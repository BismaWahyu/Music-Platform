import { useState } from 'react'
import { useSenandung } from './store'
import { getTrack } from './data'
import { ACCENT } from './helpers'
import { Hover } from './Hover'
import { SongThumb } from './SongThumb'
import { SongRow } from './SongRow'
import { WinClose } from './Icons'

export function QueuePanel() {
  const current = useSenandung((s) => s.current)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const queue = useSenandung((s) => s.queue)
  const toggleQueue = useSenandung((s) => s.toggleQueue)
  const playSong = useSenandung((s) => s.playSong)
  const reorderQueue = useSenandung((s) => s.reorderQueue)

  // Drag-to-reorder: track the dragged row and the row it's hovering over (absolute
  // queue indices). The drop indicator renders above `overIdx`.
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const qi = queue.findIndex((x) => x.id === currentId)
  const upcoming = qi >= 0 ? queue.slice(qi + 1) : []
  const cur = getTrack(currentId)

  const label = {
    fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    color: '#54585f', fontFamily: "'JetBrains Mono',monospace",
  }

  return (
    <div style={{ width: '320px', flex: 'none', background: 'rgba(18,20,26,0.42)', backdropFilter: 'blur(44px) saturate(185%)', WebkitBackdropFilter: 'blur(44px) saturate(185%)', borderLeft: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 18px 14px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>Antrean</span>
        <Hover onClick={toggleQueue} style={{ color: '#9398a0', cursor: 'pointer', lineHeight: 0 }} hover={{ color: '#e8e9ea' }}><WinClose size={15} /></Hover>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px' }}>
        {current ? (
          <>
            <div style={{ ...label, padding: '0 8px 10px' }}>Sedang Diputar</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '9px', background: 'rgba(255,255,255,0.03)' }}>
              <SongThumb hue={cur.hue} thumbnail={cur.thumbnail} size={40} current playing={isPlaying} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: ACCENT }}>{cur.title}</div>
                <div style={{ fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{cur.artist}</div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '16px 8px', fontSize: '13px', color: '#54585f' }}>Tidak ada yang diputar.</div>
        )}

        <div style={{ ...label, padding: '18px 8px 10px' }}>Selanjutnya</div>
        {upcoming.length > 0 ? (
          upcoming.map((song, i) => {
            const t = getTrack(song.id)
            const abs = qi + 1 + i
            const dragging = dragIdx === abs
            return (
              <div
                key={`${song.id}-${i}`}
                draggable
                onDragStart={(e) => { setDragIdx(abs); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== abs) setOverIdx(abs) }}
                onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) reorderQueue(dragIdx, abs); setDragIdx(null); setOverIdx(null) }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                style={{
                  cursor: 'grab', opacity: dragging ? 0.4 : 1,
                  borderTop: overIdx === abs && dragIdx !== null && !dragging ? `2px solid ${ACCENT}` : '2px solid transparent',
                }}
              >
                <SongRow
                  hue={t.hue}
                  thumbnail={t.thumbnail}
                  title={t.title}
                  subtitle={t.artist}
                  onClick={() => void playSong(song)}
                  song={song}
                />
              </div>
            )
          })
        ) : (
          <div style={{ padding: '16px 8px', fontSize: '13px', color: '#54585f' }}>Antrean kosong.</div>
        )}
      </div>
    </div>
  )
}
