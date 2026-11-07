// Persist the user's theme choice
export const THEME_STORAGE_KEY = "forpconv-theme";
export const LIGHT_SCHEME_QUERY = "(prefers-color-scheme: light)";

// The toggle steps through these in order
const THEME_CHOICES: ThemeChoice[] = ["dark", "light", "system"];

export type Theme = "dark" | "light";
// System saves nothing, so the page follows the device like on a first visit
export type ThemeChoice = Theme | "system";

// Returns the stored theme, or null when missing or malformed
export function parseStoredTheme(raw: string | null): Theme | null {
  return raw === "dark" || raw === "light" ? raw : null;
}

export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  const index = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(index + 1) % THEME_CHOICES.length]!;
}

export function resolveTheme(
  choice: ThemeChoice,
  systemPrefersLight: boolean,
): Theme {
  if (choice !== "system") return choice;
  return systemPrefersLight ? "light" : "dark";
}
