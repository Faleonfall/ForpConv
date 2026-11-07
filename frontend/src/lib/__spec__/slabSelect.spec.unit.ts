import { describe, expect, it } from "vitest";
import {
  groupSlabOptions,
  moveSlabSpot,
  slabMatch,
  slabSpotOf,
  type SlabOption,
} from "../slabSelect";

const OPTIONS: SlabOption[] = [
  { id: "mp4", label: "MP4 (H.264)", group: "Video" },
  { id: "webm", label: "WebM (VP8)", group: "Video" },
  { id: "gif", label: "GIF (animated)", group: "Video" },
  { id: "mp3", label: "MP3", group: "Audio only" },
  { id: "flac", label: "FLAC (lossless)", group: "Audio only" },
];

const GROUPS = groupSlabOptions(OPTIONS);

describe("groupSlabOptions", () => {
  it("splits options into columns in order of first appearance", () => {
    expect(GROUPS.map((group) => group.name)).toEqual(["Video", "Audio only"]);
    expect(GROUPS[1]?.options.map((option) => option.id)).toEqual([
      "mp3",
      "flac",
    ]);
  });

  it("keeps ungrouped options in one nameless column", () => {
    const groups = groupSlabOptions([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("");
  });
});

describe("slabSpotOf", () => {
  it("finds the column and row of an option", () => {
    expect(slabSpotOf(GROUPS, "flac")).toEqual({ column: 1, row: 1 });
  });

  it("returns null for an unknown id", () => {
    expect(slabSpotOf(GROUPS, "png")).toBeNull();
  });
});

describe("moveSlabSpot", () => {
  it("steps down within a column", () => {
    expect(moveSlabSpot(GROUPS, { column: 0, row: 0 }, "down")).toEqual({
      column: 0,
      row: 1,
    });
  });

  it("flows past a column end into the next column", () => {
    expect(moveSlabSpot(GROUPS, { column: 0, row: 2 }, "down")).toEqual({
      column: 1,
      row: 0,
    });
    expect(moveSlabSpot(GROUPS, { column: 1, row: 0 }, "up")).toEqual({
      column: 0,
      row: 2,
    });
  });

  it("clamps a sideways jump to the shorter column", () => {
    expect(moveSlabSpot(GROUPS, { column: 0, row: 2 }, "right")).toEqual({
      column: 1,
      row: 1,
    });
  });

  it("stays put at the edges", () => {
    expect(moveSlabSpot(GROUPS, { column: 0, row: 0 }, "up")).toEqual({
      column: 0,
      row: 0,
    });
    expect(moveSlabSpot(GROUPS, { column: 1, row: 1 }, "right")).toEqual({
      column: 1,
      row: 1,
    });
  });
});

describe("slabMatch", () => {
  it("prefers a label that starts with the query", () => {
    expect(slabMatch(OPTIONS, "m")?.id).toBe("mp4");
    expect(slabMatch(OPTIONS, "mp3")?.id).toBe("mp3");
  });

  it("falls back to a label that contains the query", () => {
    expect(slabMatch(OPTIONS, "loss")?.id).toBe("flac");
  });

  it("ignores case and returns null for no match or an empty query", () => {
    expect(slabMatch(OPTIONS, "GIF")?.id).toBe("gif");
    expect(slabMatch(OPTIONS, "zz")).toBeNull();
    expect(slabMatch(OPTIONS, " ")).toBeNull();
  });
});
