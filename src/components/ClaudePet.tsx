interface ClaudePetProps {
  mood: "happy" | "worried" | "alarm";
}

/**
 * Claw'd — pixel-art sprite per the design spec.
 *
 * Canvas: 320 × 208 px (20 × 13 grid of 16-px cells).
 * Each SVG unit = 1 grid cell = 16 px.
 * Body color #D96A47, eye color #000000.
 * shape-rendering: crispEdges keeps hard pixel boundaries (no anti-aliasing).
 */
export function ClaudePet({ mood }: ClaudePetProps) {
  const orange =
    mood === "alarm" ? "#E64545" : mood === "worried" ? "#D85B2E" : "#D96A47";
  const eye = "#000000";

  return (
    <svg
      className="claude-pet"
      viewBox="0 0 20 13"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      style={{ pointerEvents: "none" }}
    >
      {/* 1. Top head block */}
      <rect x="5" y="2" width="10" height="3" fill={orange} />

      {/* 2. Middle body with horizontal side arms */}
      <rect x="3" y="5" width="14" height="3" fill={orange} />

      {/* 3. Lower body block */}
      <rect x="5" y="8" width="10" height="2" fill={orange} />

      {/* 4–7. Four legs, 1.5 wide × 2.5 tall */}
      <rect x="5" y="10" width="1.5" height="2.5" fill={orange} />
      <rect x="7.75" y="10" width="1.5" height="2.5" fill={orange} />
      <rect x="11" y="10" width="1.5" height="2.5" fill={orange} />
      <rect x="13.5" y="10" width="1.5" height="2.5" fill={orange} />

      {/* 8–9. Eyes — 1.25 × 1.25 squares */}
      <rect className="pet-eye" x="6.5" y="3.5" width="1.25" height="1.25" fill={eye} />
      <rect className="pet-eye" x="12.25" y="3.5" width="1.25" height="1.25" fill={eye} />
    </svg>
  );
}
