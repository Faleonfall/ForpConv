import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FileUpload from "../FileUpload.vue";

function fileInput(container: Element): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("file input missing");
  return input;
}

describe("FileUpload", () => {
  it("emits a supported file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container, emitted } = render(FileUpload);
    const file = new File(["x"], "song.mp3", { type: "audio/mpeg" });

    await user.upload(fileInput(container), file);

    expect(emitted<[File]>("file-selected")[0]?.[0]).toBe(file);
    expect(screen.queryByText(/Unsupported/)).not.toBeInTheDocument();
  });

  it("shows an error for an unsupported file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container, emitted } = render(FileUpload);

    await user.upload(
      fileInput(container),
      new File(["x"], "notes.txt", { type: "text/plain" }),
    );

    expect(
      screen.getByText(/Unsupported file format \(\.txt\)/),
    ).toBeInTheDocument();
    expect(emitted("file-selected")).toBeUndefined();
  });

  it("clears the error once a valid file follows", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(FileUpload);
    const input = fileInput(container);

    await user.upload(input, new File(["x"], "a.txt", { type: "text/plain" }));
    await user.upload(input, new File(["x"], "b.wav", { type: "audio/wav" }));

    expect(screen.queryByText(/Unsupported/)).not.toBeInTheDocument();
  });

  it("emits a dropped file", async () => {
    const { container, emitted } = render(FileUpload);
    const dropzone = container.querySelector(".upload-dropzone");
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });

    await fireEvent.drop(dropzone!, { dataTransfer: { files: [file] } });

    expect(emitted<[File]>("file-selected")[0]?.[0]).toBe(file);
  });

  it("highlights the dropzone while a file is dragged over", async () => {
    const { container } = render(FileUpload);
    const dropzone = container.querySelector(".upload-dropzone")!;

    await fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass("upload-dropzone-dragover");

    await fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass("upload-dropzone-dragover");
  });
});
