import { useEffect, useRef } from "react";
import { inTauri } from "./tauri";

const ANIMATION_MS = 220;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly resize the Tauri window to `(targetWidth, targetHeight)` whenever
 * either changes. Eased interpolation via rAF so dragging the size slider —
 * or expanding the music player — feels fluid instead of snapping.
 *
 * Width and height are interpolated independently in a single frame loop, so
 * "width stays, height grows" (music player expansion) animates correctly
 * without double-loops.
 */
export function useApplyWindowSize(targetWidth: number, targetHeight: number) {
  const currentRef = useRef<{ w: number; h: number }>({
    w: targetWidth,
    h: targetHeight,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inTauri()) {
      currentRef.current = { w: targetWidth, h: targetHeight };
      return;
    }

    const startW = currentRef.current.w;
    const startH = currentRef.current.h;
    const startTime = performance.now();
    let cancelled = false;
    let modules: { setSize: (w: number, h: number) => Promise<void> } | null = null;

    (async () => {
      const [{ getCurrentWebviewWindow }, { LogicalSize }] = await Promise.all([
        import("@tauri-apps/api/webviewWindow"),
        import("@tauri-apps/api/dpi"),
      ]);
      const win = getCurrentWebviewWindow();
      modules = {
        setSize: (w: number, h: number) => win.setSize(new LogicalSize(w, h)),
      };
    })();

    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / ANIMATION_MS);
      const eased = easeOutCubic(t);
      const w = Math.round(startW + (targetWidth - startW) * eased);
      const h = Math.round(startH + (targetHeight - startH) * eased);
      if (w !== currentRef.current.w || h !== currentRef.current.h) {
        currentRef.current = { w, h };
        modules?.setSize(w, h).catch(() => {/* swallow transient resize errors */});
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetWidth, targetHeight]);
}
