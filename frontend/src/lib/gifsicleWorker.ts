import createGifsicle from "gifsicle-wasm";
import wasmUrl from "gifsicle-wasm/gifsicle.wasm?url";
import { shrinkGif, type ShrinkReply, type ShrinkRequest } from "./gifsicle";

// The DOM lib types self as a window, a worker posts with a transfer list
const scope = self as unknown as Worker;

// A fresh module per job, gifsicle keeps global state between runs
scope.onmessage = async (event: MessageEvent<ShrinkRequest>) => {
  let reply: ShrinkReply;
  try {
    const module = await createGifsicle({
      locateFile: () => wasmUrl,
      print: () => {},
      printErr: () => {},
    });
    reply = { bytes: shrinkGif(module, event.data.bytes, event.data.level) };
  } catch (error) {
    reply = { error: String(error) };
  }
  scope.postMessage(reply, "bytes" in reply ? [reply.bytes.buffer] : []);
};
