import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'
import { ACCENT } from './helpers'

type Mode = 'create' | 'csv' | 'spotify'

// "Tambah daftar putar" dialog: create an empty playlist, import a CSV, or (soon) a
// Spotify link.
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const importing = useSenandung((s) => s.importing)
  const progress = useSenandung((s) => s.importProgress)
  const importCsv = useSenandung((s) => s.importCsv)
  const createPlaylist = useSenandung((s) => s.createPlaylist)

  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [csv, setCsv] = useState<{ name: string; content: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const content = await f.text()
    setCsv({ name: f.name.replace(/\.csv$/i, ''), content })
  }

  const busy = importing || creating
  const canSubmit = mode === 'create' ? (!!name.trim() && !busy) : mode === 'csv' ? (!!csv && !busy) : false
  const submit = async () => {
    if (!canSubmit) return
    if (mode === 'create') {
      setCreating(true)
      await createPlaylist(name.trim())
      onClose()
    } else if (mode === 'csv' && csv) {
      const ok = await importCsv(csv.name, csv.content)
      if (ok) onClose()
    }
  }
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '11px 14px',
    color: '#e8e9ea', fontSize: '13.5px', outline: 'none',
  }
  const Tab = ({ m, label, disabled }: { m: Mode; label: string; disabled?: boolean }) => (
    <div
      onClick={() => { if (!disabled && !busy) setMode(m) }}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 0', borderRadius: '8px', cursor: disabled || busy ? 'default' : 'pointer', fontSize: '12.5px', fontWeight: 600, opacity: disabled ? 0.55 : 1, color: mode === m ? '#0b0c0e' : '#9398a0', background: mode === m ? '#f4f5f6' : 'transparent', transition: 'background 0.15s, color 0.15s' }}
    >
      {label}
      {disabled && <span style={{ fontSize: '8.5px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700, color: '#0b0c0e', background: ACCENT, borderRadius: '5px', padding: '2px 5px' }}>Segera</span>}
    </div>
  )

  return createPortal(
    <div onClick={() => { if (!busy) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '460px', maxWidth: '90vw', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Tambah daftar putar</h2>

        <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '11px', marginBottom: '18px' }}>
          <Tab m="create" label="Buat Baru" />
          <Tab m="csv" label="Import CSV" />
          <Tab m="spotify" label="Link Spotify" disabled />
        </div>

        {mode === 'create' && (
          <>
            <p style={{ fontSize: '13px', color: '#9398a0', margin: '0 0 14px', lineHeight: 1.5 }}>Buat daftar putar kosong, lalu tambahkan lagu lewat menu "⋯" tiap lagu.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} disabled={busy} autoFocus placeholder="Nama daftar putar" style={field} />
          </>
        )}

        {mode === 'csv' && (
          <>
            <p style={{ fontSize: '13px', color: '#9398a0', margin: '0 0 14px', lineHeight: 1.5 }}>Pilih file CSV hasil ekspor (mis. Exportify) — <b>seluruh lagu</b> dicocokkan ke YouTube Music.</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
            <div onClick={() => { if (!busy) fileRef.current?.click() }} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.22)', borderRadius: '10px', padding: '14px', cursor: busy ? 'default' : 'pointer' }}>
              <div style={{ width: '34px', height: '34px', flex: 'none', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: '11px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>CSV</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', color: '#e8e9ea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{csv ? csv.name : 'Pilih file CSV…'}</div>
                <div style={{ fontSize: '12px', color: '#9398a0' }}>{csv ? 'Klik untuk ganti file' : 'Klik untuk memilih'}</div>
              </div>
            </div>
          </>
        )}

        {busy && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (creating ? 100 : pct) + '%', background: ACCENT, transition: 'width 0.2s' }} />
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {creating ? 'Membuat…' : progress && progress.total > 0 ? `Mencocokkan ${progress.done}/${progress.total} — ${progress.title}` : 'Menyiapkan…'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <div onClick={() => { if (!busy) onClose() }} style={{ padding: '9px 18px', borderRadius: '22px', fontSize: '13.5px', cursor: busy ? 'default' : 'pointer', color: '#9398a0' }}>Batal</div>
          <div onClick={submit} style={{ padding: '9px 22px', borderRadius: '22px', fontSize: '13.5px', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default', background: canSubmit ? '#f4f5f6' : 'rgba(255,255,255,0.1)', color: canSubmit ? '#0b0c0e' : '#54585f' }}>{busy ? 'Memproses…' : mode === 'create' ? 'Buat' : 'Impor'}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
