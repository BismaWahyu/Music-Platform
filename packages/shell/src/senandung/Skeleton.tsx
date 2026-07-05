// Shimmer skeleton placeholders shown while a page/list loads. The `.skeleton` class
// (styles.css) supplies the animated gradient; these compose it into page-shaped blocks so
// the transition to real content is smooth.
import type { CSSProperties } from 'react'

type Size = number | string

export function SkBox({ w, h, r = 8, style }: { w?: Size; h?: Size; r?: Size; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flex: 'none', ...style }} />
}

function SkText({ w, h = 11 }: { w: Size; h?: number }) {
  return <SkBox w={w} h={h} r={5} />
}

// One song-row placeholder (cover + two text lines), matching SongRow's rhythm.
export function SkRow({ thumb = 40 }: { thumb?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 12px' }}>
      <SkBox w={thumb} h={thumb} r={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SkText w="52%" h={12} />
        <SkText w="34%" />
      </div>
      <SkBox w={30} h={12} r={5} />
    </div>
  )
}

export function SkList({ rows = 8, thumb = 40 }: { rows?: number; thumb?: number }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => <SkRow key={i} thumb={thumb} />)}
    </div>
  )
}

// A cover-card placeholder (browse/home carousels). `round` for artist circles.
export function SkCard({ size = 140, round = false }: { size?: number; round?: boolean }) {
  return (
    <div style={{ width: size + 20, flex: 'none', padding: '10px' }}>
      <SkBox w={size} h={size} r={round ? '50%' : 10} />
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: round ? 'center' : 'flex-start' }}>
        <SkText w="80%" h={12} />
        <SkText w="55%" />
      </div>
    </div>
  )
}

// A titled row of card placeholders.
export function SkCarousel({ cards = 6, size = 140 }: { cards?: number; size?: number }) {
  return (
    <div style={{ marginBottom: '30px' }}>
      <SkBox w={180} h={18} r={6} style={{ margin: '0 0 14px' }} />
      <div style={{ display: 'flex', gap: '4px', margin: '0 -10px', overflow: 'hidden' }}>
        {Array.from({ length: cards }, (_, i) => <SkCard key={i} size={size} />)}
      </div>
    </div>
  )
}

// Big detail-page header (playlist / album / artist): large cover + title lines.
export function SkDetailHeader({ round = false }: { round?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', padding: '42px 42px 30px' }}>
      <SkBox w={220} h={220} r={round ? '50%' : 12} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '10px' }}>
        <SkText w={90} />
        <SkBox w="46%" h={44} r={10} />
        <SkText w="30%" h={13} />
        <SkBox w={130} h={42} r={22} style={{ marginTop: '8px' }} />
      </div>
    </div>
  )
}

// Explore mood-card grid.
export function SkMoodGrid({ count = 12 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(216px,1fr))', gap: '14px' }}>
      {Array.from({ length: count }, (_, i) => <SkBox key={i} h={108} r={13} />)}
    </div>
  )
}

// Lyrics: a stack of lines with varied widths.
export function SkLyrics() {
  const widths = ['70%', '55%', '80%', '48%', '66%', '38%', '74%', '52%', '60%']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
      {widths.map((w, i) => <SkText key={i} w={w} h={18} />)}
    </div>
  )
}
