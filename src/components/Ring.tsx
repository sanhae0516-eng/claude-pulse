interface RingProps {
  /** Outer radius in viewBox units (viewBox is 100×100) */
  radius: number;
  /** Stroke thickness in viewBox units */
  thickness: number;
  /** Progress 0..1 */
  progress: number;
  color: string;
  trackColor: string;
  glow?: boolean;
  pulse?: "none" | "soft" | "warning";
}

export function Ring({
  radius,
  thickness,
  progress,
  color,
  trackColor,
  glow = false,
  pulse = "none",
}: RingProps) {
  const r = radius - thickness / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        transform: "rotate(-90deg)",
        pointerEvents: "none",
        filter: glow ? `drop-shadow(0 0 1.5px ${color})` : undefined,
        animation:
          pulse === "warning"
            ? "ring-blink 2s ease-in-out infinite"
            : pulse === "soft"
            ? "ring-pulse 1.5s ease-out 1"
            : undefined,
      }}
    >
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={thickness}
      />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{
          transition:
            "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1), stroke 250ms",
        }}
      />
    </svg>
  );
}
