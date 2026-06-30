// Bridge to the Tauri backend. Every call is a safe no-op / fallback when running
// in a plain browser (vite dev preview) so the UI stays demoable without Tauri.
import type { BackendSong, BackendPlaylist } from './data'

export const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export interface BackendPlayerState {
  is_playing: boolean
  current_song?: BackendSong | null
  position_ms: number
  volume: number
  queue: BackendSong[]
  queue_index: number
}

export async function searchSongs(query: string): Promise<BackendSong[] | null> {
  if (!inTauri) return null
  try {
    return await invoke<BackendSong[]>('search', { query })
  } catch (e) {
    console.error('search failed', e)
    return null
  }
}

export interface StreamInfo {
  url: string
  duration?: number | null
}

export interface LyricLine { time_ms: number; text: string }
export interface LyricsResult {
  synced: boolean
  text: string
  lines?: LyricLine[] | null
}

export async function getLyrics(args: {
  title: string; artist: string; album?: string | null; duration?: number | null
}): Promise<LyricsResult | null> {
  if (!inTauri) return null
  try {
    return await invoke<LyricsResult>('get_lyrics', {
      title: args.title, artist: args.artist,
      album: args.album ?? null, duration: args.duration ?? null,
    })
  } catch (e) {
    // A "not found" error is expected and normal; don't spam the console.
    return null
  }
}

export async function getStreamUrl(videoId: string): Promise<StreamInfo | null> {
  if (!inTauri) return null
  try {
    return await invoke<StreamInfo>('get_stream_url', { videoId })
  } catch (e) {
    console.error('get_stream_url failed', e)
    return null
  }
}

export async function playSong(url: string, song: BackendSong): Promise<boolean> {
  if (!inTauri) return false
  try {
    await invoke('play', { url, song })
    return true
  } catch (e) {
    console.error('play failed', e)
    return false
  }
}

export async function togglePlayback(): Promise<void> {
  if (inTauri) { try { await invoke('toggle_playback') } catch (e) { console.error(e) } }
}

export async function setVolume(volume: number): Promise<void> {
  if (inTauri) { try { await invoke('set_volume', { volume }) } catch (e) { console.error(e) } }
}

export async function seek(positionMs: number): Promise<void> {
  if (inTauri) { try { await invoke('seek', { positionMs }) } catch (e) { console.error(e) } }
}

export async function addToHistory(songId: string): Promise<void> {
  if (inTauri) { try { await invoke('add_to_history', { songId }) } catch (e) { console.error(e) } }
}

export async function getHistorySongs(limit = 20): Promise<BackendSong[]> {
  if (!inTauri) return []
  try { return await invoke<BackendSong[]>('get_history_songs', { limit }) } catch (e) { console.error(e); return [] }
}

// ==================== Browse ====================

export type BrowseKind = 'song' | 'album' | 'playlist' | 'artist'
export interface BrowseItem {
  id: string
  kind: BrowseKind
  title: string
  subtitle?: string | null
  thumbnail?: string | null
}
export interface BrowseSection { title: string; items: BrowseItem[] }
export interface BrowsePage {
  title: string
  subtitle?: string | null
  thumbnail?: string | null
  songs: BackendSong[]
  sections: BrowseSection[]
}

export async function getHome(): Promise<BrowseSection[]> {
  if (!inTauri) return []
  try { return await invoke<BrowseSection[]>('get_home') } catch (e) { console.error('get_home failed', e); return [] }
}

export async function getAlbum(browseId: string): Promise<BrowsePage | null> {
  if (!inTauri) return null
  try { return await invoke<BrowsePage>('get_album', { browseId }) } catch (e) { console.error('get_album failed', e); return null }
}

export async function getArtist(browseId: string): Promise<BrowsePage | null> {
  if (!inTauri) return null
  try { return await invoke<BrowsePage>('get_artist', { browseId }) } catch (e) { console.error('get_artist failed', e); return null }
}

export interface MoodCategory {
  title: string
  browse_id: string
  params?: string | null
  color?: string | null
}

export async function getMoods(): Promise<MoodCategory[]> {
  if (!inTauri) return []
  try { return await invoke<MoodCategory[]>('get_moods') } catch (e) { console.error('get_moods failed', e); return [] }
}

export async function getMood(browseId: string, params?: string | null): Promise<BrowsePage | null> {
  if (!inTauri) return null
  try { return await invoke<BrowsePage>('get_mood', { browseId, params: params ?? null }) } catch (e) { console.error('get_mood failed', e); return null }
}

export async function getRadio(videoId: string): Promise<BackendSong[]> {
  if (!inTauri) return []
  try { return await invoke<BackendSong[]>('get_radio', { videoId }) } catch (e) { console.error('get_radio failed', e); return [] }
}

// ==================== Spotify import ====================

export interface SpotifyImportProgress { done: number; total: number; title: string }

/** Import a public Spotify playlist by link. Throws the backend error message on failure. */
export async function importSpotifyPlaylist(url: string): Promise<BackendPlaylist | null> {
  if (!inTauri) return null
  return await invoke<BackendPlaylist>('import_spotify_playlist', { url })
}

/** Import a playlist from CSV text (e.g. an Exportify export). Throws on failure. */
export async function importCsvPlaylist(name: string, content: string): Promise<BackendPlaylist | null> {
  if (!inTauri) return null
  return await invoke<BackendPlaylist>('import_csv_playlist', { name, content })
}

export async function onSpotifyImportProgress(cb: (p: SpotifyImportProgress) => void): Promise<() => void> {
  if (!inTauri) return () => {}
  try {
    const { listen } = await import('@tauri-apps/api/event')
    return await listen<SpotifyImportProgress>('spotify-import-progress', (e) => cb(e.payload))
  } catch (e) {
    console.error('listen spotify-import-progress failed', e)
    return () => {}
  }
}

export async function getLibrary(): Promise<BackendSong[]> {
  if (!inTauri) return []
  try { return await invoke<BackendSong[]>('get_library') } catch (e) { console.error(e); return [] }
}

export async function addToLibrary(song: BackendSong): Promise<void> {
  if (inTauri) { try { await invoke('add_to_library', { song }) } catch (e) { console.error(e) } }
}

export async function removeFromLibrary(songId: string): Promise<void> {
  if (inTauri) { try { await invoke('remove_from_library', { songId }) } catch (e) { console.error(e) } }
}

export async function getPlaylists(): Promise<BackendPlaylist[]> {
  if (!inTauri) return []
  try { return await invoke<BackendPlaylist[]>('get_playlists') } catch (e) { console.error(e); return [] }
}

/** A single playlist WITH its songs (get_playlists returns empty song lists). */
export async function getPlaylist(playlistId: string): Promise<BackendPlaylist | null> {
  if (!inTauri) return null
  try { return await invoke<BackendPlaylist>('get_playlist', { playlistId }) } catch (e) { console.error(e); return null }
}

export async function addToPlaylist(playlistId: string, song: BackendSong): Promise<void> {
  if (inTauri) { try { await invoke('add_to_playlist', { playlistId, song }) } catch (e) { console.error(e) } }
}

export async function removeFromPlaylist(playlistId: string, songId: string): Promise<void> {
  if (inTauri) { try { await invoke('remove_from_playlist', { playlistId, songId }) } catch (e) { console.error(e) } }
}

export async function createPlaylist(name: string, description?: string): Promise<BackendPlaylist | null> {
  if (!inTauri) return null
  try { return await invoke<BackendPlaylist>('create_playlist', { name, description: description ?? null }) }
  catch (e) { console.error(e); return null }
}

export async function updatePlaylist(playlistId: string, name?: string | null, description?: string | null): Promise<void> {
  if (inTauri) { try { await invoke('update_playlist', { playlistId, name: name ?? null, description: description ?? null }) } catch (e) { console.error(e) } }
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  if (inTauri) { try { await invoke('delete_playlist', { playlistId }) } catch (e) { console.error(e) } }
}

export async function touchPlaylist(playlistId: string): Promise<void> {
  if (inTauri) { try { await invoke('touch_playlist', { playlistId }) } catch (e) { console.error(e) } }
}

/** Subscribe to backend player-state updates. Returns an unsubscribe fn. */
export async function onPlayerState(cb: (s: BackendPlayerState) => void): Promise<() => void> {
  if (!inTauri) return () => {}
  try {
    const { listen } = await import('@tauri-apps/api/event')
    return await listen<BackendPlayerState>('player-state-update', (e) => cb(e.payload))
  } catch (e) {
    console.error('listen failed', e)
    return () => {}
  }
}

/** Fires when the current track finishes playing. Returns an unsubscribe fn. */
export async function onSongEnded(cb: () => void): Promise<() => void> {
  if (!inTauri) return () => {}
  try {
    const { listen } = await import('@tauri-apps/api/event')
    return await listen('song-ended', () => cb())
  } catch (e) {
    console.error('listen song-ended failed', e)
    return () => {}
  }
}

export interface PlaybackError { songId: string; message: string }

/** Fires when a track fails to download/decode. Returns an unsubscribe fn. */
export async function onPlaybackError(cb: (e: PlaybackError) => void): Promise<() => void> {
  if (!inTauri) return () => {}
  try {
    const { listen } = await import('@tauri-apps/api/event')
    return await listen<PlaybackError>('playback-error', (e) => cb(e.payload))
  } catch (e) {
    console.error('listen playback-error failed', e)
    return () => {}
  }
}
