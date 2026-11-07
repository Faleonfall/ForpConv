import { describe, expect, it } from "vitest";
import {
  defaultQualityFor,
  defaultTargetFor,
  findQuality,
  findTarget,
  qualitiesFor,
  targetGroupsFor,
  targetsFor,
} from "../formatCatalog";

function ids(kind: Parameters<typeof targetsFor>[0], extension = "") {
  return targetsFor(kind, extension).map((target) => target.id);
}

describe("targetGroupsFor", () => {
  it("offers only audio formats for audio", () => {
    expect(targetGroupsFor("audio").map((group) => group.label)).toEqual([
      "Audio",
    ]);
    expect(ids("audio")).toContain("flac");
    expect(ids("audio")).not.toContain("mp4");
  });

  it("offers video formats, GIF, stills and audio extracts for video", () => {
    expect(targetGroupsFor("video").map((group) => group.label)).toEqual([
      "Video",
      "Still image",
      "Audio only",
    ]);
    expect(ids("video")).toEqual(
      expect.arrayContaining(["mp4", "webm", "video-gif", "mp3"]),
    );
  });

  it("drops the audio extracts for a silent video", () => {
    expect(
      targetGroupsFor("video", "mov", false).map((group) => group.label),
    ).toEqual(["Video", "Still image"]);
    expect(ids("video")).toContain("png");
    expect(ids("video")).not.toContain("gif");
  });

  it("offers only image formats for a still image", () => {
    expect(ids("image", "png")).toEqual([
      "png",
      "jpg",
      "webp",
      "bmp",
      "tiff",
      "gif",
    ]);
  });

  it("lets an animated GIF become a video or an animated WebP", () => {
    expect(ids("image", "gif")).toEqual(
      expect.arrayContaining(["png", "mp4", "webm", "video-webp"]),
    );
    expect(
      targetGroupsFor("image", "gif")[0]?.targets.map((t) => t.id),
    ).toEqual(["png", "jpg", "webp", "video-webp", "bmp", "tiff", "video-gif"]);
  });

  it("offers MOV with the MP4 streams for video and GIF", () => {
    expect(findTarget("mov")?.codecArgs).toEqual(findTarget("mp4")?.codecArgs);
    expect(ids("video")).toContain("mov");
    expect(ids("image", "gif")).toContain("mov");
  });

  it("offers an animated WebP for video", () => {
    expect(ids("video")).toContain("video-webp");
    expect(ids("image", "png")).not.toContain("video-webp");
  });
});

describe("defaultTargetFor", () => {
  it("skips the format the file already has", () => {
    expect(defaultTargetFor("audio", "mp3")?.id).toBe("m4a");
    expect(defaultTargetFor("image", "jpg")?.id).toBe("png");
  });

  it("starts with the first format otherwise", () => {
    expect(defaultTargetFor("video", "mov")?.id).toBe("mp4");
    expect(defaultTargetFor("video", "mp4")?.id).toBe("webm");
  });
});

describe("findTarget and findQuality", () => {
  it("looks up a target and its quality", () => {
    const mp3 = findTarget("mp3")!;

    expect(findQuality(mp3, "320k")?.args).toEqual(["-b:a", "320k"]);
    expect(findQuality(mp3, "nope")).toBeUndefined();
    expect(findTarget("nope")).toBeUndefined();
  });

  it("gives every target a default that exists", () => {
    for (const target of [
      ...targetsFor("audio"),
      ...targetsFor("video"),
      ...targetsFor("image"),
    ]) {
      if (target.qualities.length === 0) {
        expect(target.defaultQualityId).toBe("");
      } else {
        expect(findQuality(target, target.defaultQualityId)).toBeDefined();
      }
    }
  });
});

describe("qualitiesFor and defaultQualityFor", () => {
  const gif = findTarget("video-gif")!;
  const labels = (fps: number | null) =>
    qualitiesFor(gif, fps).map((quality) => quality.label);

  it("keeps a slow source's rate and offers only slower ones", () => {
    expect(labels(12.5)).toEqual(["Original (12.5 fps)", "10 fps"]);
    expect(defaultQualityFor(gif, 12.5)).toBe("original");
  });

  it("offers the fixed rates for a fast or unknown source", () => {
    expect(labels(60)).toEqual(["10 fps", "15 fps", "24 fps", "30 fps"]);
    expect(labels(null)).toEqual(labels(60));
    expect(defaultQualityFor(gif, 60)).toBe("30");
  });

  it("leaves other targets alone", () => {
    const mp4 = findTarget("mp4")!;

    expect(qualitiesFor(mp4, 12.5)).toBe(mp4.qualities);
    expect(defaultQualityFor(mp4, 12.5)).toBe("high");
  });
});
