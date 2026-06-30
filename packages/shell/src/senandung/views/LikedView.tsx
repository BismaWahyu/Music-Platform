import { useSenandung } from '../store'
import { artistName, hueFromId } from '../data'
import { ACCENT, fmt } from '../helpers'
import { Hover } from '../Hover'
import { SongRow } from '../SongRow'
import { PlayTriangle, Heart, ChevronLeft } from '../Icons'

// The "Lagu Disukai" (liked/saved songs) list.
export function LikedView() {
  const library = useSenandung((s) => s.library)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const playSong = useSenandung((s) => s.playSong)
  const setView = useSenandung((s) => s.setView)

  const totalDur = library.reduce((a, s) => a + (s.duration ?? 0), 0)
  const heart = (size: number) => (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: size > 100 ? '22px' : '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, oklch(0.62 0.2 290), oklch(0.55 0.22 256))', boxShadow: size > 100 ? '0 26px 64px rgba(0,0,0,0.5)' : 'none' }}>
      <Heart size={size > 100 ? 72 : 26} />
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 40px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '420px', background: 'radial-gradient(56% 80% at 22% -8%, oklch(0.5 0.18 290 / 0.5), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '20px 42px 0' }}>
        <Hover onClick={() => setView('library')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#9398a0', cursor: 'pointer' }} hover={{ color: '#e8e9ea' }}>
          <ChevronLeft size={15} /> Pustaka
        </Hover>
      </div>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', padding: '24px 42px 30px', position: 'relative', zIndex: 1 }}>
        {heart(200)}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9398a0', fontFamily: "'JetBrains Mono',monospace" }}>Koleksi</div>
          <h1 style={{ fontSize: '46px', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.03em', margin: '12px 0 10px' }}>Lagu Disukai</h1>
          <div style={{ fontSize: '14px', color: '#9398a0' }}>{library.length} lagu{totalDur ? ` · ${fmt(totalDur)}` : ''}</div>
          {library.length > 0 && (
            <Hover onClick={() => void playSong(library[0], library)} style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '9px', background: ACCENT, color: '#0b0c0e', fontSize: '14px', fontWeight: 700, padding: '11px 26px', borderRadius: '24px', cursor: 'pointer', transition: 'transform 0.15s' }} hover={{ transform: 'scale(1.04)' }}>
              <PlayTriangle size={13} /> Putar
            </Hover>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '0 32px' }}>
        {library.length === 0 ? (
          <div style={{ padding: '24px 12px', color: '#54585f', fontSize: '14px' }}>Belum ada lagu disukai. Sukai lagu dari pemutar untuk menyimpannya di sini.</div>
        ) : (
          library.map((song) => {
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
          })
        )}
      </div>
    </div>
  )
}
