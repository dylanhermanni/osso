"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useSiteContent } from "./content-provider";
import { catalogByKey } from "@/lib/site-copy/core";
import { saveSiteCopy } from "@/app/admin/teksten/actions";
import { authenticate } from "@/app/actions";

export function ContentTools() {
  const { canEdit, editing, setEditing, selectedKey, selectKey } =
    useSiteContent();
  return (
    <>
      {canEdit ? (
        <button
          className="button button-outline button-sm copy-mode-button"
          onClick={() => setEditing(!editing)}
          aria-pressed={editing}
        >
          {editing ? <Check size={15} /> : <Pencil size={15} />}
          {editing ? "Klaar met bewerken" : "Teksten aanpassen"}
        </button>
      ) : (
        <Link
          className="button button-outline button-sm copy-mode-button"
          href="/admin/teksten"
        >
          <Pencil size={15} />
          Teksten aanpassen
        </Link>
      )}
      {editing && (
        <aside className="copy-edit-bar" aria-label="Tekstbewerking">
          <span>Klik op een tekst op deze pagina om hem aan te passen.</span>
          <Link href="/admin/teksten">Alle teksten, knoppen en meldingen</Link>
          <button onClick={() => setEditing(false)}>Klaar</button>
        </aside>
      )}
      {canEdit && selectedKey && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) selectKey(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content">
              <div className="dialog-header">
                <div>
                  <Dialog.Title>Tekst aanpassen</Dialog.Title>
                  <Dialog.Description>
                    Opslaan wijzigt deze tekst op de website.
                  </Dialog.Description>
                </div>
                <Dialog.Close className="icon-button" aria-label="Sluiten">
                  <X size={20} />
                </Dialog.Close>
              </div>
              <InlineTextEditor key={selectedKey} copyKey={selectedKey} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}

function InlineTextEditor({ copyKey }: { copyKey: string }) {
  const { records, replaceRecords, selectKey } = useSiteContent();
  const entry = catalogByKey.get(copyKey)!;
  const stored = records.find((record) => record.key === copyKey);
  const [version, setVersion] = useState(stored?.version || 0);
  const [draft, setDraft] = useState(stored?.value ?? entry.source);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="editor-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const result = await saveSiteCopy(
            copyKey,
            draft === entry.source ? null : draft,
            version,
          );
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          replaceRecords((previous) => [
            ...previous.filter((record) => record.key !== copyKey),
            result.record,
          ]);
          setVersion(result.record.version);
          selectKey(null);
        } catch {
          setMessage(
            "Opslaan mislukt. Je tekst staat nog in het veld. Probeer opnieuw.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        Jouw tekst
        <textarea
          autoFocus
          rows={5}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={5000}
          disabled={busy}
        />
      </label>
      {entry.template && (
        <p className="form-hint">
          Laat invulvelden zoals {"{1}"} staan; de website vult ze automatisch
          in.
        </p>
      )}
      <p className="form-hint">Standaard: {entry.source}</p>
      {message && <p role="alert">{message}</p>}
      <button
        className="button button-primary"
        type="submit"
        disabled={busy || !draft.trim()}
      >
        {busy ? "Opslaan…" : "Opslaan"}
      </button>
    </form>
  );
}

export function ContentLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="editor-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          await authenticate(
            "login",
            String(values.get("email")),
            String(values.get("password")),
          );
          router.refresh();
        } catch {
          setError(
            "Inloggen mislukt. Controleer je e-mailadres en wachtwoord.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        E-mailadres
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        Wachtwoord
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="button button-primary" disabled={busy}>
        {busy ? "Inloggen…" : "Inloggen voor tekstbeheer"}
      </button>
      <Link href="/wachtwoord-vergeten">Wachtwoord vergeten?</Link>
    </form>
  );
}
