import { type TargetFormat } from "./formatCatalog";

// An animated image grows with every second, past this a video file is the
// better pick
export const MAX_ANIMATION_SECONDS = 30;
export const DEFAULT_ANIMATION_SECONDS = 5;
export const LONG_ANIMATION_SECONDS = 10;

// Shortest selection the handles allow
export const MIN_CLIP_SECONDS = 0.5;
// Arrow keys on a handle, Shift for the big step
export const TRIM_STEP_SECONDS = 0.1;
export const TRIM_BIG_STEP_SECONDS = 1;
export const FILMSTRIP_FRAMES = 10;

// Ends this close to the file edges count as untrimmed
const EDGE_TOLERANCE = 0.05;

const NO_LIMITS: ClipLimits = { maxSeconds: null, defaultSeconds: null };
const ANIMATION_LIMITS: ClipLimits = {
  maxSeconds: MAX_ANIMATION_SECONDS,
  defaultSeconds: DEFAULT_ANIMATION_SECONDS,
};
const ANIMATED_SOURCE_LIMITS: ClipLimits = {
  maxSeconds: MAX_ANIMATION_SECONDS,
  defaultSeconds: null,
};

export interface ClipRange {
  start: number;
  end: number;
}

export interface ClipLimits {
  maxSeconds: number | null;
  defaultSeconds: number | null;
}

// An animation in keeps all of itself by default, it's short already
export function clipLimitsFor(
  target: TargetFormat | undefined,
  isAnimatedSource = false,
): ClipLimits {
  if (!target?.animated) return NO_LIMITS;
  return isAnimatedSource ? ANIMATED_SOURCE_LIMITS : ANIMATION_LIMITS;
}

export function defaultClipRange(
  duration: number,
  limits: ClipLimits,
): ClipRange {
  return {
    start: 0,
    end: Math.min(
      duration,
      limits.defaultSeconds ?? limits.maxSeconds ?? duration,
    ),
  };
}

// Keeps the range inside the file and under the cap, trimming the end first
export function clampClipRange(
  range: ClipRange,
  duration: number,
  limits: ClipLimits,
): ClipRange {
  const start = Math.min(Math.max(0, range.start), duration);
  let end = Math.min(Math.max(start, range.end), duration);
  if (limits.maxSeconds !== null) {
    end = Math.min(end, start + limits.maxSeconds);
  }
  return { start, end };
}

// Like an editor handle, the start stops short of the end and at the cap
export function moveClipStart(
  range: ClipRange,
  value: number,
  limits: ClipLimits,
): ClipRange {
  const lowest =
    limits.maxSeconds === null ? 0 : Math.max(0, range.end - limits.maxSeconds);
  const highest = Math.max(lowest, range.end - MIN_CLIP_SECONDS);
  return { start: clamp(value, lowest, highest), end: range.end };
}

// Mirror of moveClipStart for the end handle
export function moveClipEnd(
  range: ClipRange,
  value: number,
  duration: number,
  limits: ClipLimits,
): ClipRange {
  const highest =
    limits.maxSeconds === null
      ? duration
      : Math.min(duration, range.start + limits.maxSeconds);
  const lowest = Math.min(highest, range.start + MIN_CLIP_SECONDS);
  return { start: range.start, end: clamp(value, lowest, highest) };
}

// Slides the whole selection, keeping its length and staying in the file
export function moveClipWindow(
  range: ClipRange,
  offset: number,
  duration: number,
): ClipRange {
  const length = range.end - range.start;
  const start = clamp(range.start + offset, 0, Math.max(0, duration - length));
  return { start, end: start + length };
}

// Time under a pointer on the track
export function timeAtPosition(
  pointerX: number,
  trackLeft: number,
  trackWidth: number,
  duration: number,
): number {
  if (trackWidth <= 0) return 0;
  return clamp(((pointerX - trackLeft) / trackWidth) * duration, 0, duration);
}

export function percentOf(time: number, duration: number): number {
  return duration > 0 ? clamp((time / duration) * 100, 0, 100) : 0;
}

// Positions the track reads as CSS custom properties
export function trackStyleVars(
  range: ClipRange,
  playhead: number,
  duration: number,
): Record<string, string> {
  return {
    "--trim-start": `${percentOf(range.start, duration)}%`,
    "--trim-end": `${percentOf(range.end, duration)}%`,
    "--trim-playhead": `${percentOf(playhead, duration)}%`,
  };
}

// Evenly spaced frame times, each in the middle of its slot
export function filmstripTimes(duration: number, count: number): number[] {
  const slot = duration / count;
  return Array.from({ length: count }, (_, i) => slot * (i + 0.5));
}

export function isFullClip(range: ClipRange, duration: number): boolean {
  return (
    range.start <= EDGE_TOLERANCE && range.end >= duration - EDGE_TOLERANCE
  );
}

// The range to convert, null for the whole file. Without a known length a
// capped target still stops at its cap.
export function clipForConvert(
  range: ClipRange,
  duration: number | null,
  limits: ClipLimits,
): ClipRange | null {
  if (duration === null) {
    return limits.maxSeconds === null
      ? null
      : { start: 0, end: limits.maxSeconds };
  }
  return isFullClip(range, duration) ? null : range;
}

export function clipLengthHint(seconds: number, limits: ClipLimits): string {
  if (limits.maxSeconds === null || seconds <= LONG_ANIMATION_SECONDS) {
    return "";
  }
  return "Long animations get large. MP4 or WebM keeps the quality at a fraction of the size.";
}

export function clipPreviewFailedText(limits: ClipLimits): string {
  return limits.maxSeconds === null
    ? "Preview isn't available in this browser, the whole file will be converted."
    : `Preview isn't available in this browser, the first ${limits.maxSeconds} seconds will be converted.`;
}

// Input seeking keeps long files fast, -t is the length from there
export function trimArgs(clip: ClipRange | null): string[] {
  if (!clip) return [];
  return ["-ss", seconds(clip.start), "-t", seconds(clip.end - clip.start)];
}

// The frame a still image is taken from, the first one when unset
export function frameArgs(time: number | null): string[] {
  return time === null || time <= 0 ? [] : ["-ss", seconds(time)];
}

function seconds(value: number): string {
  return String(Number(value.toFixed(3)));
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}
