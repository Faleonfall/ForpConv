import { LOSSY_LEVEL, type ShrinkReply } from "./gifsicle";

// Runs gifsicle's lossy pass in a worker, so a long job never freezes the
// page. Resolves to the original blob when nothing got smaller.
export async function compressGif(
  blob: Blob,
  level = LOSSY_LEVEL,
): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const worker = new Worker(new URL("./gifsicleWorker.ts", import.meta.url), {
    type: "module",
  });

  try {
    const shrunk = await new Promise<Uint8Array>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<ShrinkReply>) => {
        const reply = event.data;
        if ("bytes" in reply) resolve(reply.bytes);
        else reject(new Error(reply.error));
      };
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage({ bytes, level }, [bytes.buffer]);
    });
    return new Blob([shrunk as unknown as BlobPart], { type: "image/gif" });
  } finally {
    worker.terminate();
  }
}
