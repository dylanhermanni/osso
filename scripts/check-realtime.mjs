import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http://127.0.0.1:"))
  throw new Error("This diagnostic requires the disposable local backend.");
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const { error: authError } = await db.auth.signUp({
  email: `realtime-${crypto.randomUUID()}@example.com`,
  password: "Local-e2e-House-2026!",
});
if (authError) throw new Error(authError.message);
const { data: h, error: hError } = await db.rpc("create_household", {
  house_name: "Realtime test",
  person_name: "Test",
});
if (hError) throw new Error(hError.message);
let received = false;
const channel = db.channel("diagnostic").on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "rooms",
    filter: `household_id=eq.${h}`,
  },
  () => {
    received = true;
    console.log("Database change received.");
  },
);
await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("Subscription timed out.")),
    15000,
  );
  channel.subscribe((status, error) => {
    console.log("Channel:", status, error?.message || "");
    if (status === "SUBSCRIBED") {
      clearTimeout(timer);
      resolve();
    }
    if (status === "CHANNEL_ERROR") {
      clearTimeout(timer);
      reject(new Error("Channel error."));
    }
  });
});
const { error } = await db
  .from("rooms")
  .insert({ household_id: h, title: "Realtime room" });
if (error) throw new Error(error.message);
console.log("Insert succeeded.");
await new Promise((resolve) => setTimeout(resolve, 8000));
await db.removeChannel(channel);
console.log("Realtime functional:", received);
if (!received) process.exitCode = 1;
