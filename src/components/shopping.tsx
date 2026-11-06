"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addShoppingItem, changeShoppingItem } from "@/lib/actions";
import type { ShoppingItem } from "@/lib/types";
import { CopyScope } from "./content-provider";

export function Shopping({
  householdId,
  items,
}: {
  householdId: string;
  items: ShoppingItem[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [visibleItems, showChange] = useOptimistic(
    items,
    (current, change: { item: ShoppingItem; done: boolean | null }) => {
      if (change.item.version === 0) return [change.item, ...current];
      if (change.done === null)
        return current.filter((item) => item.id !== change.item.id);
      return current.map((item) =>
        item.id === change.item.id
          ? { ...item, done: change.done ?? item.done }
          : item,
      );
    },
  );
  const openItems = visibleItems.filter((item) => !item.done);
  const checkedItems = visibleItems.filter((item) => item.done);

  function run(
    item: ShoppingItem,
    done: boolean | null,
    work: () => Promise<void>,
    after?: () => void,
  ) {
    if (pending) return;
    setError("");
    startTransition(async () => {
      showChange({ item, done });
      try {
        await work();
        after?.();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Wijziging opslaan lukt niet.",
        );
      }
    });
  }

  function rows(list: ShoppingItem[]) {
    return (
      <ul className="shopping-list">
        {list.map((item) => (
          <li className="shopping-row" key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                disabled={pending}
                onChange={() =>
                  run(item, !item.done, () =>
                    changeShoppingItem(
                      householdId,
                      item.id,
                      item.version,
                      !item.done,
                    ),
                  )
                }
              />
              <span>
                <strong>{item.title}</strong>
                {(item.quantity || item.store) && (
                  <small>
                    {[item.quantity, item.store].filter(Boolean).join(" · ")}
                  </small>
                )}
              </span>
            </label>
            {item.done && (
              <button
                className="button button-outline button-sm"
                disabled={pending}
                onClick={() =>
                  run(item, false, () =>
                    changeShoppingItem(
                      householdId,
                      item.id,
                      item.version,
                      false,
                    ),
                  )
                }
              >
                Opnieuw toevoegen
              </button>
            )}
            <button
              className="icon-button"
              disabled={pending}
              aria-label={`Verwijder ${item.title}`}
              onClick={() =>
                run(item, null, () =>
                  changeShoppingItem(householdId, item.id, item.version, null),
                )
              }
            >
              <Trash2 size={17} />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <CopyScope>
      <section className="panel shopping-panel">
        <form
          ref={form}
          className="shopping-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            const values = new FormData(event.currentTarget);
            const title = String(values.get("title") ?? "").trim();
            const quantity = String(values.get("quantity") ?? "").trim();
            const store = String(values.get("store") ?? "").trim();
            if (!title) {
              setError("Vul een product in.");
              return;
            }
            run(
              {
                id: crypto.randomUUID(),
                title,
                quantity,
                store,
                done: false,
                version: 0,
              },
              false,
              () => addShoppingItem(householdId, title, quantity, store),
              () => {
                form.current?.reset();
                requestAnimationFrame(() => titleInput.current?.focus());
              },
            );
          }}
        >
          <div className="shopping-add">
            <input
              ref={titleInput}
              name="title"
              required
              maxLength={120}
              readOnly={pending}
              aria-label="Product voor de boodschappenlijst"
              placeholder="Bijv. melk"
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={pending}
            >
              <Plus size={17} /> Toevoegen
            </button>
          </div>
          <details>
            <summary>Aantal of winkel toevoegen</summary>
            <div className="shopping-extra">
              <label className="field">
                Aantal
                <input
                  name="quantity"
                  maxLength={40}
                  readOnly={pending}
                  placeholder="Bijv. 2 pakken"
                />
              </label>
              <label className="field">
                Winkel
                <input name="store" maxLength={80} readOnly={pending} />
              </label>
            </div>
          </details>
        </form>
        {pending && (
          <p className="form-hint" role="status">
            Boodschappen opslaan…
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <h2>Nog te halen</h2>
        {openItems.length ? (
          rows(openItems)
        ) : (
          <p className="muted">
            Alles in huis. Voeg hierboven toe wat jullie nodig hebben.
          </p>
        )}
        {checkedItems.length > 0 && (
          <details className="shopping-checked">
            <summary>Afgevinkt ({checkedItems.length})</summary>
            {rows(checkedItems)}
          </details>
        )}
      </section>
    </CopyScope>
  );
}
