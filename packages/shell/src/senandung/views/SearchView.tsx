import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import { fmt } from '../helpers'
import { SongRow } from '../SongRow'
import { SkList, SkBox } from '../Skeleton'

export function SearchView() {
  const query = useSenandung((s) => s.query)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const isSearching = useSenandung((s) => s.isSearching)
  const results = useSenandung((s) => s.searchResults)
  const playSong = useSenandung((s) => s.playSong)

  const q = query.trim()

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 44px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{q ? `Results for "${q}"` : 'Search'}</h1>

      {q === '' && (
        <div style={{ marginTop: '48px', textAlign: 'center', color: '#54585f', fontSize: '14px' }}>
          Type to search songs on YouTube Music.
        </div>
      )}

      {q !== '' && isSearching && (
        <div style={{ marginTop: '32px' }}>
          <SkBox w={54} h={13} r={5} style={{ margin: '0 0 14px' }} />
          <SkList rows={8} />
        </div>
      )}

      {q !== '' && !isSearching && results.length === 0 && (
        <div style={{ marginTop: '48px', textAlign: 'center', color: '#54585f', fontSize: '14px' }}>No matching results.</div>
      )}

      {q !== '' && !isSearching && results.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px', color: '#9398a0', letterSpacing: '0.04em' }}>Songs</h2>
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
