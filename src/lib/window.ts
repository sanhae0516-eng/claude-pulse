import { useEffect, useRef } from "react";
import { inTauri } from "./tauri";

const ANIMATION_MS = 220;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly resize the Tauri window to `targetSize` whenever the target
 * changes. Uses requestAnimationFrame with eased interpolation so dragging
 * the size slider feels fluid instead of snapping in discrete jumps.
 *
 * Cancels any in-flight animation when the target changes mid-flight,
 * so rapid slider movement always chases the latest value.
 */
export function useApplyWindowSize(targetSize: number) {
  const currentSizeRef = useRef<number>(targetSize);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inTauri()) {
      currentSizeRef.current = targetSize;
      return;
    }

    const startSize = currentSizeRef.current;
    const startTime = performance.now();
    let cancelled = false;
    let modules: { setSize: (s: number) => Promise<void> } | null = null;

    // Preload the Tauri APIs once.
    (async () => {
      const [{ getCurrentWebviewWindow }, { LogicalSize }] = await Promise.all([
        import("@tauri-apps/api/webviewWindow"),
        import("@tauri-apps/api/dpi"),
      ]);
      const win = getCurrentWebviewWindow();
      modules = {
        setSize: (s: number) => win.setSize(new LogicalSize(s, s)),
      };
    })();

    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / ANIMATION_MS);
      const eased = easeOutCubic(t);
      const size = Math.round(startSize + (targetSize - startSize) * eased);
      if (size !== currentSizeRef.current) {
        currentSizeRef.current = size;
        modules?.setSize(size).catch(() => {/* swallow transient resize errors */});
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
  }, [targetSize]);
}
