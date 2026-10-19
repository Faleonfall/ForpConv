import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/vue";
import { afterEach } from "vitest";

// Stand-ins for browser APIs jsdom lacks, each stepping aside once jsdom
// ships the real thing
if (typeof URL.createObjectURL !== "function") {
  let nextId = 0;
  Object.assign(URL, {
    createObjectURL: () => `blob:test/${++nextId}`,
    revokeObjectURL: () => {},
  });
}

if (typeof window.matchMedia !== "function") {
  Object.assign(window, {
    matchMedia: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
