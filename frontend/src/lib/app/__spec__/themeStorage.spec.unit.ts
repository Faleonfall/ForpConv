import { describe, expect, it } from "vitest";
import {
  nextThemeChoice,
  parseStoredTheme,
  resolveTheme,
} from "../themeStorage";

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

describe("nextThemeChoice", () => {
  it("steps dark, light, system and around", () => {
    expect(nextThemeChoice("dark")).toBe("light");
    expect(nextThemeChoice("light")).toBe("system");
    expect(nextThemeChoice("system")).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("keeps a fixed choice and follows the device on system", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });
});
