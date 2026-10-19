import { type Theme } from "./themeStorage";

// MM:SS.S
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  const minsStr = mins.toString().padStart(2, "0");
  const secsStr = secs.toString().padStart(2, "0");
  return `${minsStr}:${secsStr}.${tenths}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatSeconds(seconds: number, digits?: number): string {
  return `${digits === undefined ? seconds : seconds.toFixed(digits)}s`;
}

export function ringtoneFileName(title: string): string {
  return `${title}.m4r`;
}

export function themeToggleTitle(theme: Theme): string {
  return `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
}
