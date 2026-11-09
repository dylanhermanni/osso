"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();

  return (
    <section className="panel shopping-recipes" aria-labelledby="shopping-recipes-heading">
      <div className="section-heading">
        <h2 id="shopping-recipes-heading">Recepten</h2>
        <button
          type="button"
          className="button button-outline button-sm"
          disabled={pending}
          onClick={() => {
            setFormError("");
            setCreating(true);
          }}
        >
          <Plus size={16} aria-hidden="true" /> Nieuw recept
        </button>
      </div>
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
            const ingredients = String(values.get("ingredients") ?? "")
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean);
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
          <label className="field">
            Ingrediënten (één per regel)
            <textarea
              name="ingredients"
              rows={5}
              maxLength={6100}
              required
              placeholder="Bijv. 250 g pasta"
            />
          </label>
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
    </section>
  );
}
