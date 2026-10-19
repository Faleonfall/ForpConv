import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../../lib/themeStorage";
import { useTheme } from "../useTheme";

const ThemeHost = {
  setup() {
    const { activeTheme, toggleTheme } = useTheme();
    return () => h("button", { onClick: toggleTheme }, activeTheme.value);
  },
};

function preferLight(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
  } as MediaQueryList);
}

function appliedTheme() {
  return document.documentElement.getAttribute("data-theme");
}

describe("useTheme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("follows the system theme without a saved choice", async () => {
    preferLight(true);
    render(ThemeHost);

    expect(await screen.findByRole("button", { name: "light" })).toBeVisible();
    expect(appliedTheme()).toBe("light");
  });

  it("restores a saved choice over the system theme", () => {
    preferLight(true);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(ThemeHost);

    expect(appliedTheme()).toBe("dark");
  });

  it("drops a malformed saved value", () => {
    preferLight(false);
    localStorage.setItem(THEME_STORAGE_KEY, '{"theme":"light"}');
    render(ThemeHost);

    expect(appliedTheme()).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("toggles and saves the theme", async () => {
    const user = userEvent.setup();
    preferLight(false);
    render(ThemeHost);

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("light");
    expect(appliedTheme()).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
