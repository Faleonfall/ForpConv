// Persist the user's theme choice
export const THEME_STORAGE_KEY = "forpconv-theme";

export type Theme = "dark" | "light";

// Returns the stored theme, or null when missing or malformed
export function parseStoredTheme(raw: string | null): Theme | null {
  return raw === "dark" || raw === "light" ? raw : null;
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
