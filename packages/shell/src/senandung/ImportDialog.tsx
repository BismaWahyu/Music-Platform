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
  const [helpOpen, setHelpOpen] = useState(false)
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
      {disabled && <span style={{ fontSize: '8.5px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700, color: '#0b0c0e', background: ACCENT, borderRadius: '5px', padding: '2px 5px' }}>Soon</span>}
    </div>
  )

  return createPortal(
    <div onClick={() => { if (!busy) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '460px', maxWidth: '90vw', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Add playlist</h2>

        <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '11px', marginBottom: '18px' }}>
          <Tab m="create" label="New" />
          <Tab m="csv" label="Import CSV" />
          <Tab m="spotify" label="Spotify link" disabled />
        </div>

        {mode === 'create' && (
          <>
            <p style={{ fontSize: '13px', color: '#9398a0', margin: '0 0 14px', lineHeight: 1.5 }}>Create an empty playlist, then add songs from each song's "⋯" menu.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} disabled={busy} autoFocus placeholder="Playlist name" style={field} />
          </>
        )}

        {mode === 'csv' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', margin: '0 0 14px' }}>
              <p style={{ fontSize: '13px', color: '#9398a0', margin: 0, lineHeight: 1.5 }}>Choose an exported CSV (e.g. Exportify) — <b>every song</b> is matched to YouTube Music.</p>
              <div onClick={() => setHelpOpen((v) => !v)} title="Import help" style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#0b0c0e', background: ACCENT, animation: helpOpen ? 'none' : 'helppulse 1.8s ease-in-out infinite' }}>?</div>
            </div>

            {helpOpen && (
              <div style={{ fontSize: '12.5px', color: '#b3b7bd', lineHeight: 1.65, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', margin: '0 0 14px' }}>
                <div style={{ fontWeight: 700, color: '#e8e9ea', marginBottom: '6px' }}>How to get a CSV file</div>
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  <li>Open <b>exportify.net</b> in your browser.</li>
                  <li>Click <b>Log in with Spotify</b> (free, no Premium needed).</li>
                  <li>On the playlist you want, click <b>Export</b> → download the <b>.csv</b> file.</li>
                  <li>Come back here, click the area below, and pick that CSV file.</li>
                </ol>
                <div style={{ marginTop: '8px', color: '#9398a0' }}>Columns read: <b>Track Name</b>, <b>Artist Name(s)</b>, <b>Track Duration (ms)</b>. Each song is matched via YouTube Music search — some may be missing or slightly off.</div>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
            <div onClick={() => { if (!busy) fileRef.current?.click() }} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.22)', borderRadius: '10px', padding: '14px', cursor: busy ? 'default' : 'pointer' }}>
              <div style={{ width: '34px', height: '34px', flex: 'none', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: '11px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>CSV</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', color: '#e8e9ea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{csv ? csv.name : 'Choose a CSV file…'}</div>
                <div style={{ fontSize: '12px', color: '#9398a0' }}>{csv ? 'Click to change file' : 'Click to choose'}</div>
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
              {creating ? 'Creating…' : progress && progress.total > 0 ? `Matching ${progress.done}/${progress.total} — ${progress.title}` : 'Preparing…'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <div onClick={() => { if (!busy) onClose() }} style={{ padding: '9px 18px', borderRadius: '22px', fontSize: '13.5px', cursor: busy ? 'default' : 'pointer', color: '#9398a0' }}>Cancel</div>
          <div onClick={submit} style={{ padding: '9px 22px', borderRadius: '22px', fontSize: '13.5px', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default', background: canSubmit ? '#f4f5f6' : 'rgba(255,255,255,0.1)', color: canSubmit ? '#0b0c0e' : '#54585f' }}>{busy ? 'Processing…' : mode === 'create' ? 'Create' : 'Import'}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
