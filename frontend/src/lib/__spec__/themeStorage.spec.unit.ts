import { describe, expect, it } from "vitest";
import { nextTheme, parseStoredTheme } from "../themeStorage";

describe("parseStoredTheme", () => {
  it("accepts a stored theme", () => {
    expect(parseStoredTheme("dark")).toBe("dark");
    expect(parseStoredTheme("light")).toBe("light");
  });

  it("rejects a missing or unknown value", () => {
    expect(parseStoredTheme(null)).toBeNull();
    expect(parseStoredTheme('{"theme":"dark"}')).toBeNull();
  });
});

describe("nextTheme", () => {
  it("flips the theme", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});
