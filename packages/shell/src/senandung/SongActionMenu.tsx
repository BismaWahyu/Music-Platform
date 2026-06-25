// Spotify-style "..." action menu for a song row. The kebab button appears on
// row hover; clicking opens a dropdown (rendered in a portal so it isn't clipped
// by the scroll container) with queue / playlist / library / share actions.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'
import type { BackendSong } from './data'
import { ACCENT } from './helpers'
import { Kebab, ChevronLeft, ChevronRight, Check, Plus, QueueList } from './Icons'

const MENU_WIDTH = 248

function Item({ icon, label, onClick, trailing }: { icon: ReactNode; label: string; onClick: () => void; trailing?: ReactNode }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', color: '#e8e9ea', background: hover ? 'rgba(255,255,255,0.07)' : 'transparent' }}
    >
      <span style={{ color: '#9398a0', display: 'flex', width: '18px', justifyContent: 'center' }}>{icon}</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {trailing}
    </div>
  )
}

function Menu({ song, anchor, onClose }: { song: BackendSong; anchor: { x: number; y: number }; onClose: () => void }) {
  const playlists = useSenandung((s) => s.playlists)
  const liked = useSenandung((s) => !!s.liked[song.id])
  const enqueueNext = useSenandung((s) => s.enqueueNext)
  const enqueueLast = useSenandung((s) => s.enqueueLast)
  const addSongToPlaylist = useSenandung((s) => s.addSongToPlaylist)
  const createPlaylistAndAdd = useSenandung((s) => s.createPlaylistAndAdd)
  const toggleLibrarySong = useSenandung((s) => s.toggleLibrarySong)
  const openBrowse = useSenandung((s) => s.openBrowse)

  const artistId = song.artists.find((a) => a.id)?.id
  const albumId = song.album?.id

  const [page, setPage] = useState<'main' | 'playlists'>('main')
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const left = Math.max(8, Math.min(anchor.x - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.min(anchor.y, window.innerHeight - 380)

  const wrap: CSSProperties = {
    position: 'fixed', left, top, width: MENU_WIDTH + 'px', zIndex: 1000,
    background: 'rgba(28,30,38,0.86)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '6px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
  }

  const copyLink = () => {
    const url = `https://music.youtube.com/watch?v=${song.id}`
    navigator.clipboard?.writeText(url).catch(() => {})
    onClose()
  }
  const createAndAdd = () => {
    const name = newName.trim()
    if (!name) return
    void createPlaylistAndAdd(name, song)
    onClose()
  }

  return (
    <div ref={ref} style={wrap} onClick={(e) => e.stopPropagation()}>
      {page === 'main' ? (
        <>
          <Item icon={<QueueList size={16} />} label="Tambah ke antrean" onClick={() => { enqueueLast(song); onClose() }} />
          <Item icon={<PlayNextIcon />} label="Putar berikutnya" onClick={() => { enqueueNext(song); onClose() }} />
          <Item icon={<PlaylistIcon />} label="Tambah ke daftar putar" trailing={<ChevronRight size={15} />} onClick={() => setPage('playlists')} />
          {(artistId || albumId) && <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '5px 8px' }} />}
          {artistId && <Item icon={<ArtistIcon />} label="Buka artis" onClick={() => { void openBrowse('artist', artistId); onClose() }} />}
          {albumId && <Item icon={<AlbumIcon />} label="Buka album" onClick={() => { void openBrowse('album', albumId); onClose() }} />}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '5px 8px' }} />
          <Item
            icon={liked ? <span style={{ color: ACCENT, display: 'flex' }}><Check /></span> : <Plus />}
            label={liked ? 'Hapus dari Pustaka' : 'Simpan ke Pustaka'}
            onClick={() => { void toggleLibrarySong(song); onClose() }}
          />
          <Item icon={<LinkIcon />} label="Salin tautan" onClick={copyLink} />
        </>
      ) : (
        <>
          <div onClick={() => setPage('main')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px 10px', cursor: 'pointer', color: '#9398a0', fontSize: '12px', fontWeight: 600 }}>
            <ChevronLeft size={15} /> Tambah ke daftar putar
          </div>
          <div style={{ display: 'flex', gap: '6px', padding: '0 6px 8px' }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createAndAdd() }}
              placeholder="Daftar putar baru…"
              style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 10px', color: '#e8e9ea', fontSize: '13px', outline: 'none' }}
            />
            <div onClick={createAndAdd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', background: newName.trim() ? '#f4f5f6' : 'rgba(255,255,255,0.1)', color: newName.trim() ? '#0b0c0e' : '#54585f', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'default' }}>Buat</div>
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {playlists.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '12.5px', color: '#54585f' }}>Belum ada daftar putar.</div>
            ) : (
              playlists.map((pl) => (
                <Item key={pl.id} icon={<PlaylistIcon />} label={pl.name} onClick={() => { void addSongToPlaylist(pl.id, song); onClose() }} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function SongActionButton({ song, visible }: { song: BackendSong; visible: boolean }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)

  const openMenu = (e: ReactMouseEvent) => {
    e.stopPropagation()
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ x: r.right, y: r.bottom + 6 })
    setOpen(true)
  }

  return (
    <>
      <div
        ref={btnRef}
        onClick={openMenu}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Aksi lainnya"
        style={{
          width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flex: 'none', color: hover ? '#e8e9ea' : '#9398a0',
          background: hover ? 'rgba(255,255,255,0.08)' : 'transparent',
          opacity: visible || open ? 1 : 0, transition: 'opacity 0.12s',
        }}
      >
        <Kebab />
      </div>
      {open && coords && createPortal(<Menu song={song} anchor={coords} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

// Small inline icons used only here.
const PlayNextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 13 12 5 20" fill="currentColor" stroke="none"></polygon><line x1="18" y1="5" x2="18" y2="19"></line></svg>
)
const PlaylistIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="15" y2="6"></line><line x1="3" y1="12" x2="11" y2="12"></line><line x1="3" y1="18" x2="11" y2="18"></line><line x1="17" y1="12" x2="22" y2="12"></line><line x1="19.5" y1="9.5" x2="19.5" y2="14.5"></line></svg>
)
const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
)
const ArtistIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path></svg>
)
const AlbumIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2.4"></circle></svg>
)
