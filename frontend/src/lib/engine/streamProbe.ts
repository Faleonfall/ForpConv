// Folder the probed file is mounted in, read in place instead of copied
export const PROBE_DIR = "/probe";

// Peak below this is a track of digital silence, real quiet audio sits well
// above it
const SILENCE_DB = -90;

// eg "  Stream #0:1[0x2](und): Audio: aac (LC), 48000 Hz, stereo"
const STREAM_LINE = /Stream #\d+:\d+/;
const AUDIO_STREAM_LINE = /Stream #\d+:\d+.*?: Audio:/;
// eg "  Stream #0:0: Video: gif, bgra, 480x270, 12.50 fps, 12.50 tbr, 100 tbn"
const VIDEO_STREAM_LINE = /Stream #\d+:\d+.*?: Video:/;
// tbr stands in when the average is missing, a "k" there is a timebase
const FRAME_RATE = /(\d+(?:\.\d+)?) fps|(\d+(?:\.\d+)?) tbr/;
// eg "[Parsed_volumedetect_0 @ 0x1] max_volume: -inf dB"
const MAX_VOLUME_LINE = /max_volume: (-?inf|-?\d+(?:\.\d+)?) dB/;

export interface StreamInfo {
  // Null when the probe can't tell, so callers keep every option
  hasAudio: boolean | null;
  // Frames per second of the first video stream, null when unknown
  frameRate: number | null;
}

export const UNKNOWN_STREAMS: StreamInfo = { hasAudio: null, frameRate: null };

// Lists the streams, then decodes only the first audio track to measure its
// peak. Without one the map fails, after the streams are already printed.
export function probeArgs(fileName: string): string[] {
  return [
    "-hide_banner",
    "-i",
    `${PROBE_DIR}/${fileName}`,
    "-map",
    "0:a:0",
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ];
}

// Null when the log lists no streams at all, ie the probe failed
export function hasAudioStream(logLines: string[]): boolean | null {
  if (!logLines.some((line) => STREAM_LINE.test(line))) return null;
  return logLines.some((line) => AUDIO_STREAM_LINE.test(line));
}

// Peak level in dB, minus infinity for pure silence, null when not measured
export function maxVolume(logLines: string[]): number | null {
  for (const line of logLines) {
    const match = MAX_VOLUME_LINE.exec(line);
    if (match) return match[1]!.endsWith("inf") ? -Infinity : Number(match[1]);
  }
  return null;
}

// An audio track of only silence counts as none. A peak that never got
// measured keeps the track, so a failed decode doesn't hide options.
export function hasAudibleSound(logLines: string[]): boolean | null {
  const hasAudio = hasAudioStream(logLines);
  if (hasAudio !== true) return hasAudio;
  const peak = maxVolume(logLines);
  return peak === null || peak > SILENCE_DB;
}

export function frameRate(logLines: string[]): number | null {
  const line = logLines.find((entry) => VIDEO_STREAM_LINE.test(entry));
  const match = line ? FRAME_RATE.exec(line) : null;
  const fps = Number(match?.[1] ?? match?.[2]);
  return fps > 0 ? fps : null;
}

export function readStreams(logLines: string[]): StreamInfo {
  return {
    hasAudio: hasAudibleSound(logLines),
    frameRate: frameRate(logLines),
  };
}
