import { useEffect, useReducer, useRef } from "react";
import { AccessibilityInfo, View } from "react-native";

// The live recording waveform — the one ambient/animated element in the app
// (frontend-planning-doc: "the waveform is the one live element; everything else
// is static-until-interacted"). It keeps a rolling buffer of bar heights: each
// metering tick pushes a new bar on the right and shifts the oldest off the left,
// so the bars scroll like a seismograph while you speak.
//
// Bars are full-height and scaled with `scaleY` (a compositor-friendly transform,
// anchored at the bottom) rather than animating the `height` layout prop — per the
// frontend rules, NEVER animate height/width.

const BAR_COUNT = 28;
const MIN_SCALE = 0.06; // floor so silent bars are still a visible sliver
const DB_FLOOR = -60; // dBFS treated as silence; anything quieter pins to MIN_SCALE

/**
 * Convert one expo-audio metering sample to a bar scale in [MIN_SCALE, 1].
 *
 * `db` is loudness in dBFS: roughly 0 = clipping-loud, -60 (or lower) = silence.
 * expo-audio can also hand back `undefined`/`-Infinity` before the first real
 * sample arrives.
 *
 * ── YOUR CONTRIBUTION ────────────────────────────────────────────────────────
 * This single function decides how the waveform *feels*. Map `db` → a scale in
 * [MIN_SCALE, 1]. Decisions worth making:
 *   • Where's the silence floor? (e.g. treat anything ≤ -60 dB as the minimum.)
 *   • Linear or perceptual? Human loudness is roughly logarithmic, so a linear
 *     map of dB→height already gives a perceptual feel — but you may want to bias
 *     it (e.g. raise to a power) so quiet speech still moves the bars noticeably.
 *   • Clamp the output so a loud transient can't exceed 1 or a glitch go negative.
 * Return MIN_SCALE for the undefined/-Infinity case so the bar never collapses.
 *
 * Right now it returns a flat MIN_SCALE (bars sit dead-flat) — replace the body.
 */
function meteringToScale(db: number | undefined): number {
  // No sample yet, or -Infinity from a dead-silent frame → flat sliver.
  if (db === undefined || !Number.isFinite(db)) return MIN_SCALE;
  // Clamp into the audible window and normalize -60..0 dB → 0..1.
  const norm = (Math.max(DB_FLOOR, Math.min(db, 0)) - DB_FLOOR) / -DB_FLOOR;
  // sqrt biases quiet speech upward so it still visibly moves the bars; then
  // lift off MIN_SCALE so a live bar never fully collapses. Bounded to [MIN_SCALE, 1].
  return MIN_SCALE + (1 - MIN_SCALE) * Math.sqrt(norm);
}

export function Waveform({
  metering,
  active,
  tintClass = "bg-brand-700",
}: {
  metering: number | undefined;
  active: boolean;
  tintClass?: string;
}) {
  // A rolling buffer of bar scales; mutated in place + a forced re-render keeps
  // it allocation-free per tick (this runs ~10×/sec while recording).
  const bars = useRef<number[]>(Array(BAR_COUNT).fill(MIN_SCALE));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    // Reduced-motion: hold a single static level instead of scrolling bars.
    bars.current.shift();
    bars.current.push(reduceMotion.current ? MIN_SCALE * 3 : meteringToScale(metering));
    bump();
  }, [metering, active]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-16 flex-row items-center justify-center gap-[3px]"
    >
      {bars.current.map((scale, i) => (
        <View
          key={i}
          style={{
            transform: [{ scaleY: scale }],
            transformOrigin: "bottom",
          }}
          className={`h-full w-[3px] rounded-full ${tintClass}`}
        />
      ))}
    </View>
  );
}
