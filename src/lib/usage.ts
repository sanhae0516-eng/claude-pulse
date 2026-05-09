/**
 * Mirrors `api::UsageSnapshot` returned by the Rust backend, which in turn
 * mirrors Anthropic's `/api/oauth/usage` response (the same data the
 * `/usage` slash command shows).
 */
export interface UsageBucket {
  /** 0..1 fractional utilization */
  utilization: number;
  /** RFC3339 timestamp of next reset, if known */
  resetsAt: string | null;
}

export interface UsageSnapshot {
  plan: string | null;
  fiveHour: UsageBucket | null;
  sevenDay: UsageBucket | null;
  sevenDayOpus: UsageBucket | null;
  /** RFC3339 timestamp of when this was fetched */
  refreshedAt: string;
}

/** Returns ms remaining until reset (0 if past). */
export function msUntilReset(resetsAt: string | null, now: number = Date.now()): number {
  if (!resetsAt) return 0;
  const t = new Date(resetsAt).getTime();
  return Math.max(0, t - now);
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    const totalSec = Math.floor(ms / 1000);
    const remM = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${remM}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function usageColor(ratio: number): string {
  if (ratio < 0.6) return "var(--usage-low)";
  if (ratio < 0.85) return "var(--usage-mid)";
  return "var(--usage-high)";
}
