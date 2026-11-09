// Cap at 30s (GarageBand and carrier limits)
export const MAX_RINGTONE_SECONDS = 30;
export const MAX_FADE_SECONDS = 5;

const SNAP_STEP = 0.5;
const SNAP_TOLERANCE = 0.04;

export interface GainInput {
  time: number;
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  isPlaying: boolean;
}

// Preview gain at the playhead, applying volume and both fades
export function previewGain(input: GainInput): number {
  let gain = input.volume;

  // Fade In: from selection start to fade-in duration
  const timeIntoSelection = input.time - input.startTime;
  if (
    input.fadeIn > 0 &&
    timeIntoSelection >= 0 &&
    timeIntoSelection < input.fadeIn
  ) {
    gain *= timeIntoSelection / input.fadeIn;
  }

  // Fade Out: from fade-out start to selection end
  const timeRemaining = input.endTime - input.time;
  if (
    input.fadeOut > 0 &&
    timeRemaining >= 0 &&
    timeRemaining < input.fadeOut
  ) {
    gain *= timeRemaining / input.fadeOut;
  }

  // Silence outside the selection region during preview
  const outside = input.time < input.startTime || input.time > input.endTime;
  if (outside && input.isPlaying) {
    gain = 0;
  }

  return gain;
}

// Snap to the nearest half second unless free movement is held
export function snapToSticky(value: number, free: boolean): number {
  if (free) return value;
  const nearest = Math.round(value / SNAP_STEP) * SNAP_STEP;
  return Math.abs(value - nearest) < SNAP_TOLERANCE ? nearest : value;
}

export function sliderFade(value: number, free: boolean): number {
  return parseFloat(snapToSticky(value, free).toFixed(2));
}

export function clampFade(value: number): number {
  return Math.max(0, Math.min(MAX_FADE_SECONDS, Number(value) || 0));
}

export function initialSelectionEnd(duration: number): number {
  return Math.min(MAX_RINGTONE_SECONDS, duration);
}

// Strict failsafe: never emit a selection longer than the cap
export function clampSelectionEnd(startTime: number, endTime: number): number {
  return Math.min(endTime, startTime + MAX_RINGTONE_SECONDS);
}

export function waveformHeight(screenHeight: number): number {
  if (screenHeight < 700) return 80;
  if (screenHeight < 850) return 100;
  return 128;
}

export function defaultRingtoneTitle(fileName: string): string {
  const withoutExt = fileName.substring(0, fileName.lastIndexOf("."));
  return withoutExt.replace(/[^a-zA-Z0-9_\-\s]/g, "");
}

export function finalRingtoneTitle(title: string): string {
  return title.trim() || "ringtone";
}
