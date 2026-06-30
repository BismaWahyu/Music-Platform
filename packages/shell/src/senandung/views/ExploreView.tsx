import { useState } from 'react'
import { useSenandung } from '../store'
import { ACCENT } from '../helpers'
import type { MoodCategory } from '../backend'

function MoodCard({ cat, onClick }: { cat: MoodCategory; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const base = cat.color || ACCENT
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', height: '88px', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
        background: base, transform: hover ? 'scale(1.02)' : 'none', transition: 'transform 0.14s',
        boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45))' }} />
      <span style={{ position: 'absolute', left: '14px', top: '12px', right: '12px', fontSize: '15px', fontWeight: 700, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.4)', lineHeight: 1.2 }}>{cat.title}</span>
    </div>
  )
}

export function ExploreView() {
  const moods = useSenandung((s) => s.moods)
  const openMood = useSenandung((s) => s.openMood)

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '34px 42px 48px' }}>
      <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Jelajahi</h1>
      <p style={{ fontSize: '14px', color: '#9398a0', margin: '0 0 24px' }}>Mood &amp; genre untuk setiap suasana.</p>

      {moods.length === 0 ? (
        <div style={{ marginTop: '40px', color: '#54585f', fontSize: '14px' }}>Memuat kategori…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px' }}>
          {moods.map((cat, i) => (
            <MoodCard key={`${cat.browse_id}-${i}`} cat={cat} onClick={() => void openMood(cat)} />
          ))}
        </div>
      )}
    </div>
  )
}
