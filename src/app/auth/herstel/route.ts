import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin;
  if (code) {
    try {
      const db = await supabase();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL("/wachtwoord-herstellen", origin));
    } catch {
      /* Invalid or expired links return to the request form. */
    }
  }
  return NextResponse.redirect(
    new URL("/wachtwoord-vergeten?error=link", origin),
  );
}
