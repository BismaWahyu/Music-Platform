import type { ReactNode } from 'react'
import { useSenandung } from './store'
import { ACCENT } from './helpers'
import { Hover } from './Hover'
import { NavHome, NavLibrary, NavSearch, NavNowPlaying } from './Icons'

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px', padding: '10px 12px',
        borderRadius: '12px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 500,
        transition: 'background 0.14s,color 0.14s',
        color: active ? ACCENT : '#9398a0',
        background: active ? 'oklch(0.64 0.19 256 / 0.12)' : 'transparent',
      }}
    >
      {icon}
      {label}
    </div>
  )
}

export function Sidebar() {
  const view = useSenandung((s) => s.view)
  const detail = useSenandung((s) => s.detail)
  const playlists = useSenandung((s) => s.playlists)
  const library = useSenandung((s) => s.library)
  const setView = useSenandung((s) => s.setView)
  const goHome = useSenandung((s) => s.goHome)
  const openPlaylist = useSenandung((s) => s.openPlaylist)

  return (
    <div style={{
      width: '250px', flex: 'none', background: 'rgba(18,20,26,0.42)',
      backdropFilter: 'blur(44px) saturate(185%)', WebkitBackdropFilter: 'blur(44px) saturate(185%)',
      borderRight: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column',
      padding: '18px 12px 14px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <NavItem active={view === 'home'} icon={<NavHome />} label="Beranda" onClick={goHome} />
        <NavItem active={view === 'library'} icon={<NavLibrary />} label="Pustaka" onClick={() => setView('library')} />
        <NavItem active={view === 'search'} icon={<NavSearch />} label="Cari" onClick={() => setView('search')} />
        <NavItem active={view === 'nowplaying'} icon={<NavNowPlaying />} label="Sedang Diputar" onClick={() => setView('nowplaying')} />
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px' }}>
        <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>Daftar Putar</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {playlists.length === 0 ? (
          <div style={{ padding: '6px 12px', fontSize: '12px', color: '#54585f' }}>Belum ada daftar putar.</div>
        ) : (
          playlists.map((pl) => {
            const isOpen = view === 'detail' && detail?.id === pl.id
            return (
              <Hover
                key={pl.id}
                onClick={() => openPlaylist(pl.id)}
                style={{
                  padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px',
                  fontWeight: 450, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'background 0.14s,color 0.14s', color: isOpen ? ACCENT : '#a4a8af',
                }}
                hover={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {pl.name}
              </Hover>
            )
          })
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px 2px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, oklch(0.6 0.1 242), oklch(0.5 0.08 280))', flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pustaka Lokal</div>
          <div style={{ fontSize: '10.5px', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>{library.length} lagu</div>
        </div>
      </div>
    </div>
  )
}
