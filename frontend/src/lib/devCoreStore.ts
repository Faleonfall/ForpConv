// Dev server only. Its reloads and DevTools' disabled cache refetch the
// 32 MB FFmpeg core every time, so dev keeps the core in Cache Storage. The
// live site never opens it and relies on unpkg's year long HTTP cache.

const STORE_PREFIX = "ffmpeg-core-";

export interface CoreStore {
  // A stored file, only when complete, a cut off write reads as a miss
  read: (url: string, bytes: number) => Promise<Blob | null>;
  // Saving is a bonus, a full quota only costs the next reload a download
  save: (url: string, blob: Blob) => void;
  // Forgets the core, eg after it failed to start
  drop: () => Promise<void>;
}

// One store per core version
export function coreStoreName(version: string): string {
  return `${STORE_PREFIX}${version}`;
}

// Opens this version's store and deletes older ones. Cache Storage exists
// only in secure contexts and can throw in a private window, null then.
export async function openCoreStore(
  version: string,
): Promise<CoreStore | null> {
  if (typeof caches === "undefined") return null;
  const name = coreStoreName(version);
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((entry) => entry.startsWith(STORE_PREFIX) && entry !== name)
        .map((entry) => caches.delete(entry)),
    );
    const cache = await caches.open(name);
    return {
      read: async (url, bytes) => {
        try {
          const response = await cache.match(url);
          if (!response) return null;
          const blob = await response.blob();
          return blob.size === bytes ? blob : null;
        } catch {
          return null;
        }
      },
      save: (url, blob) => {
        void cache.put(url, new Response(blob)).catch(() => {});
      },
      drop: async () => {
        await caches.delete(name).catch(() => false);
      },
    };
  } catch {
    return null;
  }
}
