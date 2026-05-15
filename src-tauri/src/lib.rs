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

/// (Currently unused) Win32 GDI region clip for OS-level rounded corners.
/// Disabled in favor of CSS-only rounded corners — the GDI mask was clipping
/// the backdrop-filter sample area on the webview, making the widget feel
/// "plastic / opaque" compared to the music window. Kept around in case we
/// want to opt back in for a single sharper variant.
#[cfg(target_os = "windows")]
#[allow(dead_code)]
fn round_window_region(hwnd_raw: usize, width: i32, height: i32, radius: i32) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, SetWindowRgn};
    let hwnd: HWND = hwnd_raw as HWND;
    let ellipse = (radius + 2) * 2;
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

/// Strip chrome (title bar / min-max-close / thick frame) from the window
/// while preserving every other style bit Tauri set up. Wholesale-replacing
/// GWL_EXSTYLE clobbers WS_EX_LAYERED which Tauri uses for transparency,
/// freezing the webview — so we mask out only the chrome bits in GWL_STYLE
/// and leave GWL_EXSTYLE alone.
#[cfg(target_os = "windows")]
fn force_popup_style(hwnd_raw: usize) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_STYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        WS_CAPTION, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU, WS_THICKFRAME,
    };
    let hwnd: HWND = hwnd_raw as HWND;
    unsafe {
        let cur = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let chrome_bits = (WS_CAPTION
            | WS_THICKFRAME
            | WS_MINIMIZEBOX
            | WS_MAXIMIZEBOX
            | WS_SYSMENU) as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, cur & !chrome_bits);
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
                // Rounded corners are CSS-only now (`border-radius` on `.widget`).
                // The previous `SetWindowRgn` GDI clip looked sharper at the
                // pixel level, but it shrank the backdrop-filter sample area
                // so the widget felt plastic / opaque next to the music window.
                // We still strip chrome bits and the window icon though — those
                // are unrelated to backdrop sampling.
                if let Ok(hwnd) = window.hwnd() {
                    let raw = hwnd.0 as usize;
                    force_popup_style(raw);
                    clear_window_icon(raw);
                }

                let win_clone = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::Resized(_size) => {
                        // Music window follows the widget in lockstep — no JS
                        // round-trip per event keeps the drag smooth.
                        sync_music_to_main(&win_clone.app_handle());
                    }
                    WindowEvent::Moved(_) => {
                        sync_music_to_main(&win_clone.app_handle());
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
