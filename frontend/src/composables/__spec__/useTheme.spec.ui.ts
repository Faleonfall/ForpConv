import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../../lib/themeStorage";
import { useTheme } from "../useTheme";

const ThemeHost = {
  setup() {
    const { themeChoice, activeTheme, toggleTheme } = useTheme();
    return () =>
      h(
        "button",
        { onClick: toggleTheme },
        `${themeChoice.value} ${activeTheme.value}`,
      );
  },
};

// A device scheme the test can flip, as the OS would at sunset
function preferLight(matches: boolean) {
  const listeners: (() => void)[] = [];
  const scheme = {
    matches,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.push(listener);
    },
    removeEventListener: () => {},
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(
    scheme as unknown as MediaQueryList,
  );
  return (next: boolean) => {
    scheme.matches = next;
    listeners.forEach((listener) => listener());
  };
}

function appliedTheme() {
  return document.documentElement.getAttribute("data-theme");
}

describe("useTheme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("follows the system theme without a saved choice", async () => {
    preferLight(true);
    render(ThemeHost);

    expect(
      await screen.findByRole("button", { name: "system light" }),
    ).toBeVisible();
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

  it("steps through light, system and dark, saving only fixed themes", async () => {
    const user = userEvent.setup();
    preferLight(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(ThemeHost);
    const button = screen.getByRole("button");

    await user.click(button);
    expect(button).toHaveTextContent("light light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await user.click(button);
    expect(button).toHaveTextContent("system dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    await user.click(button);
    expect(button).toHaveTextContent("dark dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("follows the device switching scheme only on system", async () => {
    const flip = preferLight(false);
    render(ThemeHost);

    flip(true);
    expect(appliedTheme()).toBe("light");

    // System steps on to a fixed dark, which ignores the device
    await userEvent.setup().click(screen.getByRole("button"));
    flip(true);
    expect(screen.getByRole("button")).toHaveTextContent("dark dark");
    expect(appliedTheme()).toBe("dark");
  });
});
