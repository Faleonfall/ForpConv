import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type SlabOption } from "../../../lib/shared/slabSelect";
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

// A pick lands once the panel has left
async function panelClosed() {
  await vi.waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
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
    await panelClosed();

    expect(emitted("update:modelValue")).toEqual([["opus"]]);
  });
});

describe("SlabSelect held pick", () => {
  it("holds the pick until the panel has closed", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.click(screen.getByRole("option", { name: "Opus" }));

    // A new cell from the pick would resize the panel as it fades
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(emitted("update:modelValue")).toBeUndefined();
    await panelClosed();
    expect(emitted("update:modelValue")).toEqual([["opus"]]);
  });

  it("lands a held pick when the panel reopens mid fade", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();
    const cell = screen.getByRole("button", { name: /^Convert To/ });

    await user.click(cell);
    await user.click(screen.getByRole("option", { name: "Opus" }));
    await user.click(cell);

    expect(emitted("update:modelValue")).toEqual([["opus"]]);
  });
});

describe("SlabSelect closing and keys", () => {
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

    await panelClosed();
  });

  it("moves through the panel with arrows and picks on Enter", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await panelClosed();

    expect(emitted("update:modelValue")).toEqual([["flac"]]);
  });

  it("closes on Escape and hands focus back to the cell", async () => {
    const user = userEvent.setup();
    renderSelect();
    const cell = screen.getByRole("button", { name: /^Convert To/ });

    await user.click(cell);
    await user.keyboard("{Escape}");

    await panelClosed();
    expect(cell).toHaveFocus();
  });

  it("jumps to a typed option inside the panel", async () => {
    const user = userEvent.setup();
    const { emitted } = renderSelect();

    await user.click(screen.getByRole("button", { name: /^Convert To/ }));
    await user.keyboard("fl{Enter}");
    await panelClosed();

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
