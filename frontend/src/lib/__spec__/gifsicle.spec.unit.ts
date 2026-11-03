import { type GifsicleModule } from "gifsicle-wasm";
import { describe, expect, it, vi } from "vitest";
import { LOSSY_LEVEL, gifsicleArgs, shrinkGif } from "../gifsicle";

const ORIGINAL = new Uint8Array(100);

// Emscripten module stand in, run returns the exit code and output is what
// gifsicle would have written
function fakeModule(exitCode: number, output: Uint8Array | null) {
  let nextPointer = 8;
  const module = {
    FS: {
      writeFile: vi.fn(),
      readFile: vi.fn(() => {
        if (!output) throw new Error("no such file");
        return output;
      }),
    },
    _malloc: vi.fn(() => (nextPointer += 64)),
    _free: vi.fn(),
    _run_gifsicle: vi.fn(() => exitCode),
    stringToNewUTF8: vi.fn(() => (nextPointer += 16)),
    setValue: vi.fn(),
  };
  return module as typeof module & GifsicleModule;
}

describe("gifsicleArgs", () => {
  it("optimizes with the lossy level into the output file", () => {
    expect(gifsicleArgs(LOSSY_LEVEL)).toEqual([
      "gifsicle",
      "-O2",
      "--lossy=80",
      "-o",
      "/output.gif",
      "/input.gif",
    ]);
  });
});

describe("shrinkGif", () => {
  it("returns the smaller output and frees every argument", () => {
    const output = new Uint8Array(40);
    const module = fakeModule(0, output);

    expect(shrinkGif(module, ORIGINAL, LOSSY_LEVEL)).toBe(output);
    expect(module.FS.writeFile).toHaveBeenCalledWith("/input.gif", ORIGINAL);
    expect(module._run_gifsicle).toHaveBeenCalledWith(6, expect.any(Number));
    // Six strings plus the argv array
    expect(module._free).toHaveBeenCalledTimes(7);
  });

  it("keeps the original when the output is not smaller", () => {
    const module = fakeModule(0, new Uint8Array(120));

    expect(shrinkGif(module, ORIGINAL, LOSSY_LEVEL)).toBe(ORIGINAL);
  });

  it("keeps the original when gifsicle fails", () => {
    expect(shrinkGif(fakeModule(1, new Uint8Array(10)), ORIGINAL, 80)).toBe(
      ORIGINAL,
    );
    expect(shrinkGif(fakeModule(0, null), ORIGINAL, 80)).toBe(ORIGINAL);
  });
});
