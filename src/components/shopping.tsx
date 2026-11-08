"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Plus, Trash2, ShoppingBasket } from "lucide-react";
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
  const titleInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [failedAdds, setFailedAdds] = useState<
    { item: ShoppingItem; message: string }[]
  >([]);
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
  ) {
    if (item.version === 0 || busyRows.has(item.id)) return;
    setBusyRows((current) => new Set(current).add(item.id));
    setError("");
    startTransition(async () => {
      showChange({ item, done });
      try {
        await work();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Wijziging opslaan lukt niet.";
        setError(`${item.title} · ${message}`);
      } finally {
        setBusyRows((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    });
  }

  function add(item: ShoppingItem) {
    setError("");
    setFailedAdds((current) =>
      current.filter((failure) => failure.item.id !== item.id),
    );
    startTransition(async () => {
      showChange({ item, done: false });
      try {
        await addShoppingItem(
          householdId,
          item.title,
          item.quantity,
          item.store,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Toevoegen lukt niet.";
        setFailedAdds((current) => [...current, { item, message }]);
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
                disabled={item.version === 0 || busyRows.has(item.id)}
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
                {item.store && <small>{item.store}</small>}
              </span>
            </label>
            {item.quantity && (
              <span className="shopping-quantity">
                {item.quantity}
                {/^[0-9]+$/.test(item.quantity) ? "×" : ""}
              </span>
            )}
            {item.done && (
              <button
                className="button button-outline button-sm"
                disabled={item.version === 0 || busyRows.has(item.id)}
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
                Terugzetten
              </button>
            )}
            <button
              className="icon-button"
              disabled={item.version === 0 || busyRows.has(item.id)}
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
      <section className="shopping-panel">
        <form
          className="panel shopping-form"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const title = String(values.get("title") ?? "").trim();
            const quantity = String(values.get("quantity") ?? "").trim();
            const store = String(values.get("store") ?? "").trim();
            if (!title) {
              setError("Vul een product in.");
              return;
            }
            add({
              id: crypto.randomUUID(),
              title,
              quantity,
              store,
              done: false,
              version: 0,
            });
            event.currentTarget.reset();
            setQuantityInput("");
            titleInput.current?.focus();
          }}
        >
          <div className="shopping-add">
            <input
              ref={titleInput}
              name="title"
              required
              maxLength={120}
              aria-label="Product voor de boodschappenlijst"
              placeholder="Bijv. melk"
            />
            <button className="button button-primary" type="submit">
              <Plus size={17} /> Toevoegen
            </button>
          </div>
          <div className="shopping-extra">
            <label className="field">
              Aantal
              <input
                name="quantity"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={40}
                placeholder="1"
                value={quantityInput}
                onChange={(event) => {
                  if (/^[0-9]*$/.test(event.target.value))
                    setQuantityInput(event.target.value);
                }}
              />
            </label>
            <label className="field">
              Winkel
              <input
                name="store"
                maxLength={80}
                placeholder="Bijv. Albert Heijn"
              />
            </label>
          </div>
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
        {failedAdds.map(({ item, message }) => (
          <div key={item.id} className="form-error">
            <p role="alert">
              <strong>{item.title}</strong> · {message}
            </p>
            <button
              type="button"
              className="button button-outline button-sm"
              disabled={pending}
              onClick={() => add(item)}
            >
              Opnieuw proberen
            </button>
          </div>
        ))}
        <div className="shopping-paper">
          <div className="shopping-paper-heading">
            <ShoppingBasket size={22} aria-hidden="true" />
            <h2>Nog te halen</h2>
            <span className="shopping-paper-count">{openItems.length}</span>
          </div>
          {openItems.length ? (
            rows(openItems)
          ) : (
            <p className="muted">Alles in huis.</p>
          )}
          {checkedItems.length > 0 && (
            <section
              className="shopping-checked"
              aria-label="Afgevinkte boodschappen"
            >
              {rows(checkedItems)}
            </section>
          )}
        </div>
      </section>
    </CopyScope>
  );
}
