import { useState } from 'react'
import { useSenandung, moodKey } from '../store'
import { ACCENT } from '../helpers'
import type { MoodCategory } from '../backend'
import { SkMoodGrid } from '../Skeleton'

function MoodCard({ cat, cover, onClick }: { cat: MoodCategory; cover?: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const base = cat.color || ACCENT
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', height: '108px', borderRadius: '13px', overflow: 'hidden', cursor: 'pointer',
        background: base, transform: hover ? 'translateY(-3px)' : 'none', transition: 'transform 0.18s, box-shadow 0.18s',
        boxShadow: hover ? '0 16px 34px rgba(0,0,0,0.5)' : '0 8px 22px rgba(0,0,0,0.35)',
      }}
    >
      {/* depth: light from top-left, shadow toward bottom-right */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.16), transparent 42%, rgba(0,0,0,0.42))' }} />
      {/* tilted "cover" in the bottom-right corner — the mood's real cover art when loaded,
          otherwise a decorative tinted card. */}
      <div
        style={{
          position: 'absolute', right: '-16px', bottom: '-20px', width: '78px', height: '78px', borderRadius: '9px',
          background: cover ? `#000 url(${cover}) center/cover no-repeat` : `linear-gradient(135deg, rgba(255,255,255,0.42), rgba(0,0,0,0.42)), ${base}`,
          border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 12px 22px rgba(0,0,0,0.5)',
          transform: hover ? 'rotate(20deg) translate(-6px,-6px)' : 'rotate(26deg)', transition: 'transform 0.22s ease',
        }}
      />
      <span style={{ position: 'absolute', left: '15px', top: '13px', right: '54px', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>{cat.title}</span>
    </div>
  )
}

export function ExploreView() {
  const moods = useSenandung((s) => s.moods)
  const moodCovers = useSenandung((s) => s.moodCovers)
  const openMood = useSenandung((s) => s.openMood)

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 48px' }}>
      <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Explore</h1>
      <p style={{ fontSize: '14px', color: '#9398a0', margin: '0 0 24px' }}>Moods &amp; genres for every vibe.</p>

      {moods.length === 0 ? (
        <SkMoodGrid />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(216px,1fr))', gap: '14px' }}>
          {moods.map((cat, i) => (
            <MoodCard key={`${cat.browse_id}-${i}`} cat={cat} cover={moodCovers[moodKey(cat)]} onClick={() => void openMood(cat)} />
          ))}
        </div>
      )}
    </div>
  )
}
