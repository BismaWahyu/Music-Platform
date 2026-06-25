// Lyrics provider backed by LRCLIB (https://lrclib.net), mirroring how ArchiveTune's
// `lyrics/lrclib` resolves lyrics: try the exact `/api/get` (artist + track + album +
// duration) first, then fall back to `/api/search`. Synced (LRC) lyrics are parsed into
// timestamped lines; otherwise plain lyrics are returned.

use reqwest::Client;
use serde::Deserialize;
use crate::{Lyrics, LyricLine, Result, ApiError};

// LRCLIB asks clients to identify themselves with a User-Agent linking to the app.
const USER_AGENT: &str = "Senandung Music Player (https://github.com/seraidev/senandung)";

#[derive(Debug, Deserialize)]
struct LrcLibItem {
    #[serde(default)]
    instrumental: bool,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
}

/// Fetch lyrics for a track. `duration` is the track length in seconds (used to
/// disambiguate the exact match). Returns an error when nothing is found.
pub async fn fetch_lyrics(
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration: Option<u64>,
) -> Result<Lyrics> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(ApiError::from)?;

    // 1) Exact match via /api/get.
    if let Some(item) = get_exact(&client, title, artist, album, duration).await {
        if let Some(lyrics) = to_lyrics(item) {
            return Ok(lyrics);
        }
    }

    // 2) Fall back to /api/search and take the first usable result.
    if let Some(item) = search_first(&client, title, artist).await {
        if let Some(lyrics) = to_lyrics(item) {
            return Ok(lyrics);
        }
    }

    Err(ApiError { message: "Lyrics not found".to_string(), code: Some("not_found".to_string()) })
}

async fn get_exact(
    client: &Client,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration: Option<u64>,
) -> Option<LrcLibItem> {
    let mut query: Vec<(&str, String)> = vec![
        ("track_name", title.to_string()),
        ("artist_name", artist.to_string()),
    ];
    if let Some(a) = album {
        if !a.is_empty() {
            query.push(("album_name", a.to_string()));
        }
    }
    if let Some(d) = duration {
        query.push(("duration", d.to_string()));
    }

    let resp = client
        .get("https://lrclib.net/api/get")
        .query(&query)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.json::<LrcLibItem>().await.ok()
}

async fn search_first(client: &Client, title: &str, artist: &str) -> Option<LrcLibItem> {
    let resp = client
        .get("https://lrclib.net/api/search")
        .query(&[("track_name", title), ("artist_name", artist)])
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let items = resp.json::<Vec<LrcLibItem>>().await.ok()?;
    // Prefer a result that actually has lyrics.
    items
        .into_iter()
        .find(|i| i.synced_lyrics.is_some() || i.plain_lyrics.is_some() || i.instrumental)
}

fn to_lyrics(item: LrcLibItem) -> Option<Lyrics> {
    if let Some(synced) = item.synced_lyrics.as_deref().filter(|s| !s.trim().is_empty()) {
        let lines = parse_lrc(synced);
        if !lines.is_empty() {
            let text = item
                .plain_lyrics
                .filter(|p| !p.trim().is_empty())
                .unwrap_or_else(|| lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n"));
            return Some(Lyrics { synced: true, text, lines: Some(lines) });
        }
    }
    if let Some(plain) = item.plain_lyrics.filter(|p| !p.trim().is_empty()) {
        return Some(Lyrics { synced: false, text: plain, lines: None });
    }
    if item.instrumental {
        return Some(Lyrics { synced: false, text: "♪ Instrumental ♪".to_string(), lines: None });
    }
    None
}

/// Parse an LRC string into timestamped lines, sorted by time. A line may carry several
/// `[mm:ss.xx]` timestamps; each produces its own entry.
fn parse_lrc(lrc: &str) -> Vec<LyricLine> {
    let mut lines: Vec<LyricLine> = Vec::new();
    for raw in lrc.lines() {
        let mut rest = raw;
        let mut times: Vec<u64> = Vec::new();
        // Consume any leading [..] tags.
        while rest.starts_with('[') {
            let Some(close) = rest.find(']') else { break };
            let tag = &rest[1..close];
            if let Some(ms) = parse_timestamp(tag) {
                times.push(ms);
            }
            rest = &rest[close + 1..];
        }
        if times.is_empty() {
            continue; // metadata tag (e.g. [ar:...]) or untimed line
        }
        let text = rest.trim().to_string();
        for t in times {
            lines.push(LyricLine { time_ms: t, text: text.clone() });
        }
    }
    lines.sort_by_key(|l| l.time_ms);
    lines
}

/// Parse a `mm:ss.xx` (or `mm:ss`) timestamp into milliseconds. Returns None for
/// non-timestamp tags like `ar:Artist`.
fn parse_timestamp(tag: &str) -> Option<u64> {
    let (mm, rest) = tag.split_once(':')?;
    let minutes: u64 = mm.trim().parse().ok()?;
    let seconds: f64 = rest.trim().parse().ok()?;
    Some(minutes * 60_000 + (seconds * 1000.0) as u64)
}
