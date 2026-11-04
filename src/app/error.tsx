"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal">
      <p className="eyebrow">CHEESE THE ROOSTER</p>
      <h1>Even geen verbinding.</h1>
      <p>
        We kunnen je huisgegevens niet laden. Controleer de
        Supabase-configuratie en migraties, of probeer opnieuw.
      </p>
      <Button onClick={reset}>Opnieuw proberen</Button>
    </main>
  );
}
