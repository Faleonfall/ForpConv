import { describe, expect, it } from "vitest";
import { joinFileName, splitFileName } from "../fileName";

describe("splitFileName", () => {
  it("splits at the last dot", () => {
    expect(splitFileName("my.clip.gif")).toEqual({
      base: "my.clip",
      extension: "gif",
    });
  });

  it("keeps a leading dot or no dot in the base", () => {
    expect(splitFileName(".hidden")).toEqual({
      base: ".hidden",
      extension: "",
    });
    expect(splitFileName("notes")).toEqual({ base: "notes", extension: "" });
  });
});

describe("joinFileName", () => {
  it("adds the extension to the typed name", () => {
    expect(joinFileName(" Holiday ", "mp4")).toBe("Holiday.mp4");
  });

  it("drops characters a system refuses", () => {
    expect(joinFileName('a/b\\c:d*e?"f<g>h|i', "png")).toBe("abcdefghi.png");
  });

  it("never returns an empty name", () => {
    expect(joinFileName("  ", "gif")).toBe("converted.gif");
    expect(joinFileName("::", "")).toBe("converted");
  });
});
