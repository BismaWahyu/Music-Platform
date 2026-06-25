import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import { fmt } from '../helpers'
import { SongRow } from '../SongRow'

export function LibraryView() {
  const library = useSenandung((s) => s.library)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const playSong = useSenandung((s) => s.playSong)

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 44px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Pustaka</h1>
      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#54585f', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.03em' }}>
        {library.length} LAGU
      </p>

      {library.length === 0 ? (
        <div style={{ marginTop: '56px', textAlign: 'center', color: '#54585f', fontSize: '14px' }}>
          Pustaka masih kosong. Sukai lagu dari pemutar untuk menyimpannya di sini.
        </div>
      ) : (
        <div style={{ marginTop: '28px' }}>
          {library.map((song) => {
            const isCur = song.id === currentId
            return (
              <SongRow
                key={song.id}
                hue={hueFromId(song.id)}
                thumbnail={song.thumbnail ?? undefined}
                thumbSize={44}
                title={song.title}
                subtitle={`${artistName(song)}${song.album?.title ? ` · ${song.album.title}` : ''}`}
                current={isCur}
                playing={isCur && isPlaying}
                onClick={() => void playSong(song, library)}
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
