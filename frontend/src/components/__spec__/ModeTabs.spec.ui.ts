import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ModeTabs from "../ModeTabs.vue";

describe("ModeTabs", () => {
  it("marks the active tool", () => {
    render(ModeTabs, { props: { mode: "convert" } });

    expect(screen.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Ringtone" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("moves the indicator to the active tab", async () => {
    const { getByRole, rerender } = render(ModeTabs, {
      props: { mode: "ringtone" },
    });
    const tablist = getByRole("tablist");
    expect(tablist.style.getPropertyValue("--tab-index")).toBe("0");

    await rerender({ mode: "convert" });

    expect(tablist.style.getPropertyValue("--tab-index")).toBe("1");
    expect(tablist.style.getPropertyValue("--tab-count")).toBe("2");
  });

  it("emits the picked tool", async () => {
    const user = userEvent.setup();
    const { emitted } = render(ModeTabs, { props: { mode: "ringtone" } });

    await user.click(screen.getByRole("tab", { name: "Convert" }));

    expect(emitted("select")).toEqual([["convert"]]);
  });
});
