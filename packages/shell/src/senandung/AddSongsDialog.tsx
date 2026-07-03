import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'
import { searchSongs } from './backend'
import { artistName, hueFromId } from './data'
import type { BackendSong } from './data'
import { ACCENT, coverThumbFor, fmt } from './helpers'
import { Plus, Check, NavSearch, WinClose, PlayGlyph, PauseGlyph } from './Icons'

// Search YouTube Music and add results to a playlist. Stays open so several songs can be
// added in a row; already-present songs show as added.
export function AddSongsDialog({ playlistId, playlistName, existingIds, onClose }: { playlistId: string; playlistName: string; existingIds: string[]; onClose: () => void }) {
  const addSongToPlaylist = useSenandung((s) => s.addSongToPlaylist)
  const removeSongFromPlaylist = useSenandung((s) => s.removeSongFromPlaylist)
  const previewSong = useSenandung((s) => s.previewSong)
  const togglePlay = useSenandung((s) => s.togglePlay)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BackendSong[]>([])
  const [searching, setSearching] = useState(false)
  const [added, setAdded] = useState<Set<string>>(() => new Set(existingIds))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onType = (v: string) => {
    setQuery(v)
    if (timer.current) clearTimeout(timer.current)
    if (!v.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const r = (await searchSongs(v)) ?? []
      setResults(r)
      setSearching(false)
    }, 350)
  }

  // Toggle: add if not in the playlist, remove if already there.
  const toggle = (song: BackendSong) => {
    if (added.has(song.id)) {
      void removeSongFromPlaylist(playlistId, song.id)
      setAdded((prev) => { const n = new Set(prev); n.delete(song.id); return n })
    } else {
      void addSongToPlaylist(playlistId, song)
      setAdded((prev) => new Set(prev).add(song.id))
    }
  }

  const q = query.trim()
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxWidth: '92vw', height: '600px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'rgba(28,30,38,0.97)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Add songs</h2>
            <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>to "{playlistName}"</div>
          </div>
          <div onClick={onClose} title="Close" style={{ flex: 'none', color: '#9398a0', cursor: 'pointer', lineHeight: 0, padding: '4px' }}><WinClose size={14} /></div>
        </div>

        <div style={{ padding: '0 22px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '0 14px', height: '44px' }}>
            <span style={{ color: '#9398a0', display: 'flex' }}><NavSearch /></span>
            <input value={query} onChange={(e) => onType(e.target.value)} autoFocus placeholder="Search for songs to add" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#e8e9ea', fontSize: '14px' }} />
            {query && (
              <div onClick={() => onType('')} title="Clear" style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', color: '#9398a0', background: 'rgba(255,255,255,0.1)' }}><WinClose size={10} /></div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
          {q === '' ? (
            <div style={{ padding: '40px 12px', textAlign: 'center', color: '#54585f', fontSize: '13.5px' }}>Type to search for songs.</div>
          ) : searching ? (
            <div style={{ padding: '40px 12px', textAlign: 'center', color: '#54585f', fontSize: '13.5px' }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '40px 12px', textAlign: 'center', color: '#54585f', fontSize: '13.5px' }}>No results.</div>
          ) : (
            results.map((song) => {
              const isAdded = added.has(song.id)
              const isCur = currentId === song.id
              const playing = isCur && isPlaying
              return (
                <div key={song.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '9px' }}>
                  <div style={coverThumbFor({ hue: hueFromId(song.id), thumbnail: song.thumbnail ?? undefined }, 42)} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isCur ? ACCENT : '#e8e9ea' }}>{song.title}</div>
                    <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{artistName(song)}{song.duration ? ` · ${fmt(song.duration)}` : ''}</div>
                  </div>
                  <div
                    onClick={() => { if (isCur) togglePlay(); else void previewSong(song) }}
                    title={playing ? 'Pause preview' : 'Preview (max 1 min)'}
                    style={{ flex: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0b0c0e', background: '#f4f5f6' }}
                  >
                    {playing ? <PauseGlyph size={12} /> : <PlayGlyph size={12} />}
                  </div>
                  <div
                    onClick={() => toggle(song)}
                    title={isAdded ? 'Remove from playlist' : 'Add'}
                    style={{ flex: 'none', width: '32px', height: '32px', borderRadius: '50%', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isAdded ? ACCENT : '#c8cace', borderColor: isAdded ? 'oklch(0.64 0.19 256 / 0.5)' : 'rgba(255,255,255,0.16)' }}
                  >
                    {isAdded ? <Check /> : <Plus />}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
