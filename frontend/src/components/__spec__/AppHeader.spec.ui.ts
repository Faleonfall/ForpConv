import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AppHeader from "../AppHeader.vue";

describe("AppHeader", () => {
  it("offers the light theme while dark", () => {
    render(AppHeader, { props: { activeTheme: "dark" } });

    expect(screen.getByTitle("Switch to light theme")).toBeInTheDocument();
  });

  it("offers the dark theme while light", () => {
    render(AppHeader, { props: { activeTheme: "light" } });

    expect(screen.getByTitle("Switch to dark theme")).toBeInTheDocument();
  });

  it("emits toggle when the theme button is clicked", async () => {
    const user = userEvent.setup();
    const { emitted } = render(AppHeader, { props: { activeTheme: "dark" } });

    await user.click(screen.getByTitle("Switch to light theme"));

    expect(emitted("toggle")).toHaveLength(1);
  });
});
