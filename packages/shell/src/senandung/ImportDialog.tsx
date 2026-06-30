import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'
import { ACCENT } from './helpers'

type Mode = 'link' | 'csv'

// Modal to import a playlist — either by a public Spotify link (≤100 tracks) or from a CSV
// export like Exportify (full track list).
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const importing = useSenandung((s) => s.importing)
  const progress = useSenandung((s) => s.importProgress)
  const importSpotify = useSenandung((s) => s.importSpotify)
  const importCsv = useSenandung((s) => s.importCsv)

  const [mode, setMode] = useState<Mode>('link')
  const [url, setUrl] = useState('')
  const [csv, setCsv] = useState<{ name: string; content: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const content = await f.text()
    setCsv({ name: f.name.replace(/\.csv$/i, ''), content })
  }

  const canSubmit = !importing && (mode === 'link' ? !!url.trim() : !!csv)
  const submit = async () => {
    if (!canSubmit) return
    const ok = mode === 'link' ? await importSpotify(url.trim()) : await importCsv(csv!.name, csv!.content)
    if (ok) onClose()
  }
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const tab = (m: Mode): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: '8px', cursor: importing ? 'default' : 'pointer',
    fontSize: '13px', fontWeight: 600, color: mode === m ? '#0b0c0e' : '#9398a0',
    background: mode === m ? '#f4f5f6' : 'transparent', transition: 'background 0.15s, color 0.15s',
  })

  return createPortal(
    <div onClick={() => { if (!importing) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '460px', maxWidth: '90vw', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Impor playlist</h2>

        <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '11px', marginBottom: '18px' }}>
          <div onClick={() => !importing && setMode('link')} style={tab('link')}>Link Spotify</div>
          <div onClick={() => !importing && setMode('csv')} style={tab('csv')}>File CSV</div>
        </div>

        {mode === 'link' ? (
          <>
            <p style={{ fontSize: '13px', color: '#9398a0', margin: '0 0 14px', lineHeight: 1.5 }}>Tempel link playlist <b>publik</b> Spotify (Share → Copy link). Maks 100 lagu.</p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
              disabled={importing}
              autoFocus
              placeholder="https://open.spotify.com/playlist/..."
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '11px 14px', color: '#e8e9ea', fontSize: '13.5px', outline: 'none' }}
            />
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: '#9398a0', margin: '0 0 14px', lineHeight: 1.5 }}>Pilih file CSV hasil ekspor (mis. Exportify) — <b>seluruh lagu</b> ikut, tanpa batas 100.</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={importing} style={{ display: 'none' }} />
            <div
              onClick={() => { if (!importing) fileRef.current?.click() }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.22)', borderRadius: '10px', padding: '14px', cursor: importing ? 'default' : 'pointer' }}
            >
              <div style={{ width: '34px', height: '34px', flex: 'none', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: '11px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>CSV</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', color: '#e8e9ea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{csv ? csv.name : 'Pilih file CSV…'}</div>
                <div style={{ fontSize: '12px', color: '#9398a0' }}>{csv ? 'Klik untuk ganti file' : 'Klik untuk memilih'}</div>
              </div>
            </div>
          </>
        )}

        {importing && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: ACCENT, transition: 'width 0.2s' }} />
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {progress && progress.total > 0 ? `Mencocokkan ${progress.done}/${progress.total} — ${progress.title}` : 'Menyiapkan…'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <div onClick={() => { if (!importing) onClose() }} style={{ padding: '9px 18px', borderRadius: '22px', fontSize: '13.5px', cursor: importing ? 'default' : 'pointer', color: '#9398a0' }}>Batal</div>
          <div onClick={submit} style={{ padding: '9px 22px', borderRadius: '22px', fontSize: '13.5px', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default', background: canSubmit ? '#f4f5f6' : 'rgba(255,255,255,0.1)', color: canSubmit ? '#0b0c0e' : '#54585f' }}>{importing ? 'Mengimpor…' : 'Impor'}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
