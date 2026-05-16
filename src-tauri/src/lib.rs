mod api;
mod auth;
mod music;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, LogicalPosition, LogicalSize, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

/// Music window height in logical px. Mirrors the JS `MUSIC_H` in
/// `useMusicWindow.ts` — keep these in sync.
const MUSIC_HEIGHT_LOGICAL: f64 = 110.0;
/// Vertical logical-px gap between the bottom of the main widget and the
/// top of the music window.
const MUSIC_GAP_LOGICAL: f64 = 8.0;

/// Snap the music window directly under the main widget, matching its width.
/// Called from Rust-side WindowEvent handlers so the two windows move in
/// lockstep without a JS round-trip per OS event.
fn sync_music_to_main(app: &AppHandle) {
    let main = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };
    let music = match app.get_webview_window("music") {
        Some(w) => w,
        None => return,
    };
    if !music.is_visible().unwrap_or(false) {
        return;
    }

    let scale = main.scale_factor().unwrap_or(1.0);
    let pos = match main.outer_position() {
        Ok(p) => p,
        Err(_) => return,
    };
    let size = match main.outer_size() {
        Ok(s) => s,
        Err(_) => return,
    };

    let main_x = pos.x as f64 / scale;
    let main_y = pos.y as f64 / scale;
    let main_w = size.width as f64 / scale;
    let main_h = size.height as f64 / scale;

    let target_x = main_x;
    let target_y = main_y + main_h + MUSIC_GAP_LOGICAL;

    // size first, then position. Tauri may re-anchor on size change so the
    // order matters for jitter-free dragging.
    let _ = music.set_size(LogicalSize::new(main_w, MUSIC_HEIGHT_LOGICAL));
    let _ = music.set_position(LogicalPosition::new(target_x, target_y));
}

#[tauri::command]
async fn get_usage() -> Result<api::UsageSnapshot, String> {
    let token = auth::get_access_token().map_err(|e| e.to_string())?;
    api::fetch_usage(&token).await
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Show the widget if hidden, hide it if visible. Used by tray events.
/// The music window (if open) follows the main widget — hidden together,
/// shown together — so the user doesn't end up with a floating player and
/// no widget.
fn toggle_widget(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        let music = app.get_webview_window("music");
        if visible {
            let _ = win.hide();
            if let Some(m) = music {
                if m.is_visible().unwrap_or(false) {
                    let _ = m.hide();
                }
            }
        } else {
            let _ = win.show();
            let _ = win.set_focus();
            // Don't auto-restore music — user toggles it explicitly via ♪.
            // (If we restored here every time, the player would pop back
            // every time the user un-trays, which feels noisy.)
        }
    }
}

/// Win32 GDI region clip so the rectangular OS window matches the CSS
/// rounded-rectangle shape. Without this, the four corners of the window
/// — which the CSS `border-radius` rounds away — show through as
/// transparent triangular wedges (the desktop bleeds through).
///
/// The ellipse diameter equals the CSS `border-radius` × 2 exactly. Any
/// offset would expose a sub-pixel ring of WebView default background
/// (white) between the rounded CSS shape and the region edge.
///
/// In tauri mode `.widget` has `backdrop-filter: none`, so clipping the
/// window region does *not* shrink the backdrop sample area — the
/// concern that originally motivated removing this call (v0.4.0
/// glassmorphism unification) doesn't apply here.
#[cfg(target_os = "windows")]
fn round_window_region(hwnd_raw: usize, width: i32, height: i32, radius: i32) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, SetWindowRgn};
    let hwnd: HWND = hwnd_raw as HWND;
    let ellipse = radius * 2;
    unsafe {
        let rgn = CreateRoundRectRgn(0, 0, width + 1, height + 1, ellipse, ellipse);
        SetWindowRgn(hwnd, rgn, 1);
    }
}

/// Clear the window's small + big icons so nothing leaks through the
/// rounded-corner clip at the top-left of the widget. Tauri assigns the
/// app icon by default; for a chrome-less floating widget we'd rather not
/// have *any* icon associated with the HWND (only the tray icon is needed,
/// and that's a separate object).
#[cfg(target_os = "windows")]
fn clear_window_icon(hwnd_raw: usize) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageW, WM_SETICON};
    const ICON_SMALL: usize = 0;
    const ICON_BIG: usize = 1;
    let hwnd: HWND = hwnd_raw as HWND;
    unsafe {
        let _ = SendMessageW(hwnd, WM_SETICON, ICON_SMALL, 0);
        let _ = SendMessageW(hwnd, WM_SETICON, ICON_BIG, 0);
    }
}

/// Window-proc subclass that intercepts the two messages Windows uses to
/// draw chrome:
///
///   - `WM_NCCALCSIZE` (with `wparam = TRUE`): the system asks "what part of
///     the window is non-client (chrome) area?". Returning 0 says "none —
///     the entire window is client area", so no title bar / borders are
///     ever allocated regardless of `WS_CAPTION` etc.
///   - `WM_NCACTIVATE`: the system tells the window to repaint its chrome
///     active/inactive on focus change. We return 1 (TRUE) to say "handled"
///     so `DefWindowProcW` doesn't get a chance to redraw.
///
/// This is the load-bearing fix for the focus-change-brings-back-chrome
/// bug; manipulating GWL_STYLE alone is reactive (DWM redraws chrome
/// between the focus event and our handler running) while this is
/// preventative (chrome is never asked to draw in the first place).
#[cfg(target_os = "windows")]
extern "system" fn chromeless_subclass_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
    _u_id_subclass: usize,
    _dw_ref_data: usize,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::UI::Shell::DefSubclassProc;
    use windows_sys::Win32::UI::WindowsAndMessaging::{WM_NCACTIVATE, WM_NCCALCSIZE};
    match msg {
        WM_NCCALCSIZE if wparam != 0 => 0,
        WM_NCACTIVATE => 1,
        _ => unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) },
    }
}

/// Install `chromeless_subclass_proc` on the given HWND. Safe to call
/// repeatedly — `SetWindowSubclass` with the same id is a no-op.
#[cfg(target_os = "windows")]
fn install_chromeless_subclass(hwnd_raw: usize) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;
    let hwnd: HWND = hwnd_raw as HWND;
    unsafe {
        SetWindowSubclass(hwnd, Some(chromeless_subclass_proc), 1, 0);
    }
}

/// Strip chrome and lock the window in WS_POPUP style. Kept around as a
/// belt-and-suspenders alongside the wndproc subclass — the style change
/// helps with Tauri's own bookkeeping and influences alt-tab behavior.
#[cfg(target_os = "windows")]
fn force_popup_style(hwnd_raw: usize) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_STYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        WS_CAPTION, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU,
        WS_THICKFRAME,
    };
    let hwnd: HWND = hwnd_raw as HWND;
    unsafe {
        let cur = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let chrome_bits = (WS_CAPTION
            | WS_THICKFRAME
            | WS_MINIMIZEBOX
            | WS_MAXIMIZEBOX
            | WS_SYSMENU) as isize;
        let new_style = (cur & !chrome_bits) | (WS_POPUP as isize);
        SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--silent"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // ── System tray icon + menu ──────────────────────────────
            let toggle = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &separator, &quit])?;

            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("Claude Pulse")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_widget(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_widget(tray.app_handle());
                    }
                })
                .build(app)?;

            // ── Window setup ─────────────────────────────────────────
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            {
                // CSS `border-radius: 18px` shapes the visible widget, but the
                // OS window is still a rectangle — its four corners (which CSS
                // rounds off) render as transparent triangular wedges showing
                // the desktop. SetWindowRgn clips the window itself so those
                // corners stop existing at the OS level. Backdrop-filter is
                // already disabled in `.widget.in-tauri`, so we don't lose any
                // glassmorphism by adding this clip back.
                let radius = 18i32;
                if let Ok(hwnd) = window.hwnd() {
                    let raw = hwnd.0 as usize;
                    // Subclass FIRST so the very first WM_NCCALCSIZE that
                    // comes through (during the immediate frame refresh
                    // below) is already handled by our zero-NC-area
                    // override.
                    install_chromeless_subclass(raw);
                    force_popup_style(raw);
                    clear_window_icon(raw);
                    if let Ok(size) = window.outer_size() {
                        round_window_region(raw, size.width as i32, size.height as i32, radius);
                    }
                }

                let win_clone = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::Resized(size) => {
                        // Music window follows the widget in lockstep — no JS
                        // round-trip per event keeps the drag smooth.
                        sync_music_to_main(&win_clone.app_handle());
                        // Re-clip the rounded region on resize, and re-mask
                        // chrome bits — DWM sometimes re-asserts WS_CAPTION /
                        // WS_THICKFRAME when the window changes size.
                        if let Ok(hwnd) = win_clone.hwnd() {
                            let raw = hwnd.0 as usize;
                            force_popup_style(raw);
                            round_window_region(
                                raw,
                                size.width as i32,
                                size.height as i32,
                                radius,
                            );
                        }
                    }
                    WindowEvent::Moved(_) => {
                        sync_music_to_main(&win_clone.app_handle());
                    }
                    // DWM brings WS_CAPTION + WS_THICKFRAME back the moment the
                    // window loses or regains focus. We have to fight it on
                    // TWO levels: Tauri's `set_decorations(false)` triggers
                    // its own internal frame refresh, and our manual
                    // `force_popup_style` enforces WS_POPUP at the Win32
                    // layer. Calling both seems to be what finally sticks.
                    WindowEvent::Focused(_) => {
                        let _ = win_clone.set_decorations(false);
                        if let Ok(hwnd) = win_clone.hwnd() {
                            let raw = hwnd.0 as usize;
                            force_popup_style(raw);
                            if let Ok(size) = win_clone.outer_size() {
                                round_window_region(
                                    raw,
                                    size.width as i32,
                                    size.height as i32,
                                    radius,
                                );
                            }
                        }
                    }
                    WindowEvent::CloseRequested { api, .. } => {
                        // X / Alt-F4 hides to tray instead of quitting.
                        // Real exit goes through the Quit menu / settings panel.
                        api.prevent_close();
                        let _ = win_clone.hide();
                        // Mirror onto the music window so we don't leave it
                        // floating alone after the main widget is trayed.
                        if let Some(music) = win_clone.app_handle().get_webview_window("music") {
                            if music.is_visible().unwrap_or(false) {
                                let _ = music.hide();
                            }
                        }
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_usage,
            quit_app,
            music::music_scan_folder,
            music::music_scan_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
