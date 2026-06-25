import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import type { BackendSong } from '../data'
import { ACCENT, coverBig, fmt } from '../helpers'
import { Hover } from '../Hover'
import { SongActionButton } from '../SongActionMenu'
import { PlayTriangle, ShuffleArrow, EqBars } from '../Icons'

function DetailRow({ song, index, current, playing, onClick }: { song: BackendSong; index: number; current: boolean; playing: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'grid', gridTemplateColumns: '30px 1fr 180px 56px', alignItems: 'center', gap: '16px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s', background: hover ? 'rgba(255,255,255,0.045)' : 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontFamily: "'JetBrains Mono',monospace", color: hover && !current ? '#e8e9ea' : '#5d626a' }}>
        {current ? <EqBars playing={playing} /> : hover ? <PlayTriangle size={12} /> : index + 1}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: current ? ACCENT : '#e8e9ea' }}>{song.title}</div>
        <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{artistName(song)}</div>
      </div>
      <div style={{ fontSize: '13px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.album?.title ?? ''}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '12.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>
        {hover ? <SongActionButton song={song} visible /> : (song.duration ? fmt(song.duration) : '—')}
      </div>
    </div>
  )
}

export function DetailView() {
  const detail = useSenandung((s) => s.detail)
  const playlists = useSenandung((s) => s.playlists)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const playSong = useSenandung((s) => s.playSong)
  const setShuffle = useSenandung((s) => s.setShuffle)

  const pl = detail ? playlists.find((p) => p.id === detail.id) : undefined
  if (!pl) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#54585f', fontSize: '14px' }}>Daftar putar tidak ditemukan.</div>
  }

  const songs = pl.songs
  const hue = hueFromId(pl.id)
  const totalDur = songs.reduce((a, s) => a + (s.duration ?? 0), 0)
  const subtitle = `${pl.description ? pl.description + '  ·  ' : ''}${songs.length} lagu${totalDur ? ` · ${fmt(totalDur)}` : ''}`

  const glow: CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, height: '460px',
    background: `radial-gradient(56% 80% at 22% -8%, oklch(0.52 0.14 ${hue} / 0.55), transparent 70%)`,
    pointerEvents: 'none', zIndex: 0,
  }

  const onPlay = () => { if (songs.length) void playSong(songs[0], songs) }
  const onShuffle = () => {
    if (!songs.length) return
    setShuffle(true)
    // Start from a random track; playSong shuffles the rest behind it.
    void playSong(songs[Math.floor(Math.random() * songs.length)], songs)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 40px', position: 'relative' }}>
      <div style={glow} />
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', padding: '42px 42px 30px', position: 'relative', zIndex: 1 }}>
        <div style={coverBig(hue, 220)}>
          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase' }}>cover</span>
        </div>
        <div style={{ minWidth: 0, paddingBottom: '6px' }}>
          <div style={{ fontSize: '10.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9398a0', fontFamily: "'JetBrains Mono',monospace" }}>Daftar Putar</div>
          <h1 style={{ fontSize: '46px', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', margin: '12px 0 0' }}>{pl.name}</h1>
          <div style={{ fontSize: '14px', color: '#9398a0', marginTop: '16px' }}>{subtitle}</div>
          {songs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
              <Hover onClick={onPlay} style={{ display: 'flex', alignItems: 'center', gap: '9px', background: '#f4f5f6', color: '#0b0c0e', fontSize: '14px', fontWeight: 600, padding: '11px 24px', borderRadius: '24px', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.03)' }}>
                <PlayTriangle />Putar
              </Hover>
              <Hover onClick={onShuffle} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.14)', color: '#c8cace', fontSize: '13.5px', fontWeight: 500, padding: '10px 20px', borderRadius: '24px', cursor: 'pointer', transition: 'border-color 0.15s,color 0.15s' }} hover={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff' }}>
                <ShuffleArrow />Acak
              </Hover>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 42px', position: 'relative', zIndex: 1 }}>
        {songs.length === 0 ? (
          <div style={{ marginTop: '24px', color: '#54585f', fontSize: '14px' }}>Daftar putar ini masih kosong.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 180px 56px', alignItems: 'center', gap: '16px', padding: '0 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>
              <div style={{ textAlign: 'center' }}>#</div><div>Judul</div><div>Album</div><div style={{ textAlign: 'right' }}>Durasi</div>
            </div>
            <div style={{ marginTop: '6px' }}>
              {songs.map((song, i) => (
                <DetailRow
                  key={`${song.id}-${i}`}
                  song={song}
                  index={i}
                  current={song.id === currentId}
                  playing={isPlaying}
                  onClick={() => void playSong(song, songs)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
