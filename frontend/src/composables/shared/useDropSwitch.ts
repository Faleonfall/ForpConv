import { ref, watch, type WatchSource } from "vue";

// The drop only moves on a real switch, not on first paint
export function useDropSwitch(picked: WatchSource<unknown>) {
  const hasMoved = ref(false);

  watch(picked, () => {
    hasMoved.value = true;
  });

  return { hasMoved };
}
