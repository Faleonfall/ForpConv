import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileUpload from "../FileUpload.vue";
import { MODE_COPY } from "../../lib/appMode";

const ringtoneProps = {
  kinds: MODE_COPY.ringtone.kinds,
  subtitle: MODE_COPY.ringtone.uploadSubtitle,
};
const convertProps = {
  kinds: MODE_COPY.convert.kinds,
  subtitle: MODE_COPY.convert.uploadSubtitle,
};

function fileInput(container: Element): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("file input missing");
  return input;
}

describe("FileUpload", () => {
  it("emits a supported file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container, emitted } = render(FileUpload, { props: ringtoneProps });
    const file = new File(["x"], "song.mp3", { type: "audio/mpeg" });

    await user.upload(fileInput(container), file);

    expect(emitted<[File]>("file-selected")[0]?.[0]).toBe(file);
    expect(screen.queryByText(/Unsupported/)).not.toBeInTheDocument();
  });

  it("shows a rejection from the flow", () => {
    render(FileUpload, {
      props: { ...ringtoneProps, rejection: "This video has no sound" },
    });

    expect(screen.getByText("This video has no sound")).toBeInTheDocument();
  });

  it("shows an error for an unsupported file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container, emitted } = render(FileUpload, { props: ringtoneProps });

    await user.upload(
      fileInput(container),
      new File(["x"], "notes.txt", { type: "text/plain" }),
    );

    expect(
      screen.getByText(/Unsupported file format \(\.txt\)/),
    ).toBeInTheDocument();
    expect(emitted("file-selected")).toBeUndefined();
  });

  it("keeps pictures out of the ringtone upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container, emitted } = render(FileUpload, { props: ringtoneProps });

    await user.upload(
      fileInput(container),
      new File(["x"], "photo.png", { type: "image/png" }),
    );

    expect(screen.getByText(/Unsupported file format \(\.png\)/)).toBeVisible();
    expect(emitted("file-selected")).toBeUndefined();
  });

  it("takes pictures and lists them in the converter upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container, emitted } = render(FileUpload, { props: convertProps });
    const file = new File(["x"], "anim.gif", { type: "image/gif" });

    await user.upload(fileInput(container), file);

    expect(emitted<[File]>("file-selected")[0]?.[0]).toBe(file);
    expect(
      screen.getByText("Drop your audio, video or image file here"),
    ).toBeInTheDocument();
    expect(fileInput(container)).toHaveAttribute(
      "accept",
      "audio/*,video/*,image/*,.heic,.heif",
    );
  });

  it("clears the error once a valid file follows", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(FileUpload, { props: ringtoneProps });
    const input = fileInput(container);

    await user.upload(input, new File(["x"], "a.txt", { type: "text/plain" }));
    await user.upload(input, new File(["x"], "b.wav", { type: "audio/wav" }));

    expect(screen.queryByText(/Unsupported/)).not.toBeInTheDocument();
  });

  it("hides the error after ten seconds", async () => {
    vi.useFakeTimers();
    const { container } = render(FileUpload, { props: ringtoneProps });
    const dropzone = container.querySelector(".upload-dropzone");
    const notes = new File(["x"], "notes.txt", { type: "text/plain" });

    await fireEvent.drop(dropzone!, { dataTransfer: { files: [notes] } });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(screen.getByText(/Unsupported/)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1);

    expect(screen.queryByText(/Unsupported/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("FileUpload drag and drop", () => {
  it("emits a dropped file", async () => {
    const { container, emitted } = render(FileUpload, { props: ringtoneProps });
    const dropzone = container.querySelector(".upload-dropzone");
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });

    await fireEvent.drop(dropzone!, { dataTransfer: { files: [file] } });

    expect(emitted<[File]>("file-selected")[0]?.[0]).toBe(file);
  });

  it("highlights the dropzone while a file is dragged over", async () => {
    const { container } = render(FileUpload, { props: ringtoneProps });
    const dropzone = container.querySelector(".upload-dropzone")!;

    await fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass("upload-dropzone-dragover");

    await fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass("upload-dropzone-dragover");
  });
});
