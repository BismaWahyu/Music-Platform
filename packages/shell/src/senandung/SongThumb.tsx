// Cover thumbnail with micro-interactions:
//  - currently-playing track  → animated equalizer "audio wave" overlay
//  - hovered (not current)    → dark scrim + play icon
import { coverThumbFor } from './helpers'
import { PlayTriangle, EqBars } from './Icons'

interface Props {
  hue: number
  thumbnail?: string
  size: number
  current?: boolean
  playing?: boolean
  hovered?: boolean
}

export function SongThumb({ hue, thumbnail, size, current, playing, hovered }: Props) {
  const base = coverThumbFor({ hue, thumbnail }, size)
  const showEq = !!current
  const showPlay = !!hovered && !current
  const overlay = showEq || showPlay

  return (
    <div style={{ ...base, position: 'relative', overflow: 'hidden' }}>
      {overlay && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.46)', color: '#fff', transition: 'opacity 0.12s',
          }}
        >
          {showEq ? <EqBars playing={!!playing} /> : <PlayTriangle size={Math.max(12, Math.round(size * 0.34))} />}
        </div>
      )}
    </div>
  )
}
