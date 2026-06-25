import { useSenandung } from './store'

// Transient notification pill (e.g. playback errors), shown above the player bar.
export function Toast() {
  const toast = useSenandung((s) => s.toast)
  if (!toast) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: '108px', transform: 'translateX(-50%)', zIndex: 1000, pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(30,32,40,0.92)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '11px 18px',
        fontSize: '13.5px', color: '#e8e9ea', maxWidth: '440px', textAlign: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}>
        {toast}
      </div>
    </div>
  )
}
