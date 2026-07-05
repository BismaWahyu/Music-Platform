import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSenandung } from './store'
import type { BackendPlaylist } from './data'
import { hueFromId } from './data'
import { ACCENT } from './helpers'
import { Hover } from './Hover'
import { ImportDialog } from './ImportDialog'
import { PlaylistEditDialog } from './PlaylistEditDialog'
import { ConfirmPopover } from './ConfirmPopover'
import { PlaylistCover } from './PlaylistCover'
import { NavHome, NavLibrary, NavExplore, Plus, Kebab, Pencil, Trash } from './Icons'

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

function MenuRow({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: danger ? '#f06464' : '#e8e9ea', background: hover ? 'rgba(255,255,255,0.07)' : 'transparent' }}
    >
      <span style={{ display: 'flex', width: '16px', justifyContent: 'center', color: danger ? '#f06464' : '#9398a0' }}>{icon}</span>
      {label}
    </div>
  )
}

function PlaylistMenu({ anchor, onEdit, onDelete, onClose }: { anchor: { x: number; y: number }; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const left = Math.min(anchor.x, window.innerWidth - 184)
  const top = Math.min(anchor.y, window.innerHeight - 110)
  return createPortal(
    <div ref={ref} onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left, top, width: '172px', zIndex: 1000, background: 'rgba(28,30,38,0.92)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '5px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
      <MenuRow icon={<Pencil size={15} />} label="Edit details" onClick={onEdit} />
      <MenuRow icon={<Trash size={15} />} label="Delete" onClick={onDelete} danger />
    </div>,
    document.body,
  )
}

function PlaylistEntry({ pl, active, onOpen, onEdit, onDelete }: { pl: BackendPlaylist; active: boolean; onOpen: () => void; onEdit: () => void; onDelete: (anchor: { x: number; y: number }) => void }) {
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setMenu({ x: r.right, y: r.bottom + 4 })
  }

  return (
    <div
      onClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY }) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px 6px 8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.14s', background: hover ? 'rgba(255,255,255,0.04)' : 'transparent', color: active ? ACCENT : '#a4a8af' }}
    >
      <PlaylistCover thumbnails={pl.covers ?? []} hue={hueFromId(pl.id)} size={34} radius="6px" shadow={false} cover={pl.thumbnail} />
      <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: 450, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</span>
      <div ref={btnRef} onClick={openMenu} title="Playlist actions" style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '6px', color: '#9398a0', cursor: 'pointer', opacity: hover || menu ? 1 : 0, transition: 'opacity 0.12s' }}>
        <Kebab size={16} />
      </div>
      {menu && (
        <PlaylistMenu
          anchor={menu}
          onClose={() => setMenu(null)}
          onEdit={() => { setMenu(null); onEdit() }}
          onDelete={() => { const a = menu; setMenu(null); onDelete(a) }}
        />
      )}
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
  const deletePlaylist = useSenandung((s) => s.deletePlaylist)

  const [importOpen, setImportOpen] = useState(false)
  const [editPl, setEditPl] = useState<BackendPlaylist | null>(null)
  const [deletePl, setDeletePl] = useState<{ pl: BackendPlaylist; anchor: { x: number; y: number } } | null>(null)

  return (
    <div style={{
      width: '250px', flex: 'none', background: 'rgba(18,20,26,0.42)',
      backdropFilter: 'blur(44px) saturate(185%)', WebkitBackdropFilter: 'blur(44px) saturate(185%)',
      borderRight: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column',
      padding: '18px 12px 14px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <NavItem active={view === 'home'} icon={<NavHome />} label="Home" onClick={goHome} />
        <NavItem active={view === 'explore'} icon={<NavExplore />} label="Explore" onClick={() => setView('explore')} />
        <NavItem active={view === 'library' || view === 'liked'} icon={<NavLibrary />} label="Library" onClick={() => setView('library')} />
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px' }}>
        <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>Playlists</span>
        <Hover onClick={() => setImportOpen(true)} title="Add playlist" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '6px', cursor: 'pointer', color: '#9398a0' }} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }}><Plus /></Hover>
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {playlists.length === 0 ? (
          <div style={{ padding: '6px 12px', fontSize: '12px', color: '#54585f' }}>No playlists yet.</div>
        ) : (
          playlists.map((pl) => (
            <PlaylistEntry
              key={pl.id}
              pl={pl}
              active={view === 'detail' && detail?.id === pl.id}
              onOpen={() => void openPlaylist(pl.id)}
              onEdit={() => setEditPl(pl)}
              onDelete={(anchor) => setDeletePl({ pl, anchor })}
            />
          ))
        )}
      </div>

      {editPl && <PlaylistEditDialog id={editPl.id} name={editPl.name} description={editPl.description} covers={editPl.covers ?? []} cover={editPl.thumbnail} onClose={() => setEditPl(null)} />}
      {deletePl && (
        <ConfirmPopover
          anchor={deletePl.anchor}
          title="Delete playlist?"
          message={`"${deletePl.pl.name}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => void deletePlaylist(deletePl.pl.id)}
          onClose={() => setDeletePl(null)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px 2px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, oklch(0.6 0.1 242), oklch(0.5 0.08 280))', flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Local Library</div>
          <div style={{ fontSize: '10.5px', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>{library.length} songs</div>
        </div>
      </div>
    </div>
  )
}
