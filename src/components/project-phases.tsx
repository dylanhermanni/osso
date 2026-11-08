"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import {
  addProjectPhase,
  renameProjectPhase,
  toggleChild,
} from "@/lib/actions";
import type { Child } from "@/lib/types";
import { CopyScope } from "./content-provider";

type Change = { kind: "add" | "rename" | "toggle"; phase: Child };

export function ProjectPhases({
  householdId,
  projectId,
  phases,
}: {
  householdId: string;
  projectId: string;
  phases: Child[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [failedAdds, setFailedAdds] = useState<Child[]>([]);
  const [visible, showChange] = useOptimistic(
    phases,
    (current, change: Change) => {
      if (change.kind === "add")
        return [
          change.phase,
          ...current.filter((phase) => phase.id !== change.phase.id),
        ];
      return current.map((phase) =>
        phase.id !== change.phase.id
          ? phase
          : change.kind === "rename"
            ? { ...phase, title: change.phase.title }
            : { ...phase, done: change.phase.done },
      );
    },
  );

  function changePhase(change: Change) {
    const { phase, kind } = change;
    if (busyRows.has(phase.id)) return;
    const previous = visible.find((item) => item.id === phase.id);
    setError("");
    setBusyRows((current) => new Set(current).add(phase.id));
    setFailedAdds((current) => current.filter((item) => item.id !== phase.id));
    startTransition(async () => {
      showChange(change);
      try {
        if (kind === "add")
          await addProjectPhase(householdId, projectId, phase.id, phase.title!);
        else if (kind === "rename")
          await renameProjectPhase(
            householdId,
            projectId,
            phase.id,
            previous!.title!,
            phase.title!,
          );
        else
          await toggleChild(
            householdId,
            "project_phases",
            phase.id,
            Boolean(phase.done),
          );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Opslaan lukt niet. Probeer opnieuw.",
        );
        if (kind === "add") setFailedAdds((current) => [...current, phase]);
        if (kind === "rename")
          setEditing(
            (current) => current ?? { id: phase.id, title: phase.title! },
          );
      } finally {
        setBusyRows((current) => {
          const next = new Set(current);
          next.delete(phase.id);
          return next;
        });
      }
    });
  }

  return (
    <CopyScope>
      <section
        className="form-section project-phases"
        aria-label="Projectfases"
      >
        <h3>Projectfases</h3>
        {visible.map((phase) => (
          <div className="child-row phase-row" key={phase.id}>
            <button
              type="button"
              className={`check-button ${phase.done ? "checked" : ""}`}
              aria-label={`${phase.title} ${phase.done ? "heropenen" : "afronden"}`}
              disabled={busyRows.has(phase.id)}
              onClick={() =>
                changePhase({
                  kind: "toggle",
                  phase: { ...phase, done: !phase.done },
                })
              }
            >
              <Check size={14} />
            </button>
            {editing?.id === phase.id ? (
              <form
                className="phase-edit-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const title = editing.title.trim();
                  if (!title) return;
                  setEditing(null);
                  if (title !== phase.title)
                    changePhase({ kind: "rename", phase: { ...phase, title } });
                }}
              >
                <input
                  aria-label="Naam projectfase"
                  value={editing.title}
                  onChange={(event) =>
                    setEditing({ id: phase.id, title: event.target.value })
                  }
                  required
                  maxLength={4000}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditing(null);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="icon-button"
                  aria-label="Fase opslaan"
                >
                  <Check size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Bewerken annuleren"
                  onClick={() => setEditing(null)}
                >
                  <X size={17} />
                </button>
              </form>
            ) : (
              <>
                <span
                  className={`phase-title${phase.done ? " phase-done" : ""}`}
                >
                  {phase.title}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${phase.title} bewerken`}
                  disabled={busyRows.has(phase.id)}
                  onClick={() =>
                    setEditing({ id: phase.id, title: phase.title || "" })
                  }
                >
                  <Pencil size={16} />
                </button>
              </>
            )}
          </div>
        ))}
        <form
          className="inline-form phase-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const title = String(new FormData(form).get("title") || "").trim();
            if (!title) return;
            changePhase({
              kind: "add",
              phase: {
                id: crypto.randomUUID(),
                household_id: householdId,
                project_id: projectId,
                title,
                done: false,
              },
            });
            form.reset();
            input.current?.focus();
          }}
        >
          <input
            ref={input}
            name="title"
            aria-label="Nieuwe projectfase"
            placeholder="Nieuwe fase…"
            required
            maxLength={4000}
          />
          <button type="submit" className="button button-outline">
            <Plus size={16} />
            Toevoegen
          </button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {failedAdds.map((phase) => (
          <div className="phase-retry" key={phase.id}>
            <span>{phase.title}</span>
            <button
              type="button"
              className="button button-outline button-sm"
              disabled={busyRows.has(phase.id)}
              onClick={() => changePhase({ kind: "add", phase })}
            >
              Opnieuw proberen
            </button>
          </div>
        ))}
      </section>
    </CopyScope>
  );
}
