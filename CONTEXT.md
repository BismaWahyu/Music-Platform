# Senandung — Project Context & Handoff

> Last updated: 2026-06-25. This file is the source of truth for continuing work
> after moving the project to a new folder. Keep it updated as things change.

## 1. What this is

**Senandung** is a desktop music player (an unofficial YouTube Music client) built with:

- **Tauri 2** (Rust shell + WebView2 frontend)
- **React 18 + TypeScript + Zustand** (UI)
- **Rust** backend: InnerTube (YouTube Music) API client, audio playback (rodio + symphonia), SQLite (rusqlite)

The UI was **ported 1:1 from a Claude design artifact** and then converted to a clean,
100% backend-driven app (no mock/seed data).

### Origin / relationship to ArchiveTune
This project currently lives inside the **ArchiveTune** Android repo as the `MusicPlatform/`
subfolder. ArchiveTune is an Android YouTube Music client (Kotlin); its `core/` git
submodule is the **canonical InnerTube client**. The Rust backend here was **audited
against and rewritten to mirror** that `core` client (see §6). The Rust code does **not**
import `core` at build time — it only mirrors its protocol — so moving this folder out is
safe. (The `../../core` reference becomes documentation-only after the move.)

## 2. How to run

Prereqs: Rust (stable), Node 18+, Tauri CLI deps, WebView2 (Windows).

```bash
cd MusicPlatform
npm install                 # first time
npm run tauri:dev           # dev (opens the app window; rebuilds Rust on src-tauri changes)
npm run tauri:build         # production build
```

- Dev server runs Vite on **port 1420** (strictPort). Free that port first — the Claude
  "preview" tooling also uses 1420 and will conflict with `tauri dev`.
- `tauri dev` runs a **debug** build. The release build was fixed too (`main.rs` had an
  unquoted `windows_subsystem`).

### Verifying changes without launching the GUI
```bash
# Rust:
cd src-tauri && cargo check

# Frontend typecheck (shell only, strict — the root tsconfig is noisy, see §7):
cd packages/shell && npx tsc --noEmit --strict --noUnusedLocals --noUnusedParameters \
  --jsx react-jsx --moduleResolution bundler --module ESNext --target ES2020 \
  --lib ES2020,DOM,DOM.Iterable --skipLibCheck --types react,react-dom,node src/main.tsx

# Frontend build:
cd packages/shell && npx vite build
```

## 3. Architecture & file map

Monorepo with npm workspaces under `packages/`. **The only package is `packages/shell`**,
and the entire active UI lives in `packages/shell/src/senandung/`. (The old unused
`packages/mfe-*` / `packages/shared-*` scaffold was deleted on 2026-06-25.)

### Frontend — `packages/shell/src/`
- `App.tsx` → renders `senandung/SenandungApp`.
- `senandung/`
  - `data.ts` — types (`Track`, `BackendSong`, `BackendPlaylist`, `BackendArtist`,
    `BackendAlbum`) + **runtime track registry** (`registerSong`, `getTrack`, `hueFromId`,
    `artistName`, `EMPTY_TRACK`). No mock data.
  - `store.ts` — **Zustand store** (all app state + actions). See §4.
  - `backend.ts` — **Tauri bridge**. Every call is a safe no-op/empty in a plain browser
    (so the UI loads, just with no data). Wraps all `invoke()`s + the `player-state-update`
    event listener.
  - `window.ts` — Tauri window controls (minimize/toggle-maximize/close).
  - `helpers.ts` — `ACCENT`, `fmt`, `stripe`, cover style builders (`coverThumb/Big/Full`,
    `coverThumbFor/coverBigFor` use a real thumbnail when present, else a striped placeholder).
  - `Icons.tsx` — SVG icons + animated `EqBars` (the "audio wave").
  - `Hover.tsx` — inline-style hover helper (replicates the design's `style-hover`).
  - `SongThumb.tsx` — cover with micro-interactions: hover → play-icon overlay; current →
    equalizer overlay.
  - `SongRow.tsx` — horizontal list row (row-level hover) + embeds `SongActionButton`.
  - `SongActionMenu.tsx` — Spotify-style **"⋯" context menu** (portal dropdown): Add to
    queue / Play next / Add to playlist (+ create new) / **Go to artist/album** (when the
    song carries those browseIds) / Save-Remove library / Copy link.
  - `Browse.tsx` — `BrowseCard` + `BrowseCarousel` (reused by Home feed + browse pages).
  - `Toast.tsx` — transient notification pill (playback errors), driven by `store.toast`.
  - `TitleBar.tsx` — custom window chrome (native decorations are off, see §6).
  - `Sidebar.tsx`, `QueuePanel.tsx`, `PlayerBar.tsx`, `MiniPlayer.tsx`.
  - `SenandungApp.tsx` — root: background, title bar, sidebar, current view, queue, player
    bar, toast; on mount loads library + playlists + history + home, and subscribes to
    `player-state-update`, `song-ended` (→ `autoAdvance`), and `playback-error`.
  - `views/` — `HomeView` (recent + home carousels + library), `LibraryView`,
    `DetailView` (a DB playlist), `SearchView`, `NowPlayingView`, `LyricsView`,
    `BrowseView` (album/artist/playlist detail page).

### Backend — `src-tauri/src/`
- `main.rs` — Tauri builder. Registers commands; `setup` initializes the **DB**
  (`app_data_dir/senandung.db`), the **audio engine**, and the **event emitter**.
- `lib.rs` — shared models (`Song`, `Artist`, `Album`, `Playlist`, `PlayerState`,
  `ApiError`, …) + module declarations.
- `commands.rs` — all `#[tauri::command]`s (search, stream, lyrics, browse, playback,
  queue, playlists, library, history). `get_stream_url` returns `StreamInfo { url,
  duration }`. `play(app, url, song)` runs download/decode on a background thread (emits
  `playback-error` on failure) and upserts the song's metadata. `add_to_playlist` takes a
  full `Song`. `get_lyrics(title, artist, album?, duration?)`. Browse: `get_home() ->
  Vec<BrowseSection>`, `get_album(browseId)`/`get_artist(browseId) -> BrowsePage`. History:
  `get_history_songs(limit) -> Vec<Song>` (deduped, recent-first).
- `api/youtube.rs` — **InnerTube client** mirroring `core` (search + player + browse, §6).
- `api/lyrics.rs` — **LRCLIB client**: `fetch_lyrics` tries `/api/get` (exact:
  artist+track+album+duration) then `/api/search`; parses LRC into timestamped `LyricLine`s.
- `audio/player.rs` — **audio engine** (see §5).
- `db/schema.rs` — SQLite layer (see §8).
- `capabilities/default.json` — Tauri v2 permissions for the custom title bar
  (window minimize/maximize/toggle/close/start-dragging) + events + shell.
- `tauri.conf.json` — window: `decorations: false`, 1400×900, min 1000×600, centered.

### Design reference (in repo root of MusicPlatform)
- `Senandung.html` — the original **bundled Claude artifact** (the design source of truth).
- `design_view.html` — readable extracted markup/CSS from the artifact (reference only).

## 4. Frontend state model (store.ts)

Playback is driven by the backend; the store is reconciled via `player-state-update` events.

- **Browse/content**: `library` (`get_library`), `playlists` (`get_playlists`),
  `searchResults` (`search`), `history` (`get_history_songs`, shown as "Baru diputar"),
  `home` (`get_home`, carousel sections), `browsePage`/`browseRef`/`browseLoading` (the
  current album/artist/playlist detail page).
- **Playback**: `current` (BackendSong), `currentId`, `queue` (BackendSong[]), `isPlaying`,
  `progress` (sec), `volume`, `shuffle` (bool), `repeat` (`'off' | 'all' | 'one'`), `realMode`.
- **UI**: `view` (+`'browse'`), `detail`, `queueOpen`, `miniMode`, `query`, `liked`,
  `toast` (transient notification; `_toastSeq`/`_failStreak` are internal).

Key actions: `playSong(song, queue)`, `next`/`prev`, `autoAdvance`, `runSearch`,
`loadLibrary`, `loadPlaylists`, `loadHistory`, `loadHome`, `openBrowse(kind, id)`,
`openBrowseItem(item)`, `playBrowsePage`, `applyPlayerState`, `togglePlay`, `toggleShuffle`,
`setShuffle`, `toggleRepeat` (cycles off→all→one), `toggleLike`, `enqueueNext/Last`,
`addSongToPlaylist`, `createPlaylistAndAdd`, `toggleLibrarySong`, `showToast`,
`handlePlaybackError`.

**Playback errors**: the backend emits `playback-error {songId, message}` when download/
decode fails; `handlePlaybackError` shows a toast and skips to the next track, with a
`_failStreak` guard (reset once a track actually produces audio) so an all-failing queue
doesn't loop. A null stream URL takes the same path.

**Queue order**: `queue` is the *active* play order and `queueOriginal` is the canonical
one. Shuffle (Spotify-style) **reorders the queue**: `setShuffle(true)` shuffles the
upcoming tracks (current pinned to the front via `buildShuffled`); `setShuffle(false)`
restores `queueOriginal`. `playSong(song, list)` with a `list` starts a NEW context (sets
`queueOriginal`, applies shuffle); internal navigation calls `playSong(song)` with **no
list** to just move within the queue. The QueuePanel "Selanjutnya" reflects the real order.

**Next-track logic** lives in the module-level `pickNext(state, auto)` helper — a plain
sequential walk over the (already-shuffled) queue. `next()`/`prev()` are manual skips
(always navigate, wrap around); `autoAdvance()` runs on the backend `song-ended` event and
respects repeat (`off` → stop at end, `all` → loop, `one` → replay). `SenandungApp`
subscribes via `onSongEnded`.

**Important UX detail (Spotify-like instant play):** `applyPlayerState` **ignores events
whose `current_song.id` ≠ the selected `currentId`**, so stale events during the
download/decode window don't flip the UI back to "paused". The backend also sets
`is_playing = true` at the *start* of `play_url`.

## 5. Audio engine (audio/player.rs) — IMPORTANT gotchas

- Flow: `play` command → spawns a **background thread** → `play_url`:
  1. `download_audio` (full download with the ANDROID_VR `User-Agent`, a `Range: bytes=0-`
     header, status check, streamed `io::copy`). The download is still full (YouTube's MP4
     needs the `moov` atom to decode) — it's the dominant latency.
  2. **Progressive decode** — `decode_setup` primes a symphonia decoder; `decode_some`
     pulls packets in batches into interleaved i16 PCM. This **bypasses rodio's built-in
     `Decoder`**, which **panics** (`unreachable: Seek errors should not occur during
     initialization`) on YouTube's fragmented MP4 audio (panic in rodio 0.19 *and* 0.20).
     The **first batch** (~0.37s) starts playback immediately; the **rest is decoded on a
     background thread** and appended as it arrives — so there's no full-decode wait.
  3. Plays through a single custom `StreamPcmSource` (a `rodio::Source`) reading from a
     growing `SharedPcm` (immutable `Arc<Vec<i16>>` segments, so the producer never
     reallocates data the consumer is reading). It yields brief silence if it ever catches
     up to the decoder, and ends only when `SharedPcm.done` is set.
- **Seeking works**: `SharedPcm` tracks `played` (sample index → position) and a `seek_to`
  atomic; `player.seek(ms)` sets `seek_to` (clamped to what's decoded) and the source jumps
  on its next pull. `get_position()` reads `played` (not `sink.get_pos()`), so position is
  continuous across the progressive segments and correct after a seek.
- A `generation` counter (bumped each `play_url`) lets a stale background decoder detect
  it's been superseded and stop appending; play also re-checks generation before the first
  `sink.append` to avoid racing a newer click.
- The command returns immediately so the **UI never freezes** (a sync command would block
  the main thread during download).
- `start_event_emitter` runs a 500ms loop emitting `player-state-update` (is_playing,
  position, current song, volume).
- **Auto-advance:** the emitter emits a **`song-ended`** event when a loaded, fully-decoded
  track drains the sink (gated by `playback_active` + `SharedPcm.done` so neither the
  buffering nor the progressive-decode window is mistaken for end-of-track). The
  **frontend** owns queue/shuffle/repeat and decides what plays next (see §4). The old
  backend `play-next` self-advance was removed.
- **Limitations:** whole track is still held in memory as PCM (~30 MB/song; needed for
  seeking); time-to-first-audio is dominated by the full download. `static mut AUDIO_PLAYER`
  is used (works, technically UB).
- Format choice: `get_stream_url` prefers **audio/mp4 (AAC)** over webm/opus (symphonia
  can't decode Opus). rodio features `symphonia-aac`/`symphonia-isomp4` and symphonia
  features `aac`/`isomp4`/`mp3` are enabled in `Cargo.toml`.

## 6. InnerTube client & the ArchiveTune `core` audit

The Rust client (`api/youtube.rs`) mirrors `ArchiveTune/core`'s
`innertube/models/YouTubeClient.kt` + `innertube/InnerTube.kt`:

- **Search**: `WEB_REMIX` (clientId `67`, version `1.20260213.01.00`, Firefox UA).
- **Stream (`player`)**: `ANDROID_VR` (clientId `28`, version `1.61.48`, no
  signatureTimestamp → returns direct, unsigned stream URLs).
- **Browse** (`WEB_REMIX`): `get_home` (`browseId FEmusic_home`) → `musicCarouselShelf`
  sections of `musicTwoRowItemRenderer` cards (album/playlist/artist, by
  `pageType`) + song rows. `get_album` reads the **two-column** layout's
  `secondaryContents` (falls back to single-column for playlists); `get_artist` reads the
  single-column `musicShelfRenderer` (songs) + carousels. Returns `BrowseSection`/
  `BrowsePage`. Parsers are deliberately defensive (lots of `Option`) — they degrade to
  empty rather than crash when the JSON shape shifts.
- Header-based auth like core: `X-Goog-Api-Format-Version`, `X-YouTube-Client-Name`
  (= clientId), `X-YouTube-Client-Version`, `X-Origin`, `Referer`, `X-Goog-Visitor-Id`,
  `User-Agent`, `?prettyPrint=false`. **No legacy `?key=`.**
- All response structs use `#[serde(rename_all = "camelCase")]` (the original code lacked
  this, so parsing silently failed).
- `visitorData` is fetched once from the YT Music homepage and cached in a
  `tokio::sync::OnceCell` (falls back to a placeholder).
- `StreamInfo.duration` comes from the player response `videoDetails.lengthSeconds`;
  search results also parse duration from `fixedColumns`.

**If search/playback/browse breaks**, YouTube likely changed its JSON shape or client
versions — re-check `core`'s `YouTubeClient.kt` for current client versions and adjust, or
capture the failing response and update the parser. Browse parsing especially is the most
likely to drift; it has NOT yet been validated against live responses in the GUI.

## 7. Known issues / gotchas

- **DB schema**: the DB is created fresh on first run (it was never initialized before
  2026-06-25, so there's no legacy DB to migrate). If you change the schema and a
  `senandung.db` already exists, you may need to delete it from the app data dir.
- **Lyrics**: fetched live from LRCLIB each time the LyricsView opens (no caching yet); a
  "not found" error is normal and shows the empty state. Synced lyrics highlight + click-to-
  seek the active line. Could be cached in the DB later.
- **History**: surfaced on Home as "Baru diputar" (`get_history_songs`, deduped). Not yet
  on a dedicated page or clearable from the UI.
- **Browse**: home/album/artist pages are wired but **unverified against live JSON** — if a
  feed renders empty, capture the `browse` response and adjust the parser in `youtube.rs`.
- **Window resize**: borderless window (`decorations:false`) may lose edge-resize on
  Windows; maximize button works. Add CSS resize handles + `startResizeDragging` if needed.
- `.claude/launch.json` exists at the ArchiveTune root and in `packages/shell/.claude/` —
  only used by the Claude preview tool; harmless.

## 8. Database (db/schema.rs)

SQLite at `app_data_dir/senandung.db`. Tables:
- `songs` — metadata cache (id, title, artists_json, album_json, thumbnail, duration).
  Upserted by `add_to_library`, `add_song_to_playlist`, and `play`. **Referenced by FK** from
  `library` and `history` (the original schema referenced a non-existent `songs` table — fixed).
- `playlists`, `playlist_songs` (junction). `get_playlist_songs` JOINs `songs` for metadata
  (it used to return placeholder "Cached Song").
- `library` (liked/saved songs, full metadata), `history`, `settings`.
- `get_history_songs(limit)` JOINs `history`→`songs`, `GROUP BY song_id` with
  `MAX(played_at)` so each track appears once, newest-first ("Baru diputar").

## 9. Recent work log (2026-06-25)

1. Ported the Claude design 1:1 into React components.
2. Audited the Rust BE vs ArchiveTune `core`; rewrote `youtube.rs` to mirror it.
3. Wired the FE to the backend (search + playback + library/playlists/history).
4. Removed **all** mock/dummy data → clean, backend-driven app with empty states.
5. Removed the duplicate native title bar (`decorations: false`) + added Tauri
   `capabilities` for the custom title bar.
6. Fixed playback: non-blocking `play`, started the event emitter, real duration + visitor
   data, robust download, and the **symphonia-direct decode** that avoids rodio's panic.
7. Spotify-like instant-play UX (event gating + early `is_playing`).
8. Micro-interactions: hover play-overlay + playing equalizer on covers.
9. Song **"⋯" action menu** (queue/playlist/library/share) + **fixed the DB** (it was never
   initialized; playlists/library never persisted).
10. **Auto-advance + shuffle/repeat** (2026-06-25): backend emits `song-ended` (gated by a
   `playback_active` flag, so buffering isn't mistaken for end-of-track); FE `autoAdvance`
   plays the next track. Repeat is now 3-state (off/all/one) with a `RepeatOne` icon.
11. **Spotify-style shuffle** (2026-06-25): shuffle reorders the queue (`queue` vs
   `queueOriginal`, `buildShuffled`, `setShuffle`); next-track logic centralized in `pickNext`.
12. **Seeking + progressive decode** (2026-06-25): single growing `StreamPcmSource` over
   segmented `SharedPcm`; first batch starts playback, rest decodes in background; seek via
   `seek_to` atomic; position from `played`. See §5.
13. **Lyrics via LRCLIB** (2026-06-25): `api/lyrics.rs` + `get_lyrics` command; `LyricsView`
   shows synced (highlight + click-to-seek) or plain lyrics. See §3.
14. **Deleted the unused `packages/mfe-*` / `shared-*` scaffold** (2026-06-25); `npm run
   build` (= `tsc && vite build`) now runs cleanly.
15. **History surfaced** (2026-06-25): `get_history_songs` + "Baru diputar" row on Home.
16. **Playback error handling** (2026-06-25): backend `playback-error` event → `Toast` +
   auto-skip with a fail-streak guard.
17. **Browse** (2026-06-25): InnerTube `browse` client (`get_home`/`get_album`/`get_artist`)
   + home carousels, `BrowseView` (album/artist/playlist pages), and "Go to artist/album"
   in the song menu. **Parsers unverified against live JSON** — see §6/§7.

## 10. Suggested next steps

- **Verify in the GUI** — the audio engine rewrite (§5) and all of Browse (§6) are
  compile-verified only; run `npm run tauri:dev` and confirm playback/seek/browse with real
  responses, then tune the browse parsers if any feed renders empty.
- **Sleep timer** (client-side, easy).
- **Lyrics caching** in the DB (currently re-fetched from LRCLIB each open).
- **True HTTP streaming** (decode-as-download) for lower latency/memory — deferred; risky
  with YouTube's MP4 `moov`-atom placement and harder to seek (see §5).
- Add a real `visitorData` refresh + retry/fallback player clients (e.g. ANDROID_MUSIC/WEB)
  if ANDROID_VR streams start failing.
