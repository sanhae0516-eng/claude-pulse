mod api;
mod auth;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

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
fn toggle_widget(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[cfg(target_os = "windows")]
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
                let radius = 24i32;

                if let Ok(hwnd) = window.hwnd() {
                    let raw = hwnd.0 as usize;
                    force_popup_style(raw);
                    if let Ok(size) = window.outer_size() {
                        round_window_region(raw, size.width as i32, size.height as i32, radius);
                    }
                }

                // Re-clip rounded region whenever the window resizes,
                // and intercept close to hide-to-tray instead of exiting.
                let win_clone = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::Resized(size) => {
                        if let Ok(hwnd) = win_clone.hwnd() {
                            let raw = hwnd.0 as usize;
                            round_window_region(
                                raw,
                                size.width as i32,
                                size.height as i32,
                                radius,
                            );
                        }
                    }
                    WindowEvent::CloseRequested { api, .. } => {
                        // X / Alt-F4 hides to tray instead of quitting.
                        // Real exit goes through the Quit menu / settings panel.
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_usage, quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
