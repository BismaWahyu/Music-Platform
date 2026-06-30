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
  addToLibrary, removeFromLibrary, addToPlaylist as beAddToPlaylist, removeFromPlaylist as beRemoveFromPlaylist,
  createPlaylist as beCreatePlaylist, updatePlaylist as beUpdatePlaylist, deletePlaylist as beDeletePlaylist,
  touchPlaylist as beTouchPlaylist, getPlaylist as beGetPlaylist,
  getHome, getAlbum, getArtist, getMoods, getMood, getMoodCover, getMoodCovers, saveMoodCovers, getRadio,
  importSpotifyPlaylist, importCsvPlaylist,
  type BackendPlayerState, type BrowseSection, type BrowsePage, type BrowseItem, type BrowseKind,
  type MoodCategory, type SpotifyImportProgress,
} from './backend'
import { enterMiniWindow, exitMiniWindow } from './window'

export type View = 'home' | 'library' | 'liked' | 'detail' | 'search' | 'nowplaying' | 'lyrics' | 'browse' | 'explore'
export interface DetailRef { type: 'playlist'; id: string }
export type BrowseRefKind = BrowseKind | 'mood'
export interface BrowseRef { kind: BrowseRefKind; id: string }

// All moods share one browseId; `params` is what differentiates them, so cover-cache keys
// must include both.
export function moodKey(cat: { browse_id: string; params?: string | null }): string {
  return `${cat.browse_id}|${cat.params ?? ''}`
}

// off → no looping; all → loop the queue; one → repeat the current track.
export type RepeatMode = 'off' | 'all' | 'one'

interface SenandungState {
  view: View
  detail: DetailRef | null
  current: BackendSong | null
  currentId: string
  queue: BackendSong[]          // context play order (shuffled when shuffle is on)
  queueOriginal: BackendSong[]  // canonical order, used to restore when shuffle turns off
  radioPool: BackendSong[]      // internal: prefetched radio songs for the repeat-all window
  userQueue: BackendSong[]      // manual "Next in queue" — plays before the context continues
  ctxId: string                 // context anchor (a song id in `queue`); where context resumes
  contextLabel: string          // label for "Next from: <X>"
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
  detailPlaylist: BackendPlaylist | null  // the currently-open playlist, WITH its songs
  detailLoading: boolean
  history: BackendSong[]
  home: BrowseSection[]
  moods: MoodCategory[]
  moodCovers: Record<string, string>  // browseId → representative cover url
  browseRef: BrowseRef | null
  browsePage: BrowsePage | null
  browseLoading: boolean
  toast: string | null
  _toastSeq: number    // internal: identifies the latest toast for auto-dismiss
  _failStreak: number  // internal: consecutive playback failures (loop guard)
  importing: boolean
  importProgress: SpotifyImportProgress | null

  // actions
  setView: (view: View) => void
  goHome: () => void
  openPlaylist: (id: string) => Promise<void>
  reloadDetailPlaylist: () => Promise<void>
  playSong: (song: BackendSong, queue?: BackendSong[]) => Promise<void>
  previewSong: (song: BackendSong) => Promise<void>
  next: () => void
  prev: () => void
  autoAdvance: () => void
  setProgress: (p: number) => void
  setVolume: (v: number) => void
  setQuery: (q: string) => void
  runSearch: (q: string) => Promise<void>
  clearSearch: () => void
  loadLibrary: () => Promise<void>
  loadPlaylists: () => Promise<void>
  loadHistory: () => Promise<void>
  loadHome: () => Promise<void>
  loadMoods: () => Promise<void>
  loadMoodCovers: () => Promise<void>
  openMood: (cat: MoodCategory) => Promise<void>
  openBrowse: (kind: BrowseKind, id: string) => Promise<void>
  openBrowseItem: (item: BrowseItem) => void
  playBrowsePage: () => void
  topUpQueue: (force?: boolean) => Promise<void>
  showToast: (message: string) => void
  handlePlaybackError: (songId: string, message: string) => void
  setImportProgress: (p: SpotifyImportProgress) => void
  importSpotify: (url: string) => Promise<boolean>
  importCsv: (name: string, content: string) => Promise<boolean>
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
  reorderQueue: (from: number, to: number) => void
  clearUserQueue: () => void
  playUserQueueAt: (index: number) => void
  reorderUserQueue: (from: number, to: number) => void
  _playTrack: (song: BackendSong) => Promise<void>
  addSongToPlaylist: (playlistId: string, song: BackendSong) => Promise<void>
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>
  createPlaylist: (name: string) => Promise<void>
  createPlaylistAndAdd: (name: string, song: BackendSong) => Promise<void>
  updatePlaylist: (id: string, name: string, description: string) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  touchPlaylist: (id: string) => Promise<void>
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

// Shared driver for playlist imports (Spotify link / CSV): toggles the importing flag,
// runs the import, refreshes playlists, and opens the result. Progress arrives via the
// `spotify-import-progress` event (→ `setImportProgress`).
async function runImport(
  get: () => SenandungState,
  set: (partial: Partial<SenandungState>) => void,
  task: () => Promise<BackendPlaylist | null>,
  failMsg: string,
): Promise<boolean> {
  if (get().importing) return false
  set({ importing: true, importProgress: { done: 0, total: 0, title: '' } })
  try {
    const pl = await task()
    await get().loadPlaylists()
    set({ importing: false, importProgress: null })
    if (pl) {
      get().openPlaylist(pl.id)
      get().showToast(`Playlist "${pl.name}" diimpor — ${pl.songs.length} lagu.`)
    }
    return true
  } catch (e) {
    set({ importing: false, importProgress: null })
    get().showToast(typeof e === 'string' ? e : failMsg)
    return false
  }
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

// A human label for the current play context (shown as "Next from: <X>" in the queue).
function contextLabelOf(s: SenandungState): string {
  if (s.view === 'detail' && s.detailPlaylist) return s.detailPlaylist.name
  if (s.view === 'browse' && s.browsePage) return s.browsePage.title
  if (s.view === 'search') return 'Hasil pencarian'
  if (s.view === 'liked') return 'Lagu Disukai'
  if (s.view === 'library') return 'Pustaka'
  return ''
}

// Decide which CONTEXT song plays after the anchor (`ctxId`). The manual user queue is
// handled separately by the callers (it plays first). `auto` = the current track ended on
// its own (respects repeat: stop at end when off, replay when 'one'); a manual skip wraps.
function pickNext(s: SenandungState, auto: boolean): BackendSong | null {
  const q = s.queue
  if (!q.length) return null
  if (auto && s.repeat === 'one') return q.find((x) => x.id === s.ctxId) ?? q[0]
  const i = q.findIndex((x) => x.id === s.ctxId)
  if (i < 0) return q[0]
  if (i + 1 < q.length) return q[i + 1]
  // Reached the end of the queue.
  if (!auto) return q[0] // manual "next" wraps to the start
  // Auto: return null so the caller can extend with radio first, then fall back to
  // looping (repeat='all') or stopping (repeat='off').
  return null
}

// Preview cap timer (auto-pause after 1 minute). Cleared whenever real playback starts.
let previewTimer: ReturnType<typeof setTimeout> | null = null
function cancelPreview() { if (previewTimer) { clearTimeout(previewTimer); previewTimer = null } }

export const useSenandung = create<SenandungState>((set, get) => ({
  view: 'home',
  detail: null,
  current: null,
  currentId: '',
  queue: [],
  queueOriginal: [],
  radioPool: [],
  userQueue: [],
  ctxId: '',
  contextLabel: '',
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
  detailPlaylist: null,
  detailLoading: false,
  history: [],
  home: [],
  moods: [],
  moodCovers: {},
  browseRef: null,
  browsePage: null,
  browseLoading: false,
  toast: null,
  _toastSeq: 0,
  _failStreak: 0,
  importing: false,
  importProgress: null,

  setView: (view) => set({ view }),
  goHome: () => set({ view: 'home', detail: null }),

  // Open a playlist's detail page, loading its full song list (get_playlists omits songs).
  openPlaylist: async (id) => {
    set({ view: 'detail', detail: { type: 'playlist', id }, detailPlaylist: null, detailLoading: true })
    const pl = await beGetPlaylist(id)
    if (get().detail?.id !== id) return // navigated away while loading
    pl?.songs.forEach(registerSong)
    set({ detailPlaylist: pl, detailLoading: false })
  },

  // Refresh the open playlist's songs (after adding/removing/importing).
  reloadDetailPlaylist: async () => {
    const id = get().detail?.id
    if (!id) return
    const pl = await beGetPlaylist(id)
    if (get().detail?.id !== id) return
    pl?.songs.forEach(registerSong)
    set({ detailPlaylist: pl })
  },

  // Low-level: actually play a track (set current + resolve stream + backend play).
  // Does NOT touch queue/context/userQueue.
  _playTrack: async (song) => {
    registerSong(song)
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

  // Play a song. Passing `list` starts a NEW context (a click in a view/playlist): it
  // becomes the canonical order (shuffled into the queue if shuffle is on) and the anchor.
  // No list = play a song already in the context (jump within it).
  // Preview a song in the main player, auto-pausing after 1 minute. Doesn't touch the
  // queue/context (uses `_playTrack`), so it's a non-committal listen.
  previewSong: async (song) => {
    cancelPreview()
    await get()._playTrack(song)
    previewTimer = setTimeout(() => {
      previewTimer = null
      if (get().currentId === song.id && get().isPlaying) get().togglePlay()
    }, 60_000)
  },

  playSong: async (song, list) => {
    cancelPreview()
    registerSong(song)
    if (list && list.length) {
      list.forEach(registerSong)
      const active = get().shuffle ? buildShuffled(list, song.id) : list
      set({ queueOriginal: list, queue: active, radioPool: [], ctxId: song.id, contextLabel: contextLabelOf(get()) })
    } else if (get().queue.some((x) => x.id === song.id)) {
      set({ ctxId: song.id }) // jump within the current context
    } else {
      set({ queueOriginal: [song], queue: [song], ctxId: song.id, contextLabel: contextLabelOf(get()) })
    }
    await get()._playTrack(song)
  },

  next: () => {
    cancelPreview()
    const s = get()
    // The manual queue plays before the context continues.
    if (s.userQueue.length) {
      const song = s.userQueue[0]
      set({ userQueue: s.userQueue.slice(1) })
      void get()._playTrack(song)
      return
    }
    const target = pickNext(s, false)
    if (target) { set({ ctxId: target.id }); void get()._playTrack(target) }
    void get().topUpQueue() // advancing consumed a track → keep the queue flowing
  },

  // Called when the backend reports the current track finished.
  autoAdvance: async () => {
    cancelPreview()
    const s = get()
    if (s.userQueue.length) {
      const song = s.userQueue[0]
      set({ userQueue: s.userQueue.slice(1) })
      void get()._playTrack(song)
      return
    }
    let target = pickNext(get(), true)
    if (!target) {
      // End of context → extend with autoplay (radio) so playback keeps flowing.
      await get().topUpQueue(true)
      target = pickNext(get(), true)
      // Radio gave nothing → loop (repeat=all) or stop (repeat=off).
      if (!target && get().repeat === 'all' && get().queue.length) target = get().queue[0]
    }
    if (target) { set({ ctxId: target.id }); void get()._playTrack(target) }
    else set({ isPlaying: false, progress: 0 })
    void get().topUpQueue() // refill the tail for the next advance
  },

  prev: () => {
    cancelPreview()
    const s = get()
    if (s.progress > 3) { get().setProgress(0); return }
    if (!s.queue.length) return
    const i = s.queue.findIndex((x) => x.id === s.ctxId)
    const j = (i - 1 + s.queue.length) % s.queue.length
    set({ ctxId: s.queue[j].id })
    void get()._playTrack(s.queue[j])
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
  clearSearch: () => set({ query: '', searchResults: [], isSearching: false }),

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

  loadMoods: async () => {
    const [moods, cached] = await Promise.all([getMoods(), getMoodCovers()])
    // Cached covers show instantly; only missing ones are fetched below.
    set({ moods, moodCovers: { ...cached, ...get().moodCovers } })
    void get().loadMoodCovers()
  },

  // Fetch a cover thumbnail for each not-yet-cached mood (limited concurrency), then
  // persist the result. Keyed by browseId+params: all moods share one browseId, so the
  // params is what makes each mood distinct.
  loadMoodCovers: async () => {
    const moods = get().moods
    let i = 0
    let changed = false
    const worker = async () => {
      while (i < moods.length) {
        const cat = moods[i++]
        const key = moodKey(cat)
        if (get().moodCovers[key]) continue
        const url = await getMoodCover(cat.browse_id, cat.params)
        if (url) { changed = true; set((s) => ({ moodCovers: { ...s.moodCovers, [key]: url } })) }
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker))
    if (changed) void saveMoodCovers(get().moodCovers)
  },

  // Open a mood/genre page (carousels of playlists), reusing the browse detail view.
  openMood: async (cat) => {
    set({ view: 'browse', browseRef: { kind: 'mood', id: cat.browse_id }, browsePage: null, browseLoading: true })
    const page = await getMood(cat.browse_id, cat.params)
    if (get().browseRef?.id !== cat.browse_id) return
    const withTitle = page ? { ...page, title: page.title || cat.title } : null
    withTitle?.sections.forEach((sec) => sec.items.forEach((it) => {
      if (it.kind === 'song') registerSong(browseItemToSong(it))
    }))
    set({ browsePage: withTitle, browseLoading: false })
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

  // Keep the queue flowing with InnerTube radio (related songs). Called on every advance.
  //  - repeat 'all'  → a sliding ~50 window: played tracks drop off the top and a radio
  //    track is added at the bottom each advance (the playlist tail beyond 50 is dropped).
  //  - repeat off/one → autoplay only near the end (top up when ≤5 remain).
  topUpQueue: async (force = false) => {
    const s = get()
    const seed = s.ctxId || s.currentId
    if (!seed) return

    if (s.repeat === 'all') {
      // Refill the prefetched radio pool when it's low (avoids a network call per advance).
      let pool = s.radioPool
      if (pool.length < 8) {
        const radio = await getRadio(seed)
        const have = new Set([...s.queue.map((x) => x.id), ...pool.map((x) => x.id)])
        const fresh = radio.filter((r) => !have.has(r.id))
        fresh.forEach(registerSong)
        pool = [...pool, ...fresh]
      }
      set((st) => {
        let q = [...st.queue]
        const ci = q.findIndex((x) => x.id === st.ctxId)
        if (ci > 0) q = q.slice(ci)                // drop already-played tracks from the top
        if (q.length - 1 > 49) q = q.slice(0, 50)  // cap upcoming (drops the long playlist tail)
        let newPool = pool
        const need = Math.max(0, 49 - (q.length - 1))
        if (need > 0 && newPool.length) {
          const take = newPool.slice(0, need)
          newPool = newPool.slice(take.length)
          q = [...q, ...take]                      // add radio at the bottom
        }
        return { queue: q, queueOriginal: q, radioPool: newPool }
      })
      return
    }

    // repeat off / one: only top up when the queue is genuinely running low.
    const idx = s.queue.findIndex((x) => x.id === seed)
    const upcoming = idx >= 0 ? s.queue.length - 1 - idx : 0
    if (!force && upcoming > 5) return
    const radio = await getRadio(seed)
    if (!radio.length) return
    const existing = new Set(s.queue.map((x) => x.id))
    const fresh = radio.filter((r) => !existing.has(r.id))
    if (!fresh.length) return
    fresh.forEach(registerSong)
    set((st) => {
      let q = [...st.queue, ...fresh]
      if (q.length > 50) {
        const cur = q.findIndex((x) => x.id === st.ctxId)
        const trim = Math.min(q.length - 50, Math.max(0, cur))
        q = q.slice(trim)
      }
      return { queue: q, queueOriginal: q }
    })
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
    if (on) return { shuffle: true, queue: buildShuffled(s.queue, s.ctxId) }
    return { shuffle: false, queue: s.queueOriginal.length ? s.queueOriginal : s.queue }
  }),
  toggleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
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

  // Mini mode = a compact, always-on-top "picture-in-picture" window.
  setMini: (mini) => {
    set({ miniMode: mini })
    if (mini) void enterMiniWindow(); else void exitMiniWindow()
  },

  setImportProgress: (p) => set({ importProgress: p }),

  // Import a public Spotify playlist by link (scrapes the embed; no Spotify account).
  importSpotify: async (url) => runImport(get, set, () => importSpotifyPlaylist(url), 'Gagal mengimpor playlist Spotify.'),

  // Import a playlist from a CSV (e.g. an Exportify export) — gets the full track list.
  importCsv: async (name, content) => runImport(get, set, () => importCsvPlaylist(name, content), 'Gagal mengimpor CSV.'),

  // "Play next" → front of the manual queue. "Add to queue" → end of it. The manual queue
  // plays before the context resumes and is shown as "Next in queue".
  enqueueNext: (song) => {
    registerSong(song)
    set((s) => ({ userQueue: [song, ...s.userQueue] }))
  },
  enqueueLast: (song) => {
    registerSong(song)
    set((s) => ({ userQueue: [...s.userQueue, song] }))
  },

  clearUserQueue: () => set({ userQueue: [] }),

  // Click a song in "Next in queue": play it and drop it + everything before it.
  playUserQueueAt: (index) => {
    const s = get()
    const song = s.userQueue[index]
    if (!song) return
    set({ userQueue: s.userQueue.slice(index + 1) })
    void get()._playTrack(song)
  },

  reorderUserQueue: (from, to) => set((s) => {
    if (from === to || from < 0 || to < 0 || from >= s.userQueue.length || to >= s.userQueue.length) return {}
    const q = [...s.userQueue]
    const [moved] = q.splice(from, 1)
    q.splice(to, 0, moved)
    return { userQueue: q }
  }),

  // Move a context-queue entry (absolute indices) — drag-to-reorder in the QueuePanel.
  reorderQueue: (from, to) => set((s) => {
    if (from === to || from < 0 || to < 0 || from >= s.queue.length || to >= s.queue.length) return {}
    const q = [...s.queue]
    const [moved] = q.splice(from, 1)
    q.splice(to, 0, moved)
    return { queue: q }
  }),

  addSongToPlaylist: async (playlistId, song) => {
    await beAddToPlaylist(playlistId, song)
    void get().loadPlaylists()
    if (get().detail?.id === playlistId) void get().reloadDetailPlaylist()
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    await beRemoveFromPlaylist(playlistId, songId)
    void get().loadPlaylists()
    if (get().detail?.id === playlistId) void get().reloadDetailPlaylist()
  },
  createPlaylist: async (name) => {
    const pl = await beCreatePlaylist(name)
    await get().loadPlaylists()
    if (pl) { get().openPlaylist(pl.id); get().showToast(`Daftar putar "${pl.name}" dibuat.`) }
  },
  createPlaylistAndAdd: async (name, song) => {
    const pl = await beCreatePlaylist(name)
    if (pl) await beAddToPlaylist(pl.id, song)
    void get().loadPlaylists()
  },

  updatePlaylist: async (id, name, description) => {
    await beUpdatePlaylist(id, name, description)
    await get().loadPlaylists()
    if (get().detail?.id === id) void get().reloadDetailPlaylist()
    get().showToast('Daftar putar diperbarui.')
  },

  deletePlaylist: async (id) => {
    await beDeletePlaylist(id)
    await get().loadPlaylists()
    if (get().detail?.id === id) get().goHome()
    get().showToast('Daftar putar dihapus.')
  },

  // Mark a playlist recently-played and refresh the list so Home reorders.
  touchPlaylist: async (id) => {
    await beTouchPlaylist(id)
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
