import { useEffect, useRef, useState } from 'react'
import { useSenandung } from '../store'
import { getTrack, artistName } from '../data'
import { ACCENT } from '../helpers'
import { Hover } from '../Hover'
import { getLyrics, type LyricsResult } from '../backend'
import { SkLyrics } from '../Skeleton'

export function LyricsView() {
  const currentId = useSenandung((s) => s.currentId)
  const current = useSenandung((s) => s.current)
  const progress = useSenandung((s) => s.progress)
  const setProgress = useSenandung((s) => s.setProgress)
  const toggleLyrics = useSenandung((s) => s.toggleLyrics)
  const cur = getTrack(currentId)

  const [lyrics, setLyrics] = useState<LyricsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const activeRef = useRef<HTMLParagraphElement | null>(null)

  // Fetch lyrics whenever the track changes.
  useEffect(() => {
    if (!current) { setLyrics(null); return }
    let cancelled = false
    setLoading(true)
    setLyrics(null)
    getLyrics({
      title: current.title,
      artist: artistName(current),
      album: current.album?.title ?? null,
      duration: current.duration ?? null,
    })
      .then((r) => { if (!cancelled) setLyrics(r) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // Re-fetch only when the track changes (not when `current` is re-set with enriched
    // duration for the same id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  // Index of the active synced line for the current playback position.
  const lines = lyrics?.lines ?? null
  const posMs = progress * 1000
  let activeIdx = -1
  if (lines) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time_ms <= posMs) activeIdx = i
      else break
    }
  }

  // Keep the active line centered as the song plays.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIdx])

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '46px 40px 80px' }}>
        <Hover onClick={toggleLyrics} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#9398a0', cursor: 'pointer', marginBottom: '30px' }} hover={{ color: '#e8e9ea' }}>← Back</Hover>
        <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#54585f', fontFamily: "'JetBrains Mono',monospace" }}>Lyrics{lyrics?.synced ? ' · Synced' : ''}</div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>{cur.title || '—'}</h1>
        <div style={{ fontSize: '14px', color: '#9398a0' }}>{cur.artist}</div>

        <div style={{ marginTop: '34px' }}>
          {!currentId ? (
            <p style={{ fontSize: '16px', color: '#54585f' }}>Nothing playing.</p>
          ) : loading ? (
            <SkLyrics />
          ) : lines && lines.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {lines.map((line, i) => {
                const active = i === activeIdx
                return (
                  <p
                    key={`${line.time_ms}-${i}`}
                    ref={active ? activeRef : undefined}
                    onClick={() => setProgress(Math.floor(line.time_ms / 1000))}
                    style={{
                      margin: 0, padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                      fontSize: '19px', fontWeight: active ? 700 : 500, lineHeight: 1.5,
                      color: active ? ACCENT : i < activeIdx ? '#6b7079' : '#c8cace',
                      transition: 'color 0.2s, font-weight 0.2s',
                    }}
                  >
                    {line.text || '♪'}
                  </p>
                )
              })}
            </div>
          ) : lyrics?.text ? (
            <p style={{ fontSize: '17px', color: '#c8cace', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{lyrics.text}</p>
          ) : (
            <p style={{ fontSize: '16px', color: '#54585f' }}>Lyrics aren't available for this song yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
