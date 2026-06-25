// Data model + runtime track registry. No mock/seed data — everything comes from
// the real backend (search results, library, playlists).

export interface Track {
  id: string
  title: string
  dur: number
  artist: string
  album: string
  hue: number
  thumbnail?: string
}

export interface BackendArtist {
  id: string
  name: string
  thumbnail?: string | null
}

export interface BackendAlbum {
  id: string
  title: string
}

export interface BackendSong {
  id: string
  title: string
  artists: BackendArtist[]
  album?: BackendAlbum | null
  duration?: number | null
  thumbnail?: string | null
  stream_url?: string | null
}

export interface BackendPlaylist {
  id: string
  name: string
  description?: string | null
  thumbnail?: string | null
  song_count: number
  songs: BackendSong[]
}

// Empty placeholder used when nothing is playing.
export const EMPTY_TRACK: Track = { id: '', title: '', dur: 0, artist: '', album: '', hue: 240 }

const dynamicTracks: Record<string, Track> = {}

/** Deterministic hue (0–359) from a video id, so each song gets a stable striped-cover color. */
export function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

export function artistName(s: BackendSong): string {
  return s.artists.map((a) => a.name).filter(Boolean).join(', ') || 'Artis tak dikenal'
}

/** Convert a backend song into a Track and cache it so views can render it by id. */
export function registerSong(s: BackendSong): Track {
  const t: Track = {
    id: s.id,
    title: s.title,
    dur: s.duration ?? 0,
    artist: artistName(s),
    album: s.album?.title ?? '',
    hue: hueFromId(s.id),
    thumbnail: s.thumbnail ?? undefined,
  }
  dynamicTracks[t.id] = t
  return t
}

/** Look up a track by id from the runtime registry, or the empty placeholder. */
export function getTrack(id: string): Track {
  return dynamicTracks[id] ?? EMPTY_TRACK
}
