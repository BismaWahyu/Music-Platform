import { useState } from 'react'
import { useSenandung } from './store'
import { getTrack } from './data'
import type { BackendSong } from './data'
import { ACCENT } from './helpers'
import { Hover } from './Hover'
import { SongThumb } from './SongThumb'
import { SongRow } from './SongRow'
import { useSongMenu } from './SongActionMenu'
import { WinClose, Plus } from './Icons'

const EMPTY_SONG = { id: '', title: '', artists: [], album: null, duration: null, thumbnail: null } as BackendSong

const label = {
  fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase' as const,
  color: '#54585f', fontFamily: "'JetBrains Mono',monospace",
}

// Trailing marker for a Smart Shuffle recommendation: a sparkle, plus (when the context is
// a playlist) a quick button to add the rec to that playlist.
function RecTrailing({ onAdd }: { onAdd?: () => void }) {
  return (
    <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span title="Recommended for this playlist" style={{ display: 'flex', color: ACCENT }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9z" /></svg>
      </span>
      {onAdd && (
        <div onClick={(e) => { e.stopPropagation(); onAdd() }} title="Add to this playlist" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', color: '#c8cace', border: '1px solid rgba(255,255,255,0.16)' }}><Plus /></div>
      )}
    </span>
  )
}

// A draggable list of songs (used for both the user queue and the context queue). `onMove`
// reorders by index within this list; `onPlay` plays the clicked song. `recIds` marks
// Smart Shuffle recommendations with a sparkle.
function DraggableList({ songs, onPlay, onMove, onRemove, recIds, onAddRec }: { songs: BackendSong[]; onPlay: (i: number) => void; onMove: (from: number, to: number) => void; onRemove: (i: number) => void; recIds?: Record<string, true>; onAddRec?: (song: BackendSong) => void }) {
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
            <SongRow hue={t.hue} thumbnail={t.thumbnail} title={t.title} subtitle={t.artist} onClick={() => onPlay(i)} song={song} onRemoveFromQueue={() => onRemove(i)} trailing={recIds && recIds[song.id] ? <RecTrailing onAdd={onAddRec ? () => onAddRec(song) : undefined} /> : undefined} />
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
  const shuffleMode = useSenandung((s) => s.shuffleMode)
  const smartRecIds = useSenandung((s) => s.smartRecIds)
  const smartAddTargetId = useSenandung((s) => s.smartAddTargetId)
  const addSongToPlaylist = useSenandung((s) => s.addSongToPlaylist)
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
  const nowMenu = useSongMenu(current ?? EMPTY_SONG)

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
            <div onContextMenu={nowMenu.onContextMenu} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '9px', background: 'rgba(255,255,255,0.03)' }}>
              <SongThumb hue={cur.hue} thumbnail={cur.thumbnail} size={40} current playing={isPlaying} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: ACCENT }}>{cur.title}</div>
                <div style={{ fontSize: '12px', color: '#9398a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{cur.artist}</div>
              </div>
            </div>
            {nowMenu.menu}
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
          <div style={{ ...label, padding: '18px 8px 10px', color: shuffleMode === 'smart' ? ACCENT : '#54585f' }}>{shuffleMode === 'smart' ? `Smart Shuffle${contextLabel ? ` · ${contextLabel}` : ''}` : contextLabel ? `Next from: ${contextLabel}` : 'Up next'}</div>
        )}
        {upcoming.length > 0 ? (
          <DraggableList songs={upcoming} onPlay={(i) => void playSong(upcoming[i])} onMove={(from, to) => reorderQueue(ci + 1 + from, ci + 1 + to)} onRemove={(i) => removeFromContextQueue(ci + 1 + i)} recIds={shuffleMode === 'smart' ? smartRecIds : undefined} onAddRec={shuffleMode === 'smart' && smartAddTargetId ? (song) => void addSongToPlaylist(smartAddTargetId, song) : undefined} />
        ) : (
          current && userQueue.length === 0 && <div style={{ padding: '16px 8px', fontSize: '13px', color: '#54585f' }}>Queue is empty.</div>
        )}
      </div>
    </div>
  )
}
