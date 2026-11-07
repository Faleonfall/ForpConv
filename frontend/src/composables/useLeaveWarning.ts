import { onBeforeUnmount, watch } from "vue";

// A picked file lives only in the open page, so a reload or close asks
// first while there is work to lose
export function useLeaveWarning(isActive: () => boolean) {
  const warn = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
  };

  watch(
    isActive,
    (active) => {
      if (active) window.addEventListener("beforeunload", warn);
      else window.removeEventListener("beforeunload", warn);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => window.removeEventListener("beforeunload", warn));
}
