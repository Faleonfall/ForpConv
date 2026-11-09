import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { h, nextTick, ref } from "vue";
import { useLeaveWarning } from "../useLeaveWarning";

const hasWork = ref(false);

const WarningHost = {
  setup() {
    useLeaveWarning(() => hasWork.value);
    return () => h("p");
  },
};

// True when the page asked the browser to confirm leaving
function leaveIsBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useLeaveWarning", () => {
  it("asks before leaving only while there is work", async () => {
    hasWork.value = false;
    render(WarningHost);

    expect(leaveIsBlocked()).toBe(false);

    hasWork.value = true;
    await nextTick();
    expect(leaveIsBlocked()).toBe(true);

    hasWork.value = false;
    await nextTick();
    expect(leaveIsBlocked()).toBe(false);
  });

  it("stops asking once the page unmounts", async () => {
    hasWork.value = true;
    const { unmount } = render(WarningHost);
    await nextTick();

    unmount();

    expect(leaveIsBlocked()).toBe(false);
  });
});
