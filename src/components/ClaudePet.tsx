interface ClaudePetProps {
  mood: "happy" | "worried" | "alarm";
  onClick?: () => void;
}

/**
 * Claw'd — pixel-art mascot per the canonical design spec.
 *
 * Body color #D96A47, eye color #000000.
 * Idle: bob + eye blink. Alarm: red eyes + body shake.
 * Clickable when `onClick` is provided (used to trigger a speech bubble).
 */
export function ClaudePet({ mood, onClick }: ClaudePetProps) {
  const orange =
    mood === "alarm" ? "#E64545" : mood === "worried" ? "#D85B2E" : "#D96A47";
  const eye = mood === "alarm" ? "#FF3B30" : "#000000";

  const interactive = !!onClick;

  return (
    <svg
      className={`claude-pet mood-${mood} ${interactive ? "is-clickable" : ""}`}
      viewBox="0 0 20 13"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      style={{ pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "pointer" : "default" }}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      aria-label={interactive ? "Claw'd speaks" : undefined}
    >
      {/* Top head/body block */}
      <rect x="5" y="2" width="10" height="3" fill={orange} />

      {/* Middle body with horizontal side arms */}
      <rect x="3" y="5" width="14" height="3" fill={orange} />

      {/* Lower body block */}
      <rect x="5" y="8" width="10" height="2" fill={orange} />

      {/* Legs */}
      <g className="pet-legs">
        <rect x="5" y="10" width="1.5" height="2.5" fill={orange} />
        <rect x="7.75" y="10" width="1.5" height="2.5" fill={orange} />
        <rect x="11" y="10" width="1.5" height="2.5" fill={orange} />
        <rect x="13.5" y="10" width="1.5" height="2.5" fill={orange} />
      </g>

      {/* Eyes */}
      <rect className="pet-eye" x="6.5" y="3.5" width="1.25" height="1.25" fill={eye} />
      <rect className="pet-eye" x="12.25" y="3.5" width="1.25" height="1.25" fill={eye} />
    </svg>
  );
}
