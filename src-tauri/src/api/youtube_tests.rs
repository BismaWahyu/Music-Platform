#[cfg(test)]
mod tests {
    use crate::api::YouTubeClient;
    use crate::ApiError;

    #[test]
    fn test_youtube_client_new() {
        let _client = YouTubeClient::new();
        // Test that we can create a client without panicking
    }

    #[test]
    fn test_api_error_from_anyhow() {
        let anyhow_err = anyhow::anyhow!("Test error");
        let api_error: ApiError = anyhow_err.into();
        assert_eq!(api_error.message, "Test error");
        assert!(api_error.code.is_none());
    }

    #[test]
    fn test_api_error_message() {
        let api_error = ApiError {
            message: "Custom error".to_string(),
            code: Some("ERR_001".to_string()),
        };
        assert_eq!(api_error.message, "Custom error");
        assert_eq!(api_error.code, Some("ERR_001".to_string()));
    }
}
