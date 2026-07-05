use crate::api::{YouTubeClient, StreamInfo, BrowseSection, BrowsePage, MoodCategory};
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

#[tauri::command]
pub async fn get_moods() -> Result<Vec<MoodCategory>, String> {
    let client = YouTubeClient::new();
    client.get_moods().await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn get_mood(browse_id: String, params: Option<String>) -> Result<BrowsePage, String> {
    let client = YouTubeClient::new();
    client.get_mood(&browse_id, params.as_deref()).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn get_mood_cover(browse_id: String, params: Option<String>) -> Result<Option<String>, String> {
    let client = YouTubeClient::new();
    client.get_mood_cover(&browse_id, params.as_deref()).await.map_err(|e| e.message)
}

// Mood cover cache (DB `settings`), so covers aren't re-fetched every session.
#[tauri::command]
pub fn get_mood_covers() -> Result<std::collections::HashMap<String, String>, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    match db.get_setting("mood_covers").map_err(|e| e.to_string())? {
        Some(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
        None => Ok(std::collections::HashMap::new()),
    }
}

#[tauri::command]
pub fn save_mood_covers(covers: std::collections::HashMap<String, String>) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    let json = serde_json::to_string(&covers).map_err(|e| e.to_string())?;
    db.set_setting("mood_covers", &json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_radio(video_id: String) -> Result<Vec<Song>, String> {
    let client = YouTubeClient::new();
    client.get_radio(&video_id).await.map_err(|e| e.message)
}

/// Region charts (Indonesia / Global) for the Home page. `region` is a country code
/// ("ID", "ZZ" for Global). Never hard-fails the Home load: returns an empty list on error.
#[tauri::command]
pub async fn get_charts(region: String) -> Result<Vec<BrowseSection>, String> {
    let client = YouTubeClient::new();
    Ok(client.get_charts(&region).await.unwrap_or_default())
}

/// Smart Shuffle recommendations: songs similar to a set of seed tracks (a playlist),
/// excluding what's already in the playlist/queue. Best-effort — empty on failure.
#[tauri::command]
pub async fn get_recommendations(
    seed_ids: Vec<String>,
    exclude_ids: Vec<String>,
    limit: usize,
) -> Result<Vec<Song>, String> {
    let client = YouTubeClient::new();
    Ok(client
        .get_recommendations(&seed_ids, &exclude_ids, limit)
        .await
        .unwrap_or_default())
}

/// Resolve a song's true duration (via the player response) without committing to playing
/// it, and cache it to the DB so lists can show durations up-front.
#[tauri::command]
pub async fn resolve_duration(video_id: String) -> Result<Option<u64>, String> {
    let client = YouTubeClient::new();
    let info = client.get_stream_url(&video_id).await.map_err(|e| e.message)?;
    if let Some(d) = info.duration {
        if let Some(db) = get_db().lock().unwrap().as_ref() {
            let _ = db.set_song_duration(&video_id, d);
        }
    }
    Ok(info.duration)
}

// ==================== Mini-player window ====================

// Primary-monitor work area (excludes the taskbar), in physical pixels: (left, top, right, bottom).
#[cfg(windows)]
fn work_area() -> Option<(i32, i32, i32, i32)> {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA};
    let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    let ok = unsafe { SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut r as *mut _ as *mut core::ffi::c_void, 0) };
    if ok != 0 { Some((r.left, r.top, r.right, r.bottom)) } else { None }
}

/// Enter compact mini mode: resizable within limits, always-on-top, anchored bottom-right
/// of the work area (above the taskbar).
#[tauri::command]
pub fn enter_mini_mode(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    use tauri::Manager;
    let win = app.get_webview_window("main").ok_or("Window not found")?;
    let _ = win.unmaximize();
    win.set_always_on_top(true).map_err(|e| e.to_string())?;
    win.set_min_size(Some(tauri::LogicalSize::new(300.0, 340.0))).map_err(|e| e.to_string())?;
    win.set_max_size(Some(tauri::LogicalSize::new(560.0, 640.0))).map_err(|e| e.to_string())?;
    win.set_resizable(true).map_err(|e| e.to_string())?;
    win.set_size(tauri::LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    if let Some((_, _, right, bottom)) = work_area() {
        let scale = win.scale_factor().unwrap_or(1.0);
        let w = (width * scale) as i32;
        let h = (height * scale) as i32;
        let m = (16.0 * scale) as i32;
        let _ = win.set_position(tauri::PhysicalPosition::new(right - w - m, bottom - h - m));
    }
    Ok(())
}

/// Restore the full window.
#[tauri::command]
pub fn exit_mini_mode(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let win = app.get_webview_window("main").ok_or("Window not found")?;
    win.set_always_on_top(false).map_err(|e| e.to_string())?;
    win.set_max_size(None::<tauri::LogicalSize<f64>>).map_err(|e| e.to_string())?;
    win.set_min_size(Some(tauri::LogicalSize::new(1000.0, 600.0))).map_err(|e| e.to_string())?;
    win.set_resizable(true).map_err(|e| e.to_string())?;
    win.set_size(tauri::LogicalSize::new(1400.0, 900.0)).map_err(|e| e.to_string())?;
    let _ = win.center();
    Ok(())
}

// ==================== Spotify import ====================

#[tauri::command]
pub async fn import_spotify_playlist(app: tauri::AppHandle, url: String) -> Result<Playlist, String> {
    let sp = crate::api::spotify::fetch_playlist(&url).await.map_err(|e| e.message)?;
    let description = sp.owner.as_ref().map(|o| format!("Imported from Spotify · {}", o));
    import_tracks(app, &sp.name, description.as_deref(), &sp.tracks).await
}

#[tauri::command]
pub async fn import_csv_playlist(app: tauri::AppHandle, name: String, content: String) -> Result<Playlist, String> {
    let tracks = crate::api::spotify::parse_csv_tracks(&content).map_err(|e| e.message)?;
    let display = if name.trim().is_empty() { "Imported Playlist" } else { name.trim() };
    import_tracks(app, display, Some("Imported from CSV"), &tracks).await
}

/// Shared import pipeline: create a local playlist, resolve each track to a YouTube Music
/// song via search, add it, and emit `spotify-import-progress` along the way.
async fn import_tracks(
    app: tauri::AppHandle,
    name: &str,
    description: Option<&str>,
    tracks: &[crate::api::spotify::SpotifyTrack],
) -> Result<Playlist, String> {
    let playlist_id = uuid::Uuid::new_v4().to_string();
    {
        let db_guard = get_db().lock().unwrap();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        db.create_playlist(&playlist_id, name, description)
            .map_err(|e| e.to_string())?;
    }

    let client = YouTubeClient::new();
    let total = tracks.len();
    for (i, track) in tracks.iter().enumerate() {
        let _ = app.emit("spotify-import-progress", serde_json::json!({
            "done": i, "total": total, "title": track.title,
        }));

        let query = format!("{} {}", track.artists, track.title);
        let results = client.search(&query).await.unwrap_or_default();
        if let Some(best) = crate::api::spotify::pick_best_match(&results, track) {
            let db_guard = get_db().lock().unwrap();
            if let Some(db) = db_guard.as_ref() {
                let _ = db.add_song_to_playlist(&playlist_id, &best, i as i32);
            }
        }
    }
    let _ = app.emit("spotify-import-progress", serde_json::json!({
        "done": total, "total": total, "title": "",
    }));

    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    db.get_playlist(&playlist_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to load the imported playlist".to_string())
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
            let kind = if e.starts_with("network:") { "network" } else { "playback" };
            let _ = app.emit("playback-error", serde_json::json!({ "songId": song_id, "message": e, "kind": kind }));
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

/// A single playlist WITH its songs (get_all_playlists returns empty song lists).
#[tauri::command]
pub fn get_playlist(playlist_id: String) -> Result<Option<Playlist>, String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_playlist(&playlist_id).map_err(|e| e.to_string())
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

#[tauri::command]
pub fn update_playlist(playlist_id: String, name: Option<String>, description: Option<String>) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.update_playlist(&playlist_id, name.as_deref(), description.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_playlist(playlist_id: String) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.delete_playlist(&playlist_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn touch_playlist(playlist_id: String) -> Result<(), String> {
    let db_guard = get_db().lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.touch_playlist(&playlist_id).map_err(|e| e.to_string())?;
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
