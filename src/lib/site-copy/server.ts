import "server-only";
import { cache } from "react";
import { configured } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/server";
import { type CopyRecord, copyOverrides, translateCopy } from "./core";
export const loadSiteCopy = cache(async () => {
  const empty = {
    records: [] as CopyRecord[],
    canEdit: false,
    ready: false,
    signedIn: false,
  };
  if (!configured()) return empty;
  try {
    const db = await supabase();
    const [texts, permission, session] = await Promise.all([
      db.from("site_copy").select("key,value,version,updated_at"),
      db.rpc("is_content_admin"),
      db.auth.getUser(),
    ]);
    return {
      records: (texts.data || []) as CopyRecord[],
      canEdit: permission.data === true,
      ready: !texts.error && !permission.error,
      signedIn: Boolean(session.data.user),
    };
  } catch {
    return empty;
  }
});
export async function serverCopy(source: string) {
  const data = await loadSiteCopy();
  return translateCopy(source, copyOverrides(data.records));
}
