import { fileExtension, mediaKindOf, type MediaKind } from "./mediaKind";

// Maximum file size of 200MB to avoid browser memory crash
const MAX_FILE_BYTES = 200 * 1024 * 1024;

// Upload errors fade on their own, the user has read them by then
export const UPLOAD_ERROR_MS = 10_000;

export const SILENT_VIDEO_MESSAGE =
  "This video has no sound, pick one with audio.";

export interface MediaFileInfo {
  name: string;
  type: string;
  size: number;
}

// "audio or video", "audio, video or image"
export function kindListLabel(kinds: MediaKind[]): string {
  if (kinds.length < 2) return kinds.join("");
  return `${kinds.slice(0, -1).join(", ")} or ${kinds[kinds.length - 1]}`;
}

// Returns an error message, or null when the file can be converted
export function validateMediaFile(
  file: MediaFileInfo,
  kinds: MediaKind[],
): string | null {
  const kind = mediaKindOf(file);

  if (!kind || !kinds.includes(kind)) {
    return `Unsupported file format (.${fileExtension(file.name)}). Please upload an ${kindListLabel(kinds)} file.`;
  }

  if (file.size > MAX_FILE_BYTES) {
    return "File is too large (max 200MB). Please select a smaller file.";
  }

  return null;
}
