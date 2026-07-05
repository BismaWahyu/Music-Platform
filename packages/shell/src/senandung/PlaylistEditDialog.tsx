import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'
import { hueFromId } from './data'
import { PlaylistCover } from './PlaylistCover'

// Downscale a picked image to a 512×512 cover-fit JPEG data URL, so custom covers stay
// small in the DB (and load fast) regardless of the source file size.
function fileToCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode failed'))
      img.onload = () => {
        const S = 512
        const canvas = document.createElement('canvas')
        canvas.width = S; canvas.height = S
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('no canvas')); return }
        const scale = Math.max(S / img.width, S / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Modal to edit a playlist's name, description, and cover. The cover defaults to the auto
// grid built from song artwork; picking an image overrides it, "Reset to grid" reverts.
export function PlaylistEditDialog({ id, name: initName, description: initDesc, covers = [], cover: initCover, onClose }: {
  id: string; name: string; description?: string | null; covers?: string[]; cover?: string | null; onClose: () => void
}) {
  const updatePlaylist = useSenandung((s) => s.updatePlaylist)
  const [name, setName] = useState(initName)
  const [desc, setDesc] = useState(initDesc ?? '')
  const [cover, setCover] = useState<string | null>(initCover ?? null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const canSave = !!name.trim() && !saving
  const save = async () => {
    if (!canSave) return
    setSaving(true)
    await updatePlaylist(id, name.trim(), desc.trim(), cover)
    onClose()
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try { setCover(await fileToCover(f)) } catch { /* ignore bad image */ }
    e.target.value = '' // allow re-picking the same file
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '11px 14px',
    color: '#e8e9ea', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit',
  }
  const smallBtn: React.CSSProperties = {
    padding: '7px 12px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.14)', color: '#c8cace', textAlign: 'center',
  }

  return createPortal(
    <div onClick={() => { if (!saving) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '480px', maxWidth: '92vw', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 18px' }}>Edit playlist</h2>

        {/* Cover + name/description */}
        <div style={{ display: 'flex', gap: '18px' }}>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px' }}>
            <div onClick={() => { if (!saving) fileRef.current?.click() }} title="Change cover" style={{ cursor: saving ? 'default' : 'pointer', position: 'relative' }}>
              <PlaylistCover thumbnails={covers} hue={hueFromId(id)} size={112} radius="12px" cover={cover} />
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} disabled={saving} style={{ display: 'none' }} />
            <div onClick={() => { if (!saving) fileRef.current?.click() }} style={smallBtn}>Change photo</div>
            {cover && <div onClick={() => { if (!saving) setCover(null) }} style={{ fontSize: '11.5px', color: '#9398a0', cursor: 'pointer' }}>Reset to grid</div>}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9398a0', marginBottom: '7px' }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save() }} disabled={saving} autoFocus placeholder="Playlist name" style={field} />

            <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9398a0', margin: '16px 0 7px' }}>Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={saving} rows={3} placeholder="Optional" style={{ ...field, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <div onClick={() => { if (!saving) onClose() }} style={{ padding: '9px 18px', borderRadius: '22px', fontSize: '13.5px', cursor: saving ? 'default' : 'pointer', color: '#9398a0' }}>Cancel</div>
          <div onClick={save} style={{ padding: '9px 22px', borderRadius: '22px', fontSize: '13.5px', fontWeight: 600, cursor: canSave ? 'pointer' : 'default', background: canSave ? '#f4f5f6' : 'rgba(255,255,255,0.1)', color: canSave ? '#0b0c0e' : '#54585f' }}>{saving ? 'Saving…' : 'Save'}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
