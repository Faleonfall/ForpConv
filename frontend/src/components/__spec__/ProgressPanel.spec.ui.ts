import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import ProgressPanel from "../ProgressPanel.vue";

describe("ProgressPanel", () => {
  it("shows the percent and fills the bar to it", () => {
    render(ProgressPanel, {
      props: { percent: 40, title: "Converting File", text: "Working..." },
    });

    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(screen.getByText("Converting File")).toBeInTheDocument();
    expect(screen.getByText("Working...")).toBeInTheDocument();
  });

  it("swaps the percent for a warning once failed", () => {
    const { container } = render(ProgressPanel, {
      props: {
        percent: 0,
        title: "Conversion Failed",
        text: "This file may not convert to that format.",
        failed: true,
      },
      slots: { default: "<button>Pick Another Format</button>" },
    });

    expect(container.querySelector(".progress-failed")).not.toBeNull();
    expect(container.querySelector(".progress-alert")).not.toBeNull();
    expect(container.querySelector(".progress-value")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Pick Another Format" }),
    ).toBeInTheDocument();
  });
});
