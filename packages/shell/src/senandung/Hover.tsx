// Inline-style hover helper — replicates the design's `style-hover` attribute.
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface HoverProps {
  style: CSSProperties
  hover: CSSProperties
  onClick?: () => void
  children?: ReactNode
  title?: string
}

export function Hover({ style, hover, onClick, children, title }: HoverProps) {
  const [h, setH] = useState(false)
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={h ? { ...style, ...hover } : style}
    >
      {children}
    </div>
  )
}
