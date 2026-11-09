"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { CopyScope } from "./content-provider";
import type { RecordData } from "@/lib/types";

export function SortableCards({
  items,
  className,
  enabled,
  projects,
  hideGrip = false,
  onReorder,
  onError,
  children,
}: {
  items: RecordData[];
  className: string;
  enabled: boolean;
  projects: boolean;
  hideGrip?: boolean;
  onReorder: (ids: string[]) => Promise<void>;
  onError: (message: string) => void;
  children: (item: RecordData, index: number) => ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [visible, showOrder] = useOptimistic(
    items,
    (current, ids: string[]) => {
      const ranks = new Map(ids.map((id, index) => [id, index]));
      return [...current].sort(
        (a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0),
      );
    },
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function move({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || pending) return;
    const from = visible.findIndex((item) => item.id === active.id);
    const to = visible.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    if (
      projects &&
      (visible[from].status === "In uitvoering") !==
        (visible[to].status === "In uitvoering")
    ) {
      onError(
        "Projecten in uitvoering blijven bovenaan. Sleep binnen dezelfde groep.",
      );
      return;
    }
    const ids = arrayMove(visible, from, to).map((item) => item.id);
    startTransition(async () => {
      showOrder(ids);
      try {
        await onReorder(ids);
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : "Volgorde opslaan lukt niet. Probeer opnieuw.",
        );
      }
    });
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={move}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Druk op spatie om de tegel op te pakken. Verplaats met de pijltjestoetsen. Druk opnieuw op spatie om neer te zetten of op Escape om te annuleren.",
        },
        announcements: {
          onDragStart: () => "Tegel opgepakt.",
          onDragOver: ({ over }) =>
            over
              ? `Positie ${visible.findIndex((item) => item.id === over.id) + 1}.`
              : "Buiten het overzicht.",
          onDragEnd: () => "Tegel neergezet.",
          onDragCancel: () => "Verplaatsen geannuleerd.",
        },
      }}
    >
      <SortableContext
        items={visible.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div className={className} aria-busy={pending}>
          {visible.map((item, index) => (
            <SortableTile
              key={item.id}
              item={item}
              enabled={enabled && items.length > 1}
              disabled={pending}
              showGrip={!hideGrip}
            >
              <CopyScope>{children(item, index)}</CopyScope>
            </SortableTile>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({
  item,
  disabled,
  enabled,
  showGrip,
  children,
}: {
  item: RecordData;
  enabled: boolean;
  disabled: boolean;
  showGrip: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !enabled || disabled });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-tile${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children}
      {enabled && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          disabled={disabled}
          className={`tile-drag-handle${showGrip ? "" : " tile-drag-handle-plain"}`}
          {...attributes}
          {...listeners}
          aria-label={`${item.title} verplaatsen`}
          title="Sleep om te verplaatsen"
        >
          {showGrip && <GripVertical size={19} />}
        </button>
      )}
    </div>
  );
}
