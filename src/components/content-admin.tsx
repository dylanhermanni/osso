"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Search,
  Save,
  RotateCcw,
  History,
  Check,
} from "lucide-react";
import { useSiteContent } from "./content-provider";
import { catalog, type CopyEntry } from "@/lib/site-copy/core";
import { saveSiteCopy, loadCopyHistory } from "@/app/admin/teksten/actions";

export function ContentAdmin() {
  const { records, replaceRecords } = useSiteContent();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [selected, setSelected] = useState(
    catalog.find((entry) => entry.source === "Hé, wat pakken we aan?") ||
      catalog[0],
  );
  const stored = records.find((record) => record.key === selected.key);
  const current = stored?.value ?? selected.source;
  const [draft, setDraft] = useState(current);
  const [baseValue, setBaseValue] = useState(current);
  const [baseVersion, setBaseVersion] = useState(stored?.version || 0);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<
    { id: number; value: string | null; created_at: string }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const dirty = draft !== baseValue;
  const modified = records.filter((record) => record.value !== null).length;
  const groups = useMemo(
    () => [...new Set(catalog.flatMap((entry) => entry.groups))].sort(),
    [],
  );
  const filtered = useMemo(
    () =>
      catalog.filter(
        (entry) =>
          (!group || entry.groups.includes(group)) &&
          (!changedOnly ||
            records.some(
              (record) => record.key === entry.key && record.value !== null,
            )) &&
          `${entry.source} ${records.find((record) => record.key === entry.key)?.value || ""}`
            .toLocaleLowerCase("nl")
            .includes(query.toLocaleLowerCase("nl")),
      ),
    [group, changedOnly, query, records],
  );
  useEffect(() => {
    let active = true;
    loadCopyHistory(selected.key)
      .then((rows) => {
        if (active) {
          setHistory(rows);
          setHistoryLoading(false);
        }
      })
      .catch(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected.key, stored?.version]);
  function select(entry: CopyEntry) {
    if (
      dirty &&
      !window.confirm(
        "Je hebt nog niet opgeslagen. Wil je deze wijziging loslaten?",
      )
    )
      return;
    setHistoryLoading(true);
    setSelected(entry);
    setBaseValue(
      records.find((record) => record.key === entry.key)?.value ?? entry.source,
    );
    setBaseVersion(
      records.find((record) => record.key === entry.key)?.version || 0,
    );
    setDraft(
      records.find((record) => record.key === entry.key)?.value ?? entry.source,
    );
    setMessage("");
  }
  function save(reset = false) {
    if (pending) return;
    if (
      reset &&
      !window.confirm(
        "Deze tekst terugzetten naar de standaardtekst? Je kunt je vorige versie later terughalen.",
      )
    )
      return;
    const key = selected.key;
    const value = reset || draft === selected.source ? null : draft;
    setMessage("");
    startTransition(async () => {
      const result = await saveSiteCopy(key, value, baseVersion).catch(() => ({
        ok: false as const,
        message:
          "De verbinding is weggevallen. Je concept staat nog in het tekstveld. Probeer opnieuw.",
      }));
      if (!result.ok) {
        setFailed(true);
        setMessage(result.message);
        return;
      }
      setHistoryLoading(true);
      replaceRecords((previous) => [
        ...previous.filter((record) => record.key !== key),
        result.record,
      ]);
      setBaseValue(result.record.value ?? selected.source);
      setBaseVersion(result.record.version);
      setDraft(result.record.value ?? selected.source);
      setFailed(false);
      setMessage(
        reset
          ? "Standaardtekst hersteld."
          : "Opgeslagen. Deze tekst staat nu op de website.",
      );
    });
  }
  return (
    <div
      className="copy-admin"
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          if (dirty) save();
        }
      }}
    >
      <header className="copy-admin-header">
        <Link href="/" className="copy-admin-brand">
          <Image
            src="/cheese-the-rooster-logo.webp"
            width={38}
            height={38}
            alt=""
          />
          <span>
            Cheese the Rooster<small>Tekstbeheer</small>
          </span>
        </Link>
        <a
          className="button button-outline"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bekijk website <ExternalLink size={15} />
        </a>
      </header>
      <main className="copy-admin-main">
        <Link className="text-link" href="/">
          <ArrowLeft size={15} /> Terug naar je huis
        </Link>
        <div className="copy-admin-intro">
          <div>
            <p className="eyebrow">MAAK HET VAN JULLIE</p>
            <h1>Jouw woorden, jullie website.</h1>
            <p>
              Zoek een tekst, pas hem aan en sla op. De wijziging geldt voor
              iedereen die de website bezoekt.
            </p>
          </div>
          <span>
            {catalog.length} teksten · {modified} aangepast
          </span>
        </div>
        <div className="copy-admin-tools">
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek bijvoorbeeld ‘kamer’, ‘toevoegen’ of ‘welkom’"
              aria-label="Zoeken in alle websiteteksten"
            />
          </label>
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            aria-label="Filter op onderdeel"
          >
            <option value="">Alle onderdelen</option>
            {groups.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <label className="copy-changed-toggle">
            <input
              type="checkbox"
              checked={changedOnly}
              onChange={(event) => setChangedOnly(event.target.checked)}
            />{" "}
            Alleen aangepaste teksten
          </label>
        </div>
        <div className="copy-admin-grid">
          <section className="copy-catalog" aria-label="Websiteteksten">
            <div className="copy-catalog-count" aria-live="polite">
              {filtered.length}{" "}
              {filtered.length === 1 ? "tekst gevonden" : "teksten gevonden"}
            </div>
            <div className="copy-catalog-list">
              {filtered.map((entry) => {
                const record = records.find((item) => item.key === entry.key);
                return (
                  <button
                    key={entry.key}
                    className={
                      selected.key === entry.key
                        ? "copy-catalog-item selected"
                        : "copy-catalog-item"
                    }
                    onClick={() => select(entry)}
                    disabled={pending}
                    aria-pressed={selected.key === entry.key}
                  >
                    <span>{record?.value ?? entry.source}</span>
                    <small>
                      {entry.groups.join(" · ")}
                      {record?.value !== undefined && record.value !== null && (
                        <span className="copy-edited">
                          <Check size={11} /> Aangepast
                        </span>
                      )}
                    </small>
                  </button>
                );
              })}
              {!filtered.length && (
                <p className="small-empty">
                  Geen tekst gevonden. Probeer een korter zoekwoord of een ander
                  onderdeel.
                </p>
              )}
            </div>
          </section>
          <section className="copy-edit-panel" aria-label="Geselecteerde tekst">
            <div className="copy-edit-heading">
              <h2>Tekst aanpassen</h2>
              <span className="copy-dirty">
                {pending
                  ? "Bezig met opslaan…"
                  : dirty
                    ? "Nog niet opgeslagen"
                    : stored?.value !== undefined && stored.value !== null
                      ? "Eigen tekst"
                      : "Standaardtekst"}
              </span>
            </div>
            <p className="copy-group">{selected.groups.join(" · ")}</p>
            <label className="copy-field">
              Standaardtekst
              <div className="copy-original">{selected.source}</div>
            </label>
            <label className="copy-field" htmlFor="copy-draft">
              Jouw tekst
              <textarea
                id="copy-draft"
                rows={5}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setMessage("");
                }}
                maxLength={5000}
                disabled={pending}
              />
            </label>
            <div className="copy-field-help">
              <span>
                {selected.template
                  ? "Laat invulvelden zoals {1} staan; de website vult ze automatisch in."
                  : "Gewone tekst. Opmaakcode wordt als tekst getoond."}
              </span>
              <span>{draft.length}/5.000</span>
            </div>
            <div className="copy-preview">
              <p className="eyebrow">VOORBEELD</p>
              <p>{draft || "Je tekst verschijnt hier."}</p>
            </div>
            <div className="copy-actions">
              <button
                className="button button-primary"
                disabled={pending || !dirty || !draft.trim()}
                onClick={() => save()}
              >
                <Save size={16} /> Opslaan
              </button>
              <button
                className="button button-outline"
                disabled={pending || (!dirty && !stored?.value)}
                onClick={() => save(true)}
              >
                <RotateCcw size={15} /> Standaard herstellen
              </button>
            </div>
            <p
              className={failed ? "copy-message copy-error" : "copy-message"}
              role={failed ? "alert" : "status"}
              aria-live="polite"
            >
              {message ||
                (dirty
                  ? "Je ziet hierboven je concept. Opslaan publiceert de tekst."
                  : "Tip: dezelfde tekst wordt overal op de website tegelijk aangepast.")}
            </p>
            <details className="copy-history">
              <summary>
                <History size={16} /> Vorige versies ({history.length})
              </summary>
              {historyLoading ? (
                <p>Laden…</p>
              ) : history.length ? (
                history.map((row) => (
                  <div className="copy-history-row" key={row.id}>
                    <div>
                      <small>
                        {new Intl.DateTimeFormat("nl-NL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Europe/Amsterdam",
                        }).format(new Date(row.created_at))}
                      </small>
                      <p>{row.value ?? "Standaardtekst hersteld"}</p>
                    </div>
                    <button
                      className="button button-outline button-sm"
                      disabled={pending}
                      onClick={() => setDraft(row.value ?? selected.source)}
                    >
                      Gebruik versie
                    </button>
                  </div>
                ))
              ) : (
                <p>
                  Nog geen wijzigingen. Na het opslaan komt hier je
                  geschiedenis.
                </p>
              )}
            </details>
          </section>
        </div>
      </main>
    </div>
  );
}
