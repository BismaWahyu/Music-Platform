use rodio::source::SeekError;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use crate::{Song, PlayerState};

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{Decoder as SymphoniaCodec, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::{FormatOptions, FormatReader};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

// ==================== Progressive (streaming) PCM decode ====================
//
// We decode YouTube's MP4/AAC with symphonia directly (sequential, no gapless seek)
// because rodio's built-in Decoder panics on a SeekError during init for these streams.
// Rather than decode the whole file before playing, we decode in batches: the first
// batch starts playback immediately, and the rest is decoded on a background thread and
// appended as it arrives. Audio is served from a single growing source so the reported
// position stays continuous and seeking works across the whole track.

const FIRST_BATCH_SAMPLES: usize = 32_768; // ~0.37s stereo @ 44.1k — enough to start
const REST_BATCH_SAMPLES: usize = 65_536; // one decoded segment ≈ 0.74s

/// A growing buffer of decoded interleaved i16 PCM, shared between the decode thread
/// (producer) and the playback source (consumer). Stored as immutable segments so the
/// producer never reallocates data the consumer is reading.
struct SharedPcm {
    segments: Mutex<Vec<Arc<Vec<i16>>>>,
    total_len: AtomicUsize,   // total samples decoded so far
    played: AtomicUsize,      // absolute sample index consumed (drives position)
    seek_to: AtomicI64,       // pending seek target (sample index), -1 = none
    done: AtomicBool,         // true once the whole track is decoded
    channels: u16,
    rate: u32,
}

impl SharedPcm {
    fn new(channels: u16, rate: u32) -> Self {
        Self {
            segments: Mutex::new(Vec::new()),
            total_len: AtomicUsize::new(0),
            played: AtomicUsize::new(0),
            seek_to: AtomicI64::new(-1),
            done: AtomicBool::new(false),
            channels,
            rate,
        }
    }

    fn push(&self, samples: Vec<i16>) {
        let n = samples.len();
        self.segments.lock().unwrap().push(Arc::new(samples));
        self.total_len.fetch_add(n, Ordering::Release);
    }

    fn position_ms(&self) -> u64 {
        let played = self.played.load(Ordering::Acquire) as u64;
        let denom = self.rate as u64 * self.channels.max(1) as u64;
        if denom > 0 { played * 1000 / denom } else { 0 }
    }
}

/// rodio `Source` that reads from a `SharedPcm`, honouring pending seeks and yielding
/// brief silence (rather than ending) if it ever catches up to the decoder.
struct StreamPcmSource {
    shared: Arc<SharedPcm>,
    pos: usize,            // absolute index of the next sample
    seg_idx: usize,
    seg_off: usize,
    cur: Option<Arc<Vec<i16>>>,
}

impl StreamPcmSource {
    fn new(shared: Arc<SharedPcm>) -> Self {
        let mut s = Self { shared, pos: 0, seg_idx: 0, seg_off: 0, cur: None };
        s.locate(0);
        s
    }

    /// Point the cursor at absolute sample index `target`, walking the segment list.
    fn locate(&mut self, target: usize) {
        let segs = self.shared.segments.lock().unwrap();
        let mut acc = 0usize;
        for (i, seg) in segs.iter().enumerate() {
            if target < acc + seg.len() {
                self.seg_idx = i;
                self.seg_off = target - acc;
                self.cur = Some(seg.clone());
                self.pos = target;
                return;
            }
            acc += seg.len();
        }
        // Target is beyond what's decoded so far: park at the end.
        self.seg_idx = segs.len().saturating_sub(1);
        self.seg_off = segs.last().map(|s| s.len()).unwrap_or(0);
        self.cur = segs.last().cloned();
        self.pos = acc;
    }
}

impl Iterator for StreamPcmSource {
    type Item = i16;

    fn next(&mut self) -> Option<i16> {
        let sk = self.shared.seek_to.swap(-1, Ordering::AcqRel);
        if sk >= 0 {
            self.locate(sk as usize);
        }

        // Serve from the current segment.
        if let Some(cur) = &self.cur {
            if self.seg_off < cur.len() {
                let v = cur[self.seg_off];
                self.seg_off += 1;
                self.pos += 1;
                self.shared.played.store(self.pos, Ordering::Release);
                return Some(v);
            }
        }

        // Current segment exhausted: try to advance to the next one.
        let segs = self.shared.segments.lock().unwrap();
        if self.seg_idx + 1 < segs.len() {
            self.seg_idx += 1;
            let seg = segs[self.seg_idx].clone();
            drop(segs);
            let v = seg.first().copied().unwrap_or(0);
            self.seg_off = 1;
            self.pos += 1;
            self.cur = Some(seg);
            self.shared.played.store(self.pos, Ordering::Release);
            return Some(v);
        }
        let done = self.shared.done.load(Ordering::Acquire);
        drop(segs);
        if done {
            None // genuine end of track
        } else {
            Some(0) // decoder hasn't caught up yet — brief silence, keep the stream alive
        }
    }
}

impl Source for StreamPcmSource {
    fn current_frame_len(&self) -> Option<usize> { None }
    fn channels(&self) -> u16 { self.shared.channels }
    fn sample_rate(&self) -> u32 { self.shared.rate }
    fn total_duration(&self) -> Option<Duration> { None }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let frame = (pos.as_secs_f64() * self.shared.rate as f64) as usize;
        let target = frame.saturating_mul(self.shared.channels.max(1) as usize);
        self.shared.seek_to.store(target as i64, Ordering::Release);
        Ok(())
    }
}

/// A symphonia decoder primed on a file, decoded incrementally via `decode_some`.
struct DecodeSetup {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn SymphoniaCodec>,
    track_id: u32,
    sample_buf: Option<SampleBuffer<i16>>,
    spec: Option<(u16, u32)>,
}

/// Probe `path` and create a decoder for its first decodable audio track.
fn decode_setup(path: &Path) -> Result<DecodeSetup, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open audio file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("Failed to probe audio: {}", e))?;
    let format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| "No decodable audio track".to_string())?;
    let track_id = track.id;

    let decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {}", e))?;

    Ok(DecodeSetup { format, decoder, track_id, sample_buf: None, spec: None })
}

/// Decode packets until at least `min_samples` interleaved samples are produced (or the
/// stream ends). Returns an empty Vec at end-of-stream. Updates `setup.spec` on the first
/// decoded frame so the caller can learn the channel count / sample rate.
fn decode_some(setup: &mut DecodeSetup, min_samples: usize) -> Vec<i16> {
    let mut out: Vec<i16> = Vec::with_capacity(min_samples);
    while out.len() < min_samples {
        let packet = match setup.format.next_packet() {
            Ok(p) => p,
            Err(_) => break, // IO error / end of stream
        };
        if packet.track_id() != setup.track_id {
            continue;
        }
        match setup.decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                if setup.sample_buf.is_none() {
                    setup.spec = Some((spec.channels.count() as u16, spec.rate));
                    setup.sample_buf = Some(SampleBuffer::<i16>::new(decoded.capacity() as u64, spec));
                }
                if let Some(buf) = setup.sample_buf.as_mut() {
                    buf.copy_interleaved_ref(decoded);
                    out.extend_from_slice(buf.samples());
                }
            }
            Err(SymphoniaError::DecodeError(_)) => continue, // skip a bad packet
            Err(_) => break,
        }
    }
    out
}

// ==================== Audio Player State ====================

pub struct AudioPlayer {
    _stream: OutputStream,
    stream_handle: OutputStreamHandle,
    sink: Arc<Mutex<Sink>>,
    current_song: Arc<Mutex<Option<Song>>>,
    is_playing: Arc<Mutex<bool>>,
    volume: Arc<Mutex<f32>>,
    queue: Arc<Mutex<Vec<Song>>>,
    queue_index: Arc<Mutex<usize>>,
    /// True only while a track is actually loaded on the sink. Set false during the
    /// download/decode window so the emitter doesn't mistake buffering for end-of-track.
    playback_active: Arc<Mutex<bool>>,
    /// The currently-playing track's growing PCM buffer (for position + seeking).
    current_pcm: Arc<Mutex<Option<Arc<SharedPcm>>>>,
    /// Bumped on every `play_url`; lets a stale background decoder detect it's been
    /// superseded and stop appending to a buffer that's no longer on the sink.
    generation: Arc<Mutex<u64>>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, String> {
        // Get output stream
        let (stream, stream_handle) = OutputStream::try_default()
            .map_err(|e| format!("Failed to get output stream: {}", e))?;

        // Create sink
        let sink = Sink::try_new(&stream_handle)
            .map_err(|e| format!("Failed to create sink: {}", e))?;

        Ok(Self {
            _stream: stream,
            stream_handle,
            sink: Arc::new(Mutex::new(sink)),
            current_song: Arc::new(Mutex::new(None)),
            is_playing: Arc::new(Mutex::new(false)),
            volume: Arc::new(Mutex::new(1.0)),
            queue: Arc::new(Mutex::new(Vec::new())),
            queue_index: Arc::new(Mutex::new(0)),
            playback_active: Arc::new(Mutex::new(false)),
            current_pcm: Arc::new(Mutex::new(None)),
            generation: Arc::new(Mutex::new(0)),
        })
    }

    /// Play a song from a URL: download fully, then progressively decode — start playback
    /// from the first decoded batch and decode the rest on a background thread.
    pub fn play_url(&self, url: &str, song: Song) -> Result<(), String> {
        let id = song.id.clone();

        // Stop current playback and immediately mark the new song as playing, so the
        // UI reflects the click right away (audio follows once buffered).
        {
            let sink = self.sink.lock().unwrap();
            sink.stop();
        }
        // Buffering: no track is loaded on the sink yet, so the emitter must not
        // treat the (temporarily) empty sink as a finished track.
        *self.playback_active.lock().unwrap() = false;
        *self.current_pcm.lock().unwrap() = None;
        *self.current_song.lock().unwrap() = Some(song);
        *self.is_playing.lock().unwrap() = true;
        let my_gen = { let mut g = self.generation.lock().unwrap(); *g += 1; *g };

        // Download + prime the decoder on this (background) thread. On failure, clear the
        // playing flag so the UI doesn't show a stuck "playing" state.
        let temp_path = std::env::temp_dir().join(format!("song_{}.m4a", id));
        let prepared = (|| -> Result<(Arc<SharedPcm>, DecodeSetup), String> {
            self.download_audio(url, &temp_path)?;
            let mut setup = decode_setup(&temp_path)?;
            let first = decode_some(&mut setup, FIRST_BATCH_SAMPLES);
            if first.is_empty() {
                return Err("Decoded zero audio samples".to_string());
            }
            let (channels, rate) = setup.spec.unwrap_or((2, 44_100));
            let shared = Arc::new(SharedPcm::new(channels, rate));
            shared.push(first);
            Ok((shared, setup))
        })();
        let (shared, mut setup) = match prepared {
            Ok(v) => v,
            Err(e) => {
                *self.is_playing.lock().unwrap() = false;
                let _ = std::fs::remove_file(&temp_path);
                return Err(e);
            }
        };

        // A newer play may have superseded us during the download/decode window.
        if *self.generation.lock().unwrap() != my_gen {
            drop(setup); // release the file handle before deleting (Windows locks open files)
            let _ = std::fs::remove_file(&temp_path);
            return Ok(());
        }

        {
            let sink = self.sink.lock().unwrap();
            sink.append(StreamPcmSource::new(shared.clone()));
            sink.set_volume(*self.volume.lock().unwrap());
            sink.play();
        }
        *self.current_pcm.lock().unwrap() = Some(shared.clone());
        // A track is now loaded and playing; arm end-of-track detection.
        *self.playback_active.lock().unwrap() = true;

        // Decode the remainder on a background thread, appending segments as they arrive.
        let generation = self.generation.clone();
        std::thread::spawn(move || {
            loop {
                if *generation.lock().unwrap() != my_gen {
                    break; // superseded by a newer track
                }
                let batch = decode_some(&mut setup, REST_BATCH_SAMPLES);
                if batch.is_empty() {
                    break; // end of stream
                }
                shared.push(batch);
            }
            shared.done.store(true, Ordering::Release);
            // The track is fully in memory (or was superseded); the temp file is no longer
            // needed. Drop the reader first so Windows lets us delete it.
            drop(setup);
            let _ = std::fs::remove_file(&temp_path);
        });

        Ok(())
    }

    /// Play from local file
    pub fn play_file(&self, path: &str, song: Song) -> Result<(), String> {
        let file = File::open(path)
            .map_err(|e| format!("Failed to open audio file: {}", e))?;

        let source = Decoder::new(BufReader::new(file))
            .map_err(|e| format!("Failed to decode audio: {}", e))?;

        {
            let sink = self.sink.lock().unwrap();
            sink.stop();
            sink.append(source);
            sink.set_volume(*self.volume.lock().unwrap());
        }

        *self.current_song.lock().unwrap() = Some(song);
        *self.is_playing.lock().unwrap() = true;

        Ok(())
    }

    fn download_audio(&self, url: &str, path: &std::path::Path) -> Result<(), String> {
        // googlevideo throttles/resets a single full-file download (which shows up as a
        // "request or response body error" mid-transfer). Download in ranged chunks with a
        // few retries instead — the same approach yt-dlp/NewPipe use — which is far more
        // reliable. Errors are tagged "network:" so the frontend can stop-and-show-offline.
        use std::io::Write;
        const UA: &str = "com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/132.0.6808.3)";
        const CHUNK: u64 = 4 * 1024 * 1024; // 4 MiB per request

        let client = reqwest::blocking::Client::builder()
            .user_agent(UA)
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let classify = |e: &reqwest::Error| -> String {
            if e.is_connect() || e.is_timeout() {
                format!("network: {}", e)
            } else {
                format!("Failed to download audio: {}", e)
            }
        };

        let mut file = std::fs::File::create(path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        let mut start: u64 = 0;
        loop {
            let range = format!("bytes={}-{}", start, start + CHUNK - 1);
            // Fetch one chunk, retrying transient failures a few times.
            let mut chunk: Option<Vec<u8>> = None;
            for attempt in 1..=3u32 {
                match client.get(url).header("Range", &range).send() {
                    Ok(resp) => {
                        let status = resp.status();
                        // 416 = we've requested past the end → the file is fully downloaded.
                        if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
                            chunk = Some(Vec::new());
                            break;
                        }
                        if !status.is_success() {
                            if attempt >= 3 {
                                return Err(format!("Download returned status: {}", status));
                            }
                            std::thread::sleep(Duration::from_millis(300 * attempt as u64));
                            continue;
                        }
                        match resp.bytes() {
                            Ok(b) => { chunk = Some(b.to_vec()); break; }
                            Err(e) => {
                                if attempt >= 3 { return Err(classify(&e)); }
                                std::thread::sleep(Duration::from_millis(300 * attempt as u64));
                            }
                        }
                    }
                    Err(e) => {
                        if attempt >= 3 { return Err(classify(&e)); }
                        std::thread::sleep(Duration::from_millis(300 * attempt as u64));
                    }
                }
            }
            let chunk = chunk.ok_or_else(|| "Failed to download audio".to_string())?;
            if chunk.is_empty() {
                break; // reached the end
            }
            file.write_all(&chunk).map_err(|e| format!("Failed to write file: {}", e))?;
            let n = chunk.len() as u64;
            start += n;
            if n < CHUNK {
                break; // last (partial) chunk
            }
        }

        if start == 0 {
            return Err("Downloaded zero bytes".to_string());
        }
        Ok(())
    }

    pub fn pause(&self) {
        let sink = self.sink.lock().unwrap();
        sink.pause();
        *self.is_playing.lock().unwrap() = false;
    }

    pub fn resume(&self) {
        let sink = self.sink.lock().unwrap();
        sink.play();
        *self.is_playing.lock().unwrap() = true;
    }

    pub fn toggle_playback(&self) {
        if *self.is_playing.lock().unwrap() {
            self.pause();
        } else {
            self.resume();
        }
    }

    pub fn set_volume(&self, volume: f32) {
        let vol = volume.clamp(0.0, 1.0);
        let sink = self.sink.lock().unwrap();
        sink.set_volume(vol);
        *self.volume.lock().unwrap() = vol;
    }

    pub fn seek(&self, position_ms: u64) -> Result<(), String> {
        let guard = self.current_pcm.lock().unwrap();
        let shared = guard.as_ref().ok_or("Nothing to seek")?;
        let frame = position_ms.saturating_mul(shared.rate as u64) / 1000;
        let target = frame.saturating_mul(shared.channels.max(1) as u64) as usize;
        // Clamp to what's been decoded so far (the rest may still be downloading).
        let clamped = target.min(shared.total_len.load(Ordering::Acquire));
        shared.seek_to.store(clamped as i64, Ordering::Release);
        shared.played.store(clamped, Ordering::Release);
        Ok(())
    }

    pub fn get_position(&self) -> u64 {
        self.current_pcm
            .lock()
            .unwrap()
            .as_ref()
            .map(|p| p.position_ms())
            .unwrap_or(0)
    }

    pub fn set_queue(&self, songs: Vec<Song>, start_index: usize) {
        *self.queue.lock().unwrap() = songs;
        *self.queue_index.lock().unwrap() = start_index;
    }

    pub fn add_to_queue(&self, song: Song) {
        let mut queue = self.queue.lock().unwrap();
        queue.push(song);
    }

    pub fn remove_from_queue(&self, index: usize) {
        let mut queue = self.queue.lock().unwrap();
        if index < queue.len() {
            queue.remove(index);
        }
    }

    pub fn get_queue(&self) -> Vec<Song> {
        self.queue.lock().unwrap().clone()
    }

    pub fn play_next(&self) -> Option<Song> {
        let mut queue_index = self.queue_index.lock().unwrap();
        let queue = self.queue.lock().unwrap();

        if *queue_index + 1 < queue.len() {
            *queue_index += 1;
            Some(queue[*queue_index].clone())
        } else {
            None
        }
    }

    pub fn play_previous(&self) -> Option<Song> {
        let mut queue_index = self.queue_index.lock().unwrap();
        let queue = self.queue.lock().unwrap();

        if *queue_index > 0 {
            *queue_index -= 1;
            Some(queue[*queue_index].clone())
        } else {
            None
        }
    }

    pub fn get_player_state(&self) -> PlayerState {
        PlayerState {
            is_playing: *self.is_playing.lock().unwrap(),
            current_song: self.current_song.lock().unwrap().clone(),
            position_ms: self.get_position(),
            volume: *self.volume.lock().unwrap(),
            queue: self.get_queue(),
            queue_index: *self.queue_index.lock().unwrap(),
        }
    }
}

// ==================== Audio Engine Singleton ====================

// The player owns rodio's OutputStream, which is `!Send`/`!Sync` — that's why it was a
// `static mut` before. But `static mut` accessed from multiple threads (the command threads
// + the event emitter) with no synchronization is undefined behaviour: under release LTO the
// reader threads could observe it as never-initialised, so playback failed only in release
// builds. Wrapping it in a `OnceLock` gives correct init/read ordering. The stream is only
// created once and never dropped (it lives for the process), so asserting Send+Sync is sound.
struct PlayerCell(AudioPlayer);
unsafe impl Send for PlayerCell {}
unsafe impl Sync for PlayerCell {}

static AUDIO_PLAYER: OnceLock<PlayerCell> = OnceLock::new();

pub fn init_audio_engine(_app_handle: AppHandle) {
    cleanup_temp_audio(); // remove any `song_*.m4a` left behind by a previous crash
    let player = AudioPlayer::new().expect("Failed to initialize audio player");
    let _ = AUDIO_PLAYER.set(PlayerCell(player));
}

/// Delete stray temp audio files from earlier sessions. Files still open by another running
/// instance can't be removed on Windows, so this is safe to run unconditionally.
fn cleanup_temp_audio() {
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with("song_") && name.ends_with(".m4a") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

pub fn get_player() -> &'static AudioPlayer {
    &AUDIO_PLAYER.get().expect("Audio player not initialized").0
}

// ==================== Background Thread for Events ====================

pub fn start_event_emitter(app_handle: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(500));

            if let Some(cell) = AUDIO_PLAYER.get() {
                let player = &cell.0;
                let state = player.get_player_state();

                // Emit player state update
                let _ = app_handle.emit("player-state-update", state);

                // Detect end-of-track: a track was loaded and playing, fully decoded, and
                // the sink has now drained. `playback_active` is false during buffering and
                // `done` guards the progressive-decode window, so this only fires on a
                // genuine finish (not while the track is still downloading/decoding).
                let ended = {
                    let active = *player.playback_active.lock().unwrap();
                    let done = player
                        .current_pcm
                        .lock()
                        .unwrap()
                        .as_ref()
                        .map(|p| p.done.load(Ordering::Acquire))
                        .unwrap_or(false);
                    active && done && player.sink.lock().unwrap().empty()
                };
                if ended {
                    *player.playback_active.lock().unwrap() = false;
                    *player.is_playing.lock().unwrap() = false;
                    // The frontend owns the queue/shuffle/repeat logic; it decides what
                    // (if anything) plays next when it receives this.
                    let _ = app_handle.emit("song-ended", ());
                }
            }
        }
    });
}
