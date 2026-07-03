import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'

// Modal to edit a playlist's name + description.
export function PlaylistEditDialog({ id, name: initName, description: initDesc, onClose }: { id: string; name: string; description?: string | null; onClose: () => void }) {
  const updatePlaylist = useSenandung((s) => s.updatePlaylist)
  const [name, setName] = useState(initName)
  const [desc, setDesc] = useState(initDesc ?? '')
  const [saving, setSaving] = useState(false)

  const canSave = !!name.trim() && !saving
  const save = async () => {
    if (!canSave) return
    setSaving(true)
    await updatePlaylist(id, name.trim(), desc.trim())
    onClose()
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '11px 14px',
    color: '#e8e9ea', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit',
  }

  return createPortal(
    <div onClick={() => { if (!saving) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '460px', maxWidth: '90vw', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 18px' }}>Edit playlist</h2>

        <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9398a0', marginBottom: '7px' }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save() }} disabled={saving} autoFocus placeholder="Playlist name" style={field} />

        <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9398a0', margin: '16px 0 7px' }}>Description</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={saving} rows={3} placeholder="Optional" style={{ ...field, resize: 'vertical' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <div onClick={() => { if (!saving) onClose() }} style={{ padding: '9px 18px', borderRadius: '22px', fontSize: '13.5px', cursor: saving ? 'default' : 'pointer', color: '#9398a0' }}>Cancel</div>
          <div onClick={save} style={{ padding: '9px 22px', borderRadius: '22px', fontSize: '13.5px', fontWeight: 600, cursor: canSave ? 'pointer' : 'default', background: canSave ? '#f4f5f6' : 'rgba(255,255,255,0.1)', color: canSave ? '#0b0c0e' : '#54585f' }}>{saving ? 'Saving…' : 'Save'}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
