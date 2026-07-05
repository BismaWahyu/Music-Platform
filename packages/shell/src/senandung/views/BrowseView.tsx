import { useState } from 'react'
import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import type { BackendSong } from '../data'
import { ACCENT, stripe, fmt } from '../helpers'
import { Hover } from '../Hover'
import { SongActionButton, useSongMenu } from '../SongActionMenu'
import { BrowseCarousel } from '../Browse'
import { PlayTriangle, EqBars, ChevronLeft } from '../Icons'
import { SkDetailHeader, SkList } from '../Skeleton'

function TrackRow({ song, index, current, playing, onClick }: { song: BackendSong; index: number; current: boolean; playing: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const { onContextMenu, menu } = useSongMenu(song)
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'grid', gridTemplateColumns: '30px 1fr 56px', alignItems: 'center', gap: '16px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s', background: hover ? 'rgba(255,255,255,0.045)' : 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontFamily: "'JetBrains Mono',monospace", color: hover && !current ? '#e8e9ea' : '#5d626a' }}>
        {current ? <EqBars playing={playing} /> : hover ? <PlayTriangle size={12} /> : index + 1}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: current ? ACCENT : '#e8e9ea' }}>{song.title}</div>
        <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{artistName(song)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '12.5px', fontFamily: "'JetBrains Mono',monospace", color: '#5d626a' }}>
        {hover ? <SongActionButton song={song} visible /> : (song.duration ? fmt(song.duration) : '—')}
      </div>
      {menu}
    </div>
  )
}

export function BrowseView() {
  const page = useSenandung((s) => s.browsePage)
  const ref = useSenandung((s) => s.browseRef)
  const loading = useSenandung((s) => s.browseLoading)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const playSong = useSenandung((s) => s.playSong)
  const playBrowsePage = useSenandung((s) => s.playBrowsePage)
  const goHome = useSenandung((s) => s.goHome)

  const hue = hueFromId(ref?.id ?? 'x')
  const cover = page?.thumbnail
    ? { backgroundImage: `url(${page.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: stripe(hue) }
  const round = ref?.kind === 'artist'

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 40px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '420px', background: `radial-gradient(56% 80% at 22% -8%, oklch(0.52 0.14 ${hue} / 0.5), transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '20px 42px 0' }}>
        <Hover onClick={goHome} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#9398a0', cursor: 'pointer' }} hover={{ color: '#e8e9ea' }}>
          <ChevronLeft size={15} /> Back
        </Hover>
      </div>

      {loading && !page ? (
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SkDetailHeader round={round} />
          <div style={{ padding: '0 32px' }}><SkList rows={8} /></div>
        </div>
      ) : !page ? (
        <div style={{ position: 'relative', zIndex: 1, padding: '60px 42px', color: '#54585f', fontSize: '14px' }}>Couldn't load this page.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', padding: '24px 42px 30px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '200px', height: '200px', flex: 'none', borderRadius: round ? '50%' : '12px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 50px rgba(0,0,0,0.45)', ...cover }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9398a0', fontFamily: "'JetBrains Mono',monospace" }}>{round ? 'Artist' : ref?.kind === 'playlist' ? 'Playlist' : ref?.kind === 'mood' ? 'Mood & Genre' : 'Album'}</div>
              <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 0 10px', lineHeight: 1.05 }}>{page.title}</h1>
              {page.subtitle && <div style={{ fontSize: '14px', color: '#9398a0' }}>{page.subtitle}</div>}
              {page.songs.length > 0 && (
                <Hover
                  onClick={playBrowsePage}
                  style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '9px', background: ACCENT, color: '#0b0c0e', fontSize: '14px', fontWeight: 700, padding: '11px 26px', borderRadius: '24px', cursor: 'pointer', transition: 'transform 0.15s' }}
                  hover={{ transform: 'scale(1.04)' }}
                >
                  <PlayTriangle size={13} /> Play
                </Hover>
              )}
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1, padding: '0 32px' }}>
            {page.songs.map((song, i) => (
              <TrackRow
                key={`${song.id}-${i}`}
                song={song}
                index={i}
                current={song.id === currentId}
                playing={song.id === currentId && isPlaying}
                onClick={() => void playSong(song, page.songs)}
              />
            ))}
          </div>

          {page.sections.length > 0 && (
            <div style={{ position: 'relative', zIndex: 1, padding: '30px 42px 0' }}>
              {page.sections.map((section, i) => <BrowseCarousel key={`${section.title}-${i}`} section={section} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
