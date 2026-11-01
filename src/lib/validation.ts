import { z } from "zod";
import { nl } from "zod/locales";
z.config(nl());
const text = z.string().trim().min(1, "Vul een titel in.").max(200);
const optionalText = z.string().trim().max(10000).optional();
const ref = z.uuid().nullable().optional();
const date = z.iso.date().nullable().optional();
const money = z.number().int().min(0).max(100000000);
const url = z
  .union([
    z.url().refine((v) => v.startsWith("https://"), "Gebruik een https-link."),
    z.literal(""),
  ])
  .optional();
const base = z.object({
  title: text,
  description: optionalText,
  room_id: ref,
  project_id: ref,
});
export const schemas = {
  suppliers: base.extend({
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z.string().max(40).optional(),
    url,
  }),
  rooms: z.object({
    title: text,
    description: optionalText,
    image_url: url,
    width_cm: z.number().int().positive().nullable().optional(),
    length_cm: z.number().int().positive().nullable().optional(),
    paint: optionalText,
    materials: optionalText,
    sort_order: z.number().int().min(0).optional(),
    status: z.enum(["Actief", "Gearchiveerd"]).optional(),
  }),
  ideas: base.extend({
    image_url: url,
    url,
    tags: z.array(z.string().max(40)).max(20).optional(),
    favorite: z.boolean().optional(),
    cost_cents: money.optional(),
    status: z
      .enum([
        "Nieuw",
        "Bespreken",
        "Goedgekeurd",
        "Voor later",
        "Afgewezen",
        "Uitgevoerd",
      ])
      .optional(),
  }),
  tasks: base.extend({
    assignee_id: ref,
    priority: z.enum(["Laag", "Normaal", "Hoog", "Urgent"]).optional(),
    status: z.enum(["Te doen", "Bezig", "Geblokkeerd", "Afgerond"]).optional(),
    due_date: date,
    duration_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  }),
  projects: base.omit({ project_id: true }).extend({
    image_url: url,
    status: z
      .enum(["Idee", "Gepland", "In uitvoering", "Gepauzeerd", "Afgerond"])
      .optional(),
    start_date: date,
    due_date: date,
    budget_cents: money.optional(),
  }),
  wishlist_items: base.extend({
    image_url: url,
    url,
    store: optionalText,
    price_cents: money.optional(),
    quantity: z.number().int().min(1).max(10000).optional(),
    priority: z.enum(["Laag", "Normaal", "Hoog", "Urgent"]).optional(),
    due_date: date,
    status: z
      .enum([
        "Gewenst",
        "Vergelijken",
        "Goedgekeurd",
        "Besteld",
        "Geleverd",
        "Geannuleerd",
      ])
      .optional(),
  }),
  calendar_events: base
    .extend({
      task_id: ref,
      starts_at: z.iso.datetime(),
      ends_at: z.iso.datetime(),
      category: z.enum([
        "Klusdag",
        "Levering",
        "Afspraak",
        "Deadline",
        "Onderhoud",
        "Mijlpaal",
        "Herinnering",
      ]),
    })
    .refine((x) => x.ends_at > x.starts_at, {
      message: "De eindtijd moet na de starttijd liggen.",
    }),
  maintenance_items: base.omit({ project_id: true }).extend({
    assignee_id: ref,
    category: optionalText,
    frequency_months: z.number().int().min(1).max(120),
    due_date: z.iso.date(),
    cost_cents: money.optional(),
  }),
  budgets: base.omit({ description: true }).extend({ amount_cents: money }),
  savings_goals: base
    .omit({ description: true })
    .extend({ amount_cents: money, saved_cents: money }),
};
export const expenseSchema = z.object({
  title: text,
  description: optionalText,
  amount_cents: money.positive(),
  expense_date: z.iso.date(),
  category: text,
  room_id: ref,
  project_id: ref,
});
export const allocationsSchema = z
  .array(z.object({ user_id: z.uuid(), amount_cents: money }))
  .min(1)
  .max(20)
  .refine(
    (a) => new Set(a.map((x) => x.user_id)).size === a.length,
    "Iedere betaler mag maar één keer voorkomen.",
  );
