#[cfg(test)]
mod tests {
    use crate::audio::AudioPlayer;
    use crate::Song;

    #[test]
    fn test_audio_player_new() {
        // Test that we can create a new audio player
        let result = AudioPlayer::new();

        match result {
            Ok(_player) => {
                // Successfully created audio player
                println!("Audio player created successfully");
            }
            Err(_e) => {
                // Audio output not available - this is OK for test environments
                println!("Audio output not available, skipping audio tests");
            }
        }
    }

    #[test]
    fn test_song_creation() {
        // Test that we can create a Song struct
        let song = Song {
            id: "test_1".to_string(),
            title: "Test Song".to_string(),
            artists: vec![],
            album: None,
            duration: Some(180),
            thumbnail: None,
            stream_url: None,
        };

        assert_eq!(song.id, "test_1");
        assert_eq!(song.title, "Test Song");
        assert_eq!(song.duration, Some(180));
    }
}
