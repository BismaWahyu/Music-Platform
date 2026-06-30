import { useSenandung } from './store'
import { getTrack } from './data'
import { ACCENT, coverBigFor, fmt } from './helpers'
import { Hover } from './Hover'
import { Slider } from './Slider'
import { Expand, WinClose, PrevTrack, NextTrack, PauseGlyph, PlayGlyph } from './Icons'
import { winClose } from './window'

export function MiniPlayer() {
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const progress = useSenandung((s) => s.progress)
  const setProgress = useSenandung((s) => s.setProgress)
  const togglePlay = useSenandung((s) => s.togglePlay)
  const next = useSenandung((s) => s.next)
  const prev = useSenandung((s) => s.prev)
  const setMini = useSenandung((s) => s.setMini)

  const cur = getTrack(currentId)
  const duration = cur.dur
  const prog = duration > 0 ? Math.min(progress, duration) : progress

  const chromeBtn = { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9398a0', cursor: 'pointer' } as const

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(820px 700px at 18% 8%, oklch(0.6 0.17 256 / 0.4), transparent 55%), radial-gradient(760px 700px at 88% 96%, oklch(0.58 0.18 320 / 0.34), transparent 55%), radial-gradient(700px 640px at 60% 110%, oklch(0.6 0.15 200 / 0.3), transparent 55%), #070809', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Hanken Grotesk', sans-serif", color: '#e8e9ea' }}>
      <div style={{ width: '380px', borderRadius: '26px', background: 'rgba(20,22,28,0.5)', backdropFilter: 'blur(50px) saturate(190%)', WebkitBackdropFilter: 'blur(50px) saturate(190%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div data-tauri-drag-region style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', pointerEvents: 'none' }}>
            <div style={{ width: '11px', height: '11px', borderRadius: '3px', background: ACCENT, transform: 'rotate(45deg)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Senandung</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Hover onClick={() => setMini(false)} style={chromeBtn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }}><Expand /></Hover>
            <Hover onClick={winClose} style={chromeBtn} hover={{ background: '#e23b3b', color: '#fff' }}><WinClose /></Hover>
          </div>
        </div>
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={coverBigFor(cur, 150)}>
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>cover</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: '18px', width: '100%' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title || 'Tidak ada yang diputar'}</div>
            <div style={{ fontSize: '13px', color: '#9398a0', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.artist}</div>
          </div>
          <div style={{ width: '100%', marginTop: '18px' }}>
            <Slider value={duration > 0 ? prog / duration : 0} onChange={(f) => { if (duration > 0) setProgress(f * duration) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px', fontSize: '10.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>
              <span>{fmt(prog)}</span><span>{fmt(duration)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '26px', marginTop: '14px' }}>
            <Hover onClick={prev} title="Sebelumnya" style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><PrevTrack size={20} /></Hover>
            <Hover onClick={togglePlay} title={isPlaying ? 'Jeda' : 'Putar'} style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f4f5f6', color: '#0b0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.05)' }}>
              {isPlaying ? <PauseGlyph size={16} /> : <PlayGlyph size={16} />}
            </Hover>
            <Hover onClick={next} title="Berikutnya" style={{ cursor: 'pointer', color: '#c8cace' }} hover={{ color: '#fff' }}><NextTrack size={20} /></Hover>
          </div>
        </div>
      </div>
    </div>
  )
}
