import type { MouseEvent as ReactMouseEvent } from 'react'
import { useSenandung } from '../store'
import { getTrack } from '../data'
import { ACCENT, coverBigFor, fmt } from '../helpers'
import { Hover } from '../Hover'
import { Shuffle, Repeat, RepeatOne, PrevTrack, NextTrack, PauseGlyph, PlayGlyph, Lyrics } from '../Icons'

export function NowPlayingView() {
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const progress = useSenandung((s) => s.progress)
  const shuffle = useSenandung((s) => s.shuffle)
  const repeat = useSenandung((s) => s.repeat)
  const setProgress = useSenandung((s) => s.setProgress)
  const togglePlay = useSenandung((s) => s.togglePlay)
  const next = useSenandung((s) => s.next)
  const prev = useSenandung((s) => s.prev)
  const toggleShuffle = useSenandung((s) => s.toggleShuffle)
  const toggleRepeat = useSenandung((s) => s.toggleRepeat)
  const setView = useSenandung((s) => s.setView)

  const cur = getTrack(currentId)
  const duration = cur.dur
  const prog = duration > 0 ? Math.min(progress, duration) : progress
  const pct = duration > 0 ? Math.min(100, (prog / duration) * 100) : 0

  if (!currentId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#54585f', fontSize: '14px' }}>
        Tidak ada yang diputar.
      </div>
    )
  }

  const seek = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    setProgress(Math.max(0, Math.min(duration, x * duration)))
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 30px', minHeight: 0 }}>
      <div style={{ position: 'absolute', inset: '-15%', background: `radial-gradient(46% 46% at 50% 36%, oklch(0.42 0.08 ${cur.hue} / 0.5), transparent 72%)`, filter: 'blur(46px)', pointerEvents: 'none' }} />
      <div style={coverBigFor(cur, 300)}>
        <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase' }}>cover</span>
      </div>
      <div style={{ position: 'relative', textAlign: 'center', marginTop: '32px' }}>
        <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' }}>{cur.title}</div>
        <div style={{ fontSize: '15px', color: '#9398a0', marginTop: '8px' }}>{cur.artist} · {cur.album}</div>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '540px', marginTop: '30px' }}>
        <div onClick={seek} style={{ position: 'relative', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: '3px', background: ACCENT, width: pct + '%' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>
          <span>{fmt(prog)}</span><span>{fmt(duration)}</span>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '26px', marginTop: '22px' }}>
        <div onClick={toggleShuffle} style={{ cursor: 'pointer', color: shuffle ? ACCENT : '#9398a0' }}><Shuffle size={18} /></div>
        <Hover onClick={prev} style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><PrevTrack size={22} /></Hover>
        <Hover onClick={togglePlay} style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f4f5f6', color: '#0b0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.05)' }}>
          {isPlaying ? <PauseGlyph size={18} /> : <PlayGlyph size={18} />}
        </Hover>
        <Hover onClick={next} style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><NextTrack size={22} /></Hover>
        <div onClick={toggleRepeat} title={repeat === 'one' ? 'Ulangi satu lagu' : repeat === 'all' ? 'Ulangi antrean' : 'Ulangi'} style={{ cursor: 'pointer', color: repeat !== 'off' ? ACCENT : '#9398a0' }}>{repeat === 'one' ? <RepeatOne size={18} /> : <Repeat size={18} />}</div>
      </div>

      <Hover onClick={() => setView('lyrics')} style={{ position: 'relative', marginTop: '26px', fontSize: '12.5px', letterSpacing: '0.06em', color: '#9398a0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} hover={{ color: '#e8e9ea' }}>
        <Lyrics size={15} />Lihat Lirik
      </Hover>
    </div>
  )
}
