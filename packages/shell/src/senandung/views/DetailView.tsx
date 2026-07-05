import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import type { BackendSong } from '../data'
import { ACCENT, coverThumbFor, fmt } from '../helpers'
import { Hover } from '../Hover'
import { SongActionButton, useSongMenu } from '../SongActionMenu'
import { PlaylistCover, coversFromSongs } from '../PlaylistCover'
import { PlaylistEditDialog } from '../PlaylistEditDialog'
import { ConfirmPopover } from '../ConfirmPopover'
import { AddSongsDialog } from '../AddSongsDialog'
import { SkDetailHeader, SkList } from '../Skeleton'
import { PlayTriangle, ShuffleArrow, EqBars, Pencil, Trash, Plus } from '../Icons'

function DetailRow({ song, index, current, playing, onClick, playlistId }: { song: BackendSong; index: number; current: boolean; playing: boolean; onClick: () => void; playlistId: string }) {
  const [hover, setHover] = useState(false)
  const { onContextMenu, menu } = useSongMenu(song, playlistId)
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'grid', gridTemplateColumns: '24px 44px 1fr 180px 56px', alignItems: 'center', gap: '14px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s', background: hover ? 'rgba(255,255,255,0.045)' : 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontFamily: "'JetBrains Mono',monospace", color: hover && !current ? '#e8e9ea' : '#5d626a' }}>
        {current ? <EqBars playing={playing} /> : hover ? <PlayTriangle size={12} /> : index + 1}
      </div>
      <div style={coverThumbFor({ hue: hueFromId(song.id), thumbnail: song.thumbnail ?? undefined }, 40)} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: current ? ACCENT : '#e8e9ea' }}>{song.title}</div>
        <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{artistName(song)}</div>
      </div>
      <div style={{ fontSize: '13px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.album?.title ?? ''}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '12.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>
        {hover ? <SongActionButton song={song} visible playlistId={playlistId} /> : (song.duration ? fmt(song.duration) : '—')}
      </div>
      {menu}
    </div>
  )
}

export function DetailView() {
  const pl = useSenandung((s) => s.detailPlaylist)
  const loading = useSenandung((s) => s.detailLoading)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const playSong = useSenandung((s) => s.playSong)
  const setShuffle = useSenandung((s) => s.setShuffle)
  const deletePlaylist = useSenandung((s) => s.deletePlaylist)
  const touchPlaylist = useSenandung((s) => s.touchPlaylist)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmAnchor, setConfirmAnchor] = useState<{ x: number; y: number } | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  if (!pl) {
    if (loading) {
      return (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 40px' }}>
          <SkDetailHeader />
          <div style={{ padding: '0 42px' }}><SkList rows={8} /></div>
        </div>
      )
    }
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#54585f', fontSize: '14px' }}>Playlist not found.</div>
  }

  const songs = pl.songs
  const hue = hueFromId(pl.id)
  const totalDur = songs.reduce((a, s) => a + (s.duration ?? 0), 0)
  const subtitle = `${pl.description ? pl.description + '  ·  ' : ''}${songs.length} songs${totalDur ? ` · ${fmt(totalDur)}` : ''}`

  const glow: CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, height: '460px',
    background: `radial-gradient(56% 80% at 22% -8%, oklch(0.52 0.14 ${hue} / 0.55), transparent 70%)`,
    pointerEvents: 'none', zIndex: 0,
  }

  // Playing from a playlist marks it recently-played (drives the Home grid order).
  const play = (song: BackendSong) => { void touchPlaylist(pl.id); void playSong(song, songs) }
  const onPlay = () => { if (songs.length) play(songs[0]) }
  const onShuffle = () => {
    if (!songs.length) return
    setShuffle(true)
    // Start from a random track; playSong shuffles the rest behind it.
    play(songs[Math.floor(Math.random() * songs.length)])
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 40px', position: 'relative' }}>
      <div style={glow} />
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', padding: '42px 42px 30px', position: 'relative', zIndex: 1 }}>
        <PlaylistCover thumbnails={coversFromSongs(songs)} hue={hue} size={220} cover={pl.thumbnail} />
        <div style={{ minWidth: 0, paddingBottom: '6px' }}>
          <div style={{ fontSize: '10.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9398a0', fontFamily: "'JetBrains Mono',monospace" }}>Playlist</div>
          <h1 style={{ fontSize: '46px', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', margin: '12px 0 0' }}>{pl.name}</h1>
          <div style={{ fontSize: '14px', color: '#9398a0', marginTop: '16px' }}>{subtitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
            {songs.length > 0 && (
              <>
                <Hover onClick={onPlay} style={{ display: 'flex', alignItems: 'center', gap: '9px', background: '#f4f5f6', color: '#0b0c0e', fontSize: '14px', fontWeight: 600, padding: '11px 24px', borderRadius: '24px', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.03)' }}>
                  <PlayTriangle />Play
                </Hover>
                <Hover onClick={onShuffle} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.14)', color: '#c8cace', fontSize: '13.5px', fontWeight: 500, padding: '10px 20px', borderRadius: '24px', cursor: 'pointer', transition: 'border-color 0.15s,color 0.15s' }} hover={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff' }}>
                  <ShuffleArrow />Shuffle
                </Hover>
              </>
            )}
            <Hover onClick={() => setAddOpen(true)} title="Add songs" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.14)', color: '#c8cace', fontSize: '13.5px', fontWeight: 500, padding: '10px 18px', borderRadius: '24px', cursor: 'pointer' }} hover={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}><Plus />Add songs</Hover>
            <Hover onClick={() => setEditOpen(true)} title="Edit details" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8cace', cursor: 'pointer' }} hover={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}><Pencil size={17} /></Hover>
            <Hover onClick={(e) => setConfirmAnchor({ x: e.clientX, y: e.clientY })} title="Delete playlist" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8cace', cursor: 'pointer' }} hover={{ borderColor: 'oklch(0.6 0.2 25 / 0.6)', color: '#f06464' }}><Trash size={17} /></Hover>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 42px', position: 'relative', zIndex: 1 }}>
        {songs.length === 0 ? (
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ color: '#54585f', fontSize: '14px' }}>This playlist is empty.</div>
            <Hover onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f4f5f6', color: '#0b0c0e', fontSize: '14px', fontWeight: 600, padding: '11px 22px', borderRadius: '24px', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.03)' }}><Plus />Add songs</Hover>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '24px 44px 1fr 180px 56px', alignItems: 'center', gap: '14px', padding: '0 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>
              <div style={{ textAlign: 'center' }}>#</div><div></div><div>Title</div><div>Album</div><div style={{ textAlign: 'right' }}>Duration</div>
            </div>
            <div style={{ marginTop: '6px' }}>
              {songs.map((song, i) => (
                <DetailRow
                  key={`${song.id}-${i}`}
                  song={song}
                  index={i}
                  current={song.id === currentId}
                  playing={isPlaying}
                  onClick={() => play(song)}
                  playlistId={pl.id}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {addOpen && <AddSongsDialog playlistId={pl.id} playlistName={pl.name} existingIds={songs.map((s) => s.id)} onClose={() => setAddOpen(false)} />}
      {editOpen && <PlaylistEditDialog id={pl.id} name={pl.name} description={pl.description} covers={coversFromSongs(pl.songs)} cover={pl.thumbnail} onClose={() => setEditOpen(false)} />}
      {confirmAnchor && (
        <ConfirmPopover
          anchor={confirmAnchor}
          title="Delete playlist?"
          message={`"${pl.name}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => void deletePlaylist(pl.id)}
          onClose={() => setConfirmAnchor(null)}
        />
      )}
    </div>
  )
}
