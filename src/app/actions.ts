"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MAX_RECIPE_PORTIONS,
  scaleRecipeQuantity,
} from "@/lib/domain/recipe-portions";
import { supabase } from "@/lib/supabase/server";
import { schemas, expenseSchema, allocationsSchema } from "@/lib/validation";
import type { Entity } from "@/lib/types";
const id = z.uuid();
async function session() {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Log opnieuw in.");
  return { db, user };
}
async function member(h: string) {
  id.parse(h);
  const { db, user } = await session();
  const { data, error } = await db
    .from("household_members")
    .select("user_id")
    .eq("household_id", h)
    .eq("user_id", user.id)
    .single();
  if (error || !data) throw new Error("Geen toegang tot dit huishouden.");
  return { db, user };
}
function checked(error: { message: string } | null) {
  if (error) {
    console.error("Database operation:", error.message);
    throw new Error(
      "Opslaan mislukt. Controleer de gegevens en vernieuw bij een gelijktijdige wijziging.",
    );
  }
  revalidatePath("/");
}
async function authenticateImpl(
  mode: "login" | "signup",
  email: string,
  password: string,
) {
  z.email().parse(email);
  z.string().min(10, "Gebruik minimaal 10 tekens.").max(128).parse(password);
  const db = await supabase();
  const result =
    mode === "login"
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password });
  if (result.error)
    throw new Error(
      mode === "login"
        ? "Inloggen mislukt. Controleer je e-mail en wachtwoord."
        : "Registreren mislukt. Probeer later opnieuw.",
    );
  revalidatePath("/");
  return { confirmation: mode === "signup" && !result.data.session };
}
async function signoutImpl() {
  const { db } = await session();
  await db.auth.signOut();
  revalidatePath("/");
}
async function setupHouseholdImpl(
  name: string,
  person: string,
  token?: string,
) {
  z.string().trim().min(1).max(120).parse(name);
  z.string().trim().min(1).max(80).parse(person);
  const { db } = await session();
  const { error } = token
    ? await db.rpc("accept_invitation", {
        token: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(token),
        person_name: person,
      })
    : await db.rpc("create_household", {
        house_name: name,
        person_name: person,
      });
  checked(error);
}
async function inviteImpl(h: string, email: string) {
  z.email().parse(email);
  const { db } = await member(h);
  const { data, error } = await db.rpc("create_invitation", {
    h,
    invite_email: email,
  });
  checked(error);
  return data as string;
}
async function saveRecordImpl(
  entity: Entity,
  h: string,
  input: unknown,
  recordId?: string,
  version?: number,
) {
  if (!(entity in schemas))
    throw new Error("Deze module gebruikt een aparte transactie.");
  const parsed = schemas[entity as keyof typeof schemas].parse(input);
  const { db } = await member(h);
  if (recordId) {
    id.parse(recordId);
    z.number().int().positive().parse(version);
    const { data, error } = await db
      .from(entity)
      .update(parsed)
      .eq("id", recordId)
      .eq("household_id", h)
      .eq("version", version!)
      .select("id");
    checked(error);
    if (!data?.length)
      throw new Error(
        "Dit onderdeel is ondertussen gewijzigd. Vernieuw en probeer opnieuw.",
      );
  } else {
    const { error } = await db
      .from(entity)
      .insert({ ...parsed, household_id: h });
    checked(error);
  }
}
async function removeRecordImpl(
  entity: Entity,
  h: string,
  recordId: string,
  version: number,
) {
  if (!(entity in schemas) || entity === "wishlist_items")
    throw new Error("Dit onderdeel kan niet direct verwijderd worden.");
  const { db } = await member(h);
  id.parse(recordId);
  const { data, error } = await db
    .from(entity)
    .delete()
    .eq("household_id", h)
    .eq("id", recordId)
    .eq("version", version)
    .select("id");
  checked(error);
  if (!data?.length) throw new Error("Dit onderdeel is ondertussen gewijzigd.");
}
async function recordExpenseImpl(
  h: string,
  entry: unknown,
  payments: unknown,
  shares: unknown,
  requestId: string,
  productId?: string,
  refundOf?: string,
) {
  const e = expenseSchema.parse(entry),
    p = allocationsSchema.parse(payments),
    s = allocationsSchema.parse(shares);
  id.parse(requestId);
  if (productId) id.parse(productId);
  if (refundOf) id.parse(refundOf);
  if (productId && refundOf)
    throw new Error("Een aankoop kan geen terugbetaling zijn.");
  if (
    p.reduce((n, x) => n + x.amount_cents, 0) !== e.amount_cents ||
    s.reduce((n, x) => n + x.amount_cents, 0) !== e.amount_cents
  )
    throw new Error(
      "Betalingen en aandelen moeten exact gelijk zijn aan het totaal.",
    );
  const { db } = await member(h);
  const { error } = refundOf
    ? await db.rpc("record_refund", {
        h,
        original: refundOf,
        entry: e,
        payments: p,
        shares: s,
        request_id: requestId,
      })
    : await db.rpc("record_expense", {
        h,
        entry: e,
        payments: p,
        shares: s,
        request_id: requestId,
        product_id: productId ?? null,
      });
  checked(error);
}
async function settleImpl(
  h: string,
  payer: string,
  recipient: string,
  amount: number,
  requestId: string,
) {
  [payer, recipient, requestId].forEach((v) => id.parse(v));
  z.number().int().positive().parse(amount);
  const { db } = await member(h);
  const { error } = await db.rpc("record_settlement", {
    h,
    payer,
    recipient,
    cents: amount,
    request_id: requestId,
  });
  checked(error);
}
async function reverseFinancialImpl(
  h: string,
  recordId: string,
  kind: "expenses" | "settlements",
) {
  id.parse(recordId);
  z.enum(["expenses", "settlements"]).parse(kind);
  const { db } = await member(h);
  const { error } = await db.rpc("reverse_financial", {
    h,
    record_id: recordId,
    kind,
  });
  checked(error);
}
async function completeMaintenanceImpl(
  h: string,
  item: string,
  version: number,
  performed: string,
  cost: number,
) {
  id.parse(item);
  z.number().int().positive().parse(version);
  z.iso.date().parse(performed);
  z.number().int().min(0).parse(cost);
  const { db } = await member(h);
  const { error } = await db.rpc("complete_maintenance", {
    h,
    item,
    expected_version: version,
    performed,
    actual_cents: cost,
  });
  checked(error);
}
async function convertIdeaImpl(
  h: string,
  item: string,
  target: "projects" | "tasks",
  version: number,
) {
  id.parse(item);
  z.enum(["projects", "tasks"]).parse(target);
  z.number().int().positive().parse(version);
  const { db } = await member(h);
  const { error } = await db.rpc("convert_idea", {
    h,
    item,
    target,
    expected_version: version,
  });
  checked(error);
}
async function addChildImpl(
  h: string,
  kind: "idea_comments" | "task_comments" | "task_subtasks" | "project_phases",
  parent: string,
  text: string,
) {
  z.enum([
    "idea_comments",
    "task_comments",
    "task_subtasks",
    "project_phases",
  ]).parse(kind);
  id.parse(parent);
  z.string().trim().min(1).max(4000).parse(text);
  const { db } = await member(h);
  const field =
    kind === "idea_comments"
      ? "idea_id"
      : kind === "task_subtasks" || kind === "task_comments"
        ? "task_id"
        : "project_id";
  const { error } = await db.from(kind).insert({
    household_id: h,
    [field]: parent,
    [kind === "idea_comments" || kind === "task_comments" ? "body" : "title"]:
      text,
  });
  checked(error);
}
async function toggleChildImpl(
  h: string,
  kind: "task_subtasks" | "project_phases",
  child: string,
  done: boolean,
) {
  z.enum(["task_subtasks", "project_phases"]).parse(kind);
  id.parse(child);
  z.boolean().parse(done);
  const { db } = await member(h);
  const { error } = await db
    .from(kind)
    .update({ done })
    .eq("household_id", h)
    .eq("id", child)
    .eq("done", !done)
    .select("id")
    .single();
  checked(error);
}
async function fileSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validImageSignature(file: File, signature: string) {
  return file.type === "image/jpeg"
    ? signature.startsWith("ffd8ff")
    : file.type === "image/png"
      ? signature.startsWith("89504e470d0a1a0a")
      : file.type === "image/webp"
        ? signature.startsWith("52494646") &&
          signature.slice(16, 24) === "57454250"
        : false;
}

async function uploadFileImpl(h: string, form: FormData) {
  const { db } = await member(h);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024)
    throw new Error("Kies een bestand van maximaal 3 MB.");
  const signature = await fileSignature(file);
  if (
    !validImageSignature(file, signature) &&
    !(file.type === "application/pdf" && signature.startsWith("25504446"))
  )
    throw new Error(
      "Alleen geldige JPG-, PNG-, WebP- en PDF-bestanden zijn toegestaan.",
    );
  const title = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .parse(String(form.get("title") || file.name));
  const room = form.get("room_id"),
    project = form.get("project_id"),
    task = form.get("task_id"),
    expense = form.get("expense_id"),
    maintenance = form.get("maintenance_id");
  if (room) id.parse(room);
  if (project) id.parse(project);
  if (task) id.parse(task);
  if (expense) id.parse(expense);
  if (maintenance) id.parse(maintenance);
  const photoKind = form.get("photo_kind"),
    parent = form.get("parent_id");
  if (photoKind || parent) {
    z.enum([
      "room_photos",
      "idea_photos",
      "project_photos",
      "task_photos",
    ]).parse(photoKind);
    id.parse(parent);
    if (file.type === "application/pdf")
      throw new Error("Kies een afbeelding voor de galerij.");
  }
  const path = `${h}/${crypto.randomUUID()}`;
  const { error: uploadError } = await db.storage
    .from("home-files")
    .upload(path, file, { contentType: file.type, upsert: false });
  checked(uploadError);
  const { data: document, error } = await db
    .from("documents")
    .insert({
      household_id: h,
      title,
      storage_path: path,
      filename: file.name.slice(0, 255),
      mime_type: file.type,
      bytes: file.size,
      room_id: room || null,
      project_id: project || null,
      task_id: task || null,
      expense_id: expense || null,
      maintenance_id: maintenance || null,
      category: String(form.get("category") || "Document").slice(0, 100),
    })
    .select("id")
    .single();
  if (error) await db.storage.from("home-files").remove([path]);
  checked(error);
  if (photoKind && parent) {
    z.enum([
      "room_photos",
      "idea_photos",
      "project_photos",
      "task_photos",
    ]).parse(photoKind);
    id.parse(parent);
    if (file.type === "application/pdf")
      throw new Error("Kies een afbeelding voor de galerij.");
    const { error: photoError } = await db.from(String(photoKind)).insert({
      household_id: h,
      storage_path: path,
      [{
        room_photos: "room_id",
        idea_photos: "idea_id",
        project_photos: "project_id",
        task_photos: "task_id",
      }[String(photoKind)]!]: parent,
      caption: String(form.get("caption") || ""),
    });
    if (photoError) {
      await db
        .from("documents")
        .delete()
        .eq("id", document!.id)
        .eq("household_id", h);
      await db.storage.from("home-files").remove([path]);
    }
    checked(photoError);
  }
}
async function fileURLImpl(h: string, path: string) {
  const { db } = await member(h);
  if (!path.startsWith(`${h}/`)) throw new Error("Geen toegang.");
  const { data, error } = await db.storage
    .from("home-files")
    .createSignedUrl(path, 60);
  if (error) throw new Error("Bestand openen mislukt.");
  return data!.signedUrl;
}
async function linkPurchaseImpl(
  h: string,
  product: string,
  expense: string,
  version: number,
) {
  id.parse(product);
  id.parse(expense);
  z.number().int().positive().parse(version);
  const { db } = await member(h);
  const { error } = await db.rpc("link_purchase", {
    h,
    product,
    expense,
    expected_version: version,
  });
  checked(error);
}
async function deleteDocumentImpl(h: string, item: string, version: number) {
  id.parse(item);
  z.number().int().positive().parse(version);
  const { db } = await member(h);
  const { data, error } = await db.rpc("delete_document", {
    h,
    item,
    expected_version: version,
  });
  checked(error);
  const { error: storageError } = await db.storage
    .from("home-files")
    .remove([data as string]);
  if (storageError)
    throw new Error(
      "Document verwijderd uit het dossier, maar het opslagobject kon nog niet worden verwijderd.",
    );
}
async function realtimeTokenImpl(h: string) {
  const { db } = await member(h);
  const {
    data: { session },
    error,
  } = await db.auth.getSession();
  if (error || !session)
    throw new Error("Live sessie niet beschikbaar. Log opnieuw in.");
  return session.access_token;
}

// Expected validation and authorization failures are data, so production builds do not replace them with an opaque React error digest.
async function actionResult<T>(
  work: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues[0]?.message || "Controleer de ingevulde gegevens."
          : error instanceof Error
            ? error.message
            : "Dit is niet gelukt. Probeer opnieuw.",
    };
  }
}
export async function authenticate(
  ...args: Parameters<typeof authenticateImpl>
) {
  return actionResult(() => authenticateImpl(...args));
}
export async function signout(...args: Parameters<typeof signoutImpl>) {
  return actionResult(() => signoutImpl(...args));
}
export async function setupHousehold(
  ...args: Parameters<typeof setupHouseholdImpl>
) {
  return actionResult(() => setupHouseholdImpl(...args));
}
export async function invite(...args: Parameters<typeof inviteImpl>) {
  return actionResult(() => inviteImpl(...args));
}
export async function saveRecord(...args: Parameters<typeof saveRecordImpl>) {
  return actionResult(() => saveRecordImpl(...args));
}
export async function removeRecord(
  ...args: Parameters<typeof removeRecordImpl>
) {
  return actionResult(() => removeRecordImpl(...args));
}
export async function recordExpense(
  ...args: Parameters<typeof recordExpenseImpl>
) {
  return actionResult(() => recordExpenseImpl(...args));
}
export async function settle(...args: Parameters<typeof settleImpl>) {
  return actionResult(() => settleImpl(...args));
}
export async function reverseFinancial(
  ...args: Parameters<typeof reverseFinancialImpl>
) {
  return actionResult(() => reverseFinancialImpl(...args));
}
export async function completeMaintenance(
  ...args: Parameters<typeof completeMaintenanceImpl>
) {
  return actionResult(() => completeMaintenanceImpl(...args));
}
export async function convertIdea(...args: Parameters<typeof convertIdeaImpl>) {
  return actionResult(() => convertIdeaImpl(...args));
}
export async function addChild(...args: Parameters<typeof addChildImpl>) {
  return actionResult(() => addChildImpl(...args));
}
export async function toggleChild(...args: Parameters<typeof toggleChildImpl>) {
  return actionResult(() => toggleChildImpl(...args));
}
export async function uploadFile(...args: Parameters<typeof uploadFileImpl>) {
  return actionResult(() => uploadFileImpl(...args));
}
export async function fileURL(...args: Parameters<typeof fileURLImpl>) {
  return actionResult(() => fileURLImpl(...args));
}
export async function linkPurchase(
  ...args: Parameters<typeof linkPurchaseImpl>
) {
  return actionResult(() => linkPurchaseImpl(...args));
}
export async function deleteDocument(
  ...args: Parameters<typeof deleteDocumentImpl>
) {
  return actionResult(() => deleteDocumentImpl(...args));
}
export async function realtimeToken(
  ...args: Parameters<typeof realtimeTokenImpl>
) {
  return actionResult(() => realtimeTokenImpl(...args));
}

export async function addShoppingItem(
  householdId: string,
  title: string,
  quantity: string,
  store: string,
) {
  return actionResult(async () => {
    const item = z
      .object({
        title: z.string().trim().min(1, "Vul een product in.").max(120),
        quantity: z
          .string()
          .trim()
          .max(40)
          .regex(/^[0-9]*$/, "Vul bij aantal alleen cijfers in."),
        store: z.string().trim().max(80),
      })
      .parse({ title, quantity, store });
    id.parse(householdId);
    // Shopping policies enforce household membership and attribution on the write.
    const db = await supabase();
    const { error } = await db
      .from("shopping_items")
      .insert({ household_id: householdId, ...item });
    checked(error);
  });
}

export async function changeShoppingItem(
  householdId: string,
  itemId: string,
  version: number,
  done: boolean | null,
) {
  return actionResult(async () => {
    id.parse(itemId);
    z.number().int().positive().parse(version);
    z.boolean().nullable().parse(done);
    id.parse(householdId);
    // Shopping policies enforce household membership and attribution on the write.
    const db = await supabase();
    const table = db.from("shopping_items");
    const write = done === null ? table.delete() : table.update({ done });
    const { data, error } = await write
      .eq("household_id", householdId)
      .eq("id", itemId)
      .eq("version", version)
      .select("id")
      .maybeSingle();
    if (!error && !data)
      throw new Error("Dit product is ondertussen gewijzigd. Probeer opnieuw.");
    checked(error);
  });
}

const recipeIngredients = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(120, "Gebruik maximaal 120 tekens per ingrediënt."),
  )
  .min(1, "Vul minstens één ingrediënt in.")
  .max(50, "Gebruik maximaal 50 ingrediënten per recept.");

export async function saveShoppingRecipe(
  householdId: string,
  title: string,
  ingredients: string[],
  quantities: string[],
  portions: number,
  recipeId?: string,
) {
  return actionResult(async () => {
    const name = z
      .string()
      .trim()
      .min(1, "Vul een receptnaam in.")
      .max(120)
      .parse(title);
    const items = recipeIngredients.parse(ingredients);
    const amounts = z
      .array(z.string().trim().max(40))
      .length(items.length)
      .parse(quantities);
    recipeIngredients.parse(
      items.map((item, index) =>
        [amounts[index], item].filter(Boolean).join(" "),
      ),
    );
    const { db } = await member(householdId);
    const table = db.from("shopping_recipes");
    const fields = {
      title: name,
      ingredients: items,
      quantities: amounts,
      portions: z
        .number()
        .int()
        .min(1)
        .max(MAX_RECIPE_PORTIONS)
        .parse(portions),
    };
    if (recipeId) {
      const { data, error } = await table
        .update(fields)
        .eq("household_id", householdId)
        .eq("id", id.parse(recipeId))
        .select("id")
        .maybeSingle();
      if (!error && !data) throw new Error("Dit recept bestaat niet meer.");
      checked(error);
    } else {
      const { error } = await table.insert({
        household_id: householdId,
        ...fields,
      });
      checked(error);
    }
  });
}

export async function deleteShoppingRecipe(
  householdId: string,
  recipeId: string,
) {
  return actionResult(async () => {
    const { db } = await member(householdId);
    const { error } = await db
      .from("shopping_recipes")
      .delete()
      .eq("household_id", householdId)
      .eq("id", id.parse(recipeId));
    checked(error);
  });
}

export async function addRecipeToShopping(
  householdId: string,
  recipeId: string,
  portions?: number,
) {
  return actionResult(async () => {
    id.parse(recipeId);
    const { db } = await member(householdId);
    const { data: recipe, error: readError } = await db
      .from("shopping_recipes")
      .select("ingredients, quantities, portions")
      .eq("household_id", householdId)
      .eq("id", recipeId)
      .maybeSingle();
    if (readError || !recipe) throw new Error("Recept ophalen lukt niet.");
    const ingredients = recipeIngredients.parse(recipe.ingredients);
    const target = z
      .number()
      .int()
      .min(1)
      .max(MAX_RECIPE_PORTIONS)
      .parse(portions ?? recipe.portions);
    const titles = recipeIngredients.parse(
      ingredients.map((ingredient, index) => {
        const amount = scaleRecipeQuantity(
          recipe.quantities?.[index] ?? "",
          recipe.portions,
          target,
        );
        return [amount, ingredient].filter(Boolean).join(" ");
      }),
    );
    const { error } = await db
      .from("shopping_items")
      .insert(titles.map((title) => ({ household_id: householdId, title })));
    checked(error);
  });
}

export async function uploadProfilePhoto(householdId: string, form: FormData) {
  return actionResult(async () => {
    const { db, user } = await member(householdId);
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024)
      throw new Error("Kies een foto van maximaal 3 MB.");
    if (!validImageSignature(file, await fileSignature(file)))
      throw new Error("Kies een geldige JPG-, PNG- of WebP-afbeelding.");
    const { error } = await db.storage
      .from("profile-photos")
      .upload(`${householdId}/${user.id}`, file, {
        contentType: file.type,
        cacheControl: "0",
        upsert: true,
      });
    checked(error);
  });
}

export async function readTaskNotification(
  householdId: string,
  notificationId: string,
) {
  return actionResult(async () => {
    const { db, user } = await member(householdId);
    const { error } = await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id.parse(notificationId))
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .is("read_at", null);
    checked(error);
  });
}

export async function reorderRecords(
  h: string,
  entity: string,
  recordIds: string[],
  version: number,
) {
  return actionResult(async () => {
    z.enum(["rooms", "ideas", "projects", "wishlist_items"]).parse(entity);
    z.array(id)
      .min(1)
      .max(10000)
      .refine((ids) => new Set(ids).size === ids.length)
      .parse(recordIds);
    z.number().int().min(0).parse(version);
    const { db } = await member(h);
    const { error } = await db.rpc("reorder_records", {
      h,
      kind: entity,
      ordered_ids: recordIds,
      expected_version: version,
    });
    if (error?.message.includes("ondertussen"))
      throw new Error(
        "De volgorde is ondertussen gewijzigd. Vernieuw en probeer opnieuw.",
      );
    checked(error);
  });
}

export async function addProjectPhase(
  h: string,
  project: string,
  phase: string,
  title: string,
) {
  return actionResult(async () => {
    id.parse(project);
    id.parse(phase);
    const name = z
      .string()
      .trim()
      .min(1, "Vul een fase in.")
      .max(4000)
      .parse(title);
    const { db } = await member(h);
    const { error } = await db
      .from("project_phases")
      .insert({ id: phase, household_id: h, project_id: project, title: name });
    if (error?.code === "23505") {
      // Retrying a response that was lost must not create the phase twice.
      const existing = await db
        .from("project_phases")
        .select("id")
        .eq("id", phase)
        .eq("household_id", h)
        .eq("project_id", project)
        .eq("title", name)
        .maybeSingle();
      if (existing.error || !existing.data)
        throw new Error(
          "Deze fase is ondertussen gewijzigd. Vernieuw en probeer opnieuw.",
        );
      revalidatePath("/");
      return;
    }
    checked(error);
  });
}

export async function renameProjectPhase(
  h: string,
  project: string,
  phase: string,
  previousTitle: string,
  title: string,
) {
  return actionResult(async () => {
    id.parse(project);
    id.parse(phase);
    z.string().min(1).max(4000).parse(previousTitle);
    const name = z
      .string()
      .trim()
      .min(1, "Vul een fase in.")
      .max(4000)
      .parse(title);
    const { db } = await member(h);
    const { data, error } = await db
      .from("project_phases")
      .update({ title: name })
      .eq("household_id", h)
      .eq("project_id", project)
      .eq("id", phase)
      .eq("title", previousTitle)
      .select("id")
      .maybeSingle();
    checked(error);
    if (!data)
      throw new Error(
        "Deze fase is ondertussen gewijzigd. Vernieuw en probeer opnieuw.",
      );
  });
}
