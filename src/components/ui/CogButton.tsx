interface CogButtonProps {
  onClick: () => void;
}

/** Tiny gear icon at the bottom-right of the widget. */
export function CogButton({ onClick }: CogButtonProps) {
  return (
    <button className="widget-cog" onClick={onClick} aria-label="settings">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="2.2" />
        <path
          d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
