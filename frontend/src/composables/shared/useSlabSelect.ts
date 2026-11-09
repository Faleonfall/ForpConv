import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from "vue";
import {
  SLAB_TYPE_PAUSE_MS,
  groupSlabOptions,
  moveSlabFlow,
  moveSlabSpot,
  slabFlowColumns,
  slabMatch,
  slabSpotOf,
  type SlabMove,
  type SlabOption,
} from "../../lib/shared/slabSelect";

const ARROW_MOVES: Record<string, SlabMove> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function useSlabSelect(
  getOptions: () => SlabOption[],
  getValue: () => string,
  onPick: (id: string) => void,
) {
  const root = useTemplateRef<HTMLElement>("slabRoot");
  const panel = useTemplateRef<HTMLElement>("slabPanel");
  const isOpen = ref(false);
  // Columns a plain list spreads over, measured each time the panel opens
  const flowColumns = ref(1);
  // Option the keyboard or pointer rests on while the panel is open
  const activeId = ref("");

  const groups = computed(() => groupSlabOptions(getOptions()));
  const hasGroups = computed(() => groups.value.length > 1);
  const picked = computed(
    () =>
      getOptions().find((option) => option.id === getValue()) ??
      getOptions()[0],
  );

  let typed = "";
  let typedAt = 0;
  // A pick from the panel waits until the panel is gone. It can add or drop
  // a cell, and the panel would jump to the new cell width while it fades.
  let pendingPick: string | null = null;

  // The panel finished leaving, the held pick lands now
  const handleClosed = (): void => {
    if (pendingPick === null) return;
    const id = pendingPick;
    pendingPick = null;
    onPick(id);
  };

  const close = (returnFocus = false): void => {
    if (!isOpen.value) return;
    isOpen.value = false;
    document.removeEventListener("pointerdown", handleOutside);
    if (returnFocus) root.value?.querySelector("button")?.focus();
  };

  const open = (): void => {
    // Reopened mid-fade, the cancelled leave never lands the held pick
    handleClosed();
    isOpen.value = true;
    activeId.value = picked.value?.id ?? "";
    document.addEventListener("pointerdown", handleOutside);
    // Runs before paint, so the list never shows in the wrong shape
    void nextTick(() => {
      const width =
        panel.value?.querySelector<HTMLElement>(".slab-group")?.clientWidth ??
        0;
      flowColumns.value = slabFlowColumns(getOptions().length, width);
      panel.value?.focus({ preventScroll: true });
    });
  };

  const toggle = (): void => {
    if (isOpen.value) close();
    else open();
  };

  const choose = (id: string): void => {
    if (id !== getValue()) pendingPick = id;
    close(true);
  };

  const hover = (id: string): void => {
    activeId.value = id;
  };

  function handleOutside(event: PointerEvent): void {
    if (!root.value?.contains(event.target as Node)) close();
  }

  // Letters typed close together find the first option they spell
  const search = (key: string): SlabOption | null => {
    const now = performance.now();
    typed = now - typedAt > SLAB_TYPE_PAUSE_MS ? key : typed + key;
    typedAt = now;
    return slabMatch(getOptions(), typed);
  };

  const isLetter = (event: KeyboardEvent): boolean =>
    event.key.length === 1 &&
    event.key !== " " &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey;

  const moveFrom = (id: string, move: SlabMove): string => {
    if (!hasGroups.value) {
      const options = getOptions();
      const index = options.findIndex((option) => option.id === id);
      if (index < 0) return id;
      const next = moveSlabFlow(options.length, index, move, flowColumns.value);
      return options[next]?.id ?? id;
    }
    const spot = slabSpotOf(groups.value, id);
    if (!spot) return id;
    const next = moveSlabSpot(groups.value, spot, move);
    return groups.value[next.column]?.options[next.row]?.id ?? id;
  };

  // The closed cell steps its pick with up and down and jumps on letters
  const handleCellKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const options = getOptions();
      const index = options.findIndex(
        (option) => option.id === picked.value?.id,
      );
      const next = options[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (next) onPick(next.id);
    } else if (isLetter(event)) {
      event.preventDefault();
      const match = search(event.key);
      if (match && match.id !== getValue()) onPick(match.id);
    }
  };

  const handlePanelKeydown = (event: KeyboardEvent): void => {
    const move = ARROW_MOVES[event.key];
    if (move) {
      event.preventDefault();
      activeId.value = moveFrom(activeId.value, move);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeId.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close();
    } else if (isLetter(event)) {
      event.preventDefault();
      const match = search(event.key);
      if (match) activeId.value = match.id;
    }
  };

  onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", handleOutside);
  });

  return {
    isOpen,
    flowColumns,
    activeId,
    groups,
    hasGroups,
    picked,
    toggle,
    close,
    choose,
    handleClosed,
    hover,
    handleCellKeydown,
    handlePanelKeydown,
  };
}
