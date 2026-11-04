"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { validateCopyValue, type CopyRecord } from "@/lib/site-copy/core";
export async function saveSiteCopy(
  key: string,
  value: string | null,
  expectedVersion: number,
): Promise<{ ok: true; record: CopyRecord } | { ok: false; message: string }> {
  try {
    z.number().int().min(0).parse(expectedVersion);
    value = validateCopyValue(key, value);
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new Error("Log eerst in met je beheerdersaccount.");
    const permission = await db.rpc("is_content_admin");
    if (permission.data !== true)
      throw new Error("Je hebt geen toegang tot tekstbeheer.");
    const { data, error } = await db.rpc("save_site_copy", {
      copy_key: key,
      copy_value: value,
      expected_version: expectedVersion,
    });
    if (error)
      throw new Error(
        error.message.includes("COPY_CONFLICT")
          ? "Deze tekst is ondertussen gewijzigd. Vernieuw de pagina voordat je opnieuw opslaat."
          : "Opslaan is niet gelukt. Je wijziging staat nog in het tekstveld.",
      );
    revalidatePath("/", "layout");
    return { ok: true, record: data as CopyRecord };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Opslaan is niet gelukt.",
    };
  }
}
export async function loadCopyHistory(key: string) {
  const db = await supabase();
  const permission = await db.rpc("is_content_admin");
  if (permission.data !== true) return [];
  const { data } = await db
    .from("site_copy_history")
    .select("id,value,created_at")
    .eq("key", key)
    .order("created_at", { ascending: false })
    .limit(15);
  return (data || []) as {
    id: number;
    value: string | null;
    created_at: string;
  }[];
}
