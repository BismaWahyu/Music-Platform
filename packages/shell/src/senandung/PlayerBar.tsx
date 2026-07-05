import { useSenandung } from './store'
import { getTrack } from './data'
import { ACCENT, stripe, fmt } from './helpers'
import { Hover } from './Hover'
import { Slider } from './Slider'
import { Shuffle, SmartShuffle, Repeat, RepeatOne, PrevTrack, NextTrack, PauseGlyph, PlayGlyph, Lyrics, QueueList, Volume, VolumeMuted, Minimize, Check, Plus } from './Icons'

export function PlayerBar() {
  // Granular selectors so the player bar only re-renders on state it actually shows
  // (not on unrelated changes like search typing, list loads, or duration backfill).
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const progress = useSenandung((s) => s.progress)
  const volume = useSenandung((s) => s.volume)
  const shuffleMode = useSenandung((s) => s.shuffleMode)
  const repeat = useSenandung((s) => s.repeat)
  const view = useSenandung((s) => s.view)
  const queueOpen = useSenandung((s) => s.queueOpen)
  const liked = useSenandung((s) => !!s.liked[s.currentId])
  const setView = useSenandung((s) => s.setView)
  const toggleLike = useSenandung((s) => s.toggleLike)
  const toggleShuffle = useSenandung((s) => s.toggleShuffle)
  const prev = useSenandung((s) => s.prev)
  const next = useSenandung((s) => s.next)
  const togglePlay = useSenandung((s) => s.togglePlay)
  const toggleRepeat = useSenandung((s) => s.toggleRepeat)
  const setProgress = useSenandung((s) => s.setProgress)
  const toggleLyrics = useSenandung((s) => s.toggleLyrics)
  const toggleQueue = useSenandung((s) => s.toggleQueue)
  const setVolume = useSenandung((s) => s.setVolume)
  const toggleMute = useSenandung((s) => s.toggleMute)
  const setMini = useSenandung((s) => s.setMini)

  const hasCurrent = !!currentId
  const cur = getTrack(currentId)
  const duration = cur.dur
  const prog = duration > 0 ? Math.min(progress, duration) : progress
  const coverBg = cur.thumbnail
    ? { backgroundImage: `url(${cur.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: hasCurrent ? stripe(cur.hue) : 'rgba(255,255,255,0.05)' }

  return (
    <div style={{ height: '90px', flex: 'none', background: 'rgba(16,18,24,0.55)', backdropFilter: 'blur(50px) saturate(190%)', WebkitBackdropFilter: 'blur(50px) saturate(190%)', borderTop: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', padding: '0 18px' }}>
      {/* Left: track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <div onClick={() => setView('nowplaying')} style={{ width: '56px', height: '56px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', flex: 'none', cursor: 'pointer', ...coverBg }} />
        <div style={{ minWidth: 0 }}>
          <div onClick={() => setView('nowplaying')} style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', color: hasCurrent ? '#e8e9ea' : '#54585f' }}>{hasCurrent ? cur.title : 'Nothing playing'}</div>
          <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{cur.artist}</div>
        </div>
        {hasCurrent && (
          <div onClick={() => void toggleLike()} style={{ marginLeft: '6px', width: '30px', height: '30px', borderRadius: '50%', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color: liked ? ACCENT : '#9398a0', borderColor: liked ? 'oklch(0.64 0.19 256 / 0.5)' : 'rgba(255,255,255,0.14)' }}>
            {liked ? <Check /> : <Plus />}
          </div>
        )}
      </div>

      {/* Center: transport + progress */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', width: '520px', maxWidth: '46vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          <div onClick={toggleShuffle} title={shuffleMode === 'smart' ? 'Smart Shuffle: on' : shuffleMode === 'on' ? 'Shuffle: on' : 'Shuffle'} style={{ cursor: 'pointer', color: shuffleMode !== 'off' ? ACCENT : '#9398a0' }}>{shuffleMode === 'smart' ? <SmartShuffle size={16} /> : <Shuffle size={16} />}</div>
          <Hover onClick={prev} title="Previous" style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><PrevTrack size={19} /></Hover>
          <Hover onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f4f5f6', color: '#0b0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.06)' }}>
            {isPlaying ? <PauseGlyph size={14} /> : <PlayGlyph size={14} />}
          </Hover>
          <Hover onClick={next} title="Next" style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><NextTrack size={19} /></Hover>
          <div onClick={toggleRepeat} title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat queue' : 'Repeat'} style={{ cursor: 'pointer', color: repeat !== 'off' ? ACCENT : '#9398a0' }}>{repeat === 'one' ? <RepeatOne size={16} /> : <Repeat size={16} />}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%' }}>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a', width: '34px', textAlign: 'right' }}>{fmt(prog)}</span>
          <Slider value={duration > 0 ? prog / duration : 0} onChange={(f) => { if (duration > 0) setProgress(f * duration) }} />
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a', width: '34px' }}>{fmt(duration)}</span>
        </div>
      </div>

      {/* Right: lyrics, queue, volume, mini */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
        {hasCurrent && <Hover onClick={toggleLyrics} title={view === 'lyrics' ? 'Close lyrics' : 'Lyrics'} style={{ cursor: 'pointer', color: view === 'lyrics' ? ACCENT : '#9398a0' }} hover={{ color: '#e8e9ea' }}><Lyrics size={18} /></Hover>}
        <Hover onClick={toggleQueue} title="Queue" style={{ cursor: 'pointer', color: queueOpen ? ACCENT : '#9398a0' }} hover={{ color: '#e8e9ea' }}><QueueList size={18} /></Hover>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <Hover onClick={toggleMute} title={volume === 0 ? 'Unmute' : 'Mute'} style={{ display: 'flex', cursor: 'pointer', color: volume === 0 ? ACCENT : '#9398a0' }} hover={{ color: '#e8e9ea' }}>
            {volume === 0 ? <VolumeMuted size={17} /> : <Volume size={17} />}
          </Hover>
          <Slider value={volume} onChange={setVolume} color="#c8cace" containerStyle={{ width: '84px', flex: 'none' }} />
        </div>
        <Hover onClick={() => setMini(true)} title="Mini mode" style={{ cursor: 'pointer', color: '#9398a0' }} hover={{ color: '#e8e9ea' }}><Minimize size={17} /></Hover>
      </div>
    </div>
  )
}
