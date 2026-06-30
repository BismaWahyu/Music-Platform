import type { CSSProperties } from 'react'
import type { BackendSong } from './data'
import { stripe } from './helpers'

/** First up to 4 distinct, non-empty cover thumbnails from a song list. */
export function coversFromSongs(songs: BackendSong[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of songs) {
    if (s.thumbnail && !seen.has(s.thumbnail)) {
      seen.add(s.thumbnail)
      out.push(s.thumbnail)
      if (out.length === 4) break
    }
  }
  return out
}

// A playlist cover built from song artwork: a 2×2 mosaic when ≥4 covers exist, a single
// cover for 1–3, else the striped placeholder.
export function PlaylistCover({ thumbnails, hue, size, radius = '22px', shadow = true }: { thumbnails: string[]; hue: number; size: number; radius?: string; shadow?: boolean }) {
  const thumbs = thumbnails.slice(0, 4)

  const base: CSSProperties = {
    width: size, height: size, borderRadius: radius, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.07)', flex: 'none',
    ...(shadow ? { boxShadow: '0 26px 64px rgba(0,0,0,0.5)' } : {}),
  }
  const img = (url: string): CSSProperties => ({ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' })

  if (thumbs.length >= 4) {
    return (
      <div style={{ ...base, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        {thumbs.map((t, i) => <div key={i} style={img(t)} />)}
      </div>
    )
  }
  if (thumbs.length >= 1) {
    return <div style={{ ...base, ...img(thumbs[0]) }} />
  }
  return <div style={{ ...base, background: stripe(hue) }} />
}
