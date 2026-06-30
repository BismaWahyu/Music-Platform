import { useSenandung } from './store'
import { getTrack } from './data'
import { ACCENT, stripe, fmt } from './helpers'
import { Hover } from './Hover'
import { Slider } from './Slider'
import { Shuffle, Repeat, RepeatOne, PrevTrack, NextTrack, PauseGlyph, PlayGlyph, Lyrics, QueueList, Volume, Minimize, Check, Plus } from './Icons'

export function PlayerBar() {
  const s = useSenandung()
  const hasCurrent = !!s.currentId
  const cur = getTrack(s.currentId)
  const duration = cur.dur
  const prog = duration > 0 ? Math.min(s.progress, duration) : s.progress
  const liked = !!s.liked[s.currentId]
  const coverBg = cur.thumbnail
    ? { backgroundImage: `url(${cur.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: hasCurrent ? stripe(cur.hue) : 'rgba(255,255,255,0.05)' }

  return (
    <div style={{ height: '90px', flex: 'none', background: 'rgba(16,18,24,0.55)', backdropFilter: 'blur(50px) saturate(190%)', WebkitBackdropFilter: 'blur(50px) saturate(190%)', borderTop: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', padding: '0 18px' }}>
      {/* Left: track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <div onClick={() => s.setView('nowplaying')} style={{ width: '56px', height: '56px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', flex: 'none', cursor: 'pointer', ...coverBg }} />
        <div style={{ minWidth: 0 }}>
          <div onClick={() => s.setView('nowplaying')} style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', color: hasCurrent ? '#e8e9ea' : '#54585f' }}>{hasCurrent ? cur.title : 'Tidak ada yang diputar'}</div>
          <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{cur.artist}</div>
        </div>
        {hasCurrent && (
          <div onClick={() => void s.toggleLike()} style={{ marginLeft: '6px', width: '30px', height: '30px', borderRadius: '50%', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color: liked ? ACCENT : '#9398a0', borderColor: liked ? 'oklch(0.64 0.19 256 / 0.5)' : 'rgba(255,255,255,0.14)' }}>
            {liked ? <Check /> : <Plus />}
          </div>
        )}
      </div>

      {/* Center: transport + progress */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', width: '520px', maxWidth: '46vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          <div onClick={s.toggleShuffle} title={s.shuffle ? 'Acak: aktif' : 'Acak'} style={{ cursor: 'pointer', color: s.shuffle ? ACCENT : '#9398a0' }}><Shuffle size={16} /></div>
          <Hover onClick={s.prev} title="Sebelumnya" style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><PrevTrack size={19} /></Hover>
          <Hover onClick={s.togglePlay} title={s.isPlaying ? 'Jeda' : 'Putar'} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f4f5f6', color: '#0b0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.06)' }}>
            {s.isPlaying ? <PauseGlyph size={14} /> : <PlayGlyph size={14} />}
          </Hover>
          <Hover onClick={s.next} title="Berikutnya" style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><NextTrack size={19} /></Hover>
          <div onClick={s.toggleRepeat} title={s.repeat === 'one' ? 'Ulangi satu lagu' : s.repeat === 'all' ? 'Ulangi antrean' : 'Ulangi'} style={{ cursor: 'pointer', color: s.repeat !== 'off' ? ACCENT : '#9398a0' }}>{s.repeat === 'one' ? <RepeatOne size={16} /> : <Repeat size={16} />}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%' }}>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a', width: '34px', textAlign: 'right' }}>{fmt(prog)}</span>
          <Slider value={duration > 0 ? prog / duration : 0} onChange={(f) => { if (duration > 0) s.setProgress(f * duration) }} />
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a', width: '34px' }}>{fmt(duration)}</span>
        </div>
      </div>

      {/* Right: lyrics, queue, volume, mini */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
        <Hover onClick={() => s.setView('lyrics')} title="Lirik" style={{ cursor: 'pointer', color: s.view === 'lyrics' ? ACCENT : '#9398a0' }} hover={{ color: '#e8e9ea' }}><Lyrics size={18} /></Hover>
        <Hover onClick={s.toggleQueue} title="Antrean" style={{ cursor: 'pointer', color: s.queueOpen ? ACCENT : '#9398a0' }} hover={{ color: '#e8e9ea' }}><QueueList size={18} /></Hover>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }} title={`Volume ${Math.round(s.volume * 100)}%`}>
          <Volume size={17} />
          <Slider value={s.volume} onChange={s.setVolume} color="#c8cace" containerStyle={{ width: '84px', flex: 'none' }} />
        </div>
        <Hover onClick={() => s.setMini(true)} title="Mode mini" style={{ cursor: 'pointer', color: '#9398a0' }} hover={{ color: '#e8e9ea' }}><Minimize size={17} /></Hover>
      </div>
    </div>
  )
}
