import type { Entity, RecordData } from "@/lib/types";

export type SortableEntity = Extract<
  Entity,
  "rooms" | "ideas" | "projects" | "wishlist_items"
>;
export type RecordOrder = {
  entity: SortableEntity;
  record_ids: string[];
  version: number;
};

export function orderedRecords(
  items: RecordData[],
  order?: RecordOrder,
  entity?: Entity,
) {
  const ranks = new Map(order?.record_ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const running =
      entity === "projects"
        ? Number(b.status === "In uitvoering") -
          Number(a.status === "In uitvoering")
        : 0;
    return (
      running ||
      (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) ||
      (entity === "rooms" ? (a.sort_order ?? 0) - (b.sort_order ?? 0) : 0)
    );
  });
}

// Replace only the visible slots, keeping filtered and archived records in place.
export function mergeVisibleOrder(all: string[], visible: string[]) {
  const selected = new Set(visible);
  let index = 0;
  return all.map((id) => (selected.has(id) ? visible[index++] : id));
}
