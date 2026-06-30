import { useEffect } from 'react'
import { useSenandung } from './store'
import { onPlayerState, onSongEnded, onPlaybackError, onSpotifyImportProgress } from './backend'
import { TitleBar } from './TitleBar'
import { Toast } from './Toast'
import { Sidebar } from './Sidebar'
import { QueuePanel } from './QueuePanel'
import { PlayerBar } from './PlayerBar'
import { MiniPlayer } from './MiniPlayer'
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
  const applyPlayerState = useSenandung((s) => s.applyPlayerState)
  const autoAdvance = useSenandung((s) => s.autoAdvance)
  const handlePlaybackError = useSenandung((s) => s.handlePlaybackError)
  const setImportProgress = useSenandung((s) => s.setImportProgress)
  const loadLibrary = useSenandung((s) => s.loadLibrary)
  const loadPlaylists = useSenandung((s) => s.loadPlaylists)
  const loadHistory = useSenandung((s) => s.loadHistory)
  const loadHome = useSenandung((s) => s.loadHome)
  const loadMoods = useSenandung((s) => s.loadMoods)

  // Load the user's library + playlists + history + home feed + moods from the backend once.
  useEffect(() => {
    void loadLibrary()
    void loadPlaylists()
    void loadHistory()
    void loadHome()
    void loadMoods()
  }, [loadLibrary, loadPlaylists, loadHistory, loadHome, loadMoods])

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

  // Surface playback failures and skip the offending track.
  useEffect(() => {
    let unlisten = () => {}
    onPlaybackError((e) => handlePlaybackError(e.songId, e.message)).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [handlePlaybackError])

  // Spotify import progress.
  useEffect(() => {
    let unlisten = () => {}
    onSpotifyImportProgress(setImportProgress).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [setImportProgress])

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
    </div>
  )
}
