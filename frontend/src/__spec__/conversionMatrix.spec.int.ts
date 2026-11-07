import { beforeAll, describe, expect, it } from "vitest";
import {
  defaultQualityFor,
  findQuality,
  findTarget,
  isStillImage,
  ORIGINAL_FRAME_RATE_ID,
  qualitiesFor,
  targetGroupsFor,
  type TargetFormat,
} from "../lib/formatCatalog";
import { buildConvertArgs, outputFileName } from "../lib/formatConversion";
import { fileExtension, mediaKindOf } from "../lib/mediaKind";
import { inputFileName } from "../lib/ringtoneConversion";
import {
  PROBE_DIR,
  probeArgs,
  readStreams,
  type StreamInfo,
} from "../lib/streamProbe";
import { runFfmpeg, type CoreRun } from "./ffmpegCore";

// Every input the app accepts, made by the real core, goes through every
// target the picker offers it. Each output is decoded again and checked for
// the streams and frames it should hold.

const SECONDS = 2;
const STEREO = [
  "-f",
  "lavfi",
  "-i",
  `aevalsrc=sin(440*2*PI*t)|sin(660*2*PI*t):d=${SECONDS}:s=44100`,
];
// Low rate mono is where fixed bitrates fail, eg Vorbis
const MONO = ["-f", "lavfi", "-i", `sine=d=${SECONDS}:sample_rate=22050`];
// Odd sizes catch encoders that need even dimensions
const PICTURE = [
  ...["-f", "lavfi", "-i", "testsrc=size=65x49:rate=1:duration=1"],
  ...["-frames:v", "1"],
];
const MOVIE = [
  "-f",
  "lavfi",
  "-i",
  `testsrc=size=161x121:rate=25:d=${SECONDS}`,
];
const H264 = [
  ...["-vf", "scale=160:120", "-c:v", "libx264", "-pix_fmt", "yuv420p"],
  ...["-c:a", "aac", "-shortest"],
];
const NATIVE_OPUS = ["-c:a", "opus", "-strict", "-2"];

const VIDEO_STREAMS: StreamInfo = { hasAudio: true, frameRate: 25 };

interface Fixture {
  name: string;
  // FFmpeg args that make it, or the fixture it renames
  args: string[] | string;
  // What the stream probe should read, for video and GIF only
  streams?: StreamInfo;
}

interface Case {
  fixture: Fixture;
  target: TargetFormat;
  qualityId: string;
  widthId: string;
}

const FIXTURES: Fixture[] = [
  { name: "song.wav", args: STEREO },
  { name: "voice.wav", args: MONO },
  { name: "song.mp3", args: [...STEREO, "-c:a", "libmp3lame"] },
  { name: "song.m4a", args: [...STEREO, "-c:a", "aac"] },
  { name: "song.aac", args: [...STEREO, "-c:a", "aac", "-f", "adts"] },
  { name: "song.flac", args: [...STEREO, "-c:a", "flac"] },
  { name: "song.ogg", args: [...STEREO, "-c:a", "libvorbis"] },
  { name: "song.opus", args: [...STEREO, ...NATIVE_OPUS] },
  {
    name: "clip.mp4",
    args: [...MOVIE, ...STEREO, ...H264],
    streams: VIDEO_STREAMS,
  },
  {
    name: "clip.mov",
    args: [...MOVIE, ...STEREO, ...H264],
    streams: VIDEO_STREAMS,
  },
  {
    name: "clip.mkv",
    args: [...MOVIE, ...STEREO, ...H264],
    streams: VIDEO_STREAMS,
  },
  {
    name: "clip.webm",
    args: [
      ...MOVIE,
      ...STEREO,
      "-c:v",
      "libvpx",
      "-c:a",
      "libvorbis",
      "-shortest",
    ],
    streams: VIDEO_STREAMS,
  },
  {
    name: "clip.avi",
    args: [
      ...MOVIE,
      ...STEREO,
      "-c:v",
      "mpeg4",
      "-c:a",
      "libmp3lame",
      "-shortest",
    ],
    streams: VIDEO_STREAMS,
  },
  {
    name: "voice.mp4",
    args: [...MOVIE, ...MONO, ...H264],
    streams: VIDEO_STREAMS,
  },
  {
    name: "silent.mp4",
    args: [
      ...MOVIE,
      "-vf",
      "scale=160:120",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
    ],
    streams: { hasAudio: false, frameRate: 25 },
  },
  { name: "photo.png", args: PICTURE },
  { name: "photo.jpg", args: [...PICTURE, "-pix_fmt", "yuvj420p"] },
  { name: "photo.jpeg", args: "photo.jpg" },
  { name: "photo.webp", args: [...PICTURE, "-c:v", "libwebp"] },
  { name: "photo.bmp", args: PICTURE },
  { name: "photo.tiff", args: PICTURE },
  { name: "photo.tif", args: "photo.tiff" },
  {
    name: "anim.gif",
    args: ["-f", "lavfi", "-i", `testsrc=size=65x49:rate=10:d=${SECONDS}`],
    streams: { hasAudio: false, frameRate: 10 },
  },
];

// Every input runs each target at its default pick. One input per kind also
// runs every quality and every width, the args those add don't depend on
// the source format.
const OPTION_SWEEP = ["song.wav", "clip.mp4", "photo.png", "anim.gif"];

const files = new Map<string, Uint8Array>();

function kindOf(fixture: Fixture) {
  return mediaKindOf({ name: fixture.name, type: "" })!;
}

// The targets the picker lists once the probe has run, at the pick it starts
// on, plus each other quality and width for a sweep input
function casesFor(fixture: Fixture): Case[] {
  const groups = targetGroupsFor(
    kindOf(fixture),
    fileExtension(fixture.name),
    fixture.streams?.hasAudio ?? true,
  );
  const fps = fixture.streams?.frameRate ?? null;
  const sweeps = OPTION_SWEEP.includes(fixture.name);
  return groups.flatMap(({ targets }) =>
    targets.flatMap((target) => {
      const qualityId = defaultQualityFor(target, fps);
      const widthId = target.defaultWidthId ?? "";
      const picks = [{ fixture, target, qualityId, widthId }];
      if (!sweeps) return picks;
      const otherQualities = qualitiesFor(target, fps)
        .map((quality) => quality.id)
        .filter((id) => id !== qualityId);
      const otherWidths = (target.widths ?? [])
        .map((width) => width.id)
        .filter((id) => id !== widthId);
      return [
        ...picks,
        ...otherQualities.map((id) => ({ ...picks[0]!, qualityId: id })),
        ...otherWidths.map((id) => ({ ...picks[0]!, widthId: id })),
      ];
    }),
  );
}

function caseTitle({ fixture, target, qualityId, widthId }: Case): string {
  const quality =
    qualityId === ORIGINAL_FRAME_RATE_ID
      ? "original fps"
      : findQuality(target, qualityId)?.label;
  const width = widthId ? `${widthId} px` : "";
  return [`${fixture.name} → ${target.label}`, quality, width]
    .filter(Boolean)
    .join(" · ");
}

function logTail(run: CoreRun): string {
  return run.log.slice(-8).join("\n");
}

async function makeFixture({ name, args }: Fixture): Promise<Uint8Array> {
  if (typeof args === "string") return files.get(args)!;
  const run = await runFfmpeg(["-hide_banner", ...args, name], {}, name);
  if (!run.output) throw new Error(`${name} not made:\n${logTail(run)}`);
  return run.output;
}

// Runs the args the app builds for the pick, as the picker sends it
async function convert({ fixture, target, qualityId, widthId }: Case) {
  const isVideo = kindOf(fixture) === "video";
  const inputName = inputFileName(fixture.name);
  const args = buildConvertArgs(
    target,
    qualityId,
    inputName,
    isVideo && target.animated ? { start: 0, end: SECONDS } : null,
    widthId,
    isVideo && isStillImage(target) ? 1 : null,
  );
  const output = outputFileName(target);
  return runFfmpeg(args, { [inputName]: files.get(fixture.name)! }, output);
}

// Decodes the output in a fresh core and reads what it holds
async function inspect(output: Uint8Array, target: TargetFormat) {
  const name = outputFileName(target);
  const run = await runFfmpeg(["-hide_banner", "-i", name, "-f", "null", "-"], {
    [name]: output,
  });
  const log = run.log.join("\n");
  const frames = [...log.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1];
  return {
    decoded: run.exitCode === 0,
    video: /Stream #0:\d.*: Video:/.test(log),
    audio: /Stream #0:\d.*: Audio:/.test(log),
    frames: Number(frames ?? 0),
    tail: logTail(run),
  };
}

// FFmpeg reads no animated WebP, so count its frame chunks instead
function webpFrames(output: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(output);
  return text.split("ANMF").length - 1;
}

// The clip at the picked rate, give or take the frame a rounded edge drops
function expectFrames(frames: number, { fixture, qualityId }: Case) {
  const fps =
    qualityId === ORIGINAL_FRAME_RATE_ID
      ? fixture.streams!.frameRate!
      : Number(qualityId);
  expect(Math.abs(frames - fps * SECONDS)).toBeLessThanOrEqual(1);
}

async function expectPlayable(item: Case, output: Uint8Array) {
  const { target, fixture } = item;
  if (target.animated && target.extension === "webp") {
    expectFrames(webpFrames(output), item);
    return;
  }
  const found = await inspect(output, target);
  expect(found.decoded, found.tail).toBe(true);
  expect(found.video).toBe(target.kind !== "audio");
  if (target.kind === "audio") expect(found.audio).toBe(true);
  if (target.kind === "video" && !target.animated) {
    expect(found.audio).toBe(fixture.streams?.hasAudio ?? true);
  }
  if (target.animated) {
    expectFrames(found.frames, item);
  }
}

beforeAll(async () => {
  for (const fixture of FIXTURES)
    files.set(fixture.name, await makeFixture(fixture));
}, 60_000);

describe("conversion matrix probe", () => {
  it.each(FIXTURES.filter((fixture) => fixture.streams))(
    "reads the streams of $name",
    async (fixture) => {
      const path = `${PROBE_DIR}/${fixture.name}`;
      const run = await runFfmpeg(probeArgs(fixture.name), {
        [path]: files.get(fixture.name)!,
      });

      expect(readStreams(run.log)).toEqual(fixture.streams);
    },
  );
});

describe.each(["audio", "video", "image"])("conversion matrix %s", (kind) => {
  const cases = FIXTURES.filter((fixture) => kindOf(fixture) === kind).flatMap(
    casesFor,
  );

  it.each(cases.map((item) => [caseTitle(item), item] as const))(
    "%s",
    async (_title, item) => {
      const run = await convert(item);

      expect(run.exitCode, logTail(run)).toBe(0);
      await expectPlayable(item, run.output!);
    },
  );
});

describe("conversion matrix engine limits", () => {
  it("still faults libopus on stereo, so Opus keeps the native encoder", async () => {
    const run = await runFfmpeg(
      ["-i", "song.wav", "-c:a", "libopus", "song.opus"],
      { "song.wav": files.get("song.wav")! },
    );

    expect(run.exitCode).toBeNull();
    expect(findTarget("opus")?.codecArgs).not.toContain("libopus");
  });
});
