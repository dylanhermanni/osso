"use client";
import { useState } from "react";
import Link from "next/link";
import { CopyScope } from "./content-provider";
import { Button } from "./ui/button";
import { changePassword, requestPasswordReset } from "@/app/password-actions";

export function PasswordRecovery({
  reset = false,
  valid = true,
  invalidLink = false,
}: {
  reset?: boolean;
  valid?: boolean;
  invalidLink?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <CopyScope>
      <main className="copy-access recovery-page">
        <Link href="/" className="eyebrow">
          Cheese the Rooster
        </Link>
        <h1>{reset ? "Nieuw wachtwoord" : "Wachtwoord vergeten?"}</h1>
        {sent ? (
          <div role="status">
            <p>
              {reset
                ? "Je nieuwe wachtwoord is opgeslagen. Je bent ingelogd."
                : "Als dit e-mailadres bij een account hoort, ontvang je een resetmail. Controleer ook je spammap en open de link in deze browser."}
            </p>
            <Link
              className="button button-primary"
              href={reset ? "/admin/teksten" : "/"}
            >
              {reset ? "Naar tekstbeheer" : "Naar de website"}
            </Link>
          </div>
        ) : reset && !valid ? (
          <>
            <p>
              Deze herstellink is verlopen of ongeldig. Vraag een nieuwe
              resetmail aan.
            </p>
            <Link href="/wachtwoord-vergeten">Nieuwe resetmail aanvragen</Link>
          </>
        ) : (
          <>
            <p>
              {reset
                ? "Kies een nieuw wachtwoord van minimaal 10 tekens."
                : "Vul het e-mailadres van je account in. Je ontvangt een link om zelf een nieuw wachtwoord te kiezen."}
            </p>
            {invalidLink && (
              <p role="alert">
                Deze herstellink is verlopen of ongeldig. Vraag hieronder een
                nieuwe aan.
              </p>
            )}
            <form
              className="editor-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const result = reset
                    ? await changePassword(
                        String(values.get("password")),
                        String(values.get("confirmation")),
                      )
                    : await requestPasswordReset(
                        String(values.get("email")).trim(),
                      );
                  if (result.error) setError(result.error);
                  else setSent(true);
                } catch {
                  setError("Verbinding mislukt. Probeer opnieuw.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {reset ? (
                <>
                  <label className="field">
                    Nieuw wachtwoord
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      required
                    />
                  </label>
                  <label className="field">
                    Herhaal nieuw wachtwoord
                    <input
                      name="confirmation"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      required
                    />
                  </label>
                </>
              ) : (
                <label className="field">
                  E-mailadres
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Even geduld…"
                  : reset
                    ? "Wachtwoord opslaan"
                    : "Resetmail versturen"}
              </Button>
            </form>
            <Link href="/">Terug naar de website</Link>
          </>
        )}
      </main>
    </CopyScope>
  );
}
