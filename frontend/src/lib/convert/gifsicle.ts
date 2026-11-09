import { type GifsicleModule } from "gifsicle-wasm";

// gifsicle's lossy LZW runs from 0, lossless, to 200. Around 80 cuts the
// size a lot while the added noise hides in the dither.
export const LOSSY_LEVEL = 80;

const INPUT_PATH = "/input.gif";
const OUTPUT_PATH = "/output.gif";
const POINTER_BYTES = 4;

export interface ShrinkRequest {
  bytes: Uint8Array;
  level: number;
}

export type ShrinkReply = { bytes: Uint8Array } | { error: string };

export function gifsicleArgs(level: number): string[] {
  return ["gifsicle", "-O2", `--lossy=${level}`, "-o", OUTPUT_PATH, INPUT_PATH];
}

// Hands over argv the way C main gets it, a null terminated array of
// string pointers, and frees it afterwards
function runCli(module: GifsicleModule, args: string[]): number {
  const strings = args.map((arg) => module.stringToNewUTF8(arg));
  const argv = module._malloc((args.length + 1) * POINTER_BYTES);
  strings.forEach((pointer, index) =>
    module.setValue(argv + index * POINTER_BYTES, pointer, "i32"),
  );
  module.setValue(argv + args.length * POINTER_BYTES, 0, "i32");
  try {
    return module._run_gifsicle(args.length, argv);
  } finally {
    strings.forEach((pointer) => module._free(pointer));
    module._free(argv);
  }
}

// The smaller of the original and gifsicle's output. Any failure keeps the
// original, the GIF FFmpeg made is still a good result.
export function shrinkGif(
  module: GifsicleModule,
  bytes: Uint8Array,
  level: number,
): Uint8Array {
  try {
    module.FS.writeFile(INPUT_PATH, bytes);
    if (runCli(module, gifsicleArgs(level)) !== 0) return bytes;
    const output = module.FS.readFile(OUTPUT_PATH);
    return output.length > 0 && output.length < bytes.length ? output : bytes;
  } catch {
    return bytes;
  }
}
