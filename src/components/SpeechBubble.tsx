import { useEffect, useState } from "react";
import { voice } from "../lib/sound";
import type { LineTag } from "../lib/clawd-lines";

interface SpeechBubbleProps {
  text: string;
  /** Called when the bubble should disappear (timeout, click outside, ESC). */
  onDismiss: () => void;
  /** ms per character while typing */
  charMs?: number;
  /** ms to keep bubble visible after typing finishes */
  holdMs?: number;
  /** When false, the bubble stays until the parent replaces / removes it.
   *  Used in talk-toggle mode where lines auto-cycle from the parent. */
  autoDismiss?: boolean;
  /** Usage-level tag — drives the prefix glyph (◌◐◉▲) shown before text.
   *  null/undefined means it's a non-usage line (no glyph). */
  tag?: LineTag;
}

/**
 * Typing-effect speech bubble. Reveals `text` character-by-character, then
 * lingers for `holdMs` before auto-dismissing (unless `autoDismiss` is off).
 * Clicking the bubble dismisses it immediately.
 */
export function SpeechBubble({
  text,
  onDismiss,
  charMs = 55,
  holdMs = 3500,
  autoDismiss = true,
  tag,
}: SpeechBubbleProps) {
  const [shown, setShown] = useState("");
  const done = shown.length >= text.length;

  // Type the text in. Each newly-revealed character plays a voice blip.
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      const next = text.slice(0, i);
      setShown(next);
      voice(text[i - 1]);
      if (i >= text.length) window.clearInterval(id);
    }, charMs);
    return () => window.clearInterval(id);
  }, [text, charMs]);

  // Auto-dismiss after the typing finishes.
  useEffect(() => {
    if (!done || !autoDismiss) return;
    const id = window.setTimeout(onDismiss, holdMs);
    return () => window.clearTimeout(id);
  }, [done, holdMs, onDismiss, autoDismiss]);

  // ESC dismisses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="speech-bubble"
      data-tag={tag ?? undefined}
      onClick={onDismiss}
    >
      <span className="speech-bubble-text">{shown}</span>
      {!done && <span className="speech-bubble-caret">▍</span>}
    </div>
  );
}
