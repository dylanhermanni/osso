"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChefHat,
  Pencil,
  Plus,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import {
  addRecipeToShopping,
  deleteShoppingRecipe,
  saveShoppingRecipe,
} from "@/lib/actions";
import {
  DEFAULT_RECIPE_PORTIONS,
  MAX_RECIPE_PORTIONS,
  scaleRecipeQuantity,
} from "@/lib/domain/recipe-portions";
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
  const [selected, setSelected] = useState<ShoppingRecipe>();
  const [people, setPeople] = useState("");
  const target = Number(people);
  const validTarget =
    Number.isInteger(target) && target >= 1 && target <= MAX_RECIPE_PORTIONS;
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
        open={listOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setListOpen(open);
          if (!open) {
            setEditing(undefined);
            setSelected(undefined);
            setDeleting(undefined);
            setFeedback(undefined);
          }
        }}
        title="Boodschappen / Recepten"
        className="recipe-workspace"
      >
        <div className="recipe-page">
          {editing === undefined && !deleting && !selected && (
            <header className="recipe-hero">
              <div>
                <span className="recipe-eyebrow">
                  CHEESE THE ROOSTER · KEUKEN
                </span>
                <h2>Ons receptenboek</h2>
                <p>Van favoriete gerechten naar je boodschappenlijst.</p>
              </div>
              <div className="recipe-hero-art" aria-hidden="true">
                <ChefHat size={85} strokeWidth={1.05} />
              </div>
            </header>
          )}
          {editing === undefined && !deleting && !selected && (
            <section
              className="recipe-collection"
              aria-labelledby="recipe-collection-title"
            >
              <div className="recipe-section-heading">
                <div>
                  <h3 id="recipe-collection-title">Bewaarde recepten</h3>
                  <p>
                    {recipes.length}{" "}
                    {recipes.length === 1 ? "recept" : "recepten"}
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={pending}
                  onClick={() => openEditor(null)}
                >
                  <Plus size={18} aria-hidden="true" /> Nieuw recept
                </button>
              </div>
              {recipes.length ? (
                <ul className="shopping-list shopping-recipe-list">
                  {recipes.map((recipe) => (
                    <li key={recipe.id} className="recipe-card">
                      <div className="recipe-card-top">
                        <span className="recipe-card-icon">
                          <BookOpen size={20} aria-hidden="true" />
                        </span>
                        <div className="recipe-card-tools">
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
                        </div>
                      </div>
                      <h4>{recipe.title}</h4>
                      <p>
                        {recipe.ingredients.length}{" "}
                        {recipe.ingredients.length === 1
                          ? "ingrediënt"
                          : "ingrediënten"}{" "}
                        · {recipe.portions}{" "}
                        {recipe.portions === 1 ? "persoon" : "personen"}
                      </p>
                      <button
                        type="button"
                        className="button button-outline recipe-add-to-list"
                        aria-label={`${recipe.title} toevoegen aan boodschappen`}
                        disabled={pending}
                        onClick={() => {
                          setFormError("");
                          setPeople(String(recipe.portions));
                          setSelected(recipe);
                        }}
                      >
                        <ShoppingBasket size={16} aria-hidden="true" /> Op
                        boodschappenlijst
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="recipe-empty">
                  <BookOpen size={28} aria-hidden="true" />
                  <h4>Ruimte voor je favorieten</h4>
                  <p>
                    Sla je eerste recept op. Dan heb je de ingrediënten de
                    volgende keer meteen bij de hand.
                  </p>
                </div>
              )}
              {feedback && (
                <p
                  role={feedback.error ? "alert" : "status"}
                  className={feedback.error ? "form-error" : "form-hint"}
                >
                  {feedback.text}
                </p>
              )}
            </section>
          )}
          {selected && (
            <section className="recipe-editor">
              <button
                type="button"
                className="recipe-back"
                disabled={pending}
                onClick={() => setSelected(undefined)}
              >
                <ArrowLeft size={17} aria-hidden="true" /> Alle recepten
              </button>
              <h3>{selected.title}</h3>
              <p>
                Dit recept is opgeslagen voor {selected.portions}{" "}
                {selected.portions === 1 ? "persoon" : "personen"}.
              </p>
              <form
                className="editor-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!validTarget || pending) return;
                  setFormError("");
                  startTransition(async () => {
                    try {
                      await addRecipeToShopping(
                        householdId,
                        selected.id,
                        target,
                      );
                      setSelected(undefined);
                      setFeedback({
                        text: `Ingrediënten voor ${selected.title} staan op de lijst.`,
                      });
                    } catch (error) {
                      setFormError(
                        error instanceof Error
                          ? error.message
                          : "Ingrediënten toevoegen lukt niet.",
                      );
                    }
                  });
                }}
              >
                <label className="field">
                  Voor hoeveel personen kook je?
                  <input
                    type="number"
                    min={1}
                    max={MAX_RECIPE_PORTIONS}
                    step={1}
                    required
                    value={people}
                    onChange={(event) => setPeople(event.target.value)}
                  />
                </label>
                <ul
                  className="shopping-list recipe-portion-preview"
                  aria-label="Hoeveelheden voor de boodschappenlijst"
                >
                  {selected.ingredients.map((ingredient, index) => (
                    <li key={index}>
                      <span>{ingredient}</span>
                      <strong>
                        {scaleRecipeQuantity(
                          selected.quantities?.[index] ?? "",
                          selected.portions,
                          validTarget ? target : selected.portions,
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
                <p className="form-hint">
                  Hoeveelheden met een getal worden omgerekend. Vul ze in bij
                  Hoeveelheid.
                </p>
                {formError && (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                )}
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={pending || !validTarget}
                >
                  <ShoppingBasket size={16} aria-hidden="true" /> Op
                  boodschappenlijst
                </button>
              </form>
            </section>
          )}
          {deleting && (
            <section className="recipe-editor">
              <h3>Recept verwijderen?</h3>
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
            </section>
          )}
          {editing !== undefined && (
            <section className="recipe-editor">
              <button
                type="button"
                className="recipe-back"
                disabled={pending}
                onClick={() => setEditing(undefined)}
              >
                <ArrowLeft size={17} aria-hidden="true" /> Alle recepten
              </button>
              <h3>{editing ? "Recept bewerken" : "Nieuw recept"}</h3>
              <p>
                Geef je recept een naam en voeg de ingrediënten één voor één
                toe.
              </p>
              <form
                className="editor-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const values = new FormData(event.currentTarget);
                  const title = String(values.get("title") ?? "");
                  const portions = Number(values.get("portions"));
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
                        portions,
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
                <label className="field">
                  Recept voor zoveel personen
                  <input
                    name="portions"
                    type="number"
                    min={1}
                    max={MAX_RECIPE_PORTIONS}
                    step={1}
                    required
                    defaultValue={editing?.portions ?? DEFAULT_RECIPE_PORTIONS}
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
                          setIngredientRows((rows) =>
                            rows.filter((id) => id !== row),
                          )
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
                      setIngredientRows((rows) => [
                        ...rows,
                        Math.max(...rows) + 1,
                      ]);
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
            </section>
          )}
        </div>
      </Dialog>
    </>
  );
}
