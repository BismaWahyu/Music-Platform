import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BackendPlaylist } from './data'
import { hueFromId } from './data'
import { PlaylistCover } from './PlaylistCover'

// A compact horizontal tile: square cover (mosaic) + title. Used on Home and in the
// library hub. `cover`/`title` can be overridden for non-playlist tiles (e.g. Liked Songs).
export function Tile({ cover, title, onClick }: { cover: ReactNode; title: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '64px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', paddingRight: '12px', background: hover ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)', transition: 'background 0.15s' }}
    >
      {cover}
      <span style={{ minWidth: 0, fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
    </div>
  )
}

export function PlaylistTile({ pl, onClick }: { pl: BackendPlaylist; onClick: () => void }) {
  return (
    <Tile
      title={pl.name}
      onClick={onClick}
      cover={<PlaylistCover thumbnails={pl.covers ?? []} hue={hueFromId(pl.id)} size={64} radius="0" shadow={false} cover={pl.thumbnail} />}
    />
  )
}
