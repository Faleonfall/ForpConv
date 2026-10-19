import { type FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

export const FFMPEG_CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

// Downloads the FFmpeg core and wasm, then starts the engine with them
export async function loadFfmpegCore(ffmpeg: FFmpeg): Promise<void> {
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, "text/javascript"),
    toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
  ]);
  await ffmpeg.load({ coreURL, wasmURL });
}
