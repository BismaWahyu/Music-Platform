// Windows taskbar Thumbnail Toolbar: Prev / Play-Pause / Next buttons on the taskbar
// thumbnail preview (hover the app in the taskbar), like Spotify.
//
// The buttons are added via ITaskbarList3 once Windows signals the taskbar button exists
// ("TaskbarButtonCreated"). Clicks arrive as WM_COMMAND(THBN_CLICKED); we subclass the
// window to intercept them and emit a `media-control` event ("prev" | "playpause" | "next")
// that the frontend handles. `set_playing` swaps the middle button between play/pause.
//
// Everything COM-related runs on the window's UI thread (the subclass proc), so state lives
// in a thread-local. Failures are swallowed — worst case, no buttons appear (never a crash).

use std::cell::RefCell;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
use windows::Win32::UI::Shell::{
    DefSubclassProc, ITaskbarList3, SetWindowSubclass, TaskbarList, THUMBBUTTON, THBF_ENABLED,
    THB_FLAGS, THB_ICON, THB_TOOLTIP, THBN_CLICKED,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateIconFromResourceEx, LookupIconIdFromDirectoryEx, PostMessageW, RegisterWindowMessageW,
    HICON, IMAGE_FLAGS, WM_APP, WM_COMMAND,
};

const ID_PREV: u32 = 101;
const ID_PLAY: u32 = 102;
const ID_NEXT: u32 = 103;
const SUBCLASS_ID: usize = 0xB0B0;
const WM_UPDATE: u32 = WM_APP + 1; // posted by set_playing to refresh the play/pause icon

// Embedded button glyphs (32×32 .ico), white on transparent.
const ICO_PREV: &[u8] = include_bytes!("../icons/thumb/prev.ico");
const ICO_PLAY: &[u8] = include_bytes!("../icons/thumb/play.ico");
const ICO_PAUSE: &[u8] = include_bytes!("../icons/thumb/pause.ico");
const ICO_NEXT: &[u8] = include_bytes!("../icons/thumb/next.ico");

static APP: OnceLock<AppHandle> = OnceLock::new();
static HWND_RAW: OnceLock<isize> = OnceLock::new();
static WM_TBC: OnceLock<u32> = OnceLock::new(); // "TaskbarButtonCreated"

struct State {
    list: ITaskbarList3,
    icons: [HICON; 4], // prev, play, pause, next
    playing: bool,
}

thread_local! {
    static STATE: RefCell<Option<State>> = const { RefCell::new(None) };
}

/// Install the taskbar toolbar on the given window. Call once from the UI thread (setup).
pub fn init(app: &AppHandle, hwnd_raw: isize) {
    let _ = APP.set(app.clone());
    let _ = HWND_RAW.set(hwnd_raw);
    unsafe {
        let _ = WM_TBC.set(RegisterWindowMessageW(w!("TaskbarButtonCreated")));
        let _ = SetWindowSubclass(hwnd(hwnd_raw), Some(subclass_proc), SUBCLASS_ID, 0);
    }
}

/// Update the middle button to reflect play/pause. Safe to call from any thread — it posts
/// a message so the actual COM update happens on the UI thread.
pub fn set_playing(playing: bool) {
    if let Some(&raw) = HWND_RAW.get() {
        unsafe {
            let _ = PostMessageW(Some(hwnd(raw)), WM_UPDATE, WPARAM(playing as usize), LPARAM(0));
        }
    }
}

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut core::ffi::c_void)
}

unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    if Some(msg) == WM_TBC.get().copied() {
        ensure_buttons(hwnd);
    } else if msg == WM_COMMAND && ((wparam.0 >> 16) & 0xffff) as u32 == THBN_CLICKED {
        let action = match (wparam.0 & 0xffff) as u32 {
            ID_PREV => "prev",
            ID_PLAY => "playpause",
            ID_NEXT => "next",
            _ => "",
        };
        if !action.is_empty() {
            if let Some(app) = APP.get() {
                let _ = app.emit("media-control", action);
            }
            return LRESULT(0);
        }
    } else if msg == WM_UPDATE {
        update_playing(hwnd, wparam.0 != 0);
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

unsafe fn ensure_buttons(hwnd: HWND) {
    STATE.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            let list: ITaskbarList3 =
                match CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER) {
                    Ok(l) => l,
                    Err(_) => return,
                };
            if list.HrInit().is_err() {
                return;
            }
            let icons = [
                load_icon(ICO_PREV),
                load_icon(ICO_PLAY),
                load_icon(ICO_PAUSE),
                load_icon(ICO_NEXT),
            ];
            *slot = Some(State { list, icons, playing: false });
        }
        if let Some(state) = slot.as_ref() {
            let buttons = build_buttons(state);
            let _ = state.list.ThumbBarAddButtons(hwnd, &buttons);
        }
    });
}

unsafe fn update_playing(hwnd: HWND, playing: bool) {
    STATE.with(|cell| {
        let mut slot = cell.borrow_mut();
        if let Some(state) = slot.as_mut() {
            state.playing = playing;
            let buttons = build_buttons(state);
            let _ = state.list.ThumbBarUpdateButtons(hwnd, &buttons);
        }
    });
}

fn build_buttons(state: &State) -> [THUMBBUTTON; 3] {
    let play_icon = if state.playing { state.icons[2] } else { state.icons[1] };
    let play_tip = if state.playing { "Pause" } else { "Play" };
    [
        make_button(ID_PREV, state.icons[0], "Previous"),
        make_button(ID_PLAY, play_icon, play_tip),
        make_button(ID_NEXT, state.icons[3], "Next"),
    ]
}

fn make_button(id: u32, icon: HICON, tip: &str) -> THUMBBUTTON {
    let mut b = THUMBBUTTON {
        dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
        iId: id,
        hIcon: icon,
        dwFlags: THBF_ENABLED,
        ..Default::default()
    };
    for (i, c) in tip.encode_utf16().take(b.szTip.len() - 1).enumerate() {
        b.szTip[i] = c;
    }
    b
}

unsafe fn load_icon(bytes: &[u8]) -> HICON {
    let offset = LookupIconIdFromDirectoryEx(bytes.as_ptr(), true, 0, 0, IMAGE_FLAGS(0));
    if offset <= 0 {
        return HICON(core::ptr::null_mut());
    }
    let rest = &bytes[offset as usize..];
    CreateIconFromResourceEx(rest, true, 0x0003_0000, 0, 0, IMAGE_FLAGS(0))
        .unwrap_or(HICON(core::ptr::null_mut()))
}
