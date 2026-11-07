import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import QualitySwitch from "../QualitySwitch.vue";

describe("QualitySwitch", () => {
  it("checks Best while the smaller pass is off", () => {
    render(QualitySwitch, { props: { modelValue: false } });

    expect(
      screen.getByRole("radiogroup", { name: "Output size" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Best" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Smaller" })).not.toBeChecked();
  });

  it("emits the picked side", async () => {
    const user = userEvent.setup();
    const { emitted, rerender } = render(QualitySwitch, {
      props: { modelValue: false },
    });

    await user.click(screen.getByRole("radio", { name: "Smaller" }));
    await rerender({ modelValue: true });
    await user.click(screen.getByRole("radio", { name: "Best" }));

    expect(emitted("update:modelValue")).toEqual([[true], [false]]);
  });
});
