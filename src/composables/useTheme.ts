import { ref, onMounted } from "vue";

export type Theme = "dark" | "light";

// Persist the user's theme choice for 7 days
const THEME_STORAGE_KEY = "forpconv-theme";
const THEME_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function useTheme() {
  const activeTheme = ref<Theme>("dark");

  const applyTheme = (theme: Theme): void => {
    activeTheme.value = theme;
    document.documentElement.setAttribute("data-theme", theme);
  };

  const saveTheme = (theme: Theme): void => {
    try {
      localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ theme, savedAt: Date.now() }),
      );
    } catch {
      // Storage unavailable (private mode, quota); ignore
    }
  };

  const loadStoredTheme = (): Theme | null => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (!raw) return null;
      const { theme, savedAt } = JSON.parse(raw) as {
        theme: Theme;
        savedAt: number;
      };
      if (theme !== "dark" && theme !== "light") return null;
      if (Date.now() - savedAt > THEME_TTL_MS) {
        localStorage.removeItem(THEME_STORAGE_KEY);
        return null;
      }
      return theme;
    } catch {
      return null;
    }
  };

  const toggleTheme = (): void => {
    const newTheme: Theme = activeTheme.value === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    saveTheme(newTheme);
  };

  onMounted(() => {
    // Restore a saved choice if it is under 7 days old,
    // otherwise fall back to system prefers-color-scheme
    const storedTheme = loadStoredTheme();
    if (storedTheme) {
      applyTheme(storedTheme);
    } else {
      const systemPrefersLight = window.matchMedia(
        "(prefers-color-scheme: light)",
      ).matches;
      applyTheme(systemPrefersLight ? "light" : "dark");
    }
  });

  return { activeTheme, toggleTheme };
}
