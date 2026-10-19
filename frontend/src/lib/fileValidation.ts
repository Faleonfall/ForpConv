const ALLOWED_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "flac",
  "ogg",
  "mp4",
  "mov",
  "webm",
  "mkv",
  "avi",
];

// Maximum file size of 200MB to avoid browser memory crash
const MAX_FILE_BYTES = 200 * 1024 * 1024;

export interface MediaFileInfo {
  name: string;
  type: string;
  size: number;
}

// Returns an error message, or null when the file can be converted
export function validateMediaFile(file: MediaFileInfo): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAudio = file.type.startsWith("audio/");
  const isVideo = file.type.startsWith("video/");

  if (!isAudio && !isVideo && !ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file format (.${extension}). Please upload an audio or video file.`;
  }

  if (file.size > MAX_FILE_BYTES) {
    return "File is too large (max 200MB). Please select a smaller file.";
  }

  return null;
}
