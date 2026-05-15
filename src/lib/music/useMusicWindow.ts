import { useCallback, useEffect, useState } from "react";
import { inTauri } from "../tauri";

const MUSIC_LABEL = "music";
/** Fixed logical height of the music window. Width matches the main widget. */
const MUSIC_H = 110;
/** Vertical gap (in logical px) between the bottom of the main widget and
 *  the top of the music window. */
const GAP = 8;

/**
 * Manages the lifecycle of the second Tauri window that hosts the music
 * player. Creates it lazily on first toggle, then show/hide on subsequent
 * toggles. Also keeps its position glued just below the main widget by
 * listening to the main window's move/resize events.
 */
export function useMusicWindow() {
  const [isVisible, setIsVisible] = useState(false);

  /** Compute the (x, y) for the music window from the main window's
   *  outer position + size. Falls back to safe defaults outside Tauri. */
  const positionBelowMain = useCallback(async () => {
    if (!inTauri()) return null;
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const main = getCurrentWebviewWindow();
    try {
      const pos = await main.outerPosition();
      const size = await main.outerSize();
      const factor = await main.scaleFactor();
      // outerPosition / outerSize are physical px; convert to logical.
      return {
        xLogical: pos.x / factor,
        yLogical: pos.y / factor + size.height / factor + GAP,
        widthLogical: size.width / factor,
      };
    } catch {
      return null;
    }
  }, []);

  /** Reposition the music window directly under the main widget. */
  const syncPosition = useCallback(async () => {
    if (!inTauri()) return;
    const target = await positionBelowMain();
    if (!target) return;
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
    const music = await WebviewWindow.getByLabel(MUSIC_LABEL);
    if (!music) return;
    try {
      await music.setSize(new LogicalSize(target.widthLogical, MUSIC_H));
      await music.setPosition(new LogicalPosition(target.xLogical, target.yLogical));
    } catch {
      /* window may be in the middle of being created — ignore */
    }
  }, [positionBelowMain]);

  /** Create the window if needed, then show it under the main widget. */
  const showWindow = useCallback(async () => {
    if (!inTauri()) {
      setIsVisible(true);
      return;
    }
    const target = await positionBelowMain();
    if (!target) return;

    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");

    let music = await WebviewWindow.getByLabel(MUSIC_LABEL);
    if (!music) {
      // First call — create the window. Tauri keeps the instance after that.
      music = new WebviewWindow(MUSIC_LABEL, {
        url: "index.html?window=music",
        title: "Claude Pulse — Music",
        width: target.widthLogical,
        height: MUSIC_H,
        x: target.xLogical,
        y: target.yLogical,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        visible: true,
        shadow: false,
      });
      // First-paint sometimes lands at the OS default position before our
      // `x`/`y` apply on Windows. Force a position update once it's ready.
      music.once("tauri://created", () => {
        void syncPosition();
      });
    } else {
      try {
        await music.setSize(new LogicalSize(target.widthLogical, MUSIC_H));
        await music.setPosition(new LogicalPosition(target.xLogical, target.yLogical));
        await music.show();
        await music.setFocus();
      } catch {
        /* ignore */
      }
    }
    setIsVisible(true);
  }, [positionBelowMain, syncPosition]);

  const hideWindow = useCallback(async () => {
    if (!inTauri()) {
      setIsVisible(false);
      return;
    }
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const music = await WebviewWindow.getByLabel(MUSIC_LABEL);
    if (music) {
      try {
        await music.hide();
      } catch {
        /* ignore */
      }
    }
    setIsVisible(false);
  }, []);

  const toggleWindow = useCallback(async () => {
    if (isVisible) await hideWindow();
    else await showWindow();
  }, [isVisible, hideWindow, showWindow]);

  // NOTE: Rust handles per-frame position/size sync (via
  // `WindowEvent::Moved` and `Resized` on the main window). Doing it from
  // JS introduced visible lag during drag — every OS event paid an async
  // IPC round-trip. The JS-side `syncPosition` below is kept only for the
  // *initial* show, where we need to pick a starting point before the
  // window is even created.

  // Detect when the music window is closed by the user (e.g. X) and reflect.
  useEffect(() => {
    if (!inTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const music = await WebviewWindow.getByLabel(MUSIC_LABEL);
      if (!music) return;
      // Tauri emits an event when the window is closed/destroyed; reuse close
      // to keep visibility state coherent.
      unlisten = await music.onCloseRequested(() => {
        setIsVisible(false);
      });
    })();
    return () => unlisten?.();
  }, []);

  return { isVisible, toggleWindow, showWindow, hideWindow };
}
