export const OUTPUT_FILE_NAME = "output.m4a";
export const RINGTONE_MIME_TYPE = "audio/x-m4r";

export type WorkflowStep =
  "loading" | "upload" | "trim" | "converting" | "download";

export interface ConvertParams {
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  title: string;
}

export function inputFileName(fileName: string): string {
  const ext = fileName.split(".").pop() || "mp3";
  return `input.${ext}`;
}

export function buildAudioFilters(params: ConvertParams): string[] {
  const duration = params.endTime - params.startTime;
  const filters: string[] = [];

  if (params.volume !== 1.0) {
    filters.push(`volume=${params.volume}`);
  }
  if (params.fadeIn > 0) {
    filters.push(`afade=t=in:st=0:d=${params.fadeIn}`);
  }
  if (params.fadeOut > 0) {
    filters.push(
      `afade=t=out:st=${duration - params.fadeOut}:d=${params.fadeOut}`,
    );
  }

  return filters;
}

export function buildFfmpegArgs(
  params: ConvertParams,
  inputName: string,
): string[] {
  const args = [
    "-i",
    inputName,
    "-ss",
    params.startTime.toString(),
    "-to",
    params.endTime.toString(),
  ];

  const filters = buildAudioFilters(params);
  if (filters.length > 0) {
    args.push("-af", filters.join(","));
  }

  args.push(
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-vn", // Strip video tracks
    OUTPUT_FILE_NAME,
  );

  return args;
}

export function progressPercent(progress: number): number {
  return Math.min(100, Math.round(progress * 100));
}
