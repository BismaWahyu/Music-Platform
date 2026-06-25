#[cfg(test)]
mod tests {
    use crate::db::Database;
    use crate::Song;

    #[test]
    fn test_database_in_memory() {
        let db = Database::in_memory().unwrap();
        // Test that we can create an in-memory database
    }

    #[test]
    fn test_create_and_get_playlist() {
        let db = Database::in_memory().unwrap();

        // Create a playlist
        let result = db.create_playlist("playlist_1", "My Playlist", Some("My Description"));
        assert!(result.is_ok());

        // Get the playlist
        let playlist = db.get_playlist("playlist_1").unwrap();
        assert!(playlist.is_some());

        let playlist = playlist.unwrap();
        assert_eq!(playlist.id, "playlist_1");
        assert_eq!(playlist.name, "My Playlist");
        assert_eq!(playlist.description, Some("My Description".to_string()));
    }

    #[test]
    fn test_get_all_playlists() {
        let db = Database::in_memory().unwrap();

        // Create multiple playlists
        db.create_playlist("playlist_1", "Playlist 1", None).unwrap();
        db.create_playlist("playlist_2", "Playlist 2", None).unwrap();

        // Get all playlists
        let playlists = db.get_all_playlists().unwrap();
        assert_eq!(playlists.len(), 2);
    }

    #[test]
    fn test_update_playlist() {
        let db = Database::in_memory().unwrap();

        // Create a playlist
        db.create_playlist("playlist_1", "Original Name", None).unwrap();

        // Update the playlist
        let result = db.update_playlist("playlist_1", Some("Updated Name"), None);
        assert!(result.is_ok());

        // Verify the update
        let playlist = db.get_playlist("playlist_1").unwrap().unwrap();
        assert_eq!(playlist.name, "Updated Name");
    }

    #[test]
    fn test_delete_playlist() {
        let db = Database::in_memory().unwrap();

        // Create a playlist
        db.create_playlist("playlist_1", "To Delete", None).unwrap();

        // Delete the playlist
        let result = db.delete_playlist("playlist_1");
        assert!(result.is_ok());

        // Verify it's deleted
        let playlist = db.get_playlist("playlist_1").unwrap();
        assert!(playlist.is_none());
    }

    #[test]
    fn test_add_and_remove_song_from_playlist() {
        let db = Database::in_memory().unwrap();

        // Create a playlist
        db.create_playlist("playlist_1", "Test Playlist", None).unwrap();

        // Add a song
        let song = Song {
            id: "song_1".to_string(),
            title: "Test Song".to_string(),
            artists: vec![],
            album: None,
            duration: None,
            thumbnail: None,
            stream_url: None,
        };
        let result = db.add_song_to_playlist("playlist_1", &song, 0);
        assert!(result.is_ok());

        // Remove the song
        let result = db.remove_song_from_playlist("playlist_1", "song_1");
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_nonexistent_playlist() {
        let db = Database::in_memory().unwrap();

        // Try to get a playlist that doesn't exist
        let playlist = db.get_playlist("nonexistent").unwrap();
        assert!(playlist.is_none());
    }
}
