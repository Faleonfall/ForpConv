import { frameArgs, trimArgs, type ClipRange } from "./clipRange";
import {
  findQuality,
  findWidth,
  isStillImage,
  type TargetFormat,
} from "./formatCatalog";
import { formatFileSize } from "./ringtoneDisplay";

// Encoders that hold the asked bitrate closely enough to predict the size.
// Vorbis follows a quality scale, WAV depends on the source.
const STEADY_BITRATE_TARGETS = ["mp3", "m4a", "opus"];

// Silent H.264 the browser can play and seek, so a GIF gets a timeline
export const TIMELINE_NAME = "timeline.mp4";
const TIMELINE_ARGS = [
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-crf",
  "28",
  "-pix_fmt",
  "yuv420p",
  "-vf",
  "scale=trunc(iw/2)*2:trunc(ih/2)*2",
  "-movflags",
  "+faststart",
];

export interface FormatChoice {
  targetId: string;
  qualityId: string;
  // Output width for targets with widths, empty otherwise
  widthId: string;
  // Run the lossy pass after FFmpeg, only for targets that offer it
  lossy: boolean;
  // Part of the file to keep, null for all of it
  clip: ClipRange | null;
  // Moment a still image is taken from, null for the first frame
  frameTime: number | null;
}

export function timelineArgs(inputName: string): string[] {
  return ["-i", inputName, ...TIMELINE_ARGS, TIMELINE_NAME];
}

export function outputFileName(target: TargetFormat): string {
  return `output.${target.extension}`;
}

export function buildConvertArgs(
  target: TargetFormat,
  qualityId: string,
  inputName: string,
  clip: ClipRange | null = null,
  widthId = "",
  frameTime: number | null = null,
): string[] {
  const seek = isStillImage(target) ? frameArgs(frameTime) : trimArgs(clip);
  // A GIF has no index to seek in, so it decodes from the start and drops
  // what comes before the seek point
  const seeksOutput = inputName.toLowerCase().endsWith(".gif");
  // The original frame rate is no catalog entry, so it adds no fps filter
  const quality = findQuality(target, qualityId);
  const width = findWidth(target, widthId);
  // One chain, a second -vf would replace the first. Frame rate goes first
  // so fewer frames get scaled.
  const filters = [quality?.filter, width?.filter, target.filters].filter(
    (filter): filter is string => Boolean(filter),
  );
  return [
    ...(seeksOutput ? [] : seek),
    "-i",
    inputName,
    ...(seeksOutput ? seek : []),
    ...target.codecArgs,
    ...(filters.length > 0 ? ["-vf", filters.join(",")] : []),
    ...(quality?.args ?? []),
    outputFileName(target),
  ];
}

// Bitrate times length, null where the size depends on the content
export function estimateOutputBytes(
  target: TargetFormat,
  qualityId: string,
  seconds: number | null,
): number | null {
  if (seconds === null || !STEADY_BITRATE_TARGETS.includes(target.id)) {
    return null;
  }
  const args = findQuality(target, qualityId)?.args ?? [];
  const kbps = Number.parseInt(args[args.indexOf("-b:a") + 1] ?? "", 10);
  if (!Number.isFinite(kbps)) return null;
  return (kbps * 1000 * seconds) / 8;
}

export function sizeEstimateLabel(bytes: number | null): string {
  return bytes === null ? "" : `Estimated size: about ${formatFileSize(bytes)}`;
}

// Keeps the original name and swaps the extension
export function convertedFileName(
  fileName: string,
  target: TargetFormat,
): string {
  const dot = fileName.lastIndexOf(".");
  const base = (dot >= 0 ? fileName.substring(0, dot) : fileName).trim();
  return `${base || "converted"}.${target.extension}`;
}
