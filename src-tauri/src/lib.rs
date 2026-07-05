// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

// ==================== Modules ====================

pub mod api;
pub mod audio;
pub mod db;
pub mod commands;
#[cfg(windows)]
pub mod taskbar;

// ==================== Models ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artists: Vec<Artist>,
    pub album: Option<Album>,
    pub duration: Option<u64>,
    pub thumbnail: Option<String>,
    pub stream_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: String,
    pub title: String,
    pub artists: Vec<Artist>,
    pub year: Option<i32>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub song_count: i32,
    pub songs: Vec<Song>,
    /// Up to 4 song-cover thumbnails for a mosaic cover (filled by `get_all_playlists`).
    #[serde(default)]
    pub covers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lyrics {
    pub synced: bool,
    pub text: String,
    pub lines: Option<Vec<LyricLine>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub is_playing: bool,
    pub current_song: Option<Song>,
    pub position_ms: u64,
    pub volume: f32,
    pub queue: Vec<Song>,
    pub queue_index: usize,
}

// ==================== Error Handling ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub message: String,
    pub code: Option<String>,
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError {
            message: err.to_string(),
            code: None,
        }
    }
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        ApiError {
            message: err.to_string(),
            code: None,
        }
    }
}

pub type Result<T> = std::result::Result<T, ApiError>;

// ==================== Global State ====================

use std::sync::Mutex;

pub struct AppState {
    pub player: Mutex<Option<audio::AudioPlayer>>,
    pub db: Mutex<Option<db::Database>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            player: Mutex::new(None),
            db: Mutex::new(None),
        }
    }
}
