<p align="center">
  <img src="public/SwayTuneDark.png" width="96" alt="SwayTune logo" />
</p>

<h1 align="center">SwayTune</h1>

<p align="center">
  A sleek desktop music player for YouTube Music — search, playlists, lyrics, and a floating mini player.
  <br />
  <strong>Status: Public Beta · Windows</strong>
</p>

<p align="center">
  <a href="https://github.com/BismaWahyu/Music-Platform/releases/latest"><strong>⬇️ Download the latest installer (Windows)</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License: GPL-3.0" />
  <img src="https://img.shields.io/badge/platform-Windows-0a7bbb" alt="Platform: Windows" />
  <img src="https://img.shields.io/badge/status-beta-f59e0b" alt="Status: Beta" />
</p>

---

> **Unofficial project.** SwayTune is not affiliated with, endorsed by, or connected to YouTube, Google, or Spotify. It streams from YouTube Music's public endpoints for personal use. See [Disclaimer](#-disclaimer).

## ✨ Features

**Playback**
- Search all of YouTube Music and play instantly
- Gapless-feeling **progressive streaming** — playback starts before the whole track is ready
- **Seek** anywhere on the timeline, play / pause, volume, and **mute**
- **Shuffle** and **repeat** (off / all / one)
- **Infinite radio** — when repeat is on, the queue keeps refilling with related tracks

**Queue**
- Spotify-style split queue: **Next in queue** (your manual picks) vs **Next from** the current context
- Drag to reorder, right-click to **remove from queue**, "Play next" / "Add to queue"

**Library & playlists**
- **Liked Songs** and a local library
- Create, edit, and delete playlists (with mosaic covers)
- Add songs via in-app search with a **1-minute preview**
- **Import from Spotify** via CSV export (Exportify) — the whole playlist is matched to YouTube Music

**Discover**
- **Home** feed and **Top charts** (Indonesia + Global)
- **Explore** moods & genres with real cover art
- Browse **album** and **artist** pages

**Now playing**
- Full **Now Playing** view and time-synced **lyrics** (via [LRCLIB](https://lrclib.net))
- A resizable, always-on-top **mini player** (picture-in-picture) that docks bottom-right
- Recently-played history on Home

**Polish**
- Custom frameless title bar with global search and Windows 11 rounded corners
- Fully English UI, dark theme

## 📦 Install (Beta) — Windows 10/11

1. Download the latest **`SwayTune_x.y.z_x64-setup.exe`** from the **[Releases page](https://github.com/BismaWahyu/Music-Platform/releases/latest)**.
2. Run it. Because the beta is **not code-signed yet**, Windows SmartScreen may warn about an "unknown publisher":
   - Click **More info → Run anyway**.
3. It installs **per-user** (no administrator prompt) and adds a Start-menu shortcut.

> WebView2 is required and comes pre-installed on Windows 10/11. If missing, get it from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

SwayTune stores everything **locally** (SQLite in your user app-data folder). There is no account and nothing is uploaded.

## 🛠️ Build from source

**Prerequisites**
- [Rust](https://www.rust-lang.org/tools/install) (stable, MSVC toolchain on Windows)
- [Node.js](https://nodejs.org) 18+ (developed on 24)
- Windows: WebView2 (pre-installed on Win 10/11)

The Tauri CLI is installed locally by `npm install` — no separate global install needed.

```bash
# 1. Install dependencies
npm install

# 2. Run the app in development (hot-reload frontend + Rust backend)
npm run tauri:dev

# 3. Build the release installer
npm run tauri:build
```

The installer is written to:

```
src-tauri/target/release/bundle/nsis/SwayTune_<version>_x64-setup.exe
```

The first release build is slow (LTO + `codegen-units = 1`); later builds are much faster.

## 🗂️ Project structure

```
Music-Platform/
├── packages/shell/                # Frontend (React + TS + Zustand + Vite)
│   ├── src/senandung/             # App UI: store, views, components
│   │   ├── store.ts               # Central Zustand store (all app state)
│   │   ├── backend.ts             # Typed bridge to Tauri commands
│   │   ├── views/                 # Home, Search, Library, Detail, Explore, Lyrics, …
│   │   └── *.tsx                  # PlayerBar, QueuePanel, Sidebar, MiniPlayer, …
│   ├── index.html
│   └── vite.config.ts
│
├── src-tauri/                     # Backend (Rust + Tauri 2)
│   ├── src/
│   │   ├── api/youtube.rs         # InnerTube (YouTube Music) client
│   │   ├── api/spotify.rs         # Spotify embed + CSV playlist parsing
│   │   ├── api/lyrics.rs          # LRCLIB lyrics
│   │   ├── audio/player.rs        # rodio + symphonia progressive PCM decode
│   │   ├── db/schema.rs           # SQLite (rusqlite, WAL)
│   │   ├── commands.rs            # Tauri IPC commands
│   │   └── main.rs / lib.rs
│   ├── icons/                     # App & installer icons (SwayTune)
│   ├── installer/                 # NSIS wizard images (header / sidebar)
│   └── tauri.conf.json            # App + bundle (NSIS) config
│
├── public/                        # SwayTune logos (served at web root)
└── README.md
```

## ⚙️ How it works

| Layer | Tech |
|-------|------|
| Shell / windowing | **Tauri 2** (Rust), custom frameless window, DWM rounded corners |
| UI | **React 18** + **TypeScript**, **Zustand** state, **Vite** build |
| Music data | YouTube **InnerTube** API via **reqwest** (search, browse, radio, charts, stream URL) |
| Audio | **rodio** + **symphonia** — streams to disk, decodes AAC/MP4 progressively, seek via a shared PCM buffer |
| Lyrics | **LRCLIB** (time-synced when available) |
| Storage | **SQLite** (`rusqlite`, WAL mode) — library, playlists, history, caches |
| Playlist import | Spotify embed scrape + **CSV** (Exportify), matched to YouTube Music |

## 🔒 Data & privacy

- All data (library, playlists, history, cached durations & cover art) lives in a local SQLite database in your app-data directory.
- No sign-in, no telemetry, no cloud sync.
- Uninstalling removes the app; your local database can be deleted separately if desired.

## 🐞 Known limitations (Beta)

- The installer is **unsigned**, so SmartScreen shows a publisher warning.
- **No auto-update** yet — new versions are installed manually.
- Direct **Spotify link import** is disabled (use CSV export); the tab is marked *coming soon*.
- **Global charts** depend on YouTube Music's region data and may occasionally be sparse.
- Some track durations are fetched on demand the first time a list is opened (cached afterwards); heavy YouTube throttling can briefly slow this.
- Windows-first: macOS/Linux may build from source but are untested.

## 🗺️ Roadmap

- [ ] Code-signed installer + auto-update
- [ ] Direct Spotify link import
- [ ] Global keyboard shortcuts & media keys
- [ ] System tray controls
- [ ] Equalizer / audio settings
- [ ] macOS & Linux builds

## ⚖️ Disclaimer

SwayTune is an **independent, third-party client**. It is **not affiliated with, endorsed by, or connected to YouTube, Google, or Spotify**, and uses none of their official trademarks or branding.

SwayTune uses YouTube's own client endpoints and **does not bypass YouTube's technical protections** or digital rights management. It is provided **as-is**, and you are responsible for complying with the terms of service of any service you access through it.

Please **support artists** by buying their music or listening through official, licensed channels.

## 📄 License

Released under the **[GNU General Public License v3.0](LICENSE)** (GPL-3.0) — you are free to use, study, modify, and redistribute SwayTune under the terms of that license.
