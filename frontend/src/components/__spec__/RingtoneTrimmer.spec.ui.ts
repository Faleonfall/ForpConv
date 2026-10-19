import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ConvertParams } from "../../lib/ringtoneConversion";
import RingtoneTrimmer from "../RingtoneTrimmer.vue";
import { createWaveSurferFake, type WaveSurferFake } from "./waveSurferHelpers";

let fake: WaveSurferFake;

vi.mock("wavesurfer.js", () => ({
  default: { create: () => fake.waveSurfer },
}));

vi.mock("wavesurfer.js/dist/plugins/regions.js", () => ({
  default: { create: () => ({}) },
}));

const file = new File(["x"], "My Song (Live).mp3", { type: "audio/mpeg" });

async function renderDecoded() {
  const result = render(RingtoneTrimmer, { props: { file } });
  fake.emit("decode");
  await nextTick();
  return result;
}

beforeEach(() => {
  fake = createWaveSurferFake();
});

describe("RingtoneTrimmer selection", () => {
  it("shows the decoding state until the waveform is ready", () => {
    render(RingtoneTrimmer, { props: { file } });

    expect(screen.getByText("Decoding audio timeline...")).toBeVisible();
    expect(screen.queryByText("Trim Start")).not.toBeInTheDocument();
  });

  it("selects the first thirty seconds once decoded", async () => {
    await renderDecoded();

    expect(screen.getByText("Duration: 01:35.0")).toBeInTheDocument();
    expect(screen.getByText("00:30.0")).toBeInTheDocument();
    expect(screen.getByText("30.0s")).toBeInTheDocument();
    expect(fake.regions.addRegion).toHaveBeenCalledWith(
      expect.objectContaining({ start: 0, end: 30, maxLength: 30 }),
    );
  });

  it("prefills a safe title from the file name", async () => {
    await renderDecoded();

    expect(screen.getByLabelText("Ringtone Filename")).toHaveValue(
      "My Song Live",
    );
  });

  it("follows the region when it moves", async () => {
    await renderDecoded();

    fake.moveRegion(70, 95);
    await nextTick();

    expect(screen.getByText("01:10.0")).toBeInTheDocument();
    expect(screen.getByText("25.0s")).toBeInTheDocument();
  });
});

describe("RingtoneTrimmer controls", () => {
  it("emits the selection and settings on convert", async () => {
    const user = userEvent.setup();
    const { emitted } = await renderDecoded();

    fake.moveRegion(5, 20);
    const title = screen.getByLabelText("Ringtone Filename");
    await user.clear(title);
    await user.type(title, "Alarm");
    await user.click(
      screen.getByRole("button", { name: /Create M4R Ringtone/ }),
    );

    expect(emitted<[ConvertParams]>("convert")[0]?.[0]).toEqual({
      startTime: 5,
      endTime: 20,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      title: "Alarm",
    });
  });

  it("falls back to a default title when cleared", async () => {
    const user = userEvent.setup();
    const { emitted } = await renderDecoded();

    await user.clear(screen.getByLabelText("Ringtone Filename"));
    await user.click(
      screen.getByRole("button", { name: /Create M4R Ringtone/ }),
    );

    expect(emitted<[ConvertParams]>("convert")[0]?.[0].title).toBe("ringtone");
  });

  it("clamps a typed fade value into range", async () => {
    const user = userEvent.setup();
    await renderDecoded();

    await user.click(screen.getAllByTitle("Click to type exact value")[0]!);
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "9{Enter}");

    expect(screen.getByText("5s")).toBeInTheDocument();
  });

  it("resets the selection to the start", async () => {
    const user = userEvent.setup();
    await renderDecoded();

    fake.moveRegion(40, 60);
    await nextTick();
    await user.click(screen.getByTitle("Reset Selection"));

    expect(fake.region.setOptions).toHaveBeenCalledWith({ start: 0, end: 30 });
    expect(screen.getByText("00:30.0")).toBeInTheDocument();
  });

  it("starts playback from the region start", async () => {
    const user = userEvent.setup();
    await renderDecoded();

    fake.moveRegion(40, 60);
    await user.click(screen.getByTitle("Play/Pause"));

    expect(fake.waveSurfer.setTime).toHaveBeenCalledWith(40);
    expect(fake.waveSurfer.play).toHaveBeenCalled();
  });

  it("emits cancel to change the file", async () => {
    const user = userEvent.setup();
    const { emitted } = await renderDecoded();

    await user.click(screen.getByRole("button", { name: "Change File" }));

    expect(emitted("cancel")).toHaveLength(1);
  });

  it("destroys the waveform on unmount", async () => {
    const { unmount } = await renderDecoded();

    unmount();

    expect(fake.waveSurfer.destroy).toHaveBeenCalled();
  });
});
