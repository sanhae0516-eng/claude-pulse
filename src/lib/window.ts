import { useEffect } from "react";
import { inTauri } from "./tauri";

/** Resizes the Tauri window whenever `size` changes (no-op outside Tauri). */
export function useApplyWindowSize(size: number) {
  useEffect(() => {
    if (!inTauri()) return;
    (async () => {
      try {
        const [{ getCurrentWebviewWindow }, { LogicalSize }] = await Promise.all([
          import("@tauri-apps/api/webviewWindow"),
          import("@tauri-apps/api/dpi"),
        ]);
        await getCurrentWebviewWindow().setSize(new LogicalSize(size, size));
      } catch (e) {
        console.error("setSize failed", e);
      }
    })();
  }, [size]);
}
