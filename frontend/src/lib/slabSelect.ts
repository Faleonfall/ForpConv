// Typed letters gather into one search until a pause this long
export const SLAB_TYPE_PAUSE_MS = 700;

export interface SlabOption {
  id: string;
  label: string;
  // Column this option belongs to, eg "Audio only"
  group?: string;
}

export interface SlabGroup {
  name: string;
  options: SlabOption[];
}

// Spot of an option in the panel, its column and row
export interface SlabSpot {
  column: number;
  row: number;
}

export type SlabMove = "up" | "down" | "left" | "right";

// Splits options into their columns in order of first appearance
export function groupSlabOptions(options: SlabOption[]): SlabGroup[] {
  const groups: SlabGroup[] = [];
  for (const option of options) {
    const name = option.group ?? "";
    const group = groups.find((entry) => entry.name === name);
    if (group) group.options.push(option);
    else groups.push({ name, options: [option] });
  }
  return groups;
}

export function slabSpotOf(groups: SlabGroup[], id: string): SlabSpot | null {
  for (const [column, group] of groups.entries()) {
    const row = group.options.findIndex((option) => option.id === id);
    if (row >= 0) return { column, row };
  }
  return null;
}

// Up and down run through the columns in reading order, left and right jump
// to the same row of the next column or its last option
export function moveSlabSpot(
  groups: SlabGroup[],
  spot: SlabSpot,
  move: SlabMove,
): SlabSpot {
  const column = groups[spot.column];
  if (!column) return spot;
  if (move === "left" || move === "right") {
    const next = spot.column + (move === "right" ? 1 : -1);
    const target = groups[next];
    if (!target) return spot;
    return { column: next, row: Math.min(spot.row, target.options.length - 1) };
  }
  const row = spot.row + (move === "down" ? 1 : -1);
  if (row >= 0 && row < column.options.length)
    return { column: spot.column, row };
  const next = spot.column + (move === "down" ? 1 : -1);
  const target = groups[next];
  if (!target) return spot;
  return { column: next, row: move === "down" ? 0 : target.options.length - 1 };
}

// First option whose label starts with the typed letters, else contains them
export function slabMatch(
  options: SlabOption[],
  query: string,
): SlabOption | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const label = (option: SlabOption): string => option.label.toLowerCase();
  return (
    options.find((option) => label(option).startsWith(needle)) ??
    options.find((option) => label(option).includes(needle)) ??
    null
  );
}
