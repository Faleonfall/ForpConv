import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ResultDownload from "../ResultDownload.vue";
import { RINGTONE_DOWNLOAD_COPY } from "../../../lib/app/appMode";
import { type MediaKind } from "../../../lib/shared/mediaKind";

const props = {
  blob: new Blob(["x".repeat(2048)]),
  fileName: "My Tone.m4r",
  kind: "audio" as MediaKind,
  copy: RINGTONE_DOWNLOAD_COPY,
};

describe("ResultDownload", () => {
  it("shows the file name and size", () => {
    render(ResultDownload, { props });

    expect(screen.getByLabelText("File name")).toHaveValue("My Tone");
    expect(screen.getByText(".m4r")).toBeInTheDocument();
    expect(screen.getByText("Size: 2.0 KB")).toBeInTheDocument();
  });

  it("downloads under a new name with the format kept", async () => {
    const user = userEvent.setup();
    render(ResultDownload, { props });
    const name = screen.getByLabelText("File name");

    await user.clear(name);
    await user.type(name, "Wake: up");

    expect(
      await screen.findByRole("link", { name: /Download Ringtone File/ }),
    ).toHaveAttribute("download", "Wake up.m4r");
  });

  it("falls back to a default when the name is cleared", async () => {
    const user = userEvent.setup();
    render(ResultDownload, { props });

    await user.clear(screen.getByLabelText("File name"));

    expect(
      await screen.findByRole("link", { name: /Download Ringtone File/ }),
    ).toHaveAttribute("download", "converted.m4r");
  });

  it("links the file for download", async () => {
    render(ResultDownload, { props });

    const link = await screen.findByRole("link", {
      name: /Download Ringtone File/,
    });
    expect(link).toHaveAttribute("download", "My Tone.m4r");
    expect(link.getAttribute("href")).toMatch(/^blob:/);
  });

  it("previews an image result as a picture", async () => {
    render(ResultDownload, {
      props: { ...props, fileName: "clip.gif", kind: "image" },
    });

    expect(
      await screen.findByRole("img", { name: "clip.gif" }),
    ).toHaveAttribute("src", expect.stringMatching(/^blob:/));
  });

  it("emits reset to convert another file", async () => {
    const user = userEvent.setup();
    const { emitted } = render(ResultDownload, { props });

    await user.click(
      screen.getByRole("button", { name: "Convert Another File" }),
    );

    expect(emitted("reset")).toHaveLength(1);
  });

  it("revokes the object URL on unmount", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const { unmount } = render(ResultDownload, { props });
    const link = await screen.findByRole("link", {
      name: /Download Ringtone File/,
    });
    const href = link.getAttribute("href");

    unmount();

    expect(revoke).toHaveBeenCalledWith(href);
    revoke.mockRestore();
  });
});
