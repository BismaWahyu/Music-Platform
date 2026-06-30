import { useState } from 'react'
import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import type { BackendSong } from '../data'
import { ACCENT } from '../helpers'
import { Hover } from '../Hover'
import { SongThumb } from '../SongThumb'
import { SongActionButton, useSongMenu } from '../SongActionMenu'
import { BrowseCarousel } from '../Browse'
import { PlaylistTile } from '../PlaylistTile'
import { NavSearch } from '../Icons'

function greetingText(): string {
  const hr = new Date().getHours()
  return hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 19 ? 'Selamat sore' : 'Selamat malam'
}

function LibraryCard({ song, current, playing, onClick }: { song: BackendSong; current: boolean; playing: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const { onContextMenu, menu } = useSongMenu(song)
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '16px', background: hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px) saturate(160%)', WebkitBackdropFilter: 'blur(22px) saturate(160%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '12px', cursor: 'pointer', transition: 'background 0.15s' }}
    >
      <SongThumb hue={hueFromId(song.id)} thumbnail={song.thumbnail ?? undefined} size={64} current={current} playing={playing} hovered={hover} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: current ? ACCENT : '#e8e9ea' }}>{song.title}</div>
        <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '3px' }}>{artistName(song)}</div>
      </div>
      <SongActionButton song={song} visible={hover} />
      {menu}
    </div>
  )
}

function RecentCard({ song, current, onClick }: { song: BackendSong; current: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const { onContextMenu, menu } = useSongMenu(song)
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: '150px', flex: 'none', cursor: 'pointer', padding: '10px', borderRadius: '14px', background: hover ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.15s' }}
    >
      <SongThumb hue={hueFromId(song.id)} thumbnail={song.thumbnail ?? undefined} size={130} current={current} hovered={hover} />
      <div style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: current ? ACCENT : '#e8e9ea', marginTop: '10px' }}>{song.title}</div>
      <div style={{ fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '3px' }}>{artistName(song)}</div>
      {menu}
    </div>
  )
}

export function HomeView() {
  const library = useSenandung((s) => s.library)
  const history = useSenandung((s) => s.history)
  const home = useSenandung((s) => s.home)
  const playlists = useSenandung((s) => s.playlists)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const playSong = useSenandung((s) => s.playSong)
  const openPlaylist = useSenandung((s) => s.openPlaylist)
  const setView = useSenandung((s) => s.setView)

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 48px' }}>
      <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 22px' }}>{greetingText()}</h1>

      {playlists.length > 0 && (
        <div style={{ marginBottom: '34px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '10px' }}>
            {playlists.slice(0, 6).map((pl) => (
              <PlaylistTile key={pl.id} pl={pl} onClick={() => void openPlaylist(pl.id)} />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginBottom: '34px' }}>
          <h2 style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 14px' }}>Baru diputar</h2>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', margin: '0 -10px' }}>
            {history.map((song) => (
              <RecentCard
                key={song.id}
                song={song}
                current={song.id === currentId}
                onClick={() => void playSong(song, history)}
              />
            ))}
          </div>
        </div>
      )}

      {home.map((section, i) => <BrowseCarousel key={`${section.title}-${i}`} section={section} />)}

      {library.length === 0 && history.length === 0 && home.length === 0 && playlists.length === 0 && (
        <div style={{ marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: '#9398a0' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9398a0' }}>
            <NavSearch />
          </div>
          <div style={{ fontSize: '17px', fontWeight: 600, color: '#e8e9ea', marginTop: '20px' }}>Belum ada lagu</div>
          <div style={{ fontSize: '13.5px', marginTop: '8px', maxWidth: '320px' }}>Cari lagu di YouTube Music dan sukai untuk menambahkannya ke pustaka.</div>
          <Hover
            onClick={() => setView('search')}
            style={{ marginTop: '22px', background: '#f4f5f6', color: '#0b0c0e', fontSize: '14px', fontWeight: 600, padding: '11px 24px', borderRadius: '24px', cursor: 'pointer', transition: 'transform 0.15s' }}
            hover={{ transform: 'scale(1.03)' }}
          >
            Mulai Mencari
          </Hover>
        </div>
      )}

      {library.length > 0 && (
        <>
          <h2 style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 18px' }}>Pustaka kamu</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: '14px' }}>
            {library.map((song) => (
              <LibraryCard
                key={song.id}
                song={song}
                current={song.id === currentId}
                playing={song.id === currentId && isPlaying}
                onClick={() => void playSong(song, library)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
