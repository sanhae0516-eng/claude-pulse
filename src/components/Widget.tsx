import { useEffect, useRef, useState } from "react";
import { Ring } from "./Ring";
import { ClaudePet } from "./ClaudePet";
import { SettingsPanel } from "./SettingsPanel";
import { SpeechBubble } from "./SpeechBubble";
import { CogButton } from "./ui/CogButton";
import { MusicButton } from "./ui/MusicButton";
import { inTauri } from "../lib/tauri";
import { useUsage } from "../lib/useUsage";
import { formatRemaining, msUntilReset } from "../lib/usage";
import { useSettings, getPalette } from "../lib/settings";
import { useApplyWindowSize } from "../lib/window";
import { sound, setSoundsEnabled, setVoiceEnabled, setVoiceVolume } from "../lib/sound";
import { pickLine, makeContext, type PickedLine } from "../lib/clawd-lines";
import { useMusicWindow } from "../lib/music/useMusicWindow";
import { useMusicStatus } from "../lib/music/useMusicStatus";
import { NotesLayer } from "./music/NotesLayer";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/** 0..1 of how much of the 5h window has elapsed. */
function timeProgress(resetsAt: string | null, now: number): number {
  if (!resetsAt) return 0;
  return Math.max(0, Math.min(1, 1 - msUntilReset(resetsAt, now) / FIVE_HOURS_MS));
}

function shortError(e: string): string {
  const lower = e.toLowerCase();
  if (e.includes("429") || lower.includes("rate_limit")) return "rate-limited · retrying";
  if (e.includes("401") || lower.includes("auth")) return "auth — open Claude Desktop";
  if (lower.includes("request") || lower.includes("network")) return "offline · retrying";
  return "retrying…";
}

export function Widget() {
  const { snap, now, error } = useUsage();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, patchSettings] = useSettings();
  // Music lives in its own Tauri window — this hook owns its lifecycle.
  // Position sync (move/resize) is handled in Rust, so we don't need to
  // pass widget size through here.
  const musicWindow = useMusicWindow();
  // Music playback status — driven by `music:status` events emitted by the
  // music window. Powers the "dancing" mood when something is playing.
  const musicStatus = useMusicStatus();
  const isMusicPlaying = musicStatus === "playing";

  // The widget itself stays square (width=height=size). The music feature is
  // a separate window so no height growth here.
  useApplyWindowSize(settings.size, settings.size);

  // Sync the sound module's master switch with the persisted setting.
  useEffect(() => {
    setSoundsEnabled(settings.soundsEnabled);
  }, [settings.soundsEnabled]);

  // Voice settings sync.
  useEffect(() => {
    setVoiceEnabled(settings.voiceEnabled);
  }, [settings.voiceEnabled]);
  useEffect(() => {
    setVoiceVolume(settings.voiceVolume);
  }, [settings.voiceVolume]);

  const openSettings = () => {
    sound.click();
    setShowSettings(true);
  };

  /** ♪ button — toggles the separate music window. Window is created lazily
   *  on first click; subsequent clicks just show/hide. */
  const toggleMusic = () => {
    sound.click();
    void musicWindow.toggleWindow();
  };

  // ── Claw'd talk-toggle mode ─────────────────────────────
  // Clicking Claw'd toggles the talk mode. While active, new lines pop up
  // automatically on a fixed cadence. Click again to silence.
  const [talkActive, setTalkActive] = useState(false);
  const [speech, setSpeech] = useState<PickedLine | null>(null);
  const [lineKey, setLineKey] = useState(0);

  // Keep a live ref to the current usage % so the timer loop can read it
  // without having to be reset every minute.
  const usagePctRef = useRef(0);
  usagePctRef.current = Math.round((snap?.fiveHour?.utilization ?? 0) * 100);

  const toggleTalk = () => {
    sound.speak();
    setTalkActive((v) => !v);
  };

  useEffect(() => {
    if (!talkActive) {
      setSpeech(null);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const showNext = () => {
      if (cancelled) return;
      const picked = pickLine(makeContext(usagePctRef.current));
      setSpeech(picked);
      setLineKey((k) => k + 1);
      // Cycle: typing (~15 chars × 55ms ≈ 1s) + hold + gap ≈ 8s total
      timer = window.setTimeout(showNext, 8000);
    };
    showNext();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [talkActive]);

  const wrapperStyle = { opacity: settings.opacity } as React.CSSProperties;
  const dragProps =
    settings.locked || showSettings ? {} : { "data-tauri-drag-region": true };

  // Pre-compute view-model bits for the default body. Settings panel still
  // uses overlay-replace (it only covers the square widget body, leaving the
  // mini-player below it visible — by design).
  const five = snap?.fiveHour;
  const week = snap?.sevenDay;
  const uRatio = five?.utilization ?? 0;
  const tRatio = timeProgress(five?.resetsAt ?? null, now);
  const remaining = formatRemaining(msUntilReset(five?.resetsAt ?? null, now));
  const palette = getPalette(settings);
  // Music takes priority over usage-driven moods so Claw'd is visibly happy
  // (dancing) the moment a track starts. When the user pauses or stops,
  // the mood falls back to the usage-based palette.
  const mood = isMusicPlaying
    ? "dancing"
    : uRatio >= 0.95 ? "alarm"
    : uRatio >= 0.85 ? "worried"
    : "happy";
  const pulse = uRatio >= 0.95 ? "warning" : uRatio >= 0.8 ? "soft" : "none";
  const pct = Math.round(uRatio * 100);
  const weekPct = week ? Math.round(week.utilization * 100) : null;
  const hint = error ? shortError(error) : "fetching…";

  let widgetBody: React.ReactNode;
  if (showSettings) {
    widgetBody = (
      <SettingsPanel
        settings={settings}
        onChange={patchSettings}
        onClose={() => setShowSettings(false)}
      />
    );
  } else if (!snap) {
    widgetBody = (
      <>
        <div className="widget-loading-stack" {...dragProps}>
          <div className="widget-loading-dots mono" {...dragProps}>•••</div>
          <div className="widget-loading-hint" {...dragProps}>{hint}</div>
        </div>
        <CogButton onClick={openSettings} />
        <MusicButton onClick={toggleMusic} />
      </>
    );
  } else {
    widgetBody = (
      <>
        <Ring
          radius={47}
          thickness={1.8}
          progress={1 - tRatio}
          color={palette.timeRing}
          trackColor="rgba(255, 255, 255, 0.08)"
        />
        <Ring
          radius={40}
          thickness={3.6}
          progress={uRatio}
          color={palette.usageRing}
          trackColor="rgba(255, 255, 255, 0.06)"
          pulse={pulse}
        />
        <div className="widget-center" {...dragProps}>
          {settings.showCharacter && (
            <div className="claude-pet-wrap">
              {speech && (
                <SpeechBubble
                  key={lineKey}
                  text={speech.text}
                  tag={speech.tag}
                  autoDismiss={!talkActive}
                  onDismiss={() => {
                    if (talkActive) setTalkActive(false);
                    else setSpeech(null);
                  }}
                />
              )}
              <ClaudePet mood={mood} onClick={toggleTalk} />
            </div>
          )}
          <div className="widget-pct mono" style={{ color: palette.number }} {...dragProps}>
            {pct}<span className="widget-pct-sym">%</span>
          </div>
          <div className="widget-remaining mono" {...dragProps}>{remaining}</div>
          {settings.showWeek && weekPct !== null && (
            <div className="widget-week mono" {...dragProps}>week {weekPct}%</div>
          )}
        </div>
        <CogButton onClick={openSettings} />
        <MusicButton onClick={toggleMusic} />
        {/* Notes layer is a widget-root child (not inside the character wrap),
            so its coordinate system is the entire widget — exactly the same
            coordinate system the playground demo uses. The 49%/45% values
            산해님 dialed in then land at the same visual position here. */}
        {isMusicPlaying && <NotesLayer />}
      </>
    );
  }

  return (
    <div
      className={`widget ${inTauri() ? "in-tauri" : "in-browser"} ${isMusicPlaying ? "dancing" : ""}`}
      style={wrapperStyle}
      {...dragProps}
    >
      {widgetBody}
    </div>
  );
}
