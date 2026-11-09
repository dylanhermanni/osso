import { supabase } from "./supabase/server";
import { configured } from "./supabase/config";
import {
  entities,
  emptyRecords,
  type Snapshot,
  type RecordData,
  type Member,
  type Child,
} from "./types";
export async function loadSnapshot(): Promise<Snapshot> {
  const data: Snapshot = {
    configured: configured(),
    user: null,
    household: null,
    members: [],
    records: emptyRecords(),
    payments: [],
    shares: [],
    settlements: [],
    activity: [],
    notifications: [],
    shopping: [],
    shoppingRecipes: [],
    children: {},
  };
  if (!data.configured) return data;
  const db = await supabase();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError")
    throw new Error("Inloggen controleren lukt niet. Probeer opnieuw.");
  if (!user) return data;
  data.user = { id: user.id, email: user.email };
  const { data: membership, error } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);
  if (error)
    throw new Error(
      "Database niet beschikbaar. Controleer of de migraties zijn uitgevoerd.",
    );
  const h = membership?.[0]?.household_id;
  if (!h) return data;
  async function rows(table: string) {
    const all: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: page, error } = await db
        .from(table)
        .select("*")
        .eq("household_id", h)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      all.push(...page);
      if (page.length < 500) break;
    }
    return all;
  }
  const results = await Promise.all([
    db
      .from("households")
      .select("id,name")
      .eq("id", h)
      .single()
      .then((r) => {
        if (r.error) throw r.error;
        data.household = r.data;
      }),
    db
      .from("household_members")
      .select("user_id,profiles(display_name)")
      .eq("household_id", h)
      .then((r) => {
        if (r.error) throw r.error;
        data.members = r.data as unknown as Member[];
      }),
    rows("record_orders").then((orders) => {
      data.orders = orders as unknown as Snapshot["orders"];
    }),
    rows("shopping_items").then((records) => {
      data.shopping = records as Snapshot["shopping"];
    }),
    rows("shopping_recipes").then((records) => {
      data.shoppingRecipes = records as Snapshot["shoppingRecipes"];
    }),
    rows("notifications").then((records) => {
      data.notifications = records as Snapshot["notifications"];
    }),
    ...entities.map((e) =>
      rows(e).then((records) => {
        data.records[e] = records as RecordData[];
      }),
    ),
    ...(
      [
        "expense_payments",
        "expense_shares",
        "settlements",
        "activity_log",
        "idea_comments",
        "task_subtasks",
        "project_phases",
        "maintenance_history",
        "room_photos",
        "idea_photos",
        "project_photos",
        "task_photos",
        "task_comments",
      ] as const
    ).map((e) =>
      rows(e).then((records) => {
        const r = { data: records };
        if (e === "expense_payments")
          data.payments = r.data as unknown as Snapshot["payments"];
        else if (e === "expense_shares")
          data.shares = r.data as unknown as Snapshot["shares"];
        else if (e === "settlements")
          data.settlements = r.data as unknown as Snapshot["settlements"];
        else if (e === "activity_log")
          data.activity = r.data as unknown as Snapshot["activity"];
        else data.children[e] = r.data as Child[];
      }),
    ),
  ]);
  void results;
  if (data.members.length) {
    const { data: photos } = await db.storage
      .from("profile-photos")
      .createSignedUrls(
        data.members.map((member) => `${h}/${member.user_id}`),
        3600,
      );
    const urls = new Map(
      photos
        ?.filter((photo) => !photo.error)
        .map((photo) => [photo.path, photo.signedUrl]),
    );
    for (const member of data.members)
      member.avatarUrl = urls.get(`${h}/${member.user_id}`) ?? undefined;
  }
  data.members.sort((a, b) =>
    a.profiles.display_name.localeCompare(b.profiles.display_name, "nl"),
  );
  // Financial UI uses signed amounts; database keeps positive amounts and an explicit refund link.
  const refunds = new Set(
    data.records.expenses.filter((e) => e.refund_of).map((e) => e.id),
  );
  data.records.expenses = data.records.expenses.map((e) =>
    refunds.has(e.id) ? { ...e, amount_cents: -(e.amount_cents || 0) } : e,
  );
  data.payments = data.payments.map((p) =>
    refunds.has(p.expense_id) ? { ...p, amount_cents: -p.amount_cents } : p,
  );
  data.shares = data.shares.map((s) =>
    refunds.has(s.expense_id) ? { ...s, amount_cents: -s.amount_cents } : s,
  );
  return data;
}
