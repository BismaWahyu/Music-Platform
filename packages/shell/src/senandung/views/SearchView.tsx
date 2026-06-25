import { useRef } from 'react'
import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import { fmt } from '../helpers'
import { SongRow } from '../SongRow'

export function SearchView() {
  const query = useSenandung((s) => s.query)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const isSearching = useSenandung((s) => s.isSearching)
  const results = useSenandung((s) => s.searchResults)
  const setQuery = useSenandung((s) => s.setQuery)
  const runSearch = useSenandung((s) => s.runSearch)
  const playSong = useSenandung((s) => s.playSong)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onType = (value: string) => {
    setQuery(value) // immediate input feedback
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void runSearch(value), 300)
  }

  const q = query.trim()

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 44px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '16px', padding: '0 16px', maxWidth: '560px', height: '50px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9398a0" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input
          value={query}
          onChange={(e) => onType(e.target.value)}
          placeholder="Cari lagu, artis, atau album"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e8e9ea', fontSize: '15px', height: '100%' }}
        />
      </div>

      {q === '' && (
        <div style={{ marginTop: '48px', textAlign: 'center', color: '#54585f', fontSize: '14px' }}>
          Ketik untuk mencari lagu di YouTube Music.
        </div>
      )}

      {q !== '' && isSearching && (
        <div style={{ marginTop: '48px', textAlign: 'center', color: '#54585f', fontSize: '14px' }}>Mencari…</div>
      )}

      {q !== '' && !isSearching && results.length === 0 && (
        <div style={{ marginTop: '48px', textAlign: 'center', color: '#54585f', fontSize: '14px' }}>Tidak ada hasil yang cocok.</div>
      )}

      {q !== '' && !isSearching && results.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px', color: '#9398a0', letterSpacing: '0.04em' }}>Lagu</h2>
          {results.map((song) => {
            const isCur = song.id === currentId
            const albumTitle = song.album?.title ?? ''
            return (
              <SongRow
                key={song.id}
                hue={hueFromId(song.id)}
                thumbnail={song.thumbnail ?? undefined}
                title={song.title}
                subtitle={`${artistName(song)}${albumTitle ? ` · ${albumTitle}` : ''}`}
                current={isCur}
                playing={isCur && isPlaying}
                onClick={() => void playSong(song, results)}
                song={song}
                trailing={song.duration ? <div style={{ fontSize: '12.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>{fmt(song.duration)}</div> : undefined}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
