// Central player state. Everything is backed by the real Tauri backend:
// search results, library, and DB playlists. There is no mock catalog.
//
// Playback: playing a song resolves a stream URL and plays it via the backend;
// progress/playing state arrive through `player-state-update` events.
import { create } from 'zustand'
import { registerSong, getTrack } from './data'
import type { BackendSong, BackendPlaylist } from './data'
import {
  inTauri, searchSongs, getStreamUrl, playSong as bePlay, togglePlayback as bePlayPause,
  setVolume as beSetVolume, seek as beSeek, addToHistory, getHistorySongs, getLibrary, getPlaylists,
  addToLibrary, removeFromLibrary, addToPlaylist as beAddToPlaylist,
  createPlaylist as beCreatePlaylist, getHome, getAlbum, getArtist,
  type BackendPlayerState, type BrowseSection, type BrowsePage, type BrowseItem, type BrowseKind,
} from './backend'

export type View = 'home' | 'library' | 'detail' | 'search' | 'nowplaying' | 'lyrics' | 'browse'
export interface DetailRef { type: 'playlist'; id: string }
export interface BrowseRef { kind: BrowseKind; id: string }

// off → no looping; all → loop the queue; one → repeat the current track.
export type RepeatMode = 'off' | 'all' | 'one'

interface SenandungState {
  view: View
  detail: DetailRef | null
  current: BackendSong | null
  currentId: string
  queue: BackendSong[]          // active play order (shuffled when shuffle is on)
  queueOriginal: BackendSong[]  // canonical order, used to restore when shuffle turns off
  isPlaying: boolean
  progress: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  queueOpen: boolean
  miniMode: boolean
  query: string
  liked: Record<string, boolean>
  realMode: boolean
  isSearching: boolean
  searchResults: BackendSong[]
  library: BackendSong[]
  playlists: BackendPlaylist[]
  history: BackendSong[]
  home: BrowseSection[]
  browseRef: BrowseRef | null
  browsePage: BrowsePage | null
  browseLoading: boolean
  toast: string | null
  _toastSeq: number    // internal: identifies the latest toast for auto-dismiss
  _failStreak: number  // internal: consecutive playback failures (loop guard)

  // actions
  setView: (view: View) => void
  goHome: () => void
  openPlaylist: (id: string) => void
  playSong: (song: BackendSong, queue?: BackendSong[]) => Promise<void>
  next: () => void
  prev: () => void
  autoAdvance: () => void
  setProgress: (p: number) => void
  setVolume: (v: number) => void
  setQuery: (q: string) => void
  runSearch: (q: string) => Promise<void>
  loadLibrary: () => Promise<void>
  loadPlaylists: () => Promise<void>
  loadHistory: () => Promise<void>
  loadHome: () => Promise<void>
  openBrowse: (kind: BrowseKind, id: string) => Promise<void>
  openBrowseItem: (item: BrowseItem) => void
  playBrowsePage: () => void
  showToast: (message: string) => void
  handlePlaybackError: (songId: string, message: string) => void
  applyPlayerState: (s: BackendPlayerState) => void
  togglePlay: () => void
  toggleShuffle: () => void
  setShuffle: (on: boolean) => void
  toggleRepeat: () => void
  toggleQueue: () => void
  toggleLike: () => Promise<void>
  setMini: (mini: boolean) => void
  enqueueNext: (song: BackendSong) => void
  enqueueLast: (song: BackendSong) => void
  addSongToPlaylist: (playlistId: string, song: BackendSong) => Promise<void>
  createPlaylistAndAdd: (name: string, song: BackendSong) => Promise<void>
  toggleLibrarySong: (song: BackendSong) => Promise<void>
}

// Fisher–Yates shuffle (in place), returns the same array.
function shuffleInPlace<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

// Shuffle a list while pinning `frontId` (the track that should keep playing) to the
// front, so enabling shuffle doesn't interrupt the current song.
function buildShuffled(list: BackendSong[], frontId: string): BackendSong[] {
  const front = list.find((x) => x.id === frontId)
  const rest = shuffleInPlace(list.filter((x) => x.id !== frontId))
  return front ? [front, ...rest] : rest
}

// A browse song card carries only display fields; turn it into a BackendSong so it can
// be played and registered (real duration is resolved on play).
function browseItemToSong(item: BrowseItem): BackendSong {
  return {
    id: item.id,
    title: item.title,
    artists: item.subtitle ? [{ id: '', name: item.subtitle }] : [],
    album: null,
    duration: null,
    thumbnail: item.thumbnail ?? null,
  }
}

// Decide which song plays after the current one. The queue is already in play order
// (pre-shuffled when shuffle is on), so this is a plain sequential walk. `auto` means
// the current track ended on its own (respects repeat: stop at the end when off, replay
// when 'one'); a manual skip always navigates and wraps around. null = stop playback.
function pickNext(s: SenandungState, auto: boolean): BackendSong | null {
  const q = s.queue
  if (!q.length) return null
  if (auto && s.repeat === 'one') return s.current ?? q[0]
  const i = q.findIndex((x) => x.id === s.currentId)
  if (i < 0) return q[0]
  if (i + 1 < q.length) return q[i + 1]
  // Reached the end of the queue.
  if (s.repeat === 'all') return q[0]
  if (!auto) return q[0] // manual "next" wraps to the start
  return null // natural end with no repeat → stop
}

export const useSenandung = create<SenandungState>((set, get) => ({
  view: 'home',
  detail: null,
  current: null,
  currentId: '',
  queue: [],
  queueOriginal: [],
  isPlaying: false,
  progress: 0,
  volume: 0.7,
  shuffle: false,
  repeat: 'off',
  queueOpen: true,
  miniMode: false,
  query: '',
  liked: {},
  realMode: false,
  isSearching: false,
  searchResults: [],
  library: [],
  playlists: [],
  history: [],
  home: [],
  browseRef: null,
  browsePage: null,
  browseLoading: false,
  toast: null,
  _toastSeq: 0,
  _failStreak: 0,

  setView: (view) => set({ view }),
  goHome: () => set({ view: 'home', detail: null }),
  openPlaylist: (id) => set({ view: 'detail', detail: { type: 'playlist', id } }),

  // Play a song. Passing `list` starts a NEW play context (a click in a view/playlist):
  // it becomes the canonical order, shuffled into the queue if shuffle is on. Internal
  // navigation (next/prev/autoAdvance, queue clicks) passes no list and keeps the queue.
  playSong: async (song, list) => {
    registerSong(song)
    if (list && list.length) {
      list.forEach(registerSong)
      const active = get().shuffle ? buildShuffled(list, song.id) : list
      set({ queueOriginal: list, queue: active })
    } else if (!get().queue.some((x) => x.id === song.id)) {
      // Defensive: a loose song with no matching queue becomes its own context.
      set({ queueOriginal: [song], queue: [song] })
    }
    set({ current: song, currentId: song.id, progress: 0, isPlaying: true })
    if (!inTauri) return
    set({ realMode: true })
    const info = await getStreamUrl(song.id)
    if (info) {
      const enriched = { ...song, duration: info.duration ?? song.duration ?? null }
      registerSong(enriched)
      set({ current: enriched })
      const ok = await bePlay(info.url, enriched)
      if (!ok) { get().handlePlaybackError(song.id, 'Gagal memulai pemutaran'); return }
      await addToHistory(song.id)
      void get().loadHistory()
    } else {
      get().handlePlaybackError(song.id, 'Tidak ada URL stream untuk lagu ini')
    }
  },

  next: () => {
    const target = pickNext(get(), false)
    if (target) void get().playSong(target)
  },

  // Called when the backend reports the current track finished.
  autoAdvance: () => {
    const target = pickNext(get(), true)
    if (target) void get().playSong(target)
    else set({ isPlaying: false, progress: 0 })
  },

  prev: () => {
    const s = get()
    if (s.progress > 3) { get().setProgress(0); return }
    if (!s.queue.length) return
    const i = s.queue.findIndex((x) => x.id === s.currentId)
    const j = (i - 1 + s.queue.length) % s.queue.length
    void get().playSong(s.queue[j])
  },

  setProgress: (p) => {
    set({ progress: p })
    if (get().realMode) void beSeek(Math.floor(p * 1000))
  },
  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v))
    set({ volume: vol })
    if (inTauri) void beSetVolume(vol)
  },
  setQuery: (q) => set({ query: q, view: 'search' }),

  runSearch: async (q) => {
    set({ query: q, view: 'search' })
    const query = q.trim()
    if (!query) { set({ searchResults: [], isSearching: false }); return }
    set({ isSearching: true })
    const results = (await searchSongs(query)) ?? []
    results.forEach(registerSong)
    set({ searchResults: results, isSearching: false })
  },

  loadLibrary: async () => {
    const library = await getLibrary()
    library.forEach(registerSong)
    const liked = { ...get().liked }
    library.forEach((s) => { liked[s.id] = true })
    set({ library, liked })
  },

  loadPlaylists: async () => {
    const playlists = await getPlaylists()
    playlists.forEach((p) => p.songs.forEach(registerSong))
    set({ playlists })
  },

  loadHistory: async () => {
    const history = await getHistorySongs(20)
    history.forEach(registerSong)
    set({ history })
  },

  loadHome: async () => {
    const home = await getHome()
    home.forEach((sec) => sec.items.forEach((it) => {
      if (it.kind === 'song') registerSong(browseItemToSong(it))
    }))
    set({ home })
  },

  // Open an album/playlist/artist detail page and fetch its contents.
  openBrowse: async (kind, id) => {
    set({ view: 'browse', browseRef: { kind, id }, browsePage: null, browseLoading: true })
    const page = kind === 'artist' ? await getArtist(id) : await getAlbum(id)
    const ref = get().browseRef
    if (!ref || ref.id !== id) return // user navigated away while loading
    page?.songs.forEach(registerSong)
    page?.sections.forEach((sec) => sec.items.forEach((it) => {
      if (it.kind === 'song') registerSong(browseItemToSong(it))
    }))
    set({ browsePage: page, browseLoading: false })
  },

  // Act on a browse card: play a song, or navigate into an album/playlist/artist.
  openBrowseItem: (item) => {
    if (item.kind === 'song') {
      const song = browseItemToSong(item)
      void get().playSong(song, [song])
    } else {
      void get().openBrowse(item.kind, item.id)
    }
  },

  playBrowsePage: () => {
    const page = get().browsePage
    if (page && page.songs.length) void get().playSong(page.songs[0], page.songs)
  },

  showToast: (message) => {
    const seq = get()._toastSeq + 1
    set({ toast: message, _toastSeq: seq })
    setTimeout(() => { if (get()._toastSeq === seq) set({ toast: null }) }, 4000)
  },

  // A track failed to play (no stream URL, or download/decode error from the backend).
  // Notify the user and skip to the next track, with a guard so an all-failing queue
  // doesn't loop forever.
  handlePlaybackError: (songId, message) => {
    const s = get()
    if (songId !== s.currentId) return // stale error for a track we already moved past
    const title = getTrack(songId).title || 'Lagu ini'
    const streak = s._failStreak + 1
    const cap = Math.min(Math.max(s.queue.length, 1), 6)
    if (streak >= cap) {
      set({ _failStreak: 0, isPlaying: false })
      s.showToast('Beberapa lagu gagal diputar. Coba lagi nanti.')
      console.error('playback error (giving up):', message)
      return
    }
    set({ _failStreak: streak })
    s.showToast(`Gagal memutar "${title}" — melewati…`)
    // Skip like a manual "next" (ignores repeat-one so we don't retry the bad track).
    if (s.queue.length > 1) get().next()
    else set({ isPlaying: false })
  },

  // Reconcile local state with a backend player-state-update event. Only trust the
  // backend once it is actually playing the song the user selected — this ignores
  // stale events emitted while the next track is still downloading/decoding, so the
  // UI shows "playing" the instant a song is clicked (Spotify-style).
  applyPlayerState: (s) => {
    const cur = s.current_song
    if (!cur || cur.id !== get().currentId) return
    set({
      isPlaying: s.is_playing,
      progress: Math.floor((s.position_ms ?? 0) / 1000),
      volume: s.volume,
      // A track that's actually producing audio clears the failure streak.
      ...(s.is_playing && (s.position_ms ?? 0) > 500 ? { _failStreak: 0 } : {}),
    })
  },

  togglePlay: () => {
    if (!get().currentId) return
    set((s) => ({ isPlaying: !s.isPlaying }))
    if (get().realMode) void bePlayPause()
  },
  toggleShuffle: () => get().setShuffle(!get().shuffle),
  // Reorder the queue in place: shuffle the upcoming tracks (current stays at the front),
  // or restore the original order — matching Spotify's shuffle toggle.
  setShuffle: (on) => set((s) => {
    if (on === s.shuffle) return {}
    if (!s.queue.length) return { shuffle: on }
    if (on) return { shuffle: true, queue: buildShuffled(s.queue, s.currentId) }
    return { shuffle: false, queue: s.queueOriginal.length ? s.queueOriginal : s.queue }
  }),
  toggleRepeat: () => set((s) => ({
    repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
  })),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),

  toggleLike: async () => {
    const s = get()
    if (!s.current) return
    const id = s.currentId
    const nowLiked = !s.liked[id]
    set({ liked: { ...s.liked, [id]: nowLiked } })
    if (nowLiked) await addToLibrary(s.current)
    else await removeFromLibrary(id)
    void get().loadLibrary()
  },

  setMini: (mini) => set({ miniMode: mini }),

  // Insert right after the currently-playing track (in both the active and original
  // orders, so the song survives a shuffle toggle).
  enqueueNext: (song) => {
    registerSong(song)
    set((s) => {
      const insertAfterCurrent = (arr: BackendSong[]) => {
        const a = [...arr]
        const i = a.findIndex((x) => x.id === s.currentId)
        a.splice(i >= 0 ? i + 1 : a.length, 0, song)
        return a
      }
      return { queue: insertAfterCurrent(s.queue), queueOriginal: insertAfterCurrent(s.queueOriginal) }
    })
  },
  enqueueLast: (song) => {
    registerSong(song)
    set((s) => ({ queue: [...s.queue, song], queueOriginal: [...s.queueOriginal, song] }))
  },

  addSongToPlaylist: async (playlistId, song) => {
    await beAddToPlaylist(playlistId, song)
    void get().loadPlaylists()
  },
  createPlaylistAndAdd: async (name, song) => {
    const pl = await beCreatePlaylist(name)
    if (pl) await beAddToPlaylist(pl.id, song)
    void get().loadPlaylists()
  },

  toggleLibrarySong: async (song) => {
    const liked = !!get().liked[song.id]
    set((s) => ({ liked: { ...s.liked, [song.id]: !liked } }))
    if (liked) await removeFromLibrary(song.id)
    else await addToLibrary(song)
    void get().loadLibrary()
  },
}))
