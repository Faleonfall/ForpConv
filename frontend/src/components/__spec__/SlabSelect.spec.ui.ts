import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type SlabOption } from "../../lib/slabSelect";
import SlabSelect from "../SlabSelect.vue";

const OPTIONS: SlabOption[] = [
  { id: "mp3", label: "MP3" },
  { id: "opus", label: "Opus" },
  { id: "flac", label: "FLAC (lossless)" },
];

function renderSelect(options = OPTIONS, modelValue = "mp3") {
  return render(SlabSelect, {
    props: { label: "Convert To", options, modelValue },
  });
}

describe("SlabSelect", () => {
  it("names the cell after its label and pick", () => {
    renderSelect();

    const cell = screen.getByRole("button", { name: "Convert To: MP3" });
    expect(cell).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens the panel and emits the clicked option", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    expect(screen.getByRole("option", { name: "MP3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "Opus" }));

    expect(emitted("update:modelValue")).toEqual([["opus"]]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes without an emit when the pick is chosen again", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.click(screen.getByRole("option", { name: "MP3" }));

    expect(emitted("update:modelValue")).toBeUndefined();
  });

  it("closes on a click outside", async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.click(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves through the panel with arrows and picks on Enter", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(emitted("update:modelValue")).toEqual([["flac"]]);
  });

  it("closes on Escape and hands focus back to the cell", async () => {
    const user = userEvent.setup();
    renderSelect();
    const cell = screen.getByRole("button", { name: /^Convert To/ });

    await user.click(cell);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(cell).toHaveFocus();
  });

  it("jumps to a typed option inside the panel", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.keyboard("fl{Enter}");

    expect(emitted("update:modelValue")).toEqual([["flac"]]);
  });

  it("steps the pick on the closed cell with arrows and letters", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    screen.getByRole("button", { name: /^Convert To/ }).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("f");

    expect(emitted("update:modelValue")).toEqual([["opus"], ["flac"]]);
  });

  it("titles columns only when the options come grouped", async () => {
    const user = userEvent.setup();
    renderSelect([
      { id: "mp4", label: "MP4 (H.264)", group: "Video" },
      { id: "mp3", label: "MP3", group: "Audio only" },
    ]);

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));

    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Audio only")).toBeInTheDocument();
  });
});
