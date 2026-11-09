// Characters some system refuses in a file name, plus control characters
const UNSAFE_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/g;
const FALLBACK_BASE = "converted";

export interface FileNameParts {
  base: string;
  extension: string;
}

// Name of the input in the engine's filesystem, the extension tells FFmpeg
// how to read it
export function inputFileName(fileName: string): string {
  const ext = fileName.split(".").pop() || "mp3";
  return `input.${ext}`;
}

// A leading dot is part of the name, eg ".env" has no extension
export function splitFileName(fileName: string): FileNameParts {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return { base: fileName, extension: "" };
  return {
    base: fileName.substring(0, dot),
    extension: fileName.substring(dot + 1),
  };
}

// The typed name with unsafe characters dropped, never empty
export function joinFileName(base: string, extension: string): string {
  const clean = base.replace(UNSAFE_CHARACTERS, "").trim() || FALLBACK_BASE;
  return extension ? `${clean}.${extension}` : clean;
}
