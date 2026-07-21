import { useEffect } from 'react'
import { useSenandung } from './store'
import { onPlayerState, onSongEnded, onPlaybackError, onSpotifyImportProgress, onMediaControl, setMediaPlaying } from './backend'
import { TitleBar } from './TitleBar'
import { Toast } from './Toast'
import { Sidebar } from './Sidebar'
import { QueuePanel } from './QueuePanel'
import { PlayerBar } from './PlayerBar'
import { MiniPlayer } from './MiniPlayer'
import { ConfirmPopover } from './ConfirmPopover'
import { HomeView } from './views/HomeView'
import { LibraryView } from './views/LibraryView'
import { LikedView } from './views/LikedView'
import { DetailView } from './views/DetailView'
import { SearchView } from './views/SearchView'
import { NowPlayingView } from './views/NowPlayingView'
import { LyricsView } from './views/LyricsView'
import { BrowseView } from './views/BrowseView'
import { ExploreView } from './views/ExploreView'

const BG = "radial-gradient(1100px 820px at 6% -10%, oklch(0.6 0.17 256 / 0.42), transparent 56%), radial-gradient(960px 820px at 100% 4%, oklch(0.58 0.18 305 / 0.36), transparent 52%), radial-gradient(1000px 900px at 50% 116%, oklch(0.6 0.15 200 / 0.34), transparent 56%), radial-gradient(820px 720px at 104% 102%, oklch(0.58 0.17 330 / 0.3), transparent 54%), #090a0e"

function CurrentView() {
  const view = useSenandung((s) => s.view)
  switch (view) {
    case 'home': return <HomeView />
    case 'library': return <LibraryView />
    case 'liked': return <LikedView />
    case 'detail': return <DetailView />
    case 'search': return <SearchView />
    case 'nowplaying': return <NowPlayingView />
    case 'lyrics': return <LyricsView />
    case 'browse': return <BrowseView />
    case 'explore': return <ExploreView />
    default: return <HomeView />
  }
}

export function SenandungApp() {
  const miniMode = useSenandung((s) => s.miniMode)
  const queueOpen = useSenandung((s) => s.queueOpen)
  const dupConfirm = useSenandung((s) => s.dupConfirm)
  const confirmDupAdd = useSenandung((s) => s.confirmDupAdd)
  const cancelDupAdd = useSenandung((s) => s.cancelDupAdd)
  const applyPlayerState = useSenandung((s) => s.applyPlayerState)
  const autoAdvance = useSenandung((s) => s.autoAdvance)
  const handlePlaybackError = useSenandung((s) => s.handlePlaybackError)
  const setOnline = useSenandung((s) => s.setOnline)
  const setImportProgress = useSenandung((s) => s.setImportProgress)
  const next = useSenandung((s) => s.next)
  const prev = useSenandung((s) => s.prev)
  const togglePlay = useSenandung((s) => s.togglePlay)
  const isPlaying = useSenandung((s) => s.isPlaying)
  const currentId = useSenandung((s) => s.currentId)
  const loadLibrary = useSenandung((s) => s.loadLibrary)
  const loadPlaylists = useSenandung((s) => s.loadPlaylists)
  const loadHistory = useSenandung((s) => s.loadHistory)
  const loadHome = useSenandung((s) => s.loadHome)
  const loadCharts = useSenandung((s) => s.loadCharts)
  const loadMoods = useSenandung((s) => s.loadMoods)
  const loadSession = useSenandung((s) => s.loadSession)

  // Load the user's library + playlists + history + home feed + charts + moods once, and
  // restore the last playback session (paused, resumes on play).
  useEffect(() => {
    void loadSession()
    void loadLibrary()
    void loadPlaylists()
    void loadHistory()
    void loadHome()
    void loadCharts()
    void loadMoods()
  }, [loadSession, loadLibrary, loadPlaylists, loadHistory, loadHome, loadCharts, loadMoods])

  // Reconcile with real backend playback state (Tauri only; no-op in browser).
  useEffect(() => {
    let unlisten = () => {}
    onPlayerState(applyPlayerState).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [applyPlayerState])

  // Advance to the next track when the current one finishes.
  useEffect(() => {
    let unlisten = () => {}
    onSongEnded(autoAdvance).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [autoAdvance])

  // Surface playback failures: stop on connection loss, skip otherwise.
  useEffect(() => {
    let unlisten = () => {}
    onPlaybackError((e) => handlePlaybackError(e.songId, e.message, e.kind)).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [handlePlaybackError])

  // Track network status for the offline indicator.
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    setOnline(navigator.onLine)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setOnline])

  // Spotify import progress.
  useEffect(() => {
    let unlisten = () => {}
    onSpotifyImportProgress(setImportProgress).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [setImportProgress])

  // Taskbar thumbnail media buttons (Windows): map clicks to transport actions.
  useEffect(() => {
    let unlisten = () => {}
    onMediaControl((action) => {
      if (action === 'prev') prev()
      else if (action === 'next') next()
      else togglePlay()
    }).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [prev, next, togglePlay])

  // Keep the taskbar play/pause button in sync with playback.
  useEffect(() => { void setMediaPlaying(isPlaying) }, [isPlaying, currentId])

  if (miniMode) return <MiniPlayer />

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: BG, color: '#e8e9ea', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Hanken Grotesk', sans-serif", overflow: 'hidden' }}>
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'transparent' }}>
          <CurrentView />
        </div>
        {queueOpen && <QueuePanel />}
      </div>
      <PlayerBar />
      <Toast />
      {dupConfirm && (
        <ConfirmPopover
          anchor={{ x: window.innerWidth / 2 - 122, y: window.innerHeight / 2 - 70 }}
          title="Already in playlist"
          message={`"${dupConfirm.song.title}" is already in "${dupConfirm.playlistName}". Add it again?`}
          confirmLabel="Add anyway"
          onConfirm={() => void confirmDupAdd()}
          onClose={cancelDupAdd}
        />
      )}
    </div>
  )
}
