"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";

export async function requestPasswordReset(email: string) {
  if (!z.email().max(254).safeParse(email).success)
    return { error: "Vul een geldig e-mailadres in." };
  try {
    const db = await supabase();
    const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin;
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/herstel`,
    });
    if (error)
      return {
        error:
          "De resetmail kon niet worden verstuurd. Probeer later opnieuw of laat de mailinstellingen controleren.",
      };
    return { ok: true };
  } catch {
    return {
      error:
        "De resetmail kon niet worden verstuurd. Probeer later opnieuw of laat de mailinstellingen controleren.",
    };
  }
}

export async function changePassword(password: string, confirmation: string) {
  if (!z.string().min(10).max(128).safeParse(password).success)
    return { error: "Gebruik een wachtwoord van 10 tot 128 tekens." };
  if (password !== confirmation)
    return { error: "De wachtwoorden komen niet overeen." };
  try {
    const db = await supabase();
    const {
      data: { user },
      error: sessionError,
    } = await db.auth.getUser();
    if (sessionError || !user)
      return {
        error: "Je herstellink is verlopen. Vraag een nieuwe resetmail aan.",
      };
    const { error } = await db.auth.updateUser({ password });
    if (error)
      return {
        error:
          "Wachtwoord opslaan mislukt. Kies een ander wachtwoord of vraag een nieuwe resetmail aan.",
      };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { error: "Wachtwoord opslaan mislukt. Probeer opnieuw." };
  }
}
