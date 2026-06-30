import type { CSSProperties } from 'react'
import { useSenandung } from './store'
import { getTrack } from './data'
import { ACCENT, stripe, fmt } from './helpers'
import { Hover } from './Hover'
import { Slider } from './Slider'
import { Expand, WinClose, PrevTrack, NextTrack, PauseGlyph, PlayGlyph } from './Icons'
import { winClose, startResize } from './window'

// Edge + corner handles that drive interactive window resize (the window is borderless,
// so it has no native resize edges).
const HANDLES: { dir: string; style: CSSProperties }[] = [
  { dir: 'North', style: { top: 0, left: 12, right: 12, height: '5px', cursor: 'ns-resize' } },
  { dir: 'South', style: { bottom: 0, left: 12, right: 12, height: '5px', cursor: 'ns-resize' } },
  { dir: 'West', style: { left: 0, top: 12, bottom: 12, width: '5px', cursor: 'ew-resize' } },
  { dir: 'East', style: { right: 0, top: 12, bottom: 12, width: '5px', cursor: 'ew-resize' } },
  { dir: 'NorthWest', style: { top: 0, left: 0, width: '13px', height: '13px', cursor: 'nwse-resize' } },
  { dir: 'NorthEast', style: { top: 0, right: 0, width: '13px', height: '13px', cursor: 'nesw-resize' } },
  { dir: 'SouthWest', style: { bottom: 0, left: 0, width: '13px', height: '13px', cursor: 'nesw-resize' } },
  { dir: 'SouthEast', style: { bottom: 0, right: 0, width: '13px', height: '13px', cursor: 'nwse-resize' } },
]

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
  const coverStyle: CSSProperties = cur.thumbnail
    ? { backgroundImage: `url(${cur.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: stripe(cur.hue) }

  const chromeBtn = { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9398a0', cursor: 'pointer' } as const

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Hanken Grotesk', sans-serif", color: '#e8e9ea' }}>
      {HANDLES.map((h) => (
        <div key={h.dir} onPointerDown={(e) => { e.preventDefault(); void startResize(h.dir) }} style={{ position: 'absolute', zIndex: 50, ...h.style }} />
      ))}
      <div style={{ width: '100%', height: '100%', borderRadius: '8px', display: 'flex', flexDirection: 'column', background: 'rgba(18,20,26,0.82)', backdropFilter: 'blur(60px) saturate(190%)', WebkitBackdropFilter: 'blur(60px) saturate(190%)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div data-tauri-drag-region style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', pointerEvents: 'none' }}>
            <div style={{ width: '11px', height: '11px', borderRadius: '3px', background: ACCENT, transform: 'rotate(45deg)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Senandung</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Hover onClick={() => setMini(false)} title="Kembali ke jendela penuh" style={chromeBtn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }}><Expand /></Hover>
            <Hover onClick={winClose} title="Tutup" style={chromeBtn} hover={{ background: '#e23b3b', color: '#fff' }}><WinClose /></Hover>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '14px 22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Cover takes the leftover space and shrinks when the window is short, so the
              controls below never get clipped. */}
          <div style={{ flex: 1, minHeight: '40px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ height: '100%', maxHeight: '210px', aspectRatio: '1 / 1', maxWidth: '100%', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 18px 44px rgba(0,0,0,0.45)', ...coverStyle }} />
          </div>
          <div style={{ textAlign: 'center', marginTop: '14px', width: '100%', flex: 'none' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title || 'Tidak ada yang diputar'}</div>
            <div style={{ fontSize: '13px', color: '#9398a0', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.artist}</div>
          </div>
          <div style={{ width: '100%', marginTop: '14px', flex: 'none' }}>
            <Slider value={duration > 0 ? prog / duration : 0} onChange={(f) => { if (duration > 0) setProgress(f * duration) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px', fontSize: '10.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>
              <span>{fmt(prog)}</span><span>{fmt(duration)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '26px', marginTop: '14px', flex: 'none' }}>
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
