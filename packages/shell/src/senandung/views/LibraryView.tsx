import { useSenandung } from '../store'
import { Tile, PlaylistTile } from '../PlaylistTile'
import { Heart } from '../Icons'

// Library hub: Liked Songs + the user's playlists.
export function LibraryView() {
  const library = useSenandung((s) => s.library)
  const playlists = useSenandung((s) => s.playlists)
  const setView = useSenandung((s) => s.setView)
  const openPlaylist = useSenandung((s) => s.openPlaylist)

  const heartCover = (
    <div style={{ width: 64, height: 64, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, oklch(0.62 0.2 290), oklch(0.55 0.22 256))' }}>
      <Heart size={26} />
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 44px' }}>
      <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 22px' }}>Pustaka</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '10px' }}>
        <Tile cover={heartCover} title={`Lagu Disukai · ${library.length}`} onClick={() => setView('liked')} />
        {playlists.map((pl) => (
          <PlaylistTile key={pl.id} pl={pl} onClick={() => void openPlaylist(pl.id)} />
        ))}
      </div>

      {playlists.length === 0 && library.length === 0 && (
        <div style={{ marginTop: '40px', fontSize: '13.5px', color: '#54585f' }}>Sukai lagu atau impor playlist untuk mengisi pustakamu.</div>
      )}
    </div>
  )
}
