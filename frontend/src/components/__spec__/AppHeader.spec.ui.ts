import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AppHeader from "../AppHeader.vue";

describe("AppHeader", () => {
  it("offers the light theme while dark", () => {
    render(AppHeader, { props: { themeChoice: "dark" } });

    expect(screen.getByTitle("Switch to light theme")).toBeInTheDocument();
  });

  it("offers the system theme while light", () => {
    render(AppHeader, { props: { themeChoice: "light" } });

    expect(screen.getByTitle("Switch to system theme")).toBeInTheDocument();
  });

  it("shows an A while following the system", () => {
    render(AppHeader, { props: { themeChoice: "system" } });

    expect(screen.getByTitle("Switch to dark theme")).toHaveTextContent("A");
  });

  it("emits toggle when the theme button is clicked", async () => {
    const user = userEvent.setup();
    const { emitted } = render(AppHeader, { props: { themeChoice: "dark" } });

    await user.click(screen.getByTitle("Switch to light theme"));

    expect(emitted("toggle")).toHaveLength(1);
  });

  it("emits home when the logo is clicked", async () => {
    const user = userEvent.setup();
    const { emitted } = render(AppHeader, { props: { themeChoice: "dark" } });

    await user.click(screen.getByTitle("Back to start"));

    expect(emitted("home")).toHaveLength(1);
  });
});
