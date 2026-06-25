import { useState } from 'react'
import { useSenandung } from './store'
import { hueFromId } from './data'
import { ACCENT, stripe } from './helpers'
import { PlayTriangle } from './Icons'
import type { BrowseItem, BrowseSection } from './backend'

// A single browse card (album/playlist/artist/song). Artists render as a circle.
export function BrowseCard({ item }: { item: BrowseItem }) {
  const openBrowseItem = useSenandung((s) => s.openBrowseItem)
  const currentId = useSenandung((s) => s.currentId)
  const [hover, setHover] = useState(false)
  const round = item.kind === 'artist'
  const isCurrent = item.kind === 'song' && item.id === currentId

  const cover = item.thumbnail
    ? { backgroundImage: `url(${item.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: stripe(hueFromId(item.id)) }

  return (
    <div
      onClick={() => openBrowseItem(item)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: '160px', flex: 'none', cursor: 'pointer', padding: '10px', borderRadius: '14px', background: hover ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.15s' }}
    >
      <div style={{ position: 'relative', width: '140px', height: '140px', borderRadius: round ? '50%' : '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', ...cover }}>
        {hover && (
          <div style={{ position: 'absolute', right: '8px', bottom: '8px', width: '38px', height: '38px', borderRadius: '50%', background: ACCENT, color: '#0b0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}>
            <PlayTriangle size={14} />
          </div>
        )}
      </div>
      <div style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isCurrent ? ACCENT : '#e8e9ea', marginTop: '10px', textAlign: round ? 'center' : 'left' }}>{item.title}</div>
      {item.subtitle && (
        <div style={{ fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '3px', textAlign: round ? 'center' : 'left' }}>{item.subtitle}</div>
      )}
    </div>
  )
}

// A titled, horizontally-scrolling row of browse cards.
export function BrowseCarousel({ section }: { section: BrowseSection }) {
  if (!section.items.length) return null
  return (
    <div style={{ marginBottom: '30px' }}>
      {section.title && <h2 style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 12px' }}>{section.title}</h2>}
      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', margin: '0 -10px' }}>
        {section.items.map((item, i) => <BrowseCard key={`${item.id}-${i}`} item={item} />)}
      </div>
    </div>
  )
}
