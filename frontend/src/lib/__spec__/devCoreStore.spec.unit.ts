import { afterEach, describe, expect, it, vi } from "vitest";
import { coreStoreName, openCoreStore } from "../devCoreStore";

const VERSION = "0.12.6";
const URL_JS = "https://cdn.test/ffmpeg-core.js";

// In-memory Cache Storage with one store over the given entries
function stubCaches(
  entries = new Map<string, Blob>(),
  names = [coreStoreName(VERSION)],
) {
  const cache = {
    match: vi.fn((url: string) => {
      const blob = entries.get(url);
      return Promise.resolve(blob ? new Response(blob) : undefined);
    }),
    put: vi.fn(() => Promise.resolve()),
  };
  const storage = {
    keys: vi.fn(() => Promise.resolve(names)),
    open: vi.fn(() => Promise.resolve(cache)),
    delete: vi.fn(() => Promise.resolve(true)),
  };
  vi.stubGlobal("caches", storage);
  return { cache, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openCoreStore", () => {
  it("opens one store named after the core version", async () => {
    const { storage } = stubCaches();

    expect(await openCoreStore(VERSION)).not.toBeNull();
    expect(storage.open).toHaveBeenCalledWith("ffmpeg-core-0.12.6");
  });

  it("deletes stores of older core versions only", async () => {
    const { storage } = stubCaches(new Map(), [
      "ffmpeg-core-0.12.5",
      coreStoreName(VERSION),
      "other-app",
    ]);

    await openCoreStore(VERSION);

    expect(storage.delete).toHaveBeenCalledOnce();
    expect(storage.delete).toHaveBeenCalledWith("ffmpeg-core-0.12.5");
  });

  it("gives no store without Cache Storage or when it is blocked", async () => {
    expect(await openCoreStore(VERSION)).toBeNull();

    vi.stubGlobal("caches", {
      keys: () => Promise.reject(new Error("blocked")),
    });

    expect(await openCoreStore(VERSION)).toBeNull();
  });
});

describe("CoreStore", () => {
  it("reads a stored file only at its full size", async () => {
    stubCaches(new Map([[URL_JS, new Blob(["12345"])]]));
    const store = await openCoreStore(VERSION);

    expect((await store?.read(URL_JS, 5))?.size).toBe(5);
    expect(await store?.read(URL_JS, 9)).toBeNull();
    expect(await store?.read("https://cdn.test/missing", 5)).toBeNull();
  });

  it("saves a file and swallows a failed write", async () => {
    const { cache } = stubCaches();
    cache.put.mockRejectedValueOnce(new Error("quota"));
    const store = await openCoreStore(VERSION);

    expect(() => store?.save(URL_JS, new Blob(["x"]))).not.toThrow();
    expect(cache.put).toHaveBeenCalledWith(URL_JS, expect.any(Response));
  });

  it("drops its own store", async () => {
    const { storage } = stubCaches();
    const store = await openCoreStore(VERSION);

    await store?.drop();

    expect(storage.delete).toHaveBeenCalledWith("ffmpeg-core-0.12.6");
  });
});
