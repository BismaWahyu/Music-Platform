import { useState } from 'react'
import { useSenandung } from './store'
import { getTrack } from './data'
import type { BackendSong } from './data'
import { ACCENT } from './helpers'
import { Hover } from './Hover'
import { SongThumb } from './SongThumb'
import { SongRow } from './SongRow'
import { WinClose } from './Icons'

const label = {
  fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase' as const,
  color: '#54585f', fontFamily: "'JetBrains Mono',monospace",
}

// A draggable list of songs (used for both the user queue and the context queue). `onMove`
// reorders by index within this list; `onPlay` plays the clicked song.
function DraggableList({ songs, onPlay, onMove, onRemove }: { songs: BackendSong[]; onPlay: (i: number) => void; onMove: (from: number, to: number) => void; onRemove: (i: number) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  return (
    <>
      {songs.map((song, i) => {
        const t = getTrack(song.id)
        const dragging = dragIdx === i
        return (
          <div
            key={`${song.id}-${i}`}
            draggable
            onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== i) setOverIdx(i) }}
            onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) onMove(dragIdx, i); setDragIdx(null); setOverIdx(null) }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            style={{ cursor: 'grab', opacity: dragging ? 0.4 : 1, borderTop: overIdx === i && dragIdx !== null && !dragging ? `2px solid ${ACCENT}` : '2px solid transparent' }}
          >
            <SongRow hue={t.hue} thumbnail={t.thumbnail} title={t.title} subtitle={t.artist} onClick={() => onPlay(i)} song={song} onRemoveFromQueue={() => onRemove(i)} />
          </div>
        )
      })}
    </>
  )
}

export function QueuePanel() {
  const current = useSenandung((s) => s.current)
  const currentId = useSenandung((s) => s.currentId)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const queue = useSenandung((s) => s.queue)
  const ctxId = useSenandung((s) => s.ctxId)
  const contextLabel = useSenandung((s) => s.contextLabel)
  const userQueue = useSenandung((s) => s.userQueue)
  const toggleQueue = useSenandung((s) => s.toggleQueue)
  const playSong = useSenandung((s) => s.playSong)
  const playUserQueueAt = useSenandung((s) => s.playUserQueueAt)
  const reorderUserQueue = useSenandung((s) => s.reorderUserQueue)
  const reorderQueue = useSenandung((s) => s.reorderQueue)
  const clearUserQueue = useSenandung((s) => s.clearUserQueue)
  const removeFromUserQueue = useSenandung((s) => s.removeFromUserQueue)
  const removeFromContextQueue = useSenandung((s) => s.removeFromContextQueue)

  // "Next from <context>" = the context songs after the anchor.
  const ci = queue.findIndex((x) => x.id === ctxId)
  const upcoming = ci >= 0 ? queue.slice(ci + 1) : []
  const cur = getTrack(currentId)

  return (
    <div style={{ width: '320px', flex: 'none', background: 'rgba(18,20,26,0.42)', backdropFilter: 'blur(44px) saturate(185%)', WebkitBackdropFilter: 'blur(44px) saturate(185%)', borderLeft: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 18px 14px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>Queue</span>
        <Hover onClick={toggleQueue} style={{ color: '#9398a0', cursor: 'pointer', lineHeight: 0 }} hover={{ color: '#e8e9ea' }}><WinClose size={15} /></Hover>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px' }}>
        {current ? (
          <>
            <div style={{ ...label, padding: '0 8px 10px' }}>Now Playing</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '9px', background: 'rgba(255,255,255,0.03)' }}>
              <SongThumb hue={cur.hue} thumbnail={cur.thumbnail} size={40} current playing={isPlaying} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: ACCENT }}>{cur.title}</div>
                <div style={{ fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{cur.artist}</div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '16px 8px', fontSize: '13px', color: '#54585f' }}>Nothing playing.</div>
        )}

        {userQueue.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 8px 10px' }}>
              <span style={label}>Next in queue</span>
              <Hover onClick={clearUserQueue} style={{ fontSize: '11px', color: '#9398a0', cursor: 'pointer' }} hover={{ color: '#e8e9ea' }}>Clear</Hover>
            </div>
            <DraggableList songs={userQueue} onPlay={(i) => playUserQueueAt(i)} onMove={reorderUserQueue} onRemove={removeFromUserQueue} />
          </>
        )}

        {current && (
          <div style={{ ...label, padding: '18px 8px 10px' }}>{contextLabel ? `Next from: ${contextLabel}` : 'Up next'}</div>
        )}
        {upcoming.length > 0 ? (
          <DraggableList songs={upcoming} onPlay={(i) => void playSong(upcoming[i])} onMove={(from, to) => reorderQueue(ci + 1 + from, ci + 1 + to)} onRemove={(i) => removeFromContextQueue(ci + 1 + i)} />
        ) : (
          current && userQueue.length === 0 && <div style={{ padding: '16px 8px', fontSize: '13px', color: '#54585f' }}>Queue is empty.</div>
        )}
      </div>
    </div>
  )
}
