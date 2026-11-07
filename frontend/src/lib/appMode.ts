import { kindListLabel } from "./fileValidation";
import { type MediaKind } from "./mediaKind";

const RINGTONE_HASH = "#ringtone";

const UPLOAD_BADGE_LABELS: Record<MediaKind, string> = {
  audio: "Audio (MP3, M4A, WAV, FLAC)",
  video: "Video (MP4, MOV, MKV, WebM)",
  image: "Image (PNG, JPG, GIF, HEIC)",
};

export type AppMode = "ringtone" | "convert";

// Which way the content slides, following the tab order
export type SlideDirection = "forward" | "back";

export interface ModeCopy {
  tabLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  uploadSubtitle: string;
  progressTitle: string;
  failedTitle: string;
  // Button that leaves a failed run for the step before it
  backLabel: string;
  kinds: MediaKind[];
}

export interface DownloadCopy {
  heading: string;
  // Line under the heading, only where it adds a next step
  text?: string;
  buttonLabel: string;
  previewLabel: string;
}

export const MODE_COPY: Record<AppMode, ModeCopy> = {
  ringtone: {
    tabLabel: "Ringtone",
    heroTitle: "iPhone M4R Ringtone Maker",
    heroSubtitle:
      "Trim and convert audio or video files into M4R iPhone ringtones.",
    uploadSubtitle: "Supports MP3, WAV, M4A, FLAC, MP4, MOV, and more",
    progressTitle: "Creating Ringtone",
    failedTitle: "Ringtone Failed",
    backLabel: "Back to Trimming",
    kinds: ["audio", "video"],
  },
  convert: {
    tabLabel: "Convert",
    heroTitle: "File Format Converter",
    heroSubtitle:
      "Convert audio, video, and images between formats, or turn a video into a GIF.",
    uploadSubtitle:
      "Supports MP3, FLAC, MP4, WebM, GIF, PNG, JPG, HEIC, and more",
    progressTitle: "Converting File",
    failedTitle: "Conversion Failed",
    backLabel: "Pick Another Format",
    kinds: ["audio", "video", "image"],
  },
};

// Convert is the main tab and the bare address
export const APP_MODES: AppMode[] = ["convert", "ringtone"];

export const RINGTONE_DOWNLOAD_COPY: DownloadCopy = {
  heading: "Ringtone Created!",
  text: "The M4R file is ready. Download and transfer it to the iPhone.",
  buttonLabel: "Download Ringtone File",
  previewLabel: "Preview Tone",
};

// The download card already shows the file name and type
export const CONVERT_DOWNLOAD_COPY: DownloadCopy = {
  heading: "File Converted!",
  buttonLabel: "Download File",
  previewLabel: "Preview",
};

export function modeIndex(mode: AppMode): number {
  return APP_MODES.indexOf(mode);
}

export function slideDirection(from: AppMode, to: AppMode): SlideDirection {
  return modeIndex(to) >= modeIndex(from) ? "forward" : "back";
}

export function modeFromHash(hash: string): AppMode {
  return hash === RINGTONE_HASH ? "ringtone" : "convert";
}

export function hashForMode(mode: AppMode): string {
  return mode === "ringtone" ? RINGTONE_HASH : "";
}

export function uploadTitle(kinds: MediaKind[]): string {
  return `Drop your ${kindListLabel(kinds)} file here`;
}

export function uploadBadgeLabel(kind: MediaKind): string {
  return UPLOAD_BADGE_LABELS[kind];
}

// Image extensions cover HEIC, which browsers rarely tag with a mime type
export function acceptFor(kinds: MediaKind[]): string {
  const types = kinds.map((kind) => `${kind}/*`);
  if (kinds.includes("image")) types.push(".heic", ".heif");
  return types.join(",");
}
