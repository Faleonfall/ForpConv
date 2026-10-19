import { vi } from "vitest";

type Handler = (...args: never[]) => void;

// In-memory WaveSurfer and regions plugin, driven by emit from the spec
export function createWaveSurferFake() {
  const handlers = new Map<string, Handler>();
  const regionHandlers = new Map<string, Handler>();

  const region = {
    start: 0,
    end: 0,
    on: (event: string, handler: Handler) => regionHandlers.set(event, handler),
    setOptions: vi.fn((options: { start: number; end: number }) => {
      region.start = options.start;
      region.end = options.end;
    }),
  };

  const regions = {
    addRegion: vi.fn((options: { start: number; end: number }) => {
      region.start = options.start;
      region.end = options.end;
      return region;
    }),
  };

  const state = { duration: 95, time: 0, playing: false };

  const waveSurfer = {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    load: vi.fn(() => Promise.resolve()),
    registerPlugin: () => regions,
    getDuration: () => state.duration,
    getCurrentTime: () => state.time,
    getMediaElement: () => null,
    isPlaying: () => state.playing,
    play: vi.fn(() => {
      state.playing = true;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      state.playing = false;
    }),
    setTime: vi.fn((time: number) => {
      state.time = time;
    }),
    destroy: vi.fn(),
  };

  const emit = (event: string, ...args: unknown[]) =>
    (handlers.get(event) as ((...a: unknown[]) => void) | undefined)?.(...args);

  const moveRegion = (start: number, end: number) => {
    region.start = start;
    region.end = end;
    (regionHandlers.get("update") as (() => void) | undefined)?.();
  };

  return { waveSurfer, regions, region, state, emit, moveRegion };
}

export type WaveSurferFake = ReturnType<typeof createWaveSurferFake>;
