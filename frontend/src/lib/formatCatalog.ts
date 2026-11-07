import { type MediaKind } from "./mediaKind";

const bitrateOptions = (kbps: number[]): QualityOption[] =>
  kbps.map((rate) => ({
    id: `${rate}k`,
    label: `${rate} kbps`,
    args: ["-b:a", `${rate}k`],
  }));

const AUDIO_BITRATES = bitrateOptions([128, 192, 256, 320]);
// Opus sounds clear well below the MP3 rates
const OPUS_BITRATES = bitrateOptions([96, 128, 192, 256]);

// libopus in ffmpeg.wasm crashes the engine on stereo audio, so Opus comes
// from FFmpeg's own encoder, still marked experimental
const OPUS_AUDIO_ARGS = ["-c:a", "opus", "-strict", "-2"];

// libvorbis rejects a fixed bitrate past what the channels and sample rate
// allow, eg any rate on 22 kHz mono, so Vorbis takes its quality scale.
// The labels give the rate each step lands near on stereo 44.1 kHz.
const VORBIS_QUALITIES: QualityOption[] = [
  { id: "q4", label: "About 128 kbps", args: ["-q:a", "4"] },
  { id: "q6", label: "About 192 kbps", args: ["-q:a", "6"] },
  { id: "q8", label: "About 256 kbps", args: ["-q:a", "8"] },
  { id: "q9", label: "About 320 kbps", args: ["-q:a", "9"] },
];

// Single image output through the image2 muxer needs update to skip the
// numbered file pattern
const SINGLE_IMAGE_ARGS = ["-frames:v", "1", "-update", "1"];

// Even dimensions keep x264 with yuv420p from failing on odd sizes
const EVEN_SIZE_FILTER = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

// faststart puts the index up front so playback starts before the download
// ends, MP4 and MOV both take it
const H264_ARGS = [
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
];

const H264_QUALITIES: QualityOption[] = [
  { id: "low", label: "Low (small file)", args: ["-crf", "32"] },
  { id: "medium", label: "Medium", args: ["-crf", "26"] },
  { id: "high", label: "High (large file)", args: ["-crf", "20"] },
];

// A palette pass gives GIFs far fewer banding artifacts. The palette favors
// moving areas, ordered dither keeps LZW compression working where error
// diffusion noise defeats it, and only the changed rectangle of each frame
// is redrawn. showinfo logs each frame the palette reads, the only sign of
// progress before the first frame is written.
const GIF_PALETTE =
  "split[a][b];[a]showinfo,palettegen=stats_mode=diff[p];" +
  "[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle";

// Past 30 fps and 800px an animated image only grows, too large to share
const ANIMATION_FRAME_RATES = [10, 15, 24, 30];
const MAX_ANIMATION_FPS = 30;

// Keeps every frame the source has, offered only once its rate is known
export const ORIGINAL_FRAME_RATE_ID = "original";
const ANIMATION_WIDTHS = [320, 480, 640, 800];

export const AUDIO_TARGETS: TargetFormat[] = [
  {
    id: "mp3",
    label: "MP3",
    extension: "mp3",
    mime: "audio/mpeg",
    kind: "audio",
    codecArgs: ["-vn", "-c:a", "libmp3lame"],
    qualities: AUDIO_BITRATES,
    defaultQualityId: "320k",
  },
  {
    id: "m4a",
    label: "M4A (AAC)",
    extension: "m4a",
    mime: "audio/mp4",
    kind: "audio",
    codecArgs: ["-vn", "-c:a", "aac"],
    qualities: AUDIO_BITRATES,
    defaultQualityId: "320k",
  },
  {
    id: "ogg",
    label: "OGG (Vorbis)",
    extension: "ogg",
    mime: "audio/ogg",
    kind: "audio",
    codecArgs: ["-vn", "-c:a", "libvorbis"],
    qualities: VORBIS_QUALITIES,
    defaultQualityId: "q9",
  },
  {
    id: "opus",
    label: "Opus",
    extension: "opus",
    mime: "audio/ogg",
    kind: "audio",
    codecArgs: ["-vn", ...OPUS_AUDIO_ARGS],
    qualities: OPUS_BITRATES,
    defaultQualityId: "256k",
  },
  {
    id: "flac",
    label: "FLAC (lossless)",
    extension: "flac",
    mime: "audio/flac",
    kind: "audio",
    codecArgs: ["-vn", "-c:a", "flac"],
    qualities: [],
    defaultQualityId: "",
  },
  {
    id: "wav",
    label: "WAV (lossless)",
    extension: "wav",
    mime: "audio/wav",
    kind: "audio",
    codecArgs: ["-vn", "-c:a", "pcm_s16le"],
    qualities: [],
    defaultQualityId: "",
  },
];

export const VIDEO_TARGETS: TargetFormat[] = [
  {
    id: "mp4",
    label: "MP4 (H.264)",
    extension: "mp4",
    mime: "video/mp4",
    kind: "video",
    codecArgs: H264_ARGS,
    filters: EVEN_SIZE_FILTER,
    qualities: H264_QUALITIES,
    defaultQualityId: "high",
  },
  {
    id: "webm",
    label: "WebM (VP8)",
    extension: "webm",
    mime: "video/webm",
    kind: "video",
    // A GIF decodes with alpha, which libvpx refuses next to its alt-ref
    // frames, so the frames go opaque like every other video target
    codecArgs: [
      "-c:v",
      "libvpx",
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
      "-pix_fmt",
      "yuv420p",
      ...OPUS_AUDIO_ARGS,
      "-b:a",
      "128k",
    ],
    qualities: [
      { id: "low", label: "Low (small file)", args: ["-b:v", "500k"] },
      { id: "medium", label: "Medium", args: ["-b:v", "1M"] },
      { id: "high", label: "High (large file)", args: ["-b:v", "2500k"] },
    ],
    defaultQualityId: "high",
  },
  {
    // Same streams as MP4 in the container Apple apps expect. It sits after
    // WebM so an MP4 upload still defaults to a different codec.
    id: "mov",
    label: "MOV (H.264)",
    extension: "mov",
    mime: "video/quicktime",
    kind: "video",
    codecArgs: H264_ARGS,
    filters: EVEN_SIZE_FILTER,
    qualities: H264_QUALITIES,
    defaultQualityId: "high",
  },
  {
    id: "video-gif",
    label: "GIF (animated)",
    extension: "gif",
    mime: "image/gif",
    kind: "image",
    codecArgs: ["-an"],
    filters: GIF_PALETTE,
    animated: true,
    qualityLabel: "Frame Rate",
    qualities: ANIMATION_FRAME_RATES.map(animationFrameRate),
    defaultQualityId: "30",
    widths: ANIMATION_WIDTHS.map(animationWidth),
    defaultWidthId: "800",
    lossyCompression: true,
  },
  {
    // Loops like a GIF with full color and real compression, far smaller
    id: "video-webp",
    label: "WebP (animated)",
    extension: "webp",
    mime: "image/webp",
    kind: "image",
    // The anim encoder stores only what changed between frames
    codecArgs: ["-an", "-c:v", "libwebp_anim", "-quality", "80", "-loop", "0"],
    animated: true,
    qualityLabel: "Frame Rate",
    qualities: ANIMATION_FRAME_RATES.map(animationFrameRate),
    defaultQualityId: "30",
    widths: ANIMATION_WIDTHS.map(animationWidth),
    defaultWidthId: "800",
  },
];

export const IMAGE_TARGETS: TargetFormat[] = [
  {
    id: "png",
    label: "PNG",
    extension: "png",
    mime: "image/png",
    kind: "image",
    codecArgs: [...SINGLE_IMAGE_ARGS, "-c:v", "png"],
    qualities: [],
    defaultQualityId: "",
  },
  {
    id: "jpg",
    label: "JPG",
    extension: "jpg",
    mime: "image/jpeg",
    kind: "image",
    // The optimal Huffman pass faults or hangs the wasm core on some frames,
    // the standard tables cost a few percent of size
    codecArgs: [...SINGLE_IMAGE_ARGS, "-c:v", "mjpeg", "-huffman", "default"],
    // mjpeg q runs from 2 best to 31 worst
    qualities: imageQualities(["10", "5", "2"]),
    defaultQualityId: "high",
  },
  {
    id: "webp",
    label: "WebP",
    extension: "webp",
    mime: "image/webp",
    kind: "image",
    // The webp muxer writes one file on its own, no update flag
    codecArgs: ["-frames:v", "1", "-c:v", "libwebp"],
    qualities: imageQualities(["50", "75", "90"]),
    defaultQualityId: "high",
  },
  {
    id: "bmp",
    label: "BMP",
    extension: "bmp",
    mime: "image/bmp",
    kind: "image",
    codecArgs: [...SINGLE_IMAGE_ARGS, "-c:v", "bmp"],
    qualities: [],
    defaultQualityId: "",
  },
  {
    id: "tiff",
    label: "TIFF",
    extension: "tiff",
    mime: "image/tiff",
    kind: "image",
    // A YUV source would stay YUV, which TIFF readers reject on odd heights.
    // RGBA reads everywhere and keeps transparency.
    codecArgs: [...SINGLE_IMAGE_ARGS, "-c:v", "tiff", "-pix_fmt", "rgba"],
    qualities: [],
    defaultQualityId: "",
  },
  {
    id: "gif",
    label: "GIF",
    extension: "gif",
    mime: "image/gif",
    kind: "image",
    codecArgs: [],
    filters: GIF_PALETTE,
    qualities: [],
    defaultQualityId: "",
  },
];

const ALL_TARGETS = [...AUDIO_TARGETS, ...VIDEO_TARGETS, ...IMAGE_TARGETS];

export interface QualityOption {
  id: string;
  label: string;
  args: string[];
  // Video filter joined into the one chain, ahead of the target's own
  filter?: string;
}

export interface TargetFormat {
  id: string;
  label: string;
  extension: string;
  mime: string;
  // Kind of the output, picks the preview element
  kind: MediaKind;
  codecArgs: string[];
  // Video filter chain that runs last
  filters?: string;
  // Frames saved as a looping image, the clip length gets capped
  animated?: boolean;
  // Name of the quality select, "Quality" when unset
  qualityLabel?: string;
  qualities: QualityOption[];
  defaultQualityId: string;
  // Output widths, a second select next to quality
  widths?: QualityOption[];
  defaultWidthId?: string;
  // Offers gifsicle's lossy pass after FFmpeg
  lossyCompression?: boolean;
}

export interface TargetGroup {
  label: string;
  targets: TargetFormat[];
}

function animationFrameRate(fps: number): QualityOption {
  return { id: `${fps}`, label: `${fps} fps`, args: [], filter: `fps=${fps}` };
}

// Never upscales, a narrower video keeps its own width
function animationWidth(width: number): QualityOption {
  return {
    id: `${width}`,
    label: `${width} px`,
    args: [],
    filter: `scale='min(iw,${width})':-1:flags=lanczos`,
  };
}

// A source at or under the cap keeps its own rate by default, and only
// slower rates are offered since faster ones copy frames for nothing
export function qualitiesFor(
  target: TargetFormat,
  sourceFps: number | null,
): QualityOption[] {
  if (!target.animated || !keepsSourceRate(sourceFps)) return target.qualities;
  const original: QualityOption = {
    id: ORIGINAL_FRAME_RATE_ID,
    label: `Original (${formatFps(sourceFps)} fps)`,
    args: [],
  };
  const slower = target.qualities.filter(
    (quality) => Number(quality.id) < sourceFps,
  );
  return [original, ...slower];
}

export function defaultQualityFor(
  target: TargetFormat,
  sourceFps: number | null,
): string {
  return target.animated && keepsSourceRate(sourceFps)
    ? ORIGINAL_FRAME_RATE_ID
    : target.defaultQualityId;
}

function keepsSourceRate(sourceFps: number | null): sourceFps is number {
  return sourceFps !== null && sourceFps <= MAX_ANIMATION_FPS;
}

// eg 12.5 stays, 29.97 shows as 29.97, 25.00 shows as 25
function formatFps(fps: number): string {
  return String(Math.round(fps * 100) / 100);
}

// Low, medium and high values for the encoder's q:v scale
function imageQualities([low, medium, high]: [
  string,
  string,
  string,
]): QualityOption[] {
  return [
    { id: "low", label: "Low (small file)", args: ["-q:v", low] },
    { id: "medium", label: "Medium", args: ["-q:v", medium] },
    { id: "high", label: "High", args: ["-q:v", high] },
  ];
}

// Video input can also be cut down to its audio track when it has one, and
// an animated GIF can turn into a real video
export function targetGroupsFor(
  kind: MediaKind,
  inputExtension = "",
  hasAudio = true,
): TargetGroup[] {
  if (kind === "audio") return [{ label: "Audio", targets: AUDIO_TARGETS }];
  if (kind === "video") {
    const video = { label: "Video", targets: VIDEO_TARGETS };
    // A still GIF of one frame is a worse PNG, the animated one sits above
    const stills = {
      label: "Still image",
      targets: IMAGE_TARGETS.filter((target) => target.id !== "gif"),
    };
    if (!hasAudio) return [video, stills];
    return [video, stills, { label: "Audio only", targets: AUDIO_TARGETS }];
  }
  if (inputExtension === "gif") {
    // The animated WebP sits next to the still one, same loop at a fraction
    // of the size. GIF to GIF keeps every frame, so it takes the animated
    // target with its frame rate, width and lossy pass.
    const images = IMAGE_TARGETS.flatMap((target) => {
      if (target.id === "webp") return [target, findTarget("video-webp")!];
      if (target.id === "gif") return [findTarget("video-gif")!];
      return [target];
    });
    return [
      { label: "Image", targets: images },
      {
        label: "Video",
        targets: VIDEO_TARGETS.filter((target) => target.kind === "video"),
      },
    ];
  }
  return [{ label: "Image", targets: IMAGE_TARGETS }];
}

export function targetsFor(
  kind: MediaKind,
  inputExtension = "",
): TargetFormat[] {
  return targetGroupsFor(kind, inputExtension).flatMap(
    (group) => group.targets,
  );
}

// First target that actually changes the format
export function defaultTargetFor(
  kind: MediaKind,
  inputExtension: string,
): TargetFormat | undefined {
  const targets = targetsFor(kind, inputExtension);
  return (
    targets.find((target) => target.extension !== inputExtension) ?? targets[0]
  );
}

// One frame out, so a timeline picks the moment instead of a range
export function isStillImage(target: TargetFormat | undefined): boolean {
  return target?.kind === "image" && !target.animated;
}

export function findTarget(id: string): TargetFormat | undefined {
  return ALL_TARGETS.find((target) => target.id === id);
}

export function findQuality(
  target: TargetFormat,
  qualityId: string,
): QualityOption | undefined {
  return target.qualities.find((quality) => quality.id === qualityId);
}

export function findWidth(
  target: TargetFormat,
  widthId: string,
): QualityOption | undefined {
  return target.widths?.find((width) => width.id === widthId);
}
