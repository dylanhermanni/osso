"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  addRecipeToShopping,
  deleteShoppingRecipe,
  saveShoppingRecipe,
} from "@/lib/actions";
import type { ShoppingRecipe } from "@/lib/types";
import { Dialog } from "./ui/dialog";

export function ShoppingRecipes({
  householdId,
  recipes,
}: {
  householdId: string;
  recipes: ShoppingRecipe[];
}) {
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingRecipe | null | undefined>();
  const [deleting, setDeleting] = useState<ShoppingRecipe>();
  function openEditor(recipe: ShoppingRecipe | null) {
    setFormError("");
    const count = recipe?.ingredients.length ?? 1;
    setIngredientRows(Array.from({ length: count }, (_, index) => index));
    setEditing(recipe);
  }
  const [pending, startTransition] = useTransition();
  const [ingredientRows, setIngredientRows] = useState([0]);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();

  return (
    <>
      <button
        type="button"
        className="button button-outline button-sm"
        onClick={() => setListOpen(true)}
      >
        Recepten
      </button>
      <Dialog
        open={listOpen && editing === undefined && !deleting}
        onOpenChange={setListOpen}
        title="Recepten"
      >
        <button
          type="button"
          className="button button-outline button-sm"
          disabled={pending}
          onClick={() => openEditor(null)}
        >
          <Plus size={16} aria-hidden="true" /> Nieuw recept
        </button>
        {recipes.length ? (
          <ul className="shopping-list shopping-recipe-list">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  className="button button-outline button-sm"
                  aria-label={`${recipe.title} toevoegen aan boodschappen`}
                  disabled={pending}
                  onClick={() => {
                    setFeedback(undefined);
                    startTransition(async () => {
                      try {
                        await addRecipeToShopping(householdId, recipe.id);
                        setFeedback({
                          text: `Ingrediënten voor ${recipe.title} staan op de lijst.`,
                        });
                      } catch (error) {
                        setFeedback({
                          text:
                            error instanceof Error
                              ? error.message
                              : "Ingrediënten toevoegen lukt niet.",
                          error: true,
                        });
                      }
                    });
                  }}
                >
                  <Plus size={16} aria-hidden="true" /> {recipe.title}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={pending}
                  aria-label={`${recipe.title} bewerken`}
                  onClick={() => openEditor(recipe)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={pending}
                  aria-label={`${recipe.title} verwijderen`}
                  onClick={() => {
                    setFormError("");
                    setDeleting(recipe);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Bewaar je favoriete recepten en voeg alle ingrediënten met één tik
            toe.
          </p>
        )}
        {feedback && (
          <p
            role={feedback.error ? "alert" : "status"}
            className={feedback.error ? "form-error" : "form-hint"}
          >
            {feedback.text}
          </p>
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(undefined);
        }}
        title="Recept verwijderen?"
      >
        <p>Wil je {deleting?.title} uit je recepten verwijderen?</p>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="dialog-footer">
          <button
            type="button"
            className="button button-outline"
            disabled={pending}
            onClick={() => setDeleting(undefined)}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={pending}
            onClick={() => {
              if (!deleting) return;
              setFormError("");
              startTransition(async () => {
                try {
                  await deleteShoppingRecipe(householdId, deleting.id);
                  setDeleting(undefined);
                  setFeedback({ text: "Recept verwijderd." });
                } catch (error) {
                  setFormError(
                    error instanceof Error
                      ? error.message
                      : "Recept verwijderen lukt niet.",
                  );
                }
              });
            }}
          >
            Verwijderen
          </button>
        </div>
      </Dialog>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open && !pending) setEditing(undefined);
        }}
        title={editing ? "Recept bewerken" : "Nieuw recept"}
      >
        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const values = new FormData(event.currentTarget);
            const title = String(values.get("title") ?? "");
            const ingredients = ingredientRows.map((row) =>
              String(values.get(`ingredient-${row}`) ?? "").trim(),
            );
            const quantities = ingredientRows.map((row) =>
              String(values.get(`quantity-${row}`) ?? "").trim(),
            );
            setFormError("");
            startTransition(async () => {
              try {
                await saveShoppingRecipe(
                  householdId,
                  title,
                  ingredients,
                  quantities,
                  editing?.id,
                );
                setEditing(undefined);
                setFeedback({ text: "Recept opgeslagen." });
              } catch (error) {
                setFormError(
                  error instanceof Error
                    ? error.message
                    : "Recept opslaan lukt niet.",
                );
              }
            });
          }}
        >
          <label className="field">
            Receptnaam
            <input
              name="title"
              defaultValue={editing?.title}
              maxLength={120}
              required
            />
          </label>
          <fieldset className="recipe-ingredients">
            <legend>Ingrediënten</legend>
            {ingredientRows.map((row, index) => (
              <div className="recipe-ingredient-row" key={row}>
                <label className="field">
                  Ingrediënt
                  <input
                    name={`ingredient-${row}`}
                    defaultValue={editing?.ingredients[row]}
                    placeholder="Bijv. pasta"
                    maxLength={120}
                    required
                    pattern=".*\S.*"
                  />
                </label>
                <label className="field">
                  Hoeveelheid
                  <input
                    name={`quantity-${row}`}
                    defaultValue={editing?.quantities?.[row]}
                    placeholder="Bijv. 250 g"
                    maxLength={40}
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Ingrediënt ${index + 1} verwijderen`}
                  disabled={pending || ingredientRows.length === 1}
                  onClick={() =>
                    setIngredientRows((rows) => rows.filter((id) => id !== row))
                  }
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button button-outline button-sm"
              disabled={pending || ingredientRows.length >= 50}
              onClick={() => {
                setIngredientRows((rows) => [...rows, Math.max(...rows) + 1]);
              }}
            >
              <Plus size={16} aria-hidden="true" /> Ingrediënt toevoegen
            </button>
          </fieldset>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <button
            type="submit"
            className="button button-primary"
            disabled={pending}
          >
            Recept opslaan
          </button>
        </form>
      </Dialog>
    </>
  );
}
