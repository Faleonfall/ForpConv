import { inputFileName } from "../shared/fileName";
import { isHeicFile } from "../shared/mediaKind";

export const DECODED_HEIC_NAME = "input.png";

export interface EngineInput {
  blob: Blob;
  name: string;
}

// FFmpeg cannot read HEIC, so decode it to PNG first. The decoder wasm loads
// only when a HEIC file arrives.
export async function prepareEngineInput(file: File): Promise<EngineInput> {
  if (!isHeicFile(file)) {
    return { blob: file, name: inputFileName(file.name) };
  }
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({ blob: file, type: "image/png" });
  return { blob, name: DECODED_HEIC_NAME };
}
