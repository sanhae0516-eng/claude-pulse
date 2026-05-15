/**
 * Pixel music notes that bubble up above Claw'd while a track is playing.
 *
 * Layout: absolute fill over the widget. Note position + size + color are all
 * driven by CSS custom properties on `.notes-layer` (see `widget.css`), set
 * once based on the values picked in the dance-mode playground demo. The
 * playground export was: cluster (49%, 45%), spread (22%, 0%), size 9px
 * (cqmin-equivalent), note color white, density 4, layer above bubble.
 *
 * Each note has a matching burst ring that pops at the same coords when the
 * note fades out — gives the "soap bubble" snap feel.
 */

const NOTE_VARIANTS = ["eighth", "quarter", "eighth", "quarter"] as const;

function Note({ slot, variant }: { slot: 1 | 2 | 3 | 4; variant: typeof NOTE_VARIANTS[number] }) {
  return (
    <svg
      className={`mn-note mn-n${slot}`}
      viewBox="0 0 7 10"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Stem (all variants) */}
      <rect x="4" y="0" width="1" height="7" fill="currentColor" />
      {/* Flag — eighth note only */}
      {variant === "eighth" && (
        <>
          <rect x="5" y="1" width="1" height="2" fill="currentColor" />
          <rect x="6" y="2" width="1" height="2" fill="currentColor" />
        </>
      )}
      {/* Head */}
      <rect x="1" y="6" width="3" height="3" fill="currentColor" />
    </svg>
  );
}

export function NotesLayer() {
  return (
    <div className="mn-layer" aria-hidden="true">
      <Note slot={1} variant="eighth" />
      <Note slot={2} variant="quarter" />
      <Note slot={3} variant="eighth" />
      <Note slot={4} variant="quarter" />
      <div className="mn-burst mn-r1" />
      <div className="mn-burst mn-r2" />
      <div className="mn-burst mn-r3" />
      <div className="mn-burst mn-r4" />
    </div>
  );
}
