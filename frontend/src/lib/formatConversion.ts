import { trimArgs, type ClipRange } from "./clipRange";
import { findQuality, findWidth, type TargetFormat } from "./formatCatalog";
import { formatFileSize } from "./ringtoneDisplay";

// Encoders that hold the asked bitrate closely enough to predict the size.
// Opus drops far below it on quiet audio, WAV depends on the source.
const STEADY_BITRATE_TARGETS = ["mp3", "m4a", "ogg"];

export interface FormatChoice {
  targetId: string;
  qualityId: string;
  // Output width for targets with widths, empty otherwise
  widthId: string;
  // Run the lossy pass after FFmpeg, only for targets that offer it
  lossy: boolean;
  // Part of the file to keep, null for all of it
  clip: ClipRange | null;
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
): string[] {
  // The original frame rate is no catalog entry, so it adds no fps filter
  const quality = findQuality(target, qualityId);
  const width = findWidth(target, widthId);
  // One chain, a second -vf would replace the first. Frame rate goes first
  // so fewer frames get scaled.
  const filters = [quality?.filter, width?.filter, target.filters].filter(
    (filter): filter is string => Boolean(filter),
  );
  return [
    ...trimArgs(clip),
    "-i",
    inputName,
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
