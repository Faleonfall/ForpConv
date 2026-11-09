import { readFileSync } from "node:fs";
import { join } from "node:path";

// The installed core the app fetches from unpkg, run in the test process. A
// plain path, Vite rewrites a new URL beside import.meta.url into an asset.
const CORE_DIR = join(
  import.meta.dirname,
  "../../../../../node_modules/@ffmpeg/core/dist/esm",
);

interface CoreLog {
  message: string;
}

// The slice of the emscripten module the worker in @ffmpeg/ffmpeg drives
interface FfmpegCore {
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  setLogger: (logger: (log: CoreLog) => void) => void;
  setTimeout: (ms: number) => void;
  exec: (...args: string[]) => number;
  reset: () => void;
}

type CreateCore = (options: { wasmBinary: Uint8Array }) => Promise<FfmpegCore>;

export interface CoreRun {
  // Null when the wasm faulted, the way a crash surfaces in the browser
  exitCode: number | null;
  log: string[];
  // The named output, null when FFmpeg wrote none
  output: Uint8Array | null;
}

// A core serves this many runs, then a fresh one takes over, so a slow leak
// in one instance never turns into a fault in a later case
const RUNS_PER_CORE = 20;

let createCore: CreateCore | null = null;
let wasmBinary: Uint8Array | null = null;
let shared: FfmpegCore | null = null;
let runsLeft = 0;

async function loadCore(): Promise<FfmpegCore> {
  if (!createCore || !wasmBinary) {
    const script = join(CORE_DIR, "ffmpeg-core.js");
    const module = (await import(/* @vite-ignore */ script)) as {
      default: CreateCore;
    };
    createCore = module.default;
    wasmBinary = readFileSync(join(CORE_DIR, "ffmpeg-core.wasm"));
  }
  return createCore({ wasmBinary });
}

async function nextCore(): Promise<FfmpegCore> {
  if (!shared || runsLeft === 0) {
    shared = await loadCore();
    runsLeft = RUNS_PER_CORE;
  }
  runsLeft -= 1;
  return shared;
}

// Runs over a missing path, eg an output FFmpeg never wrote
function quietly<T>(step: () => T): T | null {
  try {
    return step();
  } catch {
    return null;
  }
}

// Inputs are written at their path, eg "/probe/clip.mp4" lands in its own
// folder. Every file is removed after, so the next run starts empty.
export async function runFfmpeg(
  args: string[],
  inputs: Record<string, Uint8Array> = {},
  outputPath = "",
): Promise<CoreRun> {
  const core = await nextCore();
  const log: string[] = [];
  core.setLogger(({ message }) => log.push(message));
  for (const [path, data] of Object.entries(inputs)) {
    const slash = path.lastIndexOf("/");
    if (slash > 0) quietly(() => core.FS.mkdir(path.slice(0, slash)));
    core.FS.writeFile(path, data);
  }
  core.setTimeout(-1);
  try {
    const exitCode = core.exec(...args);
    const output = outputPath
      ? quietly(() => core.FS.readFile(outputPath))
      : null;
    core.reset();
    for (const path of [...Object.keys(inputs), outputPath].filter(Boolean)) {
      quietly(() => core.FS.unlink(path));
    }
    return { exitCode, log, output };
  } catch {
    // A fault leaves the core broken, the next run gets a fresh one
    shared = null;
    return { exitCode: null, log, output: null };
  }
}
