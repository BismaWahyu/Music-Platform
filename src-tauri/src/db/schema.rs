use rusqlite::{Connection, Result as SqliteResult, OptionalExtension};
use std::path::PathBuf;
use crate::{Song, Playlist, Artist, Album};

// ==================== Database Manager ====================

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open or create database at the given path
    pub fn open(path: PathBuf) -> SqliteResult<Self> {
        let conn = Connection::open(path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        // WAL lets reads and writes proceed concurrently (smoother under the background
        // duration backfill); busy_timeout avoids spurious "database is locked" errors;
        // NORMAL sync is the safe, fast default for WAL.
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA busy_timeout = 5000;
             PRAGMA synchronous = NORMAL;",
        )?;

        let db = Database { conn };
        db.init_schema()?;

        Ok(db)
    }

    /// Open in-memory database for testing
    pub fn in_memory() -> SqliteResult<Self> {
        let conn = Connection::open_in_memory()?;

        conn.execute("PRAGMA foreign_keys = ON", [])?;

        let db = Database { conn };
        db.init_schema()?;

        Ok(db)
    }

    fn init_schema(&self) -> SqliteResult<()> {
        // Create playlists table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                thumbnail TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
            [],
        )?;

        // Create playlist_songs junction table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS playlist_songs (
                playlist_id TEXT NOT NULL,
                song_id TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                added_at INTEGER NOT NULL DEFAULT (unixepoch()),
                PRIMARY KEY (playlist_id, song_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create songs metadata cache (referenced by library, playlists, history)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artists_json TEXT NOT NULL DEFAULT '[]',
                album_json TEXT,
                thumbnail TEXT,
                duration INTEGER
            )",
            [],
        )?;

        // Create library table (for liked/saved songs)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS library (
                song_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artists_json TEXT NOT NULL,
                album_json TEXT,
                thumbnail TEXT,
                duration INTEGER,
                added_at INTEGER NOT NULL DEFAULT (unixepoch()),
                play_count INTEGER DEFAULT 0,
                FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create history table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL,
                played_at INTEGER NOT NULL DEFAULT (unixepoch()),
                FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create settings table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Create indexes
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlist_songs_position
             ON playlist_songs(playlist_id, position)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_played_at
             ON history(played_at DESC)",
            [],
        )?;

        Ok(())
    }

    // ==================== Playlist Operations ====================

    pub fn create_playlist(&self, id: &str, name: &str, description: Option<&str>) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT INTO playlists (id, name, description) VALUES (?1, ?2, ?3)",
            [id, name, description.unwrap_or("")],
        )?;
        Ok(())
    }

    pub fn get_all_playlists(&self) -> SqliteResult<Vec<Playlist>> {
        // Most-recently played/updated first (drives the Home "recently played" grid).
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, thumbnail FROM playlists ORDER BY updated_at DESC, created_at DESC"
        )?;

        let mut playlists = stmt.query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                thumbnail: row.get(3)?,
                song_count: 0,
                songs: vec![],
                covers: vec![],
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;

        // Attach up to 4 cover thumbnails per playlist for a mosaic cover.
        for pl in &mut playlists {
            pl.covers = self.get_playlist_covers(&pl.id, 4)?;
        }
        Ok(playlists)
    }

    /// Up to `limit` distinct, non-empty song-cover thumbnails for a playlist.
    fn get_playlist_covers(&self, playlist_id: &str, limit: usize) -> SqliteResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT s.thumbnail
             FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
             WHERE ps.playlist_id = ?1 AND s.thumbnail IS NOT NULL AND s.thumbnail != ''
             ORDER BY ps.position LIMIT ?2"
        )?;
        let covers = stmt
            .query_map(rusqlite::params![playlist_id, limit as i64], |row| row.get(0))?
            .collect::<SqliteResult<Vec<String>>>()?;
        Ok(covers)
    }

    /// Bump a playlist's `updated_at` (marks it recently played).
    pub fn touch_playlist(&self, id: &str) -> SqliteResult<()> {
        self.conn.execute("UPDATE playlists SET updated_at = unixepoch() WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn get_playlist(&self, id: &str) -> SqliteResult<Option<Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, thumbnail FROM playlists WHERE id = ?1"
        )?;

        let mut playlist = stmt.query_row([id], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                thumbnail: row.get(3)?,
                song_count: 0,
                songs: vec![],
                covers: vec![],
            })
        }).optional()?;

        // Load songs for playlist
        if let Some(ref mut pl) = playlist {
            pl.songs = self.get_playlist_songs(id)?;
            pl.song_count = pl.songs.len() as i32;
        }

        Ok(playlist)
    }

    pub fn update_playlist(&self, id: &str, name: Option<&str>, description: Option<&str>) -> SqliteResult<bool> {
        if name.is_none() && description.is_none() {
            return Ok(false);
        }

        let mut parts = vec![];
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if let Some(n) = name {
            parts.push("name = ?");
            params.push(Box::new(n.to_string()));
        }
        if let Some(d) = description {
            parts.push("description = ?");
            params.push(Box::new(d.to_string()));
        }

        // Add id as the last parameter for WHERE clause
        params.push(Box::new(id.to_string()));

        let set_clause = parts.join(", ");
        let sql = format!("UPDATE playlists SET {} WHERE id = ?", set_clause);

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let result = self.conn.execute(&sql, params_refs.as_slice())?;

        Ok(result > 0)
    }

    pub fn delete_playlist(&self, id: &str) -> SqliteResult<bool> {
        let result = self.conn.execute("DELETE FROM playlists WHERE id = ?1", [id])?;
        Ok(result > 0)
    }

    /// Set (Some) or clear (None → revert to the auto grid cover) a playlist's custom cover.
    pub fn set_playlist_cover(&self, id: &str, cover: Option<&str>) -> SqliteResult<()> {
        self.conn.execute(
            "UPDATE playlists SET thumbnail = ?1 WHERE id = ?2",
            rusqlite::params![cover, id],
        )?;
        Ok(())
    }

    /// Cache a song's metadata so library/playlists/history can reference it.
    pub fn upsert_song(&self, song: &Song) -> SqliteResult<()> {
        let artists_json = serde_json::to_string(&song.artists).unwrap_or_else(|_| "[]".to_string());
        let album_json = serde_json::to_string(&song.album).unwrap_or_default();
        self.conn.execute(
            "INSERT INTO songs (id, title, artists_json, album_json, thumbnail, duration)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title, artists_json = excluded.artists_json,
                album_json = excluded.album_json, thumbnail = excluded.thumbnail,
                duration = excluded.duration",
            rusqlite::params![song.id, song.title, artists_json, album_json, song.thumbnail, song.duration],
        )?;
        Ok(())
    }

    /// Backfill a song's duration in the metadata cache (and library) once it's been
    /// resolved, so it displays without re-fetching in future sessions.
    pub fn set_song_duration(&self, song_id: &str, duration: u64) -> SqliteResult<()> {
        let d = duration as i64;
        self.conn.execute(
            "UPDATE songs SET duration = ?1 WHERE id = ?2",
            rusqlite::params![d, song_id],
        )?;
        self.conn.execute(
            "UPDATE library SET duration = ?1 WHERE song_id = ?2",
            rusqlite::params![d, song_id],
        )?;
        Ok(())
    }

    pub fn add_song_to_playlist(&self, playlist_id: &str, song: &Song, position: i32) -> SqliteResult<()> {
        self.upsert_song(song)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO playlist_songs (playlist_id, song_id, position)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![playlist_id, song.id, position],
        )?;
        Ok(())
    }

    pub fn remove_song_from_playlist(&self, playlist_id: &str, song_id: &str) -> SqliteResult<bool> {
        let result = self.conn.execute(
            "DELETE FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
            [playlist_id, song_id],
        )?;
        Ok(result > 0)
    }

    fn get_playlist_songs(&self, playlist_id: &str) -> SqliteResult<Vec<Song>> {
        // Join with the songs metadata cache to return full song info.
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.title, s.artists_json, s.album_json, s.thumbnail, s.duration
             FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
             WHERE ps.playlist_id = ?1 ORDER BY ps.position"
        )?;

        let songs = stmt.query_map([playlist_id], |row| {
            let artists_json: String = row.get(2)?;
            let album_json: Option<String> = row.get(3)?;
            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                artists: serde_json::from_str(&artists_json).unwrap_or_default(),
                album: album_json.and_then(|j| serde_json::from_str(&j).ok()),
                thumbnail: row.get(4)?,
                duration: row.get(5)?,
                stream_url: None,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;

        Ok(songs)
    }

    // ==================== Library Operations ====================

    pub fn add_to_library(&self, song: &Song) -> SqliteResult<()> {
        self.upsert_song(song)?; // satisfy the songs FK + cache metadata
        let artists_json = serde_json::to_string(&song.artists).unwrap_or_default();
        let album_json = serde_json::to_string(&song.album).unwrap_or_default();

        self.conn.execute(
            "INSERT OR REPLACE INTO library (song_id, title, artists_json, album_json, thumbnail, duration)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            [
                &song.id,
                &song.title,
                &artists_json,
                &album_json,
                song.thumbnail.as_deref().unwrap_or(""),
                &song.duration.unwrap_or(0).to_string(),
            ],
        )?;
        Ok(())
    }

    pub fn remove_from_library(&self, song_id: &str) -> SqliteResult<bool> {
        let result = self.conn.execute("DELETE FROM library WHERE song_id = ?1", [song_id])?;
        Ok(result > 0)
    }

    pub fn get_library(&self) -> SqliteResult<Vec<Song>> {
        let mut stmt = self.conn.prepare(
            "SELECT song_id, title, artists_json, album_json, thumbnail, duration
             FROM library ORDER BY added_at DESC"
        )?;

        let songs = stmt.query_map([], |row| {
            let artists_json: String = row.get(2)?;
            let album_json: String = row.get(3)?;

            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                artists: serde_json::from_str(&artists_json).unwrap_or_default(),
                album: serde_json::from_str(&album_json).ok(),
                thumbnail: row.get(4)?,
                duration: row.get(5)?,
                stream_url: None,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;

        Ok(songs)
    }

    // ==================== History Operations ====================

    pub fn add_to_history(&self, song_id: &str) -> SqliteResult<()> {
        let id = format!("{}:{}", song_id, chrono::Utc::now().timestamp_millis());
        self.conn.execute(
            "INSERT INTO history (id, song_id, played_at) VALUES (?1, ?2, unixepoch())",
            [&id, song_id],
        )?;
        Ok(())
    }

    pub fn get_history(&self, limit: usize) -> SqliteResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            &format!("SELECT song_id FROM history ORDER BY played_at DESC LIMIT {}", limit)
        )?;

        let song_ids = stmt.query_map([], |row| row.get(0))?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(song_ids)
    }

    /// Recently-played songs with full metadata, deduped to the most recent play of each
    /// track and ordered newest-first (joins the songs metadata cache).
    pub fn get_history_songs(&self, limit: usize) -> SqliteResult<Vec<Song>> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.title, s.artists_json, s.album_json, s.thumbnail, s.duration,
                    MAX(h.played_at) AS last_played
             FROM history h JOIN songs s ON s.id = h.song_id
             GROUP BY h.song_id
             ORDER BY last_played DESC
             LIMIT ?1"
        )?;

        let songs = stmt.query_map([limit as i64], |row| {
            let artists_json: String = row.get(2)?;
            let album_json: Option<String> = row.get(3)?;
            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                artists: serde_json::from_str(&artists_json).unwrap_or_default(),
                album: album_json.and_then(|j| serde_json::from_str(&j).ok()),
                thumbnail: row.get(4)?,
                duration: row.get(5)?,
                stream_url: None,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;

        Ok(songs)
    }

    pub fn clear_history(&self) -> SqliteResult<()> {
        self.conn.execute("DELETE FROM history", [])?;
        Ok(())
    }

    // ==================== Settings Operations ====================

    pub fn set_setting(&self, key: &str, value: &str) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            [key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> SqliteResult<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;

        let result = stmt.query_row([key], |row| row.get(0)).optional()?;
        Ok(result)
    }
}

// ==================== Database Singleton ====================

use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref DB: Mutex<Option<Database>> = Mutex::new(None);
}

pub fn init_database(path: PathBuf) -> SqliteResult<()> {
    let db = Database::open(path)?;
    *DB.lock().unwrap() = Some(db);
    Ok(())
}

pub fn get_db() -> &'static Mutex<Option<Database>> {
    &DB
}
