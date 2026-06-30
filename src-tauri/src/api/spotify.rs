// Spotify playlist import WITHOUT any Spotify account/API connection.
//
// We fetch the *public embed* page (`open.spotify.com/embed/playlist/{id}`), which carries
// the track list inside its `__NEXT_DATA__` JSON blob, and extract title/artist/duration for
// each track. Those are then matched against YouTube Music search results (see
// `pick_best_match`) and saved as a local playlist by the caller.
//
// Caveats: this scrapes an undocumented public page, so the shape may change; and the embed
// caps the track list at ~100 entries, so very long playlists are truncated. The playlist
// must be public (private playlists don't load in the embed).

use crate::{Song, Result, ApiError};

const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

#[derive(Debug, Clone)]
pub struct SpotifyTrack {
    pub title: String,
    pub artists: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone)]
pub struct SpotifyPlaylist {
    pub name: String,
    pub owner: Option<String>,
    pub tracks: Vec<SpotifyTrack>,
}

/// Pull the base-62 playlist id out of a Spotify link or URI.
pub fn extract_playlist_id(url: &str) -> Option<String> {
    let idx = url.find("playlist")?;
    let rest = url[idx + "playlist".len()..].trim_start_matches([':', '/']);
    let id: String = rest.chars().take_while(|c| c.is_ascii_alphanumeric()).collect();
    if id.is_empty() { None } else { Some(id) }
}

/// Fetch + parse a public playlist's track list from the embed page.
pub async fn fetch_playlist(url: &str) -> Result<SpotifyPlaylist> {
    let id = extract_playlist_id(url).ok_or_else(|| ApiError {
        message: "Link playlist Spotify tidak valid.".to_string(),
        code: None,
    })?;

    let embed = format!("https://open.spotify.com/embed/playlist/{}", id);
    let client = reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .build()
        .map_err(ApiError::from)?;
    let html = client
        .get(&embed)
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(ApiError::from)?
        .text()
        .await
        .map_err(ApiError::from)?;

    let json = extract_next_data(&html).ok_or_else(|| ApiError {
        message: "Gagal membaca data playlist (struktur Spotify mungkin berubah).".to_string(),
        code: None,
    })?;
    let v: serde_json::Value = serde_json::from_str(json).map_err(|e| ApiError {
        message: format!("Gagal mem-parse data Spotify: {}", e),
        code: None,
    })?;

    let entity = &v["props"]["pageProps"]["state"]["data"]["entity"];
    let name = entity["name"]
        .as_str()
        .or_else(|| entity["title"].as_str())
        .unwrap_or("Playlist Spotify")
        .to_string();
    let owner = entity["subtitle"].as_str().map(|s| s.to_string());

    let mut tracks = Vec::new();
    if let Some(arr) = entity["trackList"].as_array() {
        for t in arr {
            let title = t["title"].as_str().unwrap_or("").trim().to_string();
            if title.is_empty() {
                continue;
            }
            // Artist names use non-breaking spaces; normalise to plain spaces.
            let artists = t["subtitle"].as_str().unwrap_or("").replace('\u{a0}', " ").trim().to_string();
            let duration_ms = t["duration"].as_u64().unwrap_or(0);
            tracks.push(SpotifyTrack { title, artists, duration_ms });
        }
    }

    if tracks.is_empty() {
        return Err(ApiError {
            message: "Tidak ada lagu ditemukan — pastikan playlist publik dan tidak kosong.".to_string(),
            code: None,
        });
    }

    Ok(SpotifyPlaylist { name, owner, tracks })
}

// ==================== CSV import (e.g. Exportify) ====================

/// Parse a playlist-export CSV into tracks. Tolerant of column order/naming; needs at
/// least a track-name column (artist + duration columns improve matching).
pub fn parse_csv_tracks(content: &str) -> Result<Vec<SpotifyTrack>> {
    let rows = parse_csv(content);
    let header = rows.first().ok_or_else(|| ApiError {
        message: "File CSV kosong.".to_string(),
        code: None,
    })?;

    let col = |names: &[&str]| -> Option<usize> {
        header.iter().position(|h| {
            let h = h.trim();
            names.iter().any(|n| h.eq_ignore_ascii_case(n))
        })
    };
    let title_i = col(&["Track Name", "Title", "Name", "Song"]).ok_or_else(|| ApiError {
        message: "CSV tidak punya kolom judul lagu (mis. \"Track Name\").".to_string(),
        code: None,
    })?;
    let artist_i = col(&["Artist Name(s)", "Artist Name", "Artist", "Artists"]);
    let dur_i = col(&["Track Duration (ms)", "Duration (ms)", "Duration"]);

    let mut tracks = Vec::new();
    for row in rows.iter().skip(1) {
        let title = row.get(title_i).map(|s| s.trim().to_string()).unwrap_or_default();
        if title.is_empty() {
            continue;
        }
        let artists = artist_i
            .and_then(|i| row.get(i))
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let duration_ms = dur_i.and_then(|i| row.get(i)).map(|s| parse_duration(s)).unwrap_or(0);
        tracks.push(SpotifyTrack { title, artists, duration_ms });
    }

    if tracks.is_empty() {
        return Err(ApiError {
            message: "Tidak ada lagu valid di CSV.".to_string(),
            code: None,
        });
    }
    Ok(tracks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_exportify_format() {
        // Real Exportify header + two rows; second artist field has a comma inside quotes.
        let csv = "\"Track URI\",\"Track Name\",\"Artist URI(s)\",\"Artist Name(s)\",\"Album Name\",\"Track Duration (ms)\"\n\
\"spotify:track:1\",\"Another Day\",\"spotify:artist:a\",\"Monday Kiz, Punch\",\"Single\",\"217972\"\n\
\"spotify:track:2\",\"Hello, World\",\"spotify:artist:b\",\"Some Artist\",\"Album\",\"180000\"\n";
        let tracks = parse_csv_tracks(csv).unwrap();
        assert_eq!(tracks.len(), 2);
        assert_eq!(tracks[0].title, "Another Day");
        assert_eq!(tracks[0].artists, "Monday Kiz, Punch");
        assert_eq!(tracks[0].duration_ms, 217972);
        // Title with an embedded comma must stay intact.
        assert_eq!(tracks[1].title, "Hello, World");
        assert_eq!(tracks[1].duration_ms, 180000);
    }

    #[test]
    fn parses_mmss_duration() {
        let csv = "Title,Artist,Duration\n\"Song\",\"Artist\",\"3:37\"\n";
        let tracks = parse_csv_tracks(csv).unwrap();
        assert_eq!(tracks[0].duration_ms, 217000);
    }

    #[test]
    fn playlist_id_from_link() {
        assert_eq!(extract_playlist_id("https://open.spotify.com/playlist/1vSkK4H1ndeZWqIiYd883E?si=abc").as_deref(), Some("1vSkK4H1ndeZWqIiYd883E"));
        assert_eq!(extract_playlist_id("spotify:playlist:1vSkK4H1ndeZWqIiYd883E").as_deref(), Some("1vSkK4H1ndeZWqIiYd883E"));
    }
}

/// Duration as ms-integer ("217972") or "m:ss" / "h:mm:ss" → milliseconds.
fn parse_duration(s: &str) -> u64 {
    let s = s.trim();
    if s.is_empty() {
        return 0;
    }
    if s.contains(':') {
        let mut total = 0u64;
        for part in s.split(':') {
            match part.trim().parse::<u64>() {
                Ok(n) => total = total * 60 + n,
                Err(_) => return 0,
            }
        }
        return total * 1000;
    }
    s.parse::<f64>().map(|f| f as u64).unwrap_or(0)
}

/// Minimal RFC-4180 CSV parser: handles quoted fields, escaped `""`, and commas/newlines
/// inside quotes. Returns rows of string fields.
fn parse_csv(content: &str) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut record: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = content.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    field.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                field.push(c);
            }
        } else {
            match c {
                '"' => in_quotes = true,
                ',' => record.push(std::mem::take(&mut field)),
                '\r' => {}
                '\n' => {
                    record.push(std::mem::take(&mut field));
                    rows.push(std::mem::take(&mut record));
                }
                _ => field.push(c),
            }
        }
    }
    if !field.is_empty() || !record.is_empty() {
        record.push(field);
        rows.push(record);
    }
    // Drop blank trailing rows.
    rows.retain(|r| !(r.len() == 1 && r[0].trim().is_empty()));
    rows
}

/// Slice out the `__NEXT_DATA__` JSON payload from the embed HTML.
fn extract_next_data(html: &str) -> Option<&str> {
    let mi = html.find("__NEXT_DATA__")?;
    let after = &html[mi..];
    let start = after.find('>')? + 1;
    let rest = &after[start..];
    let end = rest.find("</script>")?;
    Some(&rest[..end])
}

// ==================== Matching to YouTube Music ====================

fn norm_tokens(s: &str) -> Vec<String> {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(|w| w.to_string())
        .collect()
}

/// Fraction of `a`'s tokens that also appear in `b`.
fn overlap(a: &[String], b: &[String]) -> f64 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let bset: std::collections::HashSet<&String> = b.iter().collect();
    let hits = a.iter().filter(|t| bset.contains(*t)).count();
    hits as f64 / a.len() as f64
}

/// Pick the YouTube Music search result that best matches a Spotify track, scoring on title
/// + artist token overlap and duration closeness. Returns the top-scored result (search is
/// already relevance-ranked, so a weak score still yields a reasonable pick).
pub fn pick_best_match(results: &[Song], track: &SpotifyTrack) -> Option<Song> {
    if results.is_empty() {
        return None;
    }
    let t_title = norm_tokens(&track.title);
    let t_artist = norm_tokens(&track.artists);
    let target = track.duration_ms / 1000;

    let mut best: Option<(f64, &Song)> = None;
    for song in results {
        let s_title = norm_tokens(&song.title);
        let s_artist: Vec<String> = song.artists.iter().flat_map(|a| norm_tokens(&a.name)).collect();

        let title_score = overlap(&t_title, &s_title);
        let artist_score = overlap(&t_artist, &s_artist);
        let dur_score = match song.duration {
            Some(d) if target > 0 => {
                let diff = (d as i64 - target as i64).abs() as f64;
                (1.0 - diff / 15.0).max(0.0)
            }
            _ => 0.0,
        };
        let score = title_score * 2.0 + artist_score + dur_score * 1.5;

        if best.map_or(true, |(b, _)| score > b) {
            best = Some((score, song));
        }
    }
    best.map(|(_, s)| s.clone())
}
