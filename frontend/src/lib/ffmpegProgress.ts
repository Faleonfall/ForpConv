// Share of the bar for reading when the palette pass reads everything
// before the first frame is written
const READ_SHARE = 0.7;
// Below this the time left is still a guess
const MIN_RATIO_FOR_ESTIMATE = 0.05;
const MIN_SECONDS_FOR_ESTIMATE = 2;
const NO_BREAK_SPACE = " ";

const DURATION_PATTERN = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/;
const WRITTEN_PATTERN = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/;
// showinfo logs one line per frame on the palette branch
const READ_PATTERN = /pts_time:(-?\d+(?:\.\d+)?)/;

export interface ProgressState {
  // Length of the output in seconds, null until known
  total: number | null;
  readSeconds: number;
  writtenSeconds: number;
  // GIF palette pass, output starts only after the whole input is read
  readsFirst: boolean;
}

export function createProgressState(
  total: number | null,
  readsFirst: boolean,
): ProgressState {
  return { total, readSeconds: 0, writtenSeconds: 0, readsFirst };
}

function clockSeconds(match: RegExpMatchArray): number {
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

// Folds one FFmpeg log line into the state. The input duration fills in
// the total only when the caller did not know the output length.
export function applyLogLine(
  state: ProgressState,
  message: string,
): ProgressState {
  const duration = message.match(DURATION_PATTERN);
  if (duration && state.total === null) {
    const total = clockSeconds(duration);
    return total > 0 ? { ...state, total } : state;
  }

  const written = message.match(WRITTEN_PATTERN);
  if (written) {
    return {
      ...state,
      writtenSeconds: Math.max(state.writtenSeconds, clockSeconds(written)),
    };
  }

  const read = message.match(READ_PATTERN);
  if (read) {
    return {
      ...state,
      readSeconds: Math.max(state.readSeconds, Number(read[1])),
    };
  }

  return state;
}

// 0 to 1, held just under 1 until FFmpeg actually finishes
export function progressRatio(state: ProgressState): number {
  if (!state.total) return 0;
  const part = (seconds: number) => Math.min(1, seconds / state.total!);
  const ratio = state.readsFirst
    ? READ_SHARE * part(state.readSeconds) +
      (1 - READ_SHARE) * part(state.writtenSeconds)
    : part(state.writtenSeconds);
  return Math.min(0.99, Math.max(0, ratio));
}

export function remainingSeconds(
  elapsedSeconds: number,
  ratio: number,
): number | null {
  if (ratio < MIN_RATIO_FOR_ESTIMATE) return null;
  if (elapsedSeconds < MIN_SECONDS_FOR_ESTIMATE) return null;
  return (elapsedSeconds * (1 - ratio)) / ratio;
}

// 0:07, 1:05, 12:30
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// "Converting... 42% · 0:12 elapsed · about 0:16 left". Each part keeps its
// words together, so a narrow screen wraps only between parts.
export function progressStatus(
  label: string,
  percent: number,
  elapsedSeconds: number,
  remaining: number | null,
): string {
  const parts = [
    `${label} ${percent}%`,
    `${formatClock(elapsedSeconds)} elapsed`,
  ];
  if (remaining !== null) parts.push(`about ${formatClock(remaining)} left`);
  return parts.map((part) => part.replaceAll(" ", NO_BREAK_SPACE)).join(" · ");
}
