interface MusicButtonProps {
  onClick: () => void;
}

/** Tiny ♪ note icon at the bottom-left of the widget, mirroring CogButton. */
export function MusicButton({ onClick }: MusicButtonProps) {
  return (
    <button className="widget-music" onClick={onClick} aria-label="music player">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
        {/* Eighth note: vertical stem + flag + filled note head */}
        <path d="M6 11.2V3l5.5-1.5v8" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="4.4" cy="11.4" rx="1.8" ry="1.4" fill="currentColor" stroke="none" />
        <ellipse cx="9.9" cy="9.9" rx="1.8" ry="1.4" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
