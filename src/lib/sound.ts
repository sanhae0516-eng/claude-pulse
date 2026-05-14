/**
 * Tiny synthesized UI sounds. Uses Web Audio so no asset bundling needed.
 * Each sound is brief (30–100 ms) and quiet (gain ≤ 0.05) so it never feels
 * intrusive over a long session.
 *
 * AudioContext is created lazily on first call — browsers gate audio behind
 * a user gesture, and the first interaction (cog click, toggle, etc.) always
 * is one.
 */

type SoundName = "click" | "toggleOn" | "toggleOff" | "select" | "confirm" | "warn" | "speak";

let ctx: AudioContext | null = null;
let enabled = true;
let voiceEnabled = true;
let voiceVolume = 0.5;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

interface ToneSpec {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
}

function tone(spec: ToneSpec, when = 0) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = spec.type ?? "sine";
  osc.frequency.value = spec.frequency;
  const start = c.currentTime + when;
  const peak = spec.gain ?? 0.04;
  const attack = spec.attack ?? 0.004;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + spec.duration + 0.05);
}

/** Master switch — wire to settings.soundsEnabled. */
export function setSoundsEnabled(value: boolean) {
  enabled = value;
}

/** Toggle Claw'd's per-character voice (independent of master UI sounds). */
export function setVoiceEnabled(value: boolean) {
  voiceEnabled = value;
}

/** Voice volume multiplier 0..1 (applied on top of base gain). */
export function setVoiceVolume(value: number) {
  voiceVolume = Math.max(0, Math.min(1, value));
}

/**
 * Animal-Crossing / Undertale-style typing blip. Plays a tiny tone whose
 * pitch is deterministically derived from the character code, giving the
 * "wugga wugga" feel when chained across a typing animation.
 * Skips whitespace and punctuation so the cadence matches the visible syllables.
 */
export function voice(char: string) {
  if (!enabled || !voiceEnabled) return;
  if (!char) return;
  // Only blip on letters / digits (Korean Hangul is in \p{L}).
  if (!/[\p{L}\p{N}]/u.test(char)) return;

  const code = char.charCodeAt(0);
  const variation = (code % 47) / 47;      // pseudo-random but reproducible
  const frequency = 480 + variation * 320; // 480–800 Hz
  tone({
    frequency,
    duration: 0.028,
    type: "triangle",
    gain: 0.05 * voiceVolume,
    attack: 0.001,
  });
}

/**
 * Brief pitch-mapped tick — call repeatedly while dragging a slider to get
 * a "도로로록" scrubbing effect. Pitch rises from 400 Hz at min → 1200 Hz at max.
 * Duration is short enough that rapid successive calls don't overlap noticeably.
 */
export function tick(value: number, min: number, max: number) {
  if (max <= min) return;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const frequency = 400 + t * 800;
  tone({ frequency, duration: 0.022, type: "triangle", gain: 0.022, attack: 0.001 });
}

export const sound: Record<SoundName, () => void> = {
  // Generic crisp tap — buttons, swatches.
  click: () =>
    tone({ frequency: 620, duration: 0.045, type: "triangle", gain: 0.035 }),

  // Toggle ON — bright upward note.
  toggleOn: () =>
    tone({ frequency: 880, duration: 0.07, type: "sine", gain: 0.045 }),

  // Toggle OFF — lower, mellower.
  toggleOff: () =>
    tone({ frequency: 440, duration: 0.07, type: "sine", gain: 0.045 }),

  // Subtle selection (presets, channel pick).
  select: () =>
    tone({ frequency: 720, duration: 0.03, type: "triangle", gain: 0.028 }),

  // Positive two-tone confirm (Save / Done / commit).
  confirm: () => {
    tone({ frequency: 660, duration: 0.05, type: "sine", gain: 0.04 });
    tone({ frequency: 990, duration: 0.08, type: "sine", gain: 0.04 }, 0.05);
  },

  // Cautious low tone (Revert / Reset / Quit).
  warn: () =>
    tone({ frequency: 280, duration: 0.11, type: "triangle", gain: 0.045 }),

  // Cute two-note chirp when Claw'd speaks.
  speak: () => {
    tone({ frequency: 720, duration: 0.045, type: "sine", gain: 0.045 });
    tone({ frequency: 920, duration: 0.065, type: "sine", gain: 0.04 }, 0.045);
  },
};
