"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { addRecipeToShopping, createShoppingRecipe } from "@/lib/actions";
import type { ShoppingRecipe } from "@/lib/types";
import { Dialog } from "./ui/dialog";

export function ShoppingRecipes({
  householdId,
  recipes,
}: {
  householdId: string;
  recipes: ShoppingRecipe[];
}) {
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ingredientRows, setIngredientRows] = useState([0]);
  const nextRow = useRef(1);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();

  return (
    <details className="shopping-recipes">
      <summary>
        Recepten <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="shopping-recipes-body">
        <button
          type="button"
          className="button button-outline button-sm"
          disabled={pending}
          onClick={() => {
            setFormError("");
            setIngredientRows([0]);
            setCreating(true);
          }}
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
      </div>
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!pending) setCreating(open);
        }}
        title="Nieuw recept"
      >
        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const title = String(values.get("title") ?? "");
            const ingredients = ingredientRows.map((row) => {
              const ingredient = String(
                values.get(`ingredient-${row}`) ?? "",
              ).trim();
              const quantity = String(
                values.get(`quantity-${row}`) ?? "",
              ).trim();
              return [quantity, ingredient].filter(Boolean).join(" ");
            });
            setFormError("");
            startTransition(async () => {
              try {
                await createShoppingRecipe(householdId, title, ingredients);
                setCreating(false);
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
            <input name="title" maxLength={120} required />
          </label>
          <fieldset className="recipe-ingredients">
            <legend>Ingrediënten</legend>
            {ingredientRows.map((row, index) => (
              <div className="recipe-ingredient-row" key={row}>
                <label className="field">
                  Ingrediënt
                  <input
                    name={`ingredient-${row}`}
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
                const row = nextRow.current++;
                setIngredientRows((rows) => [...rows, row]);
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
    </details>
  );
}
