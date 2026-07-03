import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A small, non-modal confirmation popup anchored near where it was triggered (no dimmed
// full-screen backdrop). Closes on confirm, outside click, or Escape.
export function ConfirmPopover({
  anchor, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose,
}: {
  anchor: { x: number; y: number }
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y })

  // Keep the popover fully on-screen relative to its anchor point.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.max(8, Math.min(anchor.x, window.innerWidth - w - 8))
    const top = Math.max(8, Math.min(anchor.y, window.innerHeight - h - 8))
    setPos({ left, top })
  }, [anchor.x, anchor.y])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0)
    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 2200, width: '244px',
        background: 'rgba(28,30,38,0.96)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '14px 15px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e8e9ea' }}>{title}</div>
      {message && <div style={{ fontSize: '12px', color: '#9398a0', marginTop: '6px', lineHeight: 1.45 }}>{message}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
        <div onClick={onClose} style={{ padding: '6px 13px', borderRadius: '18px', fontSize: '12.5px', cursor: 'pointer', color: '#9398a0' }}>Cancel</div>
        <div onClick={() => { onConfirm(); onClose() }} style={{ padding: '6px 15px', borderRadius: '18px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', background: danger ? '#e23b3b' : '#f4f5f6', color: danger ? '#fff' : '#0b0c0e' }}>{confirmLabel}</div>
      </div>
    </div>,
    document.body,
  )
}
