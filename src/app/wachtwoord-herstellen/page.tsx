import { PasswordRecovery } from "@/components/password-recovery";
import { supabase } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  let valid = false;
  try {
    const db = await supabase();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    valid = !!user && !error;
  } catch {
    /* Show a fresh link request when not configured. */
  }
  return <PasswordRecovery reset valid={valid} />;
}
