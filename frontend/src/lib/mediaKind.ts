export type MediaKind = "audio" | "video" | "image";

const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi"];
// Only what the FFmpeg build or the HEIC decoder can read, so no SVG or AVIF
const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "gif",
  "heic",
  "heif",
];
const HEIC_EXTENSIONS = ["heic", "heif"];
const HEIC_MIME_TYPES = ["image/heic", "image/heif"];

export interface FileNameAndType {
  name: string;
  type: string;
}

export function fileExtension(fileName: string): string {
  if (!fileName.includes(".")) return "";
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// Mime type first for audio and video, extension for the rest
export function mediaKindOf(file: FileNameAndType): MediaKind | null {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";

  const extension = fileExtension(file.name);
  if (AUDIO_EXTENSIONS.includes(extension)) return "audio";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (HEIC_MIME_TYPES.includes(file.type)) return "image";
  return null;
}

export function isHeicFile(file: FileNameAndType): boolean {
  return (
    HEIC_MIME_TYPES.includes(file.type) ||
    HEIC_EXTENSIONS.includes(fileExtension(file.name))
  );
}
