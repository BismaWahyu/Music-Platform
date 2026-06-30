// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Search & Stream
            music_platform::commands::search,
            music_platform::commands::get_stream_url,
            music_platform::commands::get_lyrics,
            music_platform::commands::get_home,
            music_platform::commands::get_album,
            music_platform::commands::get_artist,
            music_platform::commands::get_moods,
            music_platform::commands::get_mood,
            music_platform::commands::get_mood_cover,
            music_platform::commands::get_mood_covers,
            music_platform::commands::save_mood_covers,
            music_platform::commands::get_radio,
            music_platform::commands::import_spotify_playlist,
            music_platform::commands::import_csv_playlist,
            // Playback Controls
            music_platform::commands::play,
            music_platform::commands::pause,
            music_platform::commands::resume,
            music_platform::commands::toggle_playback,
            music_platform::commands::seek,
            music_platform::commands::set_volume,
            music_platform::commands::get_player_state,
            music_platform::commands::play_next,
            music_platform::commands::play_previous,
            // Queue Management
            music_platform::commands::set_queue,
            music_platform::commands::add_to_queue,
            music_platform::commands::remove_from_queue,
            music_platform::commands::get_queue,
            // Playlist Management
            music_platform::commands::create_playlist,
            music_platform::commands::get_playlists,
            music_platform::commands::get_playlist,
            music_platform::commands::add_to_playlist,
            music_platform::commands::remove_from_playlist,
            music_platform::commands::update_playlist,
            music_platform::commands::delete_playlist,
            music_platform::commands::touch_playlist,
            // Library
            music_platform::commands::add_to_library,
            music_platform::commands::get_library,
            music_platform::commands::remove_from_library,
            // History
            music_platform::commands::add_to_history,
            music_platform::commands::get_history,
            music_platform::commands::get_history_songs,
            music_platform::commands::clear_history,
        ])
        .setup(|app| {
            use tauri::Manager;

            // Initialize the SQLite database in the app data directory.
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
                let db_path = dir.join("senandung.db");
                if let Err(e) = music_platform::db::init_database(db_path) {
                    eprintln!("[db] init failed: {}", e);
                }
            }

            // Initialize audio player, then start the player-state event emitter.
            #[cfg(desktop)]
            {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    music_platform::audio::player::init_audio_engine(app_handle.clone());
                    music_platform::audio::player::start_event_emitter(app_handle);
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
