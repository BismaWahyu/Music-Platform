// A horizontal song list row with row-level hover driving the cover overlay.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { SongThumb } from './SongThumb'
import { SongActionButton, useSongMenu } from './SongActionMenu'
import type { BackendSong } from './data'
import { ACCENT } from './helpers'

// Empty fallback so the hook is always called (rules of hooks) even without a song.
const EMPTY = { id: '', title: '', artists: [], album: null, duration: null, thumbnail: null } as BackendSong

interface Props {
  hue: number
  thumbnail?: string
  thumbSize?: number
  title: string
  subtitle: string
  trailing?: ReactNode
  current?: boolean
  playing?: boolean
  onClick?: () => void
  song?: BackendSong
  onRemoveFromQueue?: () => void
}

export function SongRow({ hue, thumbnail, thumbSize = 40, title, subtitle, trailing, current, playing, onClick, song, onRemoveFromQueue }: Props) {
  const [hover, setHover] = useState(false)
  const { onContextMenu, menu } = useSongMenu(song ?? EMPTY, undefined, onRemoveFromQueue)
  return (
    <div
      onClick={onClick}
      onContextMenu={song ? onContextMenu : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 12px', borderRadius: '9px',
        cursor: 'pointer', transition: 'background 0.12s',
        background: hover ? 'rgba(255,255,255,0.045)' : 'transparent',
      }}
    >
      <SongThumb hue={hue} thumbnail={thumbnail} size={thumbSize} current={current} playing={playing} hovered={hover} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: current ? ACCENT : '#e8e9ea' }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{subtitle}</div>
      </div>
      {trailing}
      {song && <SongActionButton song={song} visible={hover} onRemoveFromQueue={onRemoveFromQueue} />}
      {menu}
    </div>
  )
}
