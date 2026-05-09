/**
 * Mirrors `api::UsageSnapshot` returned by the Rust backend, which in turn
 * mirrors Anthropic's `/api/oauth/usage` response (same data as `/usage`).
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
  refreshedAt: string;
}

/** Returns ms remaining until reset (0 if past). */
export function msUntilReset(resetsAt: string | null, now: number = Date.now()): number {
  if (!resetsAt) return 0;
  return Math.max(0, new Date(resetsAt).getTime() - now);
}

/** Formats remaining ms as `Xh YYm` (or `Xm YYs` under one hour). */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const totalSec = Math.floor(ms / 1000);
  const totalMin = Math.floor(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
