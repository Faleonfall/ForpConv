import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ModeTabs from "../ModeTabs.vue";

describe("ModeTabs", () => {
  it("lists Convert first and marks the active tool", () => {
    render(ModeTabs, { props: { mode: "convert" } });

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent?.trim()),
    ).toEqual(["Convert", "Ringtone"]);

    expect(screen.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Ringtone" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("moves the drop to the active tab only on a real switch", async () => {
    const { getByRole, rerender } = render(ModeTabs, {
      props: { mode: "convert" },
    });
    const tablist = getByRole("tablist");
    expect(tablist).not.toHaveClass("drop-switch-end");
    expect(tablist).not.toHaveClass("drop-switch-moved");

    await rerender({ mode: "ringtone" });

    expect(tablist).toHaveClass("drop-switch-end", "drop-switch-moved");
  });

  it("emits the picked tool", async () => {
    const user = userEvent.setup();
    const { emitted } = render(ModeTabs, { props: { mode: "ringtone" } });

    await user.click(screen.getByRole("tab", { name: "Convert" }));

    expect(emitted("select")).toEqual([["convert"]]);
  });
});
