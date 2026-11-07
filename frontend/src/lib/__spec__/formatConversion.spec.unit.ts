import { describe, expect, it } from "vitest";
import { findTarget } from "../formatCatalog";
import {
  buildConvertArgs,
  convertedFileName,
  estimateOutputBytes,
  outputFileName,
  sizeEstimateLabel,
  timelineArgs,
} from "../formatConversion";

describe("buildConvertArgs seeking", () => {
  it("takes a still from the chosen moment of a video", () => {
    const args = buildConvertArgs(
      findTarget("png")!,
      "",
      "input.mp4",
      { start: 1, end: 4 },
      "",
      3.5,
    );

    expect(args.slice(0, 4)).toEqual(["-ss", "3.5", "-i", "input.mp4"]);
    expect(args).not.toContain("-t");
  });

  it("trims a GIF after reading it, it has no index to seek in", () => {
    const args = buildConvertArgs(
      findTarget("video-gif")!,
      "original",
      "input.gif",
      { start: 1, end: 3 },
    );

    expect(args.slice(0, 6)).toEqual([
      "-i",
      "input.gif",
      "-ss",
      "1",
      "-t",
      "2",
    ]);
  });

  it("renders a silent seekable MP4 for the GIF timeline", () => {
    const args = timelineArgs("input.gif");

    expect(args.slice(0, 3)).toEqual(["-i", "input.gif", "-an"]);
    expect(args).toEqual(expect.arrayContaining(["libx264", "yuv420p"]));
    expect(args.at(-1)).toBe("timeline.mp4");
  });
});

describe("buildConvertArgs", () => {
  it("adds the codec and the chosen bitrate", () => {
    expect(buildConvertArgs(findTarget("mp3")!, "256k", "input.wav")).toEqual([
      "-i",
      "input.wav",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "256k",
      "output.mp3",
    ]);
  });

  it("leaves out quality for a lossless target", () => {
    expect(buildConvertArgs(findTarget("flac")!, "", "input.mp3")).toEqual([
      "-i",
      "input.mp3",
      "-vn",
      "-c:a",
      "flac",
      "output.flac",
    ]);
  });

  it("writes a single still image", () => {
    expect(buildConvertArgs(findTarget("jpg")!, "high", "input.png")).toEqual([
      "-i",
      "input.png",
      "-frames:v",
      "1",
      "-update",
      "1",
      "-c:v",
      "mjpeg",
      "-q:v",
      "2",
      "output.jpg",
    ]);
  });

  it("keeps the even size filter as the only video filter for MP4", () => {
    const args = buildConvertArgs(findTarget("mp4")!, "high", "input.mov");

    expect(args.filter((arg) => arg === "-vf")).toHaveLength(1);
    expect(args[args.indexOf("-vf") + 1]).toBe(
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    );
  });
});

describe("buildConvertArgs animated output", () => {
  it("loops a video as an animated WebP at the chosen size", () => {
    const args = buildConvertArgs(
      findTarget("video-webp")!,
      "15",
      "input.mp4",
      { start: 0, end: 5 },
      "640",
    );

    expect(args).toEqual(
      expect.arrayContaining(["-c:v", "libwebp_anim", "-loop", "0"]),
    );
    expect(args[args.indexOf("-vf") + 1]).toBe(
      "fps=15,scale='min(iw,640)':-1:flags=lanczos",
    );
    expect(args.at(-1)).toBe("output.webp");
  });

  it("scales and samples a trimmed video into a GIF", () => {
    const args = buildConvertArgs(
      findTarget("video-gif")!,
      "10",
      "input.mp4",
      { start: 3, end: 8 },
      "320",
    );
    const filter = args[args.indexOf("-vf") + 1];

    expect(args.slice(0, 7)).toEqual([
      "-ss",
      "3",
      "-t",
      "5",
      "-i",
      "input.mp4",
      "-an",
    ]);
    expect(args.filter((arg) => arg === "-vf")).toHaveLength(1);
    expect(filter).toMatch(/^fps=10,scale='min\(iw,320\)':-1/);
    expect(filter).toContain("palettegen=stats_mode=diff");
    expect(filter).toContain("dither=bayer");
    expect(filter).toContain("diff_mode=rectangle");
    expect(args.at(-1)).toBe("output.gif");
  });

  it("keeps the source frame rate at original", () => {
    const args = buildConvertArgs(
      findTarget("video-webp")!,
      "original",
      "input.gif",
      null,
      "480",
    );

    expect(args[args.indexOf("-vf") + 1]).toBe(
      "scale='min(iw,480)':-1:flags=lanczos",
    );
  });
});

describe("outputFileName", () => {
  it("uses the target extension", () => {
    expect(outputFileName(findTarget("webm")!)).toBe("output.webm");
  });
});

describe("convertedFileName", () => {
  it("swaps the extension", () => {
    expect(convertedFileName("My Song.final.wav", findTarget("mp3")!)).toBe(
      "My Song.final.mp3",
    );
  });

  it("falls back to a default base", () => {
    expect(convertedFileName(".wav", findTarget("mp3")!)).toBe("converted.mp3");
    expect(convertedFileName("clip", findTarget("mp4")!)).toBe("clip.mp4");
  });
});

describe("estimateOutputBytes", () => {
  it("multiplies the bitrate by the length", () => {
    expect(estimateOutputBytes(findTarget("mp3")!, "320k", 30)).toBe(1_200_000);
    expect(estimateOutputBytes(findTarget("m4a")!, "128k", 10)).toBe(160_000);
  });

  it("skips formats whose size depends on the content", () => {
    expect(estimateOutputBytes(findTarget("opus")!, "320k", 30)).toBeNull();
    expect(estimateOutputBytes(findTarget("wav")!, "", 30)).toBeNull();
    expect(estimateOutputBytes(findTarget("mp4")!, "high", 30)).toBeNull();
  });

  it("waits for a known length", () => {
    expect(estimateOutputBytes(findTarget("mp3")!, "320k", null)).toBeNull();
  });
});

describe("sizeEstimateLabel", () => {
  it("shows nothing without an estimate", () => {
    expect(sizeEstimateLabel(1_200_000)).toBe("Estimated size: about 1.14 MB");
    expect(sizeEstimateLabel(null)).toBe("");
  });
});
