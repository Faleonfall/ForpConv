import { ref, onMounted, onBeforeUnmount } from "vue";
import {
  hashForMode,
  modeFromHash,
  slideDirection,
  type AppMode,
  type SlideDirection,
} from "../lib/appMode";

// Active tab, kept in the URL hash so a link opens the right tool
export function useAppMode() {
  const mode = ref<AppMode>(modeFromHash(window.location.hash));
  const direction = ref<SlideDirection>("forward");

  const applyMode = (next: AppMode): void => {
    direction.value = slideDirection(mode.value, next);
    mode.value = next;
  };

  const syncFromHash = (): void => {
    applyMode(modeFromHash(window.location.hash));
  };

  const setMode = (next: AppMode): void => {
    applyMode(next);
    const { pathname, search } = window.location;
    history.replaceState(null, "", `${pathname}${search}${hashForMode(next)}`);
  };

  onMounted(() => {
    window.addEventListener("hashchange", syncFromHash);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("hashchange", syncFromHash);
  });

  return { mode, direction, setMode };
}
