import { Hover } from './Hover'
import { WinMin, WinMax, WinClose } from './Icons'
import { winMinimize, winToggleMaximize, winClose } from './window'

const btn = {
  width: '46px', height: '44px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#9398a0', cursor: 'pointer',
} as const

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: '44px', flex: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 8px 0 16px',
        background: 'rgba(18,20,26,0.5)', backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', pointerEvents: 'none' }}>
        <div style={{ width: '13px', height: '13px', borderRadius: '4px', background: 'oklch(0.64 0.19 256)', transform: 'rotate(45deg)' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em' }}>Senandung</span>
        <span style={{ fontSize: '10.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#54585f', fontFamily: "'JetBrains Mono',monospace", marginLeft: '2px' }}>Pemutar Musik</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Hover style={btn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }} onClick={winMinimize}><WinMin /></Hover>
        <Hover style={btn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }} onClick={winToggleMaximize}><WinMax /></Hover>
        <Hover style={btn} hover={{ background: '#e23b3b', color: '#ffffff' }} onClick={winClose}><WinClose /></Hover>
      </div>
    </div>
  )
}
