// A click-and-drag slider with a thumb handle that appears on hover/drag.
// `value` and `onChange` work in fractions (0..1).
import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ACCENT } from './helpers'

interface Props {
  value: number
  onChange: (fraction: number) => void
  color?: string
  height?: number
  thumbSize?: number
  containerStyle?: CSSProperties
}

export function Slider({ value, onChange, color = ACCENT, height = 5, thumbSize = 12, containerStyle }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  const [drag, setDrag] = useState(false)
  const frac = Math.max(0, Math.min(1, value || 0))

  const fracFrom = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDrag(true)
    onChange(fracFrom(e.clientX))
    const move = (ev: PointerEvent) => onChange(fracFrom(ev.clientX))
    const up = () => {
      setDrag(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const showThumb = hover || drag
  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', height: height + 'px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', flex: 1, touchAction: 'none', ...containerStyle }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: '3px', background: color, width: frac * 100 + '%' }} />
      <div style={{ position: 'absolute', top: '50%', left: frac * 100 + '%', transform: 'translate(-50%,-50%)', width: thumbSize + 'px', height: thumbSize + 'px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 5px rgba(0,0,0,0.45)', opacity: showThumb ? 1 : 0, transition: 'opacity 0.12s', pointerEvents: 'none' }} />
    </div>
  )
}
