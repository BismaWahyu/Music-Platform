use crate::api::{YouTubeClient, StreamInfo, BrowseSection, BrowsePage};
use crate::audio::get_player;
use crate::db::get_db;
use crate::{Song, Playlist, PlayerState, Lyrics};
use std::sync::Mutex;
use tauri::{Emitter, State};

// ==================== YouTube Search ====================

#[tauri::command]
pub async fn search(query: String) -> Result<Vec<Song>, String> {
    let client = YouTubeClient::new();
    client.search(&query).await.map_err(|e| e.message)
}

// ==================== Stream URL ====================

#[tauri::command]
pub async fn get_stream_url(video_id: String) -> Result<StreamInfo, String> {
    let client = YouTubeClient::new();
    client.get_stream_url(&video_id).await.map_err(|e| e.message)
}

// ==================== Browse ====================

#[tauri::command]
pub async fn get_home() -> Result<Vec<BrowseSection>, String> {
    let client = YouTubeClient::new();
    client.get_home().await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn get_album(browse_id: String) -> Result<BrowsePage, String> {
    let client = YouTubeClient::new();
    client.get_album(&browse_id).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn get_artist(browse_id: String) -> Result<BrowsePage, String> {
    let client = YouTubeClient::new();
    client.get_artist(&browse_id).await.map_err(|e| e.message)
}

// ==================== Lyrics ====================

#[tauri::command]
pub async fn get_lyrics(
    title: String,
    artist: String,
    album: Option<String>,
    duration: Option<u64>,
) -> Result<Lyrics, String> {
    crate::api::lyrics::fetch_lyrics(&title, &artist, album.as_deref(), duration)
        .await
        .map_err(|e| e.message)
}

// ==================== Playback Controls ====================

#[tauri::command]
pub fn play(app: tauri::AppHandle, url: String, song: Song) -> Result<(), String> {
    // Cache the song's metadata so history/playlists can reference it later.
    if let Some(db) = get_db().lock().unwrap().as_ref() {
        let _ = db.upsert_song(&song);
    }

    // Downloading + decoding is blocking and would freeze the UI if run on the
    // command thread, so do it on a background thread and return immediately.
    // The event emitter loop reports the resulting playback state; on failure we emit
    // `playback-error` so the frontend can notify the user and skip the track.
    let song_id = song.id.clone();
    std::thread::spawn(move || {
        let player = get_player();
        if let Err(e) = player.play_url(&url, song) {
            eprintln!("[play] failed: {}", e);
            let _ = app.emit("playback-error", serde_json::json!({ "songId": song_id, "message": e }));
        }
    });
    Ok(())
}

#[tauri::command]
pub fn pause() -> Result<(), String> {
    let player = get_player();
    player.pause();
    Ok(())
}

#[tauri::command]
pub fn resume() -> Result<(), String> {
    let player = get_player();
    player.resume();
    Ok(())
}

#[tauri::command]
pub fn toggle_playback() -> Result<(), String> {
    let player = get_player();
    player.toggle_playback();
    Ok(())
}

#[tauri::command]
pub fn seek(position_ms: u64) -> Result<(), String> {
    let player = get_player();
    player.seek(position_ms).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_volume(volume: f32) -> Result<(), String> {
    let player = get_player();
    player.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub fn get_player_state() -> Result<PlayerState, String> {
    let player = get_player();
    Ok(player.get_player_state())
}

// ==================== Playlist Management ====================

#[tauri::command]
pub fn create_playlist(name: String, description: Option<String>) -> Result<Playlist, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    db.create_playlist(&id, &name, description.as_deref())
        .map_err(|e| e.to_string())?;

    db.get_playlist(&id).map_err(|e| e.to_string())?
        .ok_or("Failed to create playlist".to_string())
}

#[tauri::command]
pub fn get_playlists() -> Result<Vec<Playlist>, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_all_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_to_playlist(playlist_id: String, song: Song) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // Append at the end.
    let position = {
        let playlist = db.get_playlist(&playlist_id).map_err(|e| e.to_string())?
            .ok_or("Playlist not found".to_string())?;
        playlist.songs.len() as i32
    };

    db.add_song_to_playlist(&playlist_id, &song, position)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_playlist(playlist_id: String, song_id: String) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.remove_song_from_playlist(&playlist_id, &song_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ==================== Queue Management ====================

#[tauri::command]
pub fn set_queue(songs: Vec<Song>, start_index: usize) -> Result<(), String> {
    let player = get_player();
    player.set_queue(songs, start_index);
    Ok(())
}

#[tauri::command]
pub fn add_to_queue(song: Song) -> Result<(), String> {
    let player = get_player();
    player.add_to_queue(song);
    Ok(())
}

#[tauri::command]
pub fn remove_from_queue(index: usize) -> Result<(), String> {
    let player = get_player();
    player.remove_from_queue(index);
    Ok(())
}

#[tauri::command]
pub fn get_queue() -> Result<Vec<Song>, String> {
    let player = get_player();
    Ok(player.get_queue())
}

#[tauri::command]
pub fn play_next() -> Result<Option<Song>, String> {
    let player = get_player();
    Ok(player.play_next())
}

#[tauri::command]
pub fn play_previous() -> Result<Option<Song>, String> {
    let player = get_player();
    Ok(player.play_previous())
}

// ==================== Library ====================

#[tauri::command]
pub fn add_to_library(song: Song) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.add_to_library(&song).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_library() -> Result<Vec<Song>, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_library().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_library(song_id: String) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.remove_from_library(&song_id).map_err(|e| e.to_string())?;
    Ok(())
}

// ==================== History ====================

#[tauri::command]
pub fn add_to_history(song_id: String) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.add_to_history(&song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history(limit: usize) -> Result<Vec<String>, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_history(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history_songs(limit: usize) -> Result<Vec<Song>, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_history_songs(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history() -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.clear_history().map_err(|e| e.to_string())
}
