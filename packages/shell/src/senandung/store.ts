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
  touchPlaylist as beTouchPlaylist, getPlaylist as beGetPlaylist, setPlaylistCover as beSetPlaylistCover,
  saveSession as beSaveSession, getSession as beGetSession,
  getHome, getAlbum, getArtist, getMoods, getMood, getMoodCover, getMoodCovers, saveMoodCovers, getRadio,
  getCharts, resolveDuration, getRecommendations, importSpotifyPlaylist, importCsvPlaylist,
  type BackendPlayerState, type BrowseSection, type BrowsePage, type BrowseItem, type BrowseKind,
  type MoodCategory, type SpotifyImportProgress,
} from './backend'
import { enterMiniWindow, exitMiniWindow } from './window'

export type View = 'home' | 'library' | 'liked' | 'detail' | 'search' | 'nowplaying' | 'lyrics' | 'browse' | 'explore'
export interface DetailRef { type: 'playlist'; id: string }
// A region's charts (e.g. Indonesia / Global) for the Home page.
export interface ChartGroup { region: string; label: string; sections: BrowseSection[] }
export type BrowseRefKind = BrowseKind | 'mood'
export interface BrowseRef { kind: BrowseRefKind; id: string }

// All moods share one browseId; `params` is what differentiates them, so cover-cache keys
// must include both.
export function moodKey(cat: { browse_id: string; params?: string | null }): string {
  return `${cat.browse_id}|${cat.params ?? ''}`
}

// off → no looping; all → loop the queue; one → repeat the current track.
export type RepeatMode = 'off' | 'all' | 'one'

// off → in order; on → shuffled; smart → shuffled + recommendations woven in (Spotify-style).
export type ShuffleMode = 'off' | 'on' | 'smart'

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
  _preMuteVolume: number  // internal: volume to restore when unmuting
  shuffleMode: ShuffleMode
  smartPool: BackendSong[]              // internal: prefetched Smart Shuffle recommendations
  smartRecIds: Record<string, true>     // ids in `queue` that are woven-in recommendations
  smartRejected: Record<string, true>   // recs the user removed — never re-insert this session
  smartEligible: boolean                // whether the current context supports Smart Shuffle
  smartKey: string                      // cache key for the current context's rec pool
  smartAddTargetId: string              // playlist id recs can be added to ('' = none)
  repeat: RepeatMode
  queueOpen: boolean
  miniMode: boolean
  lyricsFrom: View        // where to return when closing the lyrics view
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
  homeLoading: boolean
  charts: ChartGroup[]
  moods: MoodCategory[]
  moodCovers: Record<string, string>  // browseId → representative cover url
  browseRef: BrowseRef | null
  browsePage: BrowsePage | null
  browseLoading: boolean
  online: boolean      // network status (drives the offline indicator)
  needsResume: boolean // a session was restored but playback hasn't been (re)started yet
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
  loadCharts: () => Promise<void>
  ensureDurations: (songs: BackendSong[]) => Promise<void>
  loadMoods: () => Promise<void>
  loadMoodCovers: () => Promise<void>
  openMood: (cat: MoodCategory) => Promise<void>
  openBrowse: (kind: BrowseKind, id: string) => Promise<void>
  openBrowseItem: (item: BrowseItem) => void
  playBrowsePage: () => void
  topUpQueue: (force?: boolean) => Promise<void>
  showToast: (message: string) => void
  setOnline: (v: boolean) => void
  handlePlaybackError: (songId: string, message: string, kind?: string) => void
  setImportProgress: (p: SpotifyImportProgress) => void
  importSpotify: (url: string) => Promise<boolean>
  importCsv: (name: string, content: string) => Promise<boolean>
  applyPlayerState: (s: BackendPlayerState) => void
  saveSession: (force?: boolean) => void
  loadSession: () => Promise<void>
  resumePlayback: () => Promise<void>
  togglePlay: () => void
  toggleShuffle: () => void
  setShuffle: (on: boolean) => void
  setShuffleMode: (mode: ShuffleMode) => void
  refillSmart: () => Promise<void>
  toggleRepeat: () => void
  toggleQueue: () => void
  toggleMute: () => void
  toggleLyrics: () => void
  toggleLike: () => Promise<void>
  setMini: (mini: boolean) => void
  enqueueNext: (song: BackendSong) => void
  enqueueLast: (song: BackendSong) => void
  reorderQueue: (from: number, to: number) => void
  removeFromUserQueue: (index: number) => void
  removeFromContextQueue: (index: number) => void
  clearUserQueue: () => void
  playUserQueueAt: (index: number) => void
  reorderUserQueue: (from: number, to: number) => void
  _playTrack: (song: BackendSong) => Promise<void>
  addSongToPlaylist: (playlistId: string, song: BackendSong) => Promise<void>
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>
  createPlaylist: (name: string) => Promise<void>
  createPlaylistAndAdd: (name: string, song: BackendSong) => Promise<void>
  updatePlaylist: (id: string, name: string, description: string, cover: string | null) => Promise<void>
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

// ---- Smart Shuffle ----
const SMART_INTERVAL = 3   // baseline: one recommendation after every N context tracks (1:3)
const SMART_SEEDS = 5      // playlist tracks sampled to seed recommendations
const SMART_POOL_MIN = 8   // refill the rec pool when it drops below this
const SMART_LIMIT = 30     // recommendations requested per refill
const SMART_CONTEXTS: View[] = ['detail', 'liked', 'library']

// Adaptive ratio: weave recommendations more densely into short playlists (so a tiny
// playlist still feels varied), otherwise keep the 1:3 baseline.
function smartInterval(size: number): number {
  return size <= 6 ? 2 : SMART_INTERVAL
}

// Per-context recommendation cache (session-lived): key → fetched candidate songs, so
// toggling Smart Shuffle off/on for the same playlist doesn't re-hit the network.
const smartCache = new Map<string, BackendSong[]>()

// A stable cache key for the current play context.
function smartKeyOf(s: SenandungState): string {
  if (s.view === 'detail' && s.detail) return `pl:${s.detail.id}`
  if (s.view === 'liked') return 'liked'
  if (s.view === 'library') return 'library'
  return ''
}

// Pick up to `n` distinct song ids spread across the list, so recommendations reflect the
// whole playlist rather than just its first track.
function sampleSeeds(list: BackendSong[], n: number): string[] {
  const ids = list.map((s) => s.id).filter(Boolean)
  if (ids.length <= n) return ids
  return shuffleInPlace([...ids]).slice(0, n)
}

// Weave one recommendation from `pool` after every `interval` tracks. Returns the woven
// list, the set of inserted rec ids, and the unused remainder of the pool.
function weaveList(items: BackendSong[], pool: BackendSong[], interval: number): {
  queue: BackendSong[]; recIds: Record<string, true>; poolLeft: BackendSong[]
} {
  const queue: BackendSong[] = []
  const recIds: Record<string, true> = {}
  let pi = 0
  let since = 0
  for (const it of items) {
    queue.push(it)
    since++
    if (since >= interval && pi < pool.length) {
      const rec = pool[pi++]
      queue.push(rec)
      recIds[rec.id] = true
      since = 0
    }
  }
  return { queue, recIds, poolLeft: pool.slice(pi) }
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
      get().showToast(`Playlist "${pl.name}" imported — ${pl.songs.length} songs.`)
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
  if (s.view === 'search') return 'Search results'
  if (s.view === 'liked') return 'Liked Songs'
  if (s.view === 'library') return 'Library'
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

// Throttle for periodic session autosave (position updates ~every few seconds).
let lastSessionSave = 0
const SESSION_QUEUE_CAP = 200 // bound how many queue songs we persist

// Song ids we've already tried to resolve a duration for this session (success or not),
// so `ensureDurations` never re-requests the same track.
const durationTried = new Set<string>()
// Circuit breaker: if resolving keeps failing (e.g. the client is being throttled), stop
// backfilling for the rest of the session so we don't hammer the network.
let durationFailStreak = 0
let durationBackfillOff = false

// Patch a freshly-resolved duration into the store lists that actually contain this song,
// so the UI updates in place (views read `song.duration` directly). Only rebuilds the
// arrays that change, to avoid churning unrelated subscribers.
function patchDuration(set: (fn: (s: SenandungState) => Partial<SenandungState>) => void, id: string, dur: number) {
  const needs = (arr: BackendSong[]) => arr.some((s) => s.id === id && !s.duration)
  const fix = (arr: BackendSong[]) => arr.map((s) => (s.id === id && !s.duration ? { ...s, duration: dur } : s))
  set((s) => {
    const out: Partial<SenandungState> = {}
    if (s.detailPlaylist && needs(s.detailPlaylist.songs)) out.detailPlaylist = { ...s.detailPlaylist, songs: fix(s.detailPlaylist.songs) }
    if (needs(s.library)) out.library = fix(s.library)
    if (needs(s.searchResults)) out.searchResults = fix(s.searchResults)
    if (needs(s.queue)) out.queue = fix(s.queue)
    if (needs(s.userQueue)) out.userQueue = fix(s.userQueue)
    if (needs(s.history)) out.history = fix(s.history)
    if (s.browsePage && needs(s.browsePage.songs)) out.browsePage = { ...s.browsePage, songs: fix(s.browsePage.songs) }
    return out
  })
}

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
  _preMuteVolume: 0.7,
  shuffleMode: 'off',
  smartPool: [],
  smartRecIds: {},
  smartRejected: {},
  smartEligible: false,
  smartKey: '',
  smartAddTargetId: '',
  repeat: 'off',
  queueOpen: false,
  miniMode: false,
  lyricsFrom: 'home',
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
  homeLoading: true,
  charts: [],
  moods: [],
  moodCovers: {},
  browseRef: null,
  browsePage: null,
  browseLoading: false,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  needsResume: false,
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
    if (pl) void get().ensureDurations(pl.songs)
  },

  // Refresh the open playlist's songs (after adding/removing/importing).
  reloadDetailPlaylist: async () => {
    const id = get().detail?.id
    if (!id) return
    const pl = await beGetPlaylist(id)
    if (get().detail?.id !== id) return
    pl?.songs.forEach(registerSong)
    set({ detailPlaylist: pl })
    if (pl) void get().ensureDurations(pl.songs)
  },

  // Low-level: actually play a track (set current + resolve stream + backend play).
  // Does NOT touch queue/context/userQueue. Guards against a newer play superseding this
  // one mid-await (which would otherwise desync the displayed song from the audio).
  _playTrack: async (song) => {
    registerSong(song)
    set({ current: song, currentId: song.id, progress: 0, isPlaying: true, needsResume: false })
    if (!inTauri) return
    set({ realMode: true })
    const info = await getStreamUrl(song.id)
    if (get().currentId !== song.id) return // superseded by a newer play
    if (info) {
      const enriched = { ...song, duration: info.duration ?? song.duration ?? null }
      registerSong(enriched)
      set({ current: enriched })
      const ok = await bePlay(info.url, enriched)
      if (get().currentId !== song.id) return // superseded while starting playback
      if (!ok) { get().handlePlaybackError(song.id, 'Failed to start playback'); return }
      await addToHistory(song.id)
      void get().loadHistory()
      get().saveSession(true) // snapshot the new song + queue
    } else {
      get().handlePlaybackError(song.id, 'No stream URL for this song')
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
      const mode = get().shuffleMode
      const eligible = SMART_CONTEXTS.includes(get().view)
      const active = mode !== 'off' ? buildShuffled(list, song.id) : list
      set({
        queueOriginal: list, queue: active, radioPool: [],
        ctxId: song.id, contextLabel: contextLabelOf(get()),
        smartEligible: eligible, smartPool: [], smartRecIds: {}, smartRejected: {},
        smartKey: smartKeyOf(get()),
        smartAddTargetId: get().view === 'detail' ? (get().detail?.id ?? '') : '',
      })
      await get()._playTrack(song)
      // Smart Shuffle recs are fetched + woven in asynchronously (see refillSmart).
      if (mode === 'smart' && eligible) void get().refillSmart()
      return
    } else if (get().queue.some((x) => x.id === song.id)) {
      set({ ctxId: song.id }) // jump within the current context
    } else {
      set({ queueOriginal: [song], queue: [song], ctxId: song.id, contextLabel: contextLabelOf(get()), smartEligible: false, smartPool: [], smartRecIds: {}, smartRejected: {}, smartKey: '', smartAddTargetId: '' })
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
    void get().ensureDurations(library)
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
    set({ home, homeLoading: false })
  },

  // Fetch region charts (Indonesia + Global) for the Home page. Best-effort: a region that
  // errors or returns nothing is simply omitted.
  loadCharts: async () => {
    const regions: { region: string; label: string }[] = [
      { region: 'ID', label: 'Top charts · Indonesia' },
      { region: 'ZZ', label: 'Top charts · Global' },
    ]
    const results = await Promise.all(regions.map((r) => getCharts(r.region)))
    const charts: ChartGroup[] = regions
      // Cap items per section so a "Top 100" shelf doesn't render hundreds of cards.
      .map((r, i) => ({ ...r, sections: results[i].map((sec) => ({ ...sec, items: sec.items.slice(0, 20) })) }))
      .filter((g) => g.sections.length > 0)
    charts.forEach((g) => g.sections.forEach((sec) => sec.items.forEach((it) => {
      if (it.kind === 'song') registerSong(browseItemToSong(it))
    })))
    set({ charts })
  },

  // Resolve + cache durations for songs that don't have one yet, so lists show durations
  // without playing. Concurrency-limited; each id is only ever attempted once per session.
  ensureDurations: async (songs) => {
    if (!inTauri || durationBackfillOff) return
    // Cap each pass so a big list (whole library / long playlist) can't fire a burst of
    // heavy player requests at once.
    const todo = songs.filter((s) => !s.duration && s.id && !durationTried.has(s.id)).slice(0, 20)
    if (!todo.length) return
    todo.forEach((s) => durationTried.add(s.id))
    let i = 0
    const worker = async () => {
      while (i < todo.length && !durationBackfillOff) {
        const song = todo[i++]
        const dur = await resolveDuration(song.id)
        if (dur && dur > 0) {
          durationFailStreak = 0
          patchDuration(set, song.id, dur)
        } else {
          // A run of failures means we're likely being throttled — stop for this session.
          if (++durationFailStreak >= 6) { durationBackfillOff = true }
        }
      }
    }
    await Promise.all(Array.from({ length: 2 }, worker))
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
    if (page) void get().ensureDurations(page.songs)
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

    // Smart Shuffle manages its own queue (playlist tracks + woven recommendations).
    if (s.shuffleMode === 'smart' && s.smartEligible) { await get().refillSmart(); return }

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

  setOnline: (v) => set({ online: v }),

  // A track failed to play. On a connection failure we STOP (don't skip) and flag offline,
  // matching Spotify — so a dropped connection doesn't churn through the whole queue. Other
  // failures (unavailable track, decode error) skip to the next track with a loop guard.
  handlePlaybackError: (songId, message, kind) => {
    const s = get()
    if (songId !== s.currentId) return // stale error for a track we already moved past

    const offline = kind === 'network' || !s.online || (typeof navigator !== 'undefined' && !navigator.onLine)
    if (offline) {
      set({ isPlaying: false, online: false, _failStreak: 0 })
      s.showToast("You're offline — playback stopped.")
      console.warn('playback stopped (offline):', message)
      return
    }

    const title = getTrack(songId).title || 'This song'
    const streak = s._failStreak + 1
    const cap = Math.min(Math.max(s.queue.length, 1), 6)
    if (streak >= cap) {
      set({ _failStreak: 0, isPlaying: false })
      s.showToast('A few songs failed to play. Try again later.')
      console.error('playback error (giving up):', message)
      return
    }
    set({ _failStreak: streak })
    s.showToast(`Couldn't play "${title}" — skipping…`)
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
      // A track that's actually producing audio clears the failure streak and confirms we're
      // back online.
      ...(s.is_playing && (s.position_ms ?? 0) > 500 ? { _failStreak: 0, online: true } : {}),
    })
    get().saveSession() // throttled — keeps the saved position roughly current
  },

  // Persist the current playback session so it can be resumed after the app is reopened.
  // Throttled unless `force` (e.g. a song change) to avoid churning the DB on every tick.
  saveSession: (force) => {
    if (!inTauri) return
    const s = get()
    if (!s.current) return
    const now = Date.now()
    if (!force && now - lastSessionSave < 3000) return
    lastSessionSave = now
    const cap = (a: BackendSong[]) => a.slice(0, SESSION_QUEUE_CAP)
    const snapshot = {
      current: s.current, progress: s.progress,
      queue: cap(s.queue), queueOriginal: cap(s.queueOriginal), userQueue: cap(s.userQueue),
      ctxId: s.ctxId, contextLabel: s.contextLabel,
      shuffleMode: s.shuffleMode, repeat: s.repeat, volume: s.volume,
      smartEligible: s.smartEligible, smartKey: s.smartKey, smartAddTargetId: s.smartAddTargetId,
    }
    void beSaveSession(JSON.stringify(snapshot))
  },

  // Restore the last session on startup: load the song, position, queue, and modes WITHOUT
  // auto-playing (Spotify-style). Playback resumes at the saved position when the user hits
  // play (see resumePlayback).
  loadSession: async () => {
    if (!inTauri) return
    const raw = await beGetSession()
    if (!raw) return
    let snap: any
    try { snap = JSON.parse(raw) } catch { return }
    if (!snap?.current?.id || get().currentId) return // nothing to restore, or already playing
    const lists: BackendSong[] = [snap.current, ...(snap.queue ?? []), ...(snap.queueOriginal ?? []), ...(snap.userQueue ?? [])]
    lists.forEach((x) => x && registerSong(x))
    set({
      current: snap.current, currentId: snap.current.id, progress: snap.progress || 0,
      queue: snap.queue ?? [], queueOriginal: snap.queueOriginal ?? [], userQueue: snap.userQueue ?? [],
      ctxId: snap.ctxId ?? snap.current.id, contextLabel: snap.contextLabel ?? '',
      shuffleMode: snap.shuffleMode ?? 'off', repeat: snap.repeat ?? 'off',
      smartEligible: !!snap.smartEligible, smartKey: snap.smartKey ?? '', smartAddTargetId: snap.smartAddTargetId ?? '',
      isPlaying: false, needsResume: true, realMode: false,
    })
    if (typeof snap.volume === 'number') get().setVolume(snap.volume)
  },

  // Start real playback of the restored song and seek back to where it left off (best-effort:
  // the seek fires after decode has had a moment to catch up).
  resumePlayback: async () => {
    const cur = get().current
    if (!cur) return
    const pos = get().progress
    set({ needsResume: false })
    await get()._playTrack(cur)
    if (pos > 2 && get().currentId === cur.id) {
      setTimeout(() => { if (get().currentId === cur.id) get().setProgress(pos) }, 1200)
    }
  },

  togglePlay: () => {
    if (!get().currentId) return
    // First press after restoring a session → start + seek to the saved position.
    if (get().needsResume) { void get().resumePlayback(); return }
    set((s) => ({ isPlaying: !s.isPlaying }))
    if (get().realMode) void bePlayPause()
    get().saveSession(true)
  },
  // Cycle Off → Shuffle → Smart Shuffle → Off (Smart is skipped when the context can't
  // support it, e.g. search results / radio).
  toggleShuffle: () => {
    const s = get()
    const canSmart = s.smartEligible && s.queueOriginal.length > 0
    const next: ShuffleMode = s.shuffleMode === 'off' ? 'on' : s.shuffleMode === 'on' ? (canSmart ? 'smart' : 'off') : 'off'
    get().setShuffleMode(next)
  },
  // The plain shuffle button (e.g. a playlist's "Shuffle") maps onto the shuffle mode.
  setShuffle: (on) => get().setShuffleMode(on ? 'on' : 'off'),

  setShuffleMode: (mode) => {
    const s = get()
    if (mode === s.shuffleMode) return
    const base = s.queueOriginal.length ? s.queueOriginal : s.queue
    if (mode === 'off') {
      // Restore the original order (drops woven recommendations).
      set({ shuffleMode: 'off', smartRecIds: {}, smartPool: [], queue: base })
      return
    }
    if (mode === 'on') {
      set({ shuffleMode: 'on', smartRecIds: {}, smartPool: [], queue: s.queue.length ? buildShuffled(base, s.ctxId) : s.queue })
      return
    }
    // smart — fall back to plain shuffle if the context isn't eligible.
    if (!s.smartEligible) { get().setShuffleMode('on'); return }
    set({ shuffleMode: 'smart', smartRecIds: {}, smartPool: [], queue: s.queue.length ? buildShuffled(base, s.ctxId) : s.queue })
    void get().refillSmart()
  },

  // Fetch recommendations for the current playlist and weave them into the upcoming queue.
  // Refills the pool when low, and weaves once (keeping the current + already-played tracks
  // intact). Guards against the mode being turned off mid-fetch.
  refillSmart: async () => {
    if (!inTauri) return
    let s = get()
    if (s.shuffleMode !== 'smart' || !s.smartEligible) return

    if (s.smartPool.length < SMART_POOL_MIN) {
      const key = s.smartKey
      let candidates = smartCache.get(key) ?? []
      // Fetch (once per context, then cached) only if the cache is thin.
      if (candidates.length < SMART_POOL_MIN) {
        const seeds = sampleSeeds(s.queueOriginal, SMART_SEEDS)
        if (seeds.length) {
          const exclude = s.queueOriginal.map((x) => x.id) // exclude the playlist itself
          const fetched = await getRecommendations(seeds, exclude, SMART_LIMIT)
          if (get().shuffleMode !== 'smart') return // toggled off while fetching
          fetched.forEach(registerSong)
          const seen = new Set(candidates.map((x) => x.id))
          candidates = [...candidates, ...fetched.filter((f) => !seen.has(f.id))]
          if (key) smartCache.set(key, candidates)
        }
      }
      // Feed the pool from candidates, skipping anything queued / already a rec / rejected.
      s = get()
      const blocked = new Set([
        ...s.queue.map((x) => x.id),
        ...Object.keys(s.smartRecIds),
        ...Object.keys(s.smartRejected),
        ...s.smartPool.map((x) => x.id),
      ])
      const fresh = candidates.filter((c) => !blocked.has(c.id))
      if (fresh.length) set((st) => ({ smartPool: [...st.smartPool, ...fresh] }))
    }

    // Continuously weave recs into the trailing, not-yet-woven playlist tracks (the part
    // after the last existing rec). This keeps the immediate upcoming order stable while
    // extending recs deeper as the pool refills — no re-shuffling of what's already woven.
    s = get()
    if (s.smartPool.length > 0 && s.queue.length > 1) {
      const interval = smartInterval(s.queueOriginal.length)
      const ci = Math.max(0, s.queue.findIndex((x) => x.id === s.ctxId))
      let lastRec = -1
      for (let i = 0; i < s.queue.length; i++) if (s.smartRecIds[s.queue[i].id]) lastRec = i
      const start = Math.max(lastRec + 1, ci + 1) // never touch played/current or woven upcoming
      const tail = s.queue.slice(start)
      // Only worth weaving once there's at least a full interval of bare playlist tracks.
      if (tail.filter((t) => !s.smartRecIds[t.id]).length >= interval) {
        const { queue: woven, recIds, poolLeft } = weaveList(tail, s.smartPool, interval)
        set({ queue: [...s.queue.slice(0, start), ...woven], smartRecIds: { ...s.smartRecIds, ...recIds }, smartPool: poolLeft })
      }
    }
  },
  toggleRepeat: () => { set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })); get().saveSession(true) },
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),

  // Mute/unmute: drop the volume to 0, remembering the previous level to restore on unmute.
  toggleMute: () => {
    const s = get()
    if (s.volume > 0) {
      set({ _preMuteVolume: s.volume })
      get().setVolume(0)
    } else {
      get().setVolume(s._preMuteVolume > 0 ? s._preMuteVolume : 0.7)
    }
  },

  // Open the lyrics view, or close it (returning to the previous view) if already open.
  toggleLyrics: () => {
    const s = get()
    if (s.view === 'lyrics') set({ view: s.lyricsFrom })
    else set({ lyricsFrom: s.view, view: 'lyrics' })
  },

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
  importSpotify: async (url) => runImport(get, set, () => importSpotifyPlaylist(url), 'Failed to import the Spotify playlist.'),

  // Import a playlist from a CSV (e.g. an Exportify export) — gets the full track list.
  importCsv: async (name, content) => runImport(get, set, () => importCsvPlaylist(name, content), 'Failed to import the CSV.'),

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

  // Remove a song from the manual "Next in queue" list.
  removeFromUserQueue: (index) => set((s) => {
    if (index < 0 || index >= s.userQueue.length) return {}
    return { userQueue: s.userQueue.filter((_, i) => i !== index) }
  }),

  // Remove a song from the context queue (absolute index). Never removes the anchor track.
  // A removed Smart Shuffle recommendation is remembered so it isn't re-inserted, and does
  // NOT alter queueOriginal (recs aren't part of the playlist).
  removeFromContextQueue: (index) => set((s) => {
    if (index < 0 || index >= s.queue.length || s.queue[index].id === s.ctxId) return {}
    const removed = s.queue[index]
    const q = [...s.queue]
    q.splice(index, 1)
    if (s.smartRecIds[removed.id]) {
      const recIds = { ...s.smartRecIds }; delete recIds[removed.id]
      return { queue: q, smartRecIds: recIds, smartRejected: { ...s.smartRejected, [removed.id]: true } }
    }
    return { queue: q, queueOriginal: q }
  }),

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
    if (pl) { get().openPlaylist(pl.id); get().showToast(`Playlist "${pl.name}" created.`) }
  },
  createPlaylistAndAdd: async (name, song) => {
    const pl = await beCreatePlaylist(name)
    if (pl) await beAddToPlaylist(pl.id, song)
    void get().loadPlaylists()
  },

  updatePlaylist: async (id, name, description, cover) => {
    await beUpdatePlaylist(id, name, description)
    await beSetPlaylistCover(id, cover) // Some = custom image, null = revert to grid
    await get().loadPlaylists()
    if (get().detail?.id === id) void get().reloadDetailPlaylist()
    get().showToast('Playlist updated.')
  },

  deletePlaylist: async (id) => {
    await beDeletePlaylist(id)
    await get().loadPlaylists()
    if (get().detail?.id === id) get().goHome()
    get().showToast('Playlist deleted.')
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
