import { ref, onMounted, onBeforeUnmount } from "vue";
import {
  LIGHT_SCHEME_QUERY,
  THEME_STORAGE_KEY,
  nextThemeChoice,
  parseStoredTheme,
  resolveTheme,
  type Theme,
  type ThemeChoice,
} from "../../lib/app/themeStorage";

export function useTheme() {
  const themeChoice = ref<ThemeChoice>("system");
  const activeTheme = ref<Theme>("dark");

  let systemScheme: MediaQueryList | null = null;

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

  const applyChoice = (choice: ThemeChoice): void => {
    themeChoice.value = choice;
    applyTheme(resolveTheme(choice, systemScheme?.matches ?? false));
  };

  const saveChoice = (choice: ThemeChoice): void => {
    try {
      if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, choice);
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

  // The device switching light and dark, eg at sunset, only counts on system
  const handleSystemChange = (): void => {
    if (themeChoice.value === "system") applyChoice("system");
  };

  const toggleTheme = (): void => {
    const choice = nextThemeChoice(themeChoice.value);
    applyChoice(choice);
    saveChoice(choice);
  };

  onMounted(() => {
    systemScheme = window.matchMedia(LIGHT_SCHEME_QUERY);
    systemScheme.addEventListener("change", handleSystemChange);
    // Restore a saved choice, otherwise follow the system
    applyChoice(loadStoredTheme() ?? "system");
  });

  onBeforeUnmount(() => {
    systemScheme?.removeEventListener("change", handleSystemChange);
  });

  return { themeChoice, activeTheme, toggleTheme };
}
