import type { UsageSnapshot } from "./usage";

/** Runtime check — true when running inside Tauri shell. */
export const inTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Fetch current usage snapshot.
 * - Inside Tauri: calls the Rust `get_usage` command which decrypts the
 *   Claude Desktop OAuth token and hits `https://api.anthropic.com/api/oauth/usage`.
 *   Returns the *exact* same data Claude's `/usage` slash command shows.
 * - In browser preview: returns mock data so the UI is reviewable.
 */
export async function fetchUsage(): Promise<UsageSnapshot> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<UsageSnapshot>("get_usage");
  }
  return mockSnapshot();
}

function mockSnapshot(): UsageSnapshot {
  const fiveHourReset = new Date(Date.now() + 3 * 60 * 60 * 1000 + 14 * 60 * 1000).toISOString();
  const sevenDayReset = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  return {
    plan: "Max (5x)",
    fiveHour: { utilization: 0.26, resetsAt: fiveHourReset },
    sevenDay: { utilization: 0.12, resetsAt: sevenDayReset },
    sevenDayOpus: null,
    refreshedAt: new Date().toISOString(),
  };
}
