import { createPortal } from 'react-dom'

// Simple confirm modal. `danger` tints the confirm button red for destructive actions.
export function ConfirmDialog({ title, message, confirmLabel = 'Ya', danger, onConfirm, onClose }: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '380px', maxWidth: '90vw', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: '13px', color: '#9398a0', margin: '0 0 20px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <div onClick={onClose} style={{ padding: '9px 18px', borderRadius: '22px', fontSize: '13.5px', cursor: 'pointer', color: '#9398a0' }}>Batal</div>
          <div onClick={() => { onConfirm(); onClose() }} style={{ padding: '9px 22px', borderRadius: '22px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', background: danger ? '#e23b3b' : '#f4f5f6', color: danger ? '#fff' : '#0b0c0e' }}>{confirmLabel}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
