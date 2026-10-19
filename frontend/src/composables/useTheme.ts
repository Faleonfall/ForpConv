import { ref, onMounted } from "vue";
import {
  THEME_STORAGE_KEY,
  nextTheme,
  parseStoredTheme,
  type Theme,
} from "../lib/themeStorage";

export function useTheme() {
  const activeTheme = ref<Theme>("dark");

  const applyTheme = (theme: Theme): void => {
    activeTheme.value = theme;
    document.documentElement.setAttribute("data-theme", theme);

    // Keep the browser chrome on the page background, as index.html does
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-background")
      .trim();
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", background);
  };

  const saveTheme = (theme: Theme): void => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private mode, quota); ignore
    }
  };

  const loadStoredTheme = (): Theme | null => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      const theme = parseStoredTheme(raw);
      if (raw && !theme) localStorage.removeItem(THEME_STORAGE_KEY);
      return theme;
    } catch {
      return null;
    }
  };

  const toggleTheme = (): void => {
    const theme = nextTheme(activeTheme.value);
    applyTheme(theme);
    saveTheme(theme);
  };

  onMounted(() => {
    // Restore a saved choice, otherwise fall back to system prefers-color-scheme
    const storedTheme = loadStoredTheme();
    if (storedTheme) {
      applyTheme(storedTheme);
      return;
    }
    const systemPrefersLight = window.matchMedia(
      "(prefers-color-scheme: light)",
    ).matches;
    applyTheme(systemPrefersLight ? "light" : "dark");
  });

  return { activeTheme, toggleTheme };
}
