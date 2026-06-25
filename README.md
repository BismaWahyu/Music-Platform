# Music Platform Desktop App

A modern music platform desktop application built with Tauri, React, and Rust.

## 🎯 Prototype Features

- ✅ Search for songs on YouTube Music
- ✅ Play music with audio controls
- ✅ Create and manage playlists
- ✅ Queue management
- ✅ SQLite database for local storage
- ✅ Beautiful dark theme UI

## 🛠️ Tech Stack

### Backend (Rust)
- **Tauri 2.0** - Desktop framework
- **reqwest** - HTTP client for YouTube Music API
- **rodio** - Audio playback engine
- **rusqlite** - SQLite database
- **tokio** - Async runtime

### Frontend (TypeScript + React)
- **React 18** - UI framework
- **Tauri API** - IPC communication
- **Vite** - Build tool

## 📋 Prerequisites

Before running the project, ensure you have:

1. **Rust** (latest stable)
   ```bash
   # Windows (winget)
   winget install Rustlang.Rust.MSVC

   # Or download from: https://www.rust-lang.org/tools/install
   ```

2. **Node.js** (v18+)
   ```bash
   # Check if installed
   node --version
   npm --version
   ```

3. **Tauri CLI**
   ```bash
   cargo install tauri-cli --version "^2.0.0"
   ```

4. **WebView2** (Windows only)
   - Usually pre-installed on Windows 10/11
   - If not: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## 🚀 Getting Started

1. **Navigate to project directory**
   ```bash
   cd MusicPlatform
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

## 📁 Project Structure

```
MusicPlatform/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── SearchBar.tsx
│   │   ├── SongList.tsx
│   │   ├── Player.tsx
│   │   ├── QueuePanel.tsx
│   │   └── PlaylistPanel.tsx
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── styles.css          # Global styles
│
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── api/            # API clients
│   │   │   └── youtube.rs # YouTube Music client
│   │   ├── audio/          # Audio engine
│   │   │   └── player.rs   # Audio player
│   │   ├── db/             # Database
│   │   │   └── schema.rs   # SQLite schema
│   │   ├── commands.rs     # Tauri IPC commands
│   │   ├── lib.rs          # Shared types
│   │   └── main.rs         # Entry point
│   └── Cargo.toml          # Rust dependencies
│
├── index.html              # HTML template
├── package.json            # Frontend dependencies
├── tauri.conf.json         # Tauri configuration
└── vite.config.ts          # Vite configuration
```

## 🔌 API Integration

### YouTube Music (InnerTube API)

The app uses YouTube's internal API (InnerTube) to:
- Search for songs
- Get streaming URLs
- Fetch song metadata

**Endpoints used:**
- `/youtubei/v1/search` - Search
- `/youtubei/v1/player` - Get stream URL

## 🎵 Features Roadmap

### ✅ Implemented (Prototype)
- [x] Search songs
- [x] Play/Pause/Volume controls
- [x] Queue management
- [x] Create playlists
- [x] SQLite storage
- [x] Dark theme UI

### 🚧 Planned
- [ ] Lyrics display
- [ ] Artwork fetching
- [ ] Spotify playlist import
- [ ] Local file support
- [ ] Audio visualization
- [ ] Equalizer
- [ ] Keyboard shortcuts
- [ ] System tray integration

## ⚖️ Legal Note

This is an **unofficial** educational project:

- **NOT** affiliated with Google LLC or YouTube
- For **personal use and portfolio purposes only**
- **NOT** for commercial distribution
- Users must have valid YouTube Music subscription

This project demonstrates software development skills using modern technologies.

## 📝 Development Notes

### Adding New Tauri Commands

1. Define command in `src-tauri/src/commands.rs`:
```rust
#[tauri::command]
pub fn my_command(param: String) -> Result<String, String> {
    // Your logic here
    Ok("result".to_string())
}
```

2. Register in `main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::my_command,
])
```

3. Call from frontend:
```typescript
import { invoke } from '@tauri-apps/api/core'
const result = await invoke('my_command', { param: 'value' })
```

### Database Schema

Tables:
- `playlists` - User playlists
- `playlist_songs` - Junction table
- `library` - Saved songs
- `history` - Play history
- `settings` - App settings

## 🐛 Known Issues

- Seeking not supported (rodio limitation)
- Download happens before playback (streaming WIP)
- YouTube rate limiting may occur

## 📄 License

GPL-3.0 (for educational/portfolio use)

---

**Built with ❤️ for portfolio purposes**
