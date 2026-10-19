import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ResultDownload from "../ResultDownload.vue";

const props = { blob: new Blob(["x".repeat(2048)]), title: "My Tone" };

describe("ResultDownload", () => {
  it("shows the file name and size", () => {
    render(ResultDownload, { props });

    expect(screen.getByText("My Tone.m4r")).toBeInTheDocument();
    expect(screen.getByText("Size: 2.0 KB")).toBeInTheDocument();
  });

  it("links the ringtone for download", async () => {
    render(ResultDownload, { props });

    const link = await screen.findByRole("link", {
      name: /Download Ringtone File/,
    });
    expect(link).toHaveAttribute("download", "My Tone.m4r");
    expect(link.getAttribute("href")).toMatch(/^blob:/);
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
