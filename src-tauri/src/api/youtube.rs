// InnerTube (YouTube Music) client.
//
// This mirrors the canonical ArchiveTune `core` InnerTube client
// (core/src/main/kotlin/moe/rukamori/archivetune/innertube/), specifically the
// YouTubeClient definitions and the request headers built in InnerTube.ytClient():
//   - WEB_REMIX (clientId 67, Firefox UA) for browsing/search
//   - ANDROID_VR (clientId 28, no signatureTimestamp) for the `player` endpoint,
//     which returns directly-playable stream URLs without signature ciphering.
//
// Requests are authenticated the same way as core: header-based
// (X-YouTube-Client-Name/Version, X-Origin, Referer, X-Goog-Visitor-Id, User-Agent)
// with `prettyPrint=false`, NOT the legacy `?key=` query parameter.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::OnceCell;
use crate::{Song, Artist, Album, Result, ApiError};

/// Resolved playable stream plus the track's true duration (from the player response).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub url: String,
    pub duration: Option<u64>,
}

/// A card in a browse feed: a song (id = videoId) or an album/playlist/artist
/// (id = browseId). `kind` tells the frontend how to act on a click.
#[derive(Debug, Clone, Serialize)]
pub struct BrowseItem {
    pub id: String,
    pub kind: String, // "song" | "album" | "playlist" | "artist"
    pub title: String,
    pub subtitle: Option<String>,
    pub thumbnail: Option<String>,
}

/// A titled row of browse items (a carousel shelf).
#[derive(Debug, Clone, Serialize)]
pub struct BrowseSection {
    pub title: String,
    pub items: Vec<BrowseItem>,
}

/// A browse detail page (album or artist): header info, directly-playable tracks, and
/// related sections (e.g. an artist's albums/singles).
#[derive(Debug, Clone, Serialize)]
pub struct BrowsePage {
    pub title: String,
    pub subtitle: Option<String>,
    pub thumbnail: Option<String>,
    pub songs: Vec<Song>,
    pub sections: Vec<BrowseSection>,
}

/// A mood/genre chip from the "Moods & genres" page; `params` is required when browsing it.
#[derive(Debug, Clone, Serialize)]
pub struct MoodCategory {
    pub title: String,
    pub browse_id: String,
    pub params: Option<String>,
    pub color: Option<String>, // "#RRGGBB"
}

// Visitor data is fetched once from the YouTube Music homepage and cached for the
// process lifetime, mirroring how core supplies a real X-Goog-Visitor-Id.
static VISITOR_DATA: OnceCell<String> = OnceCell::const_new();

async fn cached_visitor_data(client: &Client) -> String {
    VISITOR_DATA
        .get_or_init(|| async { fetch_visitor_data(client).await.unwrap_or_else(default_visitor_data) })
        .await
        .clone()
}

async fn fetch_visitor_data(client: &Client) -> Option<String> {
    let body = client
        .get("https://music.youtube.com/")
        .header("User-Agent", USER_AGENT_WEB_REMIX)
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;
    // ytcfg embeds the token as: "visitorData":"<value>"
    let key = "\"visitorData\":\"";
    let start = body.find(key)? + key.len();
    let rest = &body[start..];
    let end = rest.find('"')?;
    let val = &rest[..end];
    if val.is_empty() { None } else { Some(val.to_string()) }
}

fn parse_hms(s: &str) -> Option<u64> {
    let parts: Vec<&str> = s.trim().split(':').collect();
    if parts.is_empty() || parts.len() > 3 {
        return None;
    }
    let mut total = 0u64;
    for p in &parts {
        let n: u64 = p.trim().parse().ok()?;
        total = total * 60 + n;
    }
    Some(total)
}

const API_BASE: &str = "https://music.youtube.com/youtubei/v1";
const ORIGIN_YOUTUBE_MUSIC: &str = "https://music.youtube.com";
const REFERER_YOUTUBE_MUSIC: &str = "https://music.youtube.com/";

const USER_AGENT_WEB_REMIX: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";
const USER_AGENT_ANDROID_VR: &str =
    "com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/132.0.6808.3)";

// ==================== Client definitions (mirrors core YouTubeClient) ====================

#[derive(Clone)]
struct YtClient {
    client_name: &'static str,
    client_version: &'static str,
    client_id: &'static str,
    user_agent: &'static str,
    os_name: Option<&'static str>,
    os_version: Option<&'static str>,
    device_make: Option<&'static str>,
    device_model: Option<&'static str>,
    android_sdk_version: Option<&'static str>,
}

// core: YouTubeClient.WEB_REMIX
const WEB_REMIX: YtClient = YtClient {
    client_name: "WEB_REMIX",
    client_version: "1.20260213.01.00",
    client_id: "67",
    user_agent: USER_AGENT_WEB_REMIX,
    os_name: None,
    os_version: None,
    device_make: None,
    device_model: None,
    android_sdk_version: None,
};

// core: YouTubeClient.ANDROID_VR_1_61_48 (no signatureTimestamp -> direct stream URLs)
const ANDROID_VR: YtClient = YtClient {
    client_name: "ANDROID_VR",
    client_version: "1.61.48",
    client_id: "28",
    user_agent: USER_AGENT_ANDROID_VR,
    os_name: Some("Android"),
    os_version: Some("12"),
    device_make: Some("Oculus"),
    device_model: Some("Quest 3"),
    android_sdk_version: Some("32"),
};

// ==================== Request context ====================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContextClient {
    client_name: String,
    client_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    os_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    os_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    android_sdk_version: Option<String>,
    gl: String,
    hl: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    visitor_data: Option<String>,
}

#[derive(Debug, Serialize)]
struct RequestContext {
    client: ContextClient,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchRequest {
    context: RequestContext,
    query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<String>,
}

// ==================== Response models (camelCase like the InnerTube JSON) ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeResponse {
    contents: Option<Contents>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Contents {
    tabbed_search_results_renderer: Option<TabbedSearchResults>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TabbedSearchResults {
    tabs: Option<Vec<Tab>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Tab {
    tab_renderer: Option<TabRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TabRenderer {
    content: Option<Content>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Content {
    section_list_renderer: Option<SectionList>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SectionList {
    contents: Option<Vec<SectionContent>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum SectionContent {
    Shelf(ShelfContent),
    Item(ItemContent),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShelfContent {
    music_shelf_renderer: Option<MusicShelf>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemContent {
    item_section_renderer: Option<ItemSection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemSection {
    contents: Option<Vec<SectionContent>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicShelf {
    #[serde(default)]
    title: Option<Text>,
    contents: Option<Vec<ShelfItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ShelfItem {
    ListItem(MusicResponsiveListItem),
    Other(serde_json::Value),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicResponsiveListItem {
    music_responsive_list_item_renderer: Option<ListItemRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListItemRenderer {
    playlist_item_data: Option<PlaylistItemData>,
    flex_columns: Option<Vec<FlexColumn>>,
    fixed_columns: Option<Vec<FixedColumn>>,
    thumbnail: Option<Thumbnail>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FixedColumn {
    music_responsive_list_item_fixed_column_renderer: Option<FixedColumnRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FixedColumnRenderer {
    text: Option<Text>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaylistItemData {
    video_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FlexColumn {
    music_responsive_list_item_flex_column_renderer: Option<FlexColumnRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FlexColumnRenderer {
    text: Option<Text>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Text {
    runs: Option<Vec<Run>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Run {
    text: String,
    navigation_endpoint: Option<NavigationEndpoint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Thumbnail {
    music_thumbnail_renderer: Option<MusicThumbnail>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicThumbnail {
    thumbnail: Option<ThumbnailData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThumbnailData {
    thumbnails: Vec<Image>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Image {
    url: String,
    #[serde(default)]
    width: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NavigationEndpoint {
    browse_endpoint: Option<BrowseEndpoint>,
    watch_endpoint: Option<WatchEndpoint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WatchEndpoint {
    video_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseEndpoint {
    browse_id: String,
    #[serde(default)]
    params: Option<String>,
    browse_endpoint_context_supported_configs: Option<BrowseCtxConfigs>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseCtxConfigs {
    browse_endpoint_context_music_config: Option<BrowseMusicConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseMusicConfig {
    page_type: Option<String>, // MUSIC_PAGE_TYPE_ALBUM / _PLAYLIST / _ARTIST
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlayerResponse {
    streaming_data: Option<StreamingData>,
    video_details: Option<VideoDetails>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoDetails {
    length_seconds: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StreamingData {
    formats: Option<Vec<Format>>,
    adaptive_formats: Option<Vec<Format>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Format {
    url: Option<String>,
    mime_type: String,
    #[serde(default)]
    bitrate: Option<u32>,
}

// ==================== Browse response models ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseResponse {
    contents: Option<BrowseContents>,
    header: Option<BrowseHeader>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseContents {
    single_column_browse_results_renderer: Option<SingleColumnBrowse>,
    two_column_browse_results_renderer: Option<TwoColumnBrowse>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SingleColumnBrowse {
    tabs: Option<Vec<BrowseTab>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseTab {
    tab_renderer: Option<BrowseTabRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseTabRenderer {
    content: Option<BrowseTabContent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseTabContent {
    section_list_renderer: Option<BrowseSectionList>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseSectionList {
    contents: Option<Vec<BrowseSectionItem>>,
}

// Album pages use a two-column layout: tracks live under `secondaryContents`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TwoColumnBrowse {
    secondary_contents: Option<BrowseTabContent>,
    tabs: Option<Vec<BrowseTab>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseSectionItem {
    music_carousel_shelf_renderer: Option<CarouselShelf>,
    music_immersive_carousel_shelf_renderer: Option<CarouselShelf>,
    music_shelf_renderer: Option<MusicShelf>,
    music_playlist_shelf_renderer: Option<MusicShelf>,
    grid_renderer: Option<GridRenderer>,
}

// Moods & genres page: a grid of navigation buttons.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GridRenderer {
    items: Option<Vec<GridItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GridItem {
    music_navigation_button_renderer: Option<NavButton>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NavButton {
    button_text: Option<Text>,
    solid: Option<Solid>,
    click_command: Option<ClickCommand>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Solid {
    left_stripe_color: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClickCommand {
    browse_endpoint: Option<BrowseEndpoint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CarouselShelf {
    header: Option<CarouselHeader>,
    contents: Option<Vec<CarouselItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CarouselHeader {
    music_carousel_shelf_basic_header_renderer: Option<BasicHeader>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BasicHeader {
    title: Option<Text>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CarouselItem {
    music_two_row_item_renderer: Option<TwoRowItem>,
    music_responsive_list_item_renderer: Option<ListItemRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TwoRowItem {
    title: Option<Text>,
    subtitle: Option<Text>,
    thumbnail_renderer: Option<Thumbnail>,
    navigation_endpoint: Option<NavigationEndpoint>,
}

// Browse page header (artist immersive header / album/playlist header).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowseHeader {
    music_immersive_header_renderer: Option<HeaderRenderer>,
    music_detail_header_renderer: Option<HeaderRenderer>,
    music_visual_header_renderer: Option<HeaderRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeaderRenderer {
    title: Option<Text>,
    subtitle: Option<Text>,
    description: Option<Text>,
    thumbnail: Option<HeaderThumbnail>,
}

// Header thumbnails nest slightly differently than list thumbnails.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeaderThumbnail {
    music_thumbnail_renderer: Option<MusicThumbnail>,
    cropped_square_thumbnail_renderer: Option<MusicThumbnail>,
}

// ==================== `next` (radio / autoplay queue) models ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NextResponse {
    contents: Option<NextContents>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NextContents {
    single_column_music_watch_next_results_renderer: Option<SingleColumnNext>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SingleColumnNext {
    tabbed_renderer: Option<TabbedRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TabbedRenderer {
    watch_next_tabbed_results_renderer: Option<WatchNextTabbed>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WatchNextTabbed {
    tabs: Option<Vec<NextTab>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NextTab {
    tab_renderer: Option<NextTabRenderer>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NextTabRenderer {
    content: Option<NextTabContent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NextTabContent {
    music_queue_renderer: Option<MusicQueue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicQueue {
    content: Option<MusicQueueContent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicQueueContent {
    playlist_panel_renderer: Option<PlaylistPanel>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaylistPanel {
    contents: Option<Vec<PlaylistPanelItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaylistPanelItem {
    playlist_panel_video_renderer: Option<PanelVideo>,
    playlist_panel_video_wrapper_renderer: Option<PanelWrapper>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PanelWrapper {
    primary_renderer: Option<PanelPrimary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PanelPrimary {
    playlist_panel_video_renderer: Option<PanelVideo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PanelVideo {
    video_id: Option<String>,
    title: Option<Text>,
    long_byline_text: Option<Text>,
    length_text: Option<Text>,
    thumbnail: Option<ThumbnailData>,
}

// ==================== Client ====================

pub struct YouTubeClient {
    client: Client,
}

// One process-wide reqwest client, reused by every `YouTubeClient::new()`. reqwest clients
// are internally reference-counted, so cloning shares the same connection pool + TLS
// sessions — far cheaper than building a fresh client (and TCP/TLS handshake) per request.
static HTTP_CLIENT: std::sync::OnceLock<Client> = std::sync::OnceLock::new();

fn shared_client() -> Client {
    HTTP_CLIENT
        .get_or_init(|| {
            // Always give requests a timeout: without one, a throttled/blocked request (or a
            // stalled connection) hangs forever, piling up background tasks and making
            // playback appear frozen.
            Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(25))
                .build()
                .unwrap_or_else(|_| Client::new())
        })
        .clone()
}

impl YouTubeClient {
    pub fn new() -> Self {
        Self { client: shared_client() }
    }

    fn context(&self, c: &YtClient, visitor: &str) -> ContextClient {
        self.context_gl(c, visitor, "US")
    }

    /// Like `context`, but with an explicit country code (`gl`) — used to fetch
    /// region-specific charts (e.g. "ID" for Indonesia, "ZZ" for Global).
    fn context_gl(&self, c: &YtClient, visitor: &str, gl: &str) -> ContextClient {
        ContextClient {
            client_name: c.client_name.to_string(),
            client_version: c.client_version.to_string(),
            os_name: c.os_name.map(str::to_string),
            os_version: c.os_version.map(str::to_string),
            device_make: c.device_make.map(str::to_string),
            device_model: c.device_model.map(str::to_string),
            android_sdk_version: c.android_sdk_version.map(str::to_string),
            gl: gl.to_string(),
            hl: "en".to_string(),
            visitor_data: Some(visitor.to_string()),
        }
    }

    /// POST to an InnerTube endpoint with core-equivalent headers (no `?key=`).
    async fn post<T: Serialize + ?Sized>(
        &self,
        endpoint: &str,
        client: &YtClient,
        visitor: &str,
        body: &T,
    ) -> Result<reqwest::Response> {
        let url = format!("{}/{}?prettyPrint=false", API_BASE, endpoint);

        let response = self
            .client
            .post(&url)
            .header("X-Goog-Api-Format-Version", "1")
            .header("X-YouTube-Client-Name", client.client_id)
            .header("X-YouTube-Client-Version", client.client_version)
            .header("X-Origin", ORIGIN_YOUTUBE_MUSIC)
            .header("Referer", REFERER_YOUTUBE_MUSIC)
            .header("X-Goog-Visitor-Id", visitor)
            .header("User-Agent", client.user_agent)
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| ApiError { message: format!("Request failed: {}", e), code: None })?;

        if !response.status().is_success() {
            return Err(ApiError {
                message: format!("API returned status: {}", response.status()),
                code: Some(response.status().as_u16().to_string()),
            });
        }

        Ok(response)
    }

    /// Search YouTube Music for songs (WEB_REMIX client, songs filter).
    pub async fn search(&self, query: &str) -> Result<Vec<Song>> {
        let visitor = cached_visitor_data(&self.client).await;
        let body = SearchRequest {
            context: RequestContext { client: self.context(&WEB_REMIX, &visitor) },
            query: query.to_string(),
            // "Songs" search filter param.
            params: Some("EgWKAQIIAWoKEAkQBRAKEAMQBA==".to_string()),
        };

        let response = self.post("search", &WEB_REMIX, &visitor, &body).await?;
        let parsed: YouTubeResponse = response.json().await.map_err(|e| ApiError {
            message: format!("Failed to parse search response: {}", e),
            code: None,
        })?;

        Ok(parse_search_response(parsed))
    }

    /// POST a `browse` request (WEB_REMIX) and parse the JSON response.
    async fn browse(&self, browse_id: &str) -> Result<BrowseResponse> {
        self.browse_params(browse_id, None).await
    }

    async fn browse_params(&self, browse_id: &str, params: Option<&str>) -> Result<BrowseResponse> {
        let visitor = cached_visitor_data(&self.client).await;
        let mut body = json!({
            "context": { "client": self.context(&WEB_REMIX, &visitor) },
            "browseId": browse_id,
        });
        if let Some(p) = params {
            body["params"] = json!(p);
        }
        let response = self.post("browse", &WEB_REMIX, &visitor, &body).await?;
        response.json().await.map_err(|e| ApiError {
            message: format!("Failed to parse browse response: {}", e),
            code: None,
        })
    }

    /// The "Moods & genres" category chips.
    pub async fn get_moods(&self) -> Result<Vec<MoodCategory>> {
        let parsed = self.browse("FEmusic_moods_and_genres").await?;
        Ok(parse_moods(section_list_of(&parsed)))
    }

    /// A representative cover thumbnail for a mood/genre (first card on its page).
    pub async fn get_mood_cover(&self, browse_id: &str, params: Option<&str>) -> Result<Option<String>> {
        let parsed = self.browse_params(browse_id, params).await?;
        for section in section_list_of(&parsed) {
            let shelf = section
                .music_carousel_shelf_renderer
                .as_ref()
                .or(section.music_immersive_carousel_shelf_renderer.as_ref());
            for ci in shelf.into_iter().flat_map(|s| s.contents.iter().flatten()) {
                if let Some(tr) = ci.music_two_row_item_renderer.as_ref() {
                    if let Some(url) = thumbnail_url(&tr.thumbnail_renderer) {
                        return Ok(Some(url));
                    }
                }
            }
        }
        Ok(None)
    }

    /// A mood/genre detail page (carousels of playlists), browsed by id + params.
    pub async fn get_mood(&self, browse_id: &str, params: Option<&str>) -> Result<BrowsePage> {
        let parsed = self.browse_params(browse_id, params).await?;
        let sections = parse_browse_sections(section_list_of(&parsed));
        let (title, subtitle, thumbnail) = parse_header(&parsed);
        Ok(BrowsePage { title, subtitle, thumbnail, songs: vec![], sections })
    }

    /// A radio / autoplay queue seeded from a video (the `next` endpoint). Skips the seed
    /// track itself so callers can append the rest to the current queue.
    pub async fn get_radio(&self, video_id: &str) -> Result<Vec<Song>> {
        let visitor = cached_visitor_data(&self.client).await;
        let body = json!({
            "context": { "client": self.context(&WEB_REMIX, &visitor) },
            "videoId": video_id,
            "playlistId": format!("RDAMVM{}", video_id),
            "isAudioOnly": true,
            "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
            "enablePersistentPlaylistPanel": true,
        });
        let response = self.post("next", &WEB_REMIX, &visitor, &body).await?;
        let parsed: NextResponse = response.json().await.map_err(|e| ApiError {
            message: format!("Failed to parse next response: {}", e),
            code: None,
        })?;
        Ok(parse_radio(parsed, video_id))
    }

    /// The YouTube Music home feed as a list of carousel sections.
    pub async fn get_home(&self) -> Result<Vec<BrowseSection>> {
        let parsed = self.browse("FEmusic_home").await?;
        Ok(parse_browse_sections(section_list_of(&parsed)))
    }

    /// The YouTube Music charts for a region (`gl`, e.g. "ID" for Indonesia, "ZZ" for
    /// Global): "Top songs", "Top videos", "Trending", etc. Includes both carousel shelves
    /// and ranked song shelves.
    pub async fn get_charts(&self, gl: &str) -> Result<Vec<BrowseSection>> {
        let visitor = cached_visitor_data(&self.client).await;
        let body = json!({
            "context": { "client": self.context_gl(&WEB_REMIX, &visitor, gl) },
            "browseId": "FEmusic_charts",
        });
        let response = self.post("browse", &WEB_REMIX, &visitor, &body).await?;
        let parsed: BrowseResponse = response.json().await.map_err(|e| ApiError {
            message: format!("Failed to parse charts response: {}", e),
            code: None,
        })?;
        Ok(parse_chart_sections(section_list_of(&parsed)))
    }

    /// An album page: its tracks (directly playable) plus header info.
    pub async fn get_album(&self, browse_id: &str) -> Result<BrowsePage> {
        let parsed = self.browse(browse_id).await?;

        // Album tracks live in the two-column layout's secondary contents.
        let track_sections = parsed
            .contents
            .as_ref()
            .and_then(|c| c.two_column_browse_results_renderer.as_ref())
            .and_then(|t| t.secondary_contents.as_ref())
            .and_then(|s| s.section_list_renderer.as_ref())
            .and_then(|s| s.contents.as_ref())
            .map(|v| v.as_slice())
            .unwrap_or(&[]);

        let mut songs = Vec::new();
        for section in track_sections {
            if let Some(shelf) = section
                .music_shelf_renderer
                .as_ref()
                .or(section.music_playlist_shelf_renderer.as_ref())
            {
                collect_shelf_items(shelf, &mut songs);
            }
        }
        // Playlists (and some albums) use the single-column layout instead.
        if songs.is_empty() {
            for section in section_list_of(&parsed) {
                if let Some(shelf) = section
                    .music_shelf_renderer
                    .as_ref()
                    .or(section.music_playlist_shelf_renderer.as_ref())
                {
                    collect_shelf_items(shelf, &mut songs);
                }
            }
        }

        let (title, subtitle, thumbnail) = parse_header(&parsed);
        // Stamp each track with the album title for nicer display.
        if !title.is_empty() {
            for s in &mut songs {
                if s.album.is_none() {
                    s.album = Some(Album {
                        id: browse_id.to_string(), title: title.clone(),
                        artists: vec![], year: None, thumbnail: thumbnail.clone(),
                    });
                }
            }
        }
        Ok(BrowsePage { title, subtitle, thumbnail, songs, sections: vec![] })
    }

    /// An artist page: top songs plus related sections (albums, singles, …).
    pub async fn get_artist(&self, browse_id: &str) -> Result<BrowsePage> {
        let parsed = self.browse(browse_id).await?;
        let section_items = section_list_of(&parsed);

        let mut songs = Vec::new();
        for section in section_items {
            // The "Songs" shelf is a plain musicShelfRenderer of list items.
            if let Some(shelf) = section.music_shelf_renderer.as_ref() {
                collect_shelf_items(shelf, &mut songs);
            }
        }
        let sections = parse_browse_sections(section_items);

        let (title, subtitle, thumbnail) = parse_header(&parsed);
        Ok(BrowsePage { title, subtitle, thumbnail, songs, sections })
    }

    /// Resolve a directly-playable audio stream + duration (ANDROID_VR client).
    pub async fn get_stream_url(&self, video_id: &str) -> Result<StreamInfo> {
        let visitor = cached_visitor_data(&self.client).await;
        let body = json!({
            "context": { "client": self.context(&ANDROID_VR, &visitor) },
            "videoId": video_id,
            "contentCheckOk": true,
            "racyCheckOk": true,
        });

        let response = self.post("player", &ANDROID_VR, &visitor, &body).await?;
        let player: PlayerResponse = response.json().await.map_err(|e| ApiError {
            message: format!("Failed to parse player response: {}", e),
            code: None,
        })?;

        let duration = player
            .video_details
            .as_ref()
            .and_then(|d| d.length_seconds.as_ref())
            .and_then(|s| s.parse::<u64>().ok());

        let streaming = player.streaming_data.ok_or_else(|| ApiError {
            message: "No streaming data (video may be unavailable or age-restricted)".to_string(),
            code: None,
        })?;

        // Pick an audio format the local decoder (rodio/symphonia) can actually play.
        // Prefer AAC (audio/mp4) over Opus/WebM, then highest bitrate within that.
        let score = |f: &Format| -> u32 {
            let container = if f.mime_type.contains("mp4") { 2 } else if f.mime_type.contains("webm") { 1 } else { 0 };
            container * 1_000_000 + f.bitrate.unwrap_or(0)
        };
        let mut best: Option<&Format> = None;
        for f in streaming.adaptive_formats.iter().flatten() {
            if f.mime_type.starts_with("audio") && f.url.is_some() {
                if best.is_none() || score(f) > score(best.unwrap()) {
                    best = Some(f);
                }
            }
        }
        let chosen = best
            .or_else(|| streaming.formats.iter().flatten().find(|f| f.url.is_some()))
            .ok_or_else(|| ApiError { message: "No playable format found".to_string(), code: None })?;

        let url = chosen
            .url
            .clone()
            .ok_or_else(|| ApiError { message: "Selected format has no direct URL".to_string(), code: None })?;

        Ok(StreamInfo { url, duration })
    }
}

impl Default for YouTubeClient {
    fn default() -> Self {
        Self::new()
    }
}

// ==================== Parsing ====================

fn parse_search_response(response: YouTubeResponse) -> Vec<Song> {
    let mut songs = Vec::new();
    if let Some(tabs) = response
        .contents
        .and_then(|c| c.tabbed_search_results_renderer)
        .and_then(|t| t.tabs)
    {
        for tab in tabs {
            if let Some(content) = tab.tab_renderer.and_then(|r| r.content) {
                extract_songs(&content, &mut songs);
            }
        }
    }
    songs
}

fn extract_songs(content: &Content, songs: &mut Vec<Song>) {
    let Some(section_list) = &content.section_list_renderer else { return };
    let Some(contents) = &section_list.contents else { return };
    for section in contents {
        match section {
            SectionContent::Shelf(shelf) => collect_shelf(&shelf.music_shelf_renderer, songs),
            SectionContent::Item(item) => {
                if let Some(sub) = item.item_section_renderer.as_ref().and_then(|s| s.contents.as_ref()) {
                    for inner in sub {
                        if let SectionContent::Shelf(shelf) = inner {
                            collect_shelf(&shelf.music_shelf_renderer, songs);
                        }
                    }
                }
            }
        }
    }
}

fn collect_shelf(shelf: &Option<MusicShelf>, songs: &mut Vec<Song>) {
    if let Some(shelf) = shelf {
        collect_shelf_items(shelf, songs);
    }
}

fn collect_shelf_items(shelf: &MusicShelf, songs: &mut Vec<Song>) {
    let Some(items) = &shelf.contents else { return };
    for item in items {
        if let ShelfItem::ListItem(list_item) = item {
            if let Some(song) = parse_song_item(list_item) {
                songs.push(song);
            }
        }
    }
}

// ==================== Browse parsing ====================

/// The section-list contents of a single-column browse response (home / artist).
fn section_list_of(parsed: &BrowseResponse) -> &[BrowseSectionItem] {
    parsed
        .contents
        .as_ref()
        .and_then(|c| c.single_column_browse_results_renderer.as_ref())
        .and_then(|s| s.tabs.as_ref())
        .and_then(|tabs| tabs.first())
        .and_then(|t| t.tab_renderer.as_ref())
        .and_then(|r| r.content.as_ref())
        .and_then(|c| c.section_list_renderer.as_ref())
        .and_then(|s| s.contents.as_ref())
        .map(|v| v.as_slice())
        .unwrap_or(&[])
}

fn first_run_text(text: &Option<Text>) -> Option<String> {
    text.as_ref()?.runs.as_ref()?.first().map(|r| r.text.clone())
}

fn join_runs_text(text: &Option<Text>) -> Option<String> {
    let runs = text.as_ref()?.runs.as_ref()?;
    let s: String = runs.iter().map(|r| r.text.as_str()).collect();
    if s.trim().is_empty() { None } else { Some(s) }
}

/// Pick a sensibly-sized thumbnail rather than the biggest one available: the smallest
/// that's at least ~480px wide (crisp for cards and the ~300px now-playing cover on HiDPI)
/// — avoids pulling 1080px+ artwork for tiny list rows. Falls back to the largest when the
/// JSON carries no widths.
fn best_thumb(imgs: &[Image]) -> Option<String> {
    imgs.iter()
        .filter(|i| i.width.map_or(false, |w| w >= 480))
        .min_by_key(|i| i.width.unwrap_or(u32::MAX))
        .or_else(|| imgs.last())
        .map(|i| i.url.clone())
}

fn thumbnail_url(t: &Option<Thumbnail>) -> Option<String> {
    let imgs = &t
        .as_ref()?
        .music_thumbnail_renderer
        .as_ref()?
        .thumbnail
        .as_ref()?
        .thumbnails;
    best_thumb(imgs)
}

/// Map a two-row card (album/playlist/artist/song) into a BrowseItem.
fn two_row_to_item(item: &TwoRowItem) -> Option<BrowseItem> {
    let title = first_run_text(&item.title)?;
    let subtitle = join_runs_text(&item.subtitle);
    let thumbnail = thumbnail_url(&item.thumbnail_renderer);
    let nav = item.navigation_endpoint.as_ref();

    // A watch endpoint means it's a playable track.
    if let Some(video_id) = nav
        .and_then(|n| n.watch_endpoint.as_ref())
        .and_then(|w| w.video_id.clone())
    {
        return Some(BrowseItem { id: video_id, kind: "song".into(), title, subtitle, thumbnail });
    }

    // Otherwise a browse endpoint → album / playlist / artist (by pageType).
    let browse = nav.and_then(|n| n.browse_endpoint.as_ref())?;
    let page_type = browse
        .browse_endpoint_context_supported_configs
        .as_ref()
        .and_then(|c| c.browse_endpoint_context_music_config.as_ref())
        .and_then(|c| c.page_type.as_deref())
        .unwrap_or("");
    let kind = match page_type {
        "MUSIC_PAGE_TYPE_ALBUM" => "album",
        "MUSIC_PAGE_TYPE_PLAYLIST" | "MUSIC_PAGE_TYPE_AUDIOBOOK" => "playlist",
        "MUSIC_PAGE_TYPE_ARTIST" | "MUSIC_PAGE_TYPE_USER_CHANNEL" => "artist",
        _ => return None,
    };
    Some(BrowseItem { id: browse.browse_id.clone(), kind: kind.into(), title, subtitle, thumbnail })
}

/// Map a list-item (song row) into a BrowseItem.
fn list_item_to_item(renderer: &ListItemRenderer) -> Option<BrowseItem> {
    let song = parse_list_renderer(renderer)?;
    let subtitle = if song.artists.is_empty() {
        None
    } else {
        Some(song.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "))
    };
    Some(BrowseItem { id: song.id, kind: "song".into(), title: song.title, subtitle, thumbnail: song.thumbnail })
}

/// Parse carousel/shelf sections into titled rows of browse items.
fn parse_browse_sections(sections: &[BrowseSectionItem]) -> Vec<BrowseSection> {
    let mut out = Vec::new();
    for section in sections {
        let Some(shelf) = section
            .music_carousel_shelf_renderer
            .as_ref()
            .or(section.music_immersive_carousel_shelf_renderer.as_ref())
        else { continue };

        let title = shelf
            .header
            .as_ref()
            .and_then(|h| h.music_carousel_shelf_basic_header_renderer.as_ref())
            .and_then(|h| first_run_text(&h.title))
            .unwrap_or_default();

        let mut items = Vec::new();
        for ci in shelf.contents.iter().flatten() {
            if let Some(two_row) = ci.music_two_row_item_renderer.as_ref() {
                if let Some(bi) = two_row_to_item(two_row) {
                    items.push(bi);
                }
            } else if let Some(li) = ci.music_responsive_list_item_renderer.as_ref() {
                if let Some(bi) = list_item_to_item(li) {
                    items.push(bi);
                }
            }
        }
        if !items.is_empty() {
            out.push(BrowseSection { title, items });
        }
    }
    out
}

/// Parse the charts page: like `parse_browse_sections` but also picks up ranked song
/// shelves (`musicShelfRenderer`, e.g. "Top songs"), which aren't carousels.
fn parse_chart_sections(sections: &[BrowseSectionItem]) -> Vec<BrowseSection> {
    let mut out = Vec::new();
    for section in sections {
        // Carousel shelves (top videos / artists / trending playlists).
        if let Some(shelf) = section
            .music_carousel_shelf_renderer
            .as_ref()
            .or(section.music_immersive_carousel_shelf_renderer.as_ref())
        {
            let title = shelf
                .header
                .as_ref()
                .and_then(|h| h.music_carousel_shelf_basic_header_renderer.as_ref())
                .and_then(|h| first_run_text(&h.title))
                .unwrap_or_default();
            let mut items = Vec::new();
            for ci in shelf.contents.iter().flatten() {
                if let Some(two_row) = ci.music_two_row_item_renderer.as_ref() {
                    if let Some(bi) = two_row_to_item(two_row) {
                        items.push(bi);
                    }
                } else if let Some(li) = ci.music_responsive_list_item_renderer.as_ref() {
                    if let Some(bi) = list_item_to_item(li) {
                        items.push(bi);
                    }
                }
            }
            if !items.is_empty() {
                out.push(BrowseSection { title, items });
            }
        }
        // Ranked song shelf (a plain list of tracks, e.g. "Top songs").
        if let Some(shelf) = section
            .music_shelf_renderer
            .as_ref()
            .or(section.music_playlist_shelf_renderer.as_ref())
        {
            let title = first_run_text(&shelf.title).unwrap_or_default();
            let mut items = Vec::new();
            for it in shelf.contents.iter().flatten() {
                if let ShelfItem::ListItem(list_item) = it {
                    if let Some(r) = list_item.music_responsive_list_item_renderer.as_ref() {
                        if let Some(bi) = list_item_to_item(r) {
                            items.push(bi);
                        }
                    }
                }
            }
            if !items.is_empty() {
                out.push(BrowseSection { title, items });
            }
        }
    }
    out
}

/// Extract (title, subtitle, thumbnail) from a browse page header.
fn parse_header(parsed: &BrowseResponse) -> (String, Option<String>, Option<String>) {
    let Some(header) = parsed.header.as_ref() else { return (String::new(), None, None) };
    let Some(hr) = header
        .music_immersive_header_renderer
        .as_ref()
        .or(header.music_detail_header_renderer.as_ref())
        .or(header.music_visual_header_renderer.as_ref())
    else { return (String::new(), None, None) };

    let title = first_run_text(&hr.title).unwrap_or_default();
    let subtitle = join_runs_text(&hr.subtitle).or_else(|| join_runs_text(&hr.description));
    let thumbnail = hr.thumbnail.as_ref().and_then(|t| {
        let mt = t.music_thumbnail_renderer.as_ref().or(t.cropped_square_thumbnail_renderer.as_ref())?;
        best_thumb(&mt.thumbnail.as_ref()?.thumbnails)
    });
    (title, subtitle, thumbnail)
}

/// Parse the grid of mood/genre navigation buttons.
fn parse_moods(sections: &[BrowseSectionItem]) -> Vec<MoodCategory> {
    let mut out = Vec::new();
    for section in sections {
        let Some(grid) = section.grid_renderer.as_ref() else { continue };
        for item in grid.items.iter().flatten() {
            let Some(btn) = item.music_navigation_button_renderer.as_ref() else { continue };
            let Some(title) = first_run_text(&btn.button_text) else { continue };
            let Some(browse) = btn.click_command.as_ref().and_then(|c| c.browse_endpoint.as_ref()) else { continue };
            let color = btn
                .solid
                .as_ref()
                .and_then(|s| s.left_stripe_color)
                .map(|c| format!("#{:06X}", (c as u32) & 0x00FF_FFFF));
            out.push(MoodCategory {
                title,
                browse_id: browse.browse_id.clone(),
                params: browse.params.clone(),
                color,
            });
        }
    }
    out
}

/// Parse a radio/autoplay queue into playable songs (skipping the seed `video_id`).
fn parse_radio(parsed: NextResponse, seed_id: &str) -> Vec<Song> {
    let items = parsed
        .contents
        .and_then(|c| c.single_column_music_watch_next_results_renderer)
        .and_then(|r| r.tabbed_renderer)
        .and_then(|r| r.watch_next_tabbed_results_renderer)
        .and_then(|r| r.tabs)
        .and_then(|tabs| tabs.into_iter().next())
        .and_then(|t| t.tab_renderer)
        .and_then(|r| r.content)
        .and_then(|c| c.music_queue_renderer)
        .and_then(|q| q.content)
        .and_then(|c| c.playlist_panel_renderer)
        .and_then(|p| p.contents)
        .unwrap_or_default();

    let mut songs = Vec::new();
    for item in items {
        let video = item
            .playlist_panel_video_renderer
            .or_else(|| item.playlist_panel_video_wrapper_renderer.and_then(|w| w.primary_renderer).and_then(|p| p.playlist_panel_video_renderer));
        let Some(v) = video else { continue };
        let Some(id) = v.video_id.filter(|id| id != seed_id) else { continue };
        let title = first_run_text(&v.title).unwrap_or_default();
        if title.is_empty() {
            continue;
        }
        let artists = v
            .long_byline_text
            .as_ref()
            .and_then(|t| t.runs.as_ref())
            .map(|runs| {
                runs.iter()
                    .filter_map(|run| {
                        run.navigation_endpoint
                            .as_ref()
                            .and_then(|e| e.browse_endpoint.as_ref())
                            .filter(|b| !b.browse_id.is_empty())
                            .map(|b| Artist { id: b.browse_id.clone(), name: run.text.clone(), thumbnail: None })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let duration = v
            .length_text
            .as_ref()
            .and_then(|t| t.runs.as_ref())
            .and_then(|runs| runs.first())
            .and_then(|run| parse_hms(&run.text));
        let thumbnail = v.thumbnail.as_ref().and_then(|t| best_thumb(&t.thumbnails));
        songs.push(Song { id, title, artists, album: None, duration, thumbnail, stream_url: None });
    }
    songs
}

fn parse_song_item(item: &MusicResponsiveListItem) -> Option<Song> {
    parse_list_renderer(item.music_responsive_list_item_renderer.as_ref()?)
}

fn parse_list_renderer(renderer: &ListItemRenderer) -> Option<Song> {
    let video_id = renderer.playlist_item_data.as_ref()?.video_id.clone();
    let flex_columns = renderer.flex_columns.as_ref()?;

    let title = flex_columns
        .get(0)?
        .music_responsive_list_item_flex_column_renderer
        .as_ref()?
        .text
        .as_ref()?
        .runs
        .as_ref()?
        .first()?
        .text
        .clone();

    let artists = flex_columns
        .get(1)
        .and_then(|c| c.music_responsive_list_item_flex_column_renderer.as_ref())
        .and_then(|c| c.text.as_ref())
        .and_then(|t| t.runs.as_ref())
        .map(|runs| {
            runs.iter()
                .filter_map(|run| {
                    run.navigation_endpoint
                        .as_ref()
                        .and_then(|e| e.browse_endpoint.as_ref())
                        .filter(|b| !b.browse_id.is_empty())
                        .map(|b| Artist { id: b.browse_id.clone(), name: run.text.clone(), thumbnail: None })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let thumbnail = renderer
        .thumbnail
        .as_ref()
        .and_then(|t| t.music_thumbnail_renderer.as_ref())
        .and_then(|mt| mt.thumbnail.as_ref())
        .and_then(|td| best_thumb(&td.thumbnails));

    // Duration lives in a fixed column as "m:ss" (or "h:mm:ss").
    let duration = renderer.fixed_columns.as_ref().and_then(|cols| {
        cols.iter().rev().find_map(|c| {
            c.music_responsive_list_item_fixed_column_renderer
                .as_ref()
                .and_then(|r| r.text.as_ref())
                .and_then(|t| t.runs.as_ref())
                .and_then(|runs| runs.first())
                .and_then(|run| parse_hms(&run.text))
        })
    });

    Some(Song { id: video_id, title, artists, album: None, duration, thumbnail, stream_url: None })
}

/// Placeholder visitor id. core fetches a fresh one from the visitor endpoint /
/// derives it from the player response; that should be added for robustness.
fn default_visitor_data() -> String {
    "CgtsZ1ZTR3FfVVBGUSiCgJBGAE%3D".to_string()
}
