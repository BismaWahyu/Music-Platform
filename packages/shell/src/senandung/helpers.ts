// Visual helpers ported 1:1 from the Senandung design artifact.
import type { CSSProperties } from 'react'

export const ACCENT = 'oklch(0.64 0.19 256)'

export function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

// Diagonal striped placeholder "cover art", tinted per album hue.
export function stripe(hue: number): string {
  return `repeating-linear-gradient(135deg, oklch(0.325 0.05 ${hue}) 0 11px, oklch(0.265 0.042 ${hue}) 11px 22px)`
}

export function coverFull(hue: number): CSSProperties {
  return {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '16px',
    background: stripe(hue),
    border: '1px solid rgba(255,255,255,0.06)',
  }
}

export function coverThumb(hue: number, px: number): CSSProperties {
  return {
    width: px + 'px',
    height: px + 'px',
    borderRadius: '10px',
    background: stripe(hue),
    border: '1px solid rgba(255,255,255,0.06)',
    flex: 'none',
  }
}

export function coverBig(hue: number, px: number): CSSProperties {
  return {
    width: px + 'px',
    height: px + 'px',
    borderRadius: '22px',
    background: stripe(hue),
    border: '1px solid rgba(255,255,255,0.07)',
    boxShadow: '0 26px 64px rgba(0,0,0,0.5)',
    position: 'relative',
    flex: 'none',
  }
}

interface CoverLike { hue: number; thumbnail?: string }

// Cover variants that use a real thumbnail image when present, else the striped placeholder.
export function coverThumbFor(t: CoverLike, px: number): CSSProperties {
  if (t.thumbnail) {
    return {
      width: px + 'px', height: px + 'px', borderRadius: '10px',
      backgroundImage: `url(${t.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center',
      border: '1px solid rgba(255,255,255,0.06)', flex: 'none',
    }
  }
  return coverThumb(t.hue, px)
}

export function coverBigFor(t: CoverLike, px: number): CSSProperties {
  if (t.thumbnail) {
    return {
      width: px + 'px', height: px + 'px', borderRadius: '22px',
      backgroundImage: `url(${t.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center',
      border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 26px 64px rgba(0,0,0,0.5)',
      position: 'relative', flex: 'none',
    }
  }
  return coverBig(t.hue, px)
}
