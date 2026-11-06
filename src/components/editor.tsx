"use client";
import { CopyScope } from "@/components/content-provider";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DateTime } from "luxon";
import { CalendarDays, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { saveRecord, recordExpense, uploadFile } from "@/lib/actions";
import { cents, splitCents, euro } from "@/lib/domain/finance";
import { localToISO, today, ZONE } from "@/lib/domain/dates";
import type { Entity, RecordData, Snapshot } from "@/lib/types";
export const labels: Record<Entity, string> = {
  rooms: "Kamer",
  ideas: "Idee",
  tasks: "Taak",
  projects: "Project",
  expenses: "Uitgave",
  wishlist_items: "Product",
  calendar_events: "Afspraak",
  maintenance_items: "Onderhoud",
  documents: "Document",
  budgets: "Budget",
  savings_goals: "Spaardoel",
  suppliers: "Leverancier",
};
export const statuses: Partial<Record<Entity, string[]>> = {
  rooms: ["Actief", "Gearchiveerd"],
  ideas: [
    "Nieuw",
    "Bespreken",
    "Goedgekeurd",
    "Voor later",
    "Afgewezen",
    "Uitgevoerd",
  ],
  tasks: ["Te doen", "Bezig", "Geblokkeerd", "Afgerond"],
  projects: ["Idee", "Gepland", "In uitvoering", "Gepauzeerd", "Afgerond"],
  wishlist_items: [
    "Gewenst",
    "Vergelijken",
    "Goedgekeurd",
    "Besteld",
    "Geleverd",
    "Geannuleerd",
  ],
};
const formSchema = z.object({
  title: z.string().trim().min(1, "Geef dit een naam.").max(200),
  description: z.string().max(10000),
});
type FormValues = z.infer<typeof formSchema>;
export function Editor({
  entity,
  record,
  data,
  onClose,
  onSaved,
  linkedRoom,
  linkedProject,
  purchase,
}: {
  entity: Entity;
  record?: RecordData;
  data: Snapshot;
  onClose: () => void;
  onSaved: (message: string) => void;
  linkedRoom?: string;
  linkedProject?: string;
  purchase?: RecordData;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(
    record?.amount_cents
      ? String(record.amount_cents / 100)
      : purchase
        ? String(((purchase.price_cents || 0) * (purchase.quantity || 1)) / 100)
        : "",
  );
  const [weights, setWeights] = useState("50/50");
  const [expenseKind, setExpenseKind] = useState("expense");
  const [requestId] = useState(() => crypto.randomUUID());
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: record?.title || purchase?.title || "",
      description: record?.description || "",
    },
  });
  const h = data.household?.id;
  const appointment = entity === "calendar_events";
  const canLink = !["rooms"].includes(entity);
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    setError("");
    try {
      if (!h)
        throw new Error(
          data.configured
            ? "Log in en maak een huishouden aan."
            : "Koppel eerst Supabase via de configuratie-instructies.",
        );
      const form = document.getElementById("entity-form") as HTMLFormElement;
      const f = new FormData(form);
      const str = (n: string) => String(f.get(n) || "");
      const nullable = (n: string) => str(n) || null;
      const money = (n: string) => cents(str(n) || "0");
      const input: Record<string, unknown> = { ...v };
      if (canLink) {
        input.room_id = nullable("room_id");
        if (entity !== "maintenance_items" && entity !== "projects")
          input.project_id = nullable("project_id");
      }
      if (
        statuses[entity] &&
        !(entity === "wishlist_items" && record?.expense_id)
      )
        input.status = str("status");
      if (["rooms", "ideas", "projects", "wishlist_items"].includes(entity))
        input.image_url = str("image_url");
      if (entity === "rooms")
        Object.assign(input, {
          width_cm: str("width_cm") ? Number(str("width_cm")) : null,
          length_cm: str("length_cm") ? Number(str("length_cm")) : null,
          paint: str("paint"),
          materials: str("materials"),
          sort_order: Number(str("sort_order") || 0),
        });
      if (entity === "suppliers")
        Object.assign(input, {
          email: str("email"),
          phone: str("phone"),
          url: str("url"),
        });
      if (entity === "ideas")
        Object.assign(input, {
          url: str("url"),
          tags: str("tags")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          cost_cents: money("cost"),
        });
      if (["tasks", "wishlist_items"].includes(entity))
        Object.assign(input, {
          priority: str("priority"),
          due_date: nullable("due_date"),
        });
      if (entity === "tasks")
        Object.assign(input, {
          assignee_id: nullable("assignee_id"),
          duration_minutes: str("duration_minutes")
            ? Number(str("duration_minutes"))
            : null,
        });
      if (entity === "projects")
        Object.assign(input, {
          start_date: nullable("start_date"),
          due_date: nullable("due_date"),
          budget_cents: money("budget"),
        });
      if (entity === "wishlist_items")
        Object.assign(input, {
          url: str("url"),
          store: str("store"),
          price_cents: money("price"),
          quantity: Number(str("quantity") || 1),
        });
      if (entity === "maintenance_items")
        Object.assign(input, {
          assignee_id: nullable("assignee_id"),
          category: str("category"),
          frequency_months: Number(str("frequency_months")),
          due_date: str("due_date"),
          cost_cents: money("cost"),
        });
      if (entity === "calendar_events")
        Object.assign(input, {
          starts_at: localToISO(str("starts_at")),
          ends_at: localToISO(str("ends_at")),
          category: str("category"),
          task_id: nullable("task_id"),
        });
      if (entity === "budgets" || entity === "savings_goals") {
        delete input.description;
        input.amount_cents = money("amount");
        if (entity === "savings_goals") input.saved_cents = money("saved");
      }
      if (entity === "expenses") {
        const amount = cents(total);
        if (amount <= 0)
          throw new Error("Het bedrag moet groter zijn dan nul.");
        const users = data.members.map((m) => m.user_id);
        const paid = users.map((user_id) => ({
          user_id,
          amount_cents: money(`paid_${user_id}`),
        }));
        let shares: number[];
        if (weights === "fixed") shares = users.map((u) => money(`share_${u}`));
        else if (weights === "personal")
          shares = users.map((u) => (u === str("personal_user") ? amount : 0));
        else if (weights === "custom") {
          const w = users.map((u) => Number(str(`weight_${u}`)));
          if (Math.abs(w.reduce((a, b) => a + b, 0) - 100) > 0.000001)
            throw new Error("De percentages moeten samen 100% zijn.");
          shares = splitCents(amount, w);
        } else {
          const [a, b] = weights.split("/").map(Number);
          shares = splitCents(
            amount,
            users.length === 2 ? [a, b] : users.map(() => 1),
          );
        }
        await recordExpense(
          h,
          {
            ...v,
            amount_cents: amount,
            expense_date: str("expense_date"),
            category: str("category"),
            room_id: nullable("room_id"),
            project_id: nullable("project_id"),
          },
          paid,
          users.map((u, i) => ({ user_id: u, amount_cents: shares[i] })),
          requestId,
          purchase?.id,
          expenseKind === "refund" ? str("refund_of") : undefined,
        );
      } else if (entity === "documents") await uploadFile(h, f);
      else await saveRecord(entity, h, input, record?.id, record?.version);
      onSaved(`${labels[entity]} ${record ? "bijgewerkt" : "toegevoegd"}.`);
      onClose();
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? e.issues[0]?.message || "Controleer de ingevulde gegevens."
          : e instanceof Error
            ? e.message
            : "Opslaan mislukt.",
      );
    } finally {
      setBusy(false);
    }
  });
  const descriptionField = (
    <label className="field">
      Omschrijving
      <textarea
        {...register("description")}
        rows={3}
        placeholder="Een paar details, een gedachte of een plan…"
      />
    </label>
  );
  const links = (
    <>
      {canLink && (
        <label className="field">
          Kamer
          <select
            name="room_id"
            defaultValue={
              record?.room_id || linkedRoom || purchase?.room_id || ""
            }
          >
            <option value="">Hele huis</option>
            {data.records.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {canLink && !["maintenance_items", "projects"].includes(entity) && (
        <label className="field">
          Project
          <select
            name="project_id"
            defaultValue={
              record?.project_id || linkedProject || purchase?.project_id || ""
            }
          >
            <option value="">Geen project</option>
            {data.records.projects.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
  const appointmentOptions = appointment ? (
    <>
      <label className="field">
        Soort afspraak
        <select name="category" defaultValue={record?.category || "Afspraak"}>
          {[
            "Klusdag",
            "Levering",
            "Afspraak",
            "Deadline",
            "Onderhoud",
            "Mijlpaal",
            "Herinnering",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Taak
        <select name="task_id" defaultValue={record?.task_id || ""}>
          <option value="">Geen taak</option>
          {data.records.tasks.map((t) => (
            <option value={t.id} key={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
    </>
  ) : null;
  return (
    <CopyScope>
      {
        <Dialog
          open
          editor
          onOpenChange={(v) => {
            if (!v && !busy) onClose();
          }}
          title={
            purchase
              ? "Aankoop registreren"
              : appointment
                ? record
                  ? "Afspraak bewerken"
                  : "Nieuwe afspraak"
                : `${record ? "Bewerk" : "Nieuw"} ${labels[entity].toLowerCase()}`
          }
          description={
            purchase
              ? "De aankoop en uitgave worden samen opgeslagen."
              : appointment
                ? "Geef je afspraak een naam en kies het tijdstip."
                : "Vul de gegevens in en sla op."
          }
        >
          <form id="entity-form" onSubmit={submit} className="editor-form">
            <label className="field">
              Naam
              <input
                {...register("title")}
                placeholder={
                  appointment
                    ? "Bijvoorbeeld: Samen eten"
                    : entity === "rooms"
                      ? "Bijvoorbeeld: Woonkamer"
                      : "Wat gaan we doen?"
                }
                autoFocus
              />
              {errors.title && (
                <span className="field-error">{errors.title.message}</span>
              )}
            </label>
            {appointment ? (
              <>
                <AppointmentTime record={record} />
                <details className="editor-options">
                  <summary>
                    <SlidersHorizontal size={17} /> Extra details{" "}
                    <ChevronDown size={17} />
                  </summary>
                  <div className="editor-options-body">
                    {descriptionField}
                    <div className="form-grid">
                      {links}
                      {appointmentOptions}
                    </div>
                  </div>
                </details>
              </>
            ) : (
              entity !== "documents" && descriptionField
            )}
            {!appointment && (
              <div className="form-grid">
                {links}
                {statuses[entity] && (
                  <label className="field">
                    Status
                    <select
                      name="status"
                      disabled={
                        entity === "wishlist_items" &&
                        Boolean(record?.expense_id)
                      }
                      defaultValue={record?.status || statuses[entity]![0]}
                    >
                      {entity === "wishlist_items" && record?.expense_id && (
                        <option>Gekocht</option>
                      )}
                      {statuses[entity]!.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                )}
                {["tasks", "maintenance_items"].includes(entity) && (
                  <label className="field">
                    Verantwoordelijke
                    <select
                      name="assignee_id"
                      defaultValue={record?.assignee_id || ""}
                    >
                      <option value="">Samen</option>
                      {data.members.map((m) => (
                        <option value={m.user_id} key={m.user_id}>
                          {m.profiles.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {["tasks", "wishlist_items"].includes(entity) && (
                  <label className="field">
                    Prioriteit
                    <select
                      name="priority"
                      defaultValue={record?.priority || "Normaal"}
                    >
                      {["Laag", "Normaal", "Hoog", "Urgent"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                )}
                {[
                  "tasks",
                  "projects",
                  "wishlist_items",
                  "maintenance_items",
                ].includes(entity) && (
                  <DateField
                    name="due_date"
                    label={
                      entity === "maintenance_items"
                        ? "Volgende uitvoering"
                        : "Streefdatum"
                    }
                    value={
                      record?.due_date ||
                      (entity === "maintenance_items" ? today() : null)
                    }
                    required={entity === "maintenance_items"}
                  />
                )}
                {entity === "projects" && (
                  <>
                    <DateField
                      name="start_date"
                      label="Startdatum"
                      value={record?.start_date}
                    />
                    <Field
                      name="budget"
                      label="Budget (€)"
                      value={(record?.budget_cents || 0) / 100}
                    />
                  </>
                )}
                {entity === "tasks" && (
                  <Field
                    name="duration_minutes"
                    label="Geschatte tijd (minuten)"
                    type="number"
                    value={record?.duration_minutes}
                  />
                )}
                {entity === "rooms" && (
                  <>
                    <Field
                      name="width_cm"
                      label="Breedte (cm)"
                      type="number"
                      value={record?.width_cm}
                    />
                    <Field
                      name="length_cm"
                      label="Lengte (cm)"
                      type="number"
                      value={record?.length_cm}
                    />
                    <Field
                      name="paint"
                      label="Verfkleuren"
                      value={record?.paint}
                    />
                    <Field
                      name="materials"
                      label="Materialen"
                      value={record?.materials}
                    />
                    <Field
                      name="sort_order"
                      label="Volgorde"
                      type="number"
                      value={record?.sort_order || 0}
                    />
                  </>
                )}
                {entity === "ideas" && (
                  <>
                    <Field
                      name="cost"
                      label="Kostenindicatie (€)"
                      value={(record?.cost_cents || 0) / 100}
                    />
                    <Field
                      name="tags"
                      label="Tags (gescheiden door komma's)"
                      value={record?.tags?.join(", ")}
                    />
                  </>
                )}
                {entity === "suppliers" && (
                  <>
                    <Field
                      name="email"
                      label="E-mailadres"
                      type="email"
                      value={record?.email}
                    />
                    <Field
                      name="phone"
                      label="Telefoon"
                      type="tel"
                      value={record?.phone}
                    />
                  </>
                )}
                {["ideas", "wishlist_items", "suppliers"].includes(entity) && (
                  <Field
                    name="url"
                    label="Website of productlink"
                    type="url"
                    value={record?.url}
                  />
                )}
                {entity === "wishlist_items" && (
                  <>
                    <Field name="store" label="Winkel" value={record?.store} />
                    <Field
                      name="price"
                      label="Prijs per stuk (€)"
                      value={(record?.price_cents || 0) / 100}
                    />
                    <Field
                      name="quantity"
                      label="Aantal"
                      type="number"
                      value={record?.quantity || 1}
                    />
                  </>
                )}
                {entity === "maintenance_items" && (
                  <>
                    <Field
                      name="frequency_months"
                      label="Herhalen iedere … maanden"
                      type="number"
                      value={record?.frequency_months || 12}
                      required
                    />
                    <Field
                      name="cost"
                      label="Geschatte kosten (€)"
                      value={(record?.cost_cents || 0) / 100}
                    />
                    <Field
                      name="category"
                      label="Categorie"
                      value={record?.category || "Algemeen"}
                    />
                  </>
                )}
                {["budgets", "savings_goals"].includes(entity) && (
                  <Field
                    name="amount"
                    label="Doelbedrag (€)"
                    value={(record?.amount_cents || 0) / 100}
                  />
                )}
                {entity === "savings_goals" && (
                  <Field
                    name="saved"
                    label="Al gespaard (€)"
                    value={(record?.saved_cents || 0) / 100}
                  />
                )}
              </div>
            )}
            {["rooms", "ideas", "projects", "wishlist_items"].includes(
              entity,
            ) && (
              <Field
                name="image_url"
                label="Omslagfoto (https-link, optioneel)"
                type="url"
                value={record?.image_url || ""}
              />
            )}
            {entity === "expenses" && (
              <>
                {!purchase && (
                  <label className="field">
                    Soort registratie
                    <select
                      value={expenseKind}
                      onChange={(e) => setExpenseKind(e.target.value)}
                    >
                      <option value="expense">Uitgave</option>
                      <option value="refund">
                        Terugbetaling van een winkel
                      </option>
                    </select>
                  </label>
                )}
                {expenseKind === "refund" && (
                  <label className="field">
                    Oorspronkelijke uitgave
                    <select name="refund_of" required>
                      <option value="">Kies de uitgave</option>
                      {data.records.expenses
                        .filter((e) => !e.reversed_at && !e.refund_of)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title} · {euro(e.amount_cents || 0)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="form-grid">
                  <label className="field">
                    Totaalbedrag (€)
                    <input
                      name="total"
                      value={total}
                      onChange={(e) => setTotal(e.target.value)}
                      required
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                  </label>
                  <DateField
                    name="expense_date"
                    label="Datum"
                    value={today()}
                    required
                  />
                  <Field
                    name="category"
                    label="Categorie"
                    value="Inrichting"
                    required
                  />
                </div>
                <div className="form-section">
                  <h3>
                    {expenseKind === "refund"
                      ? "Wie heeft het geld teruggekregen?"
                      : "Wie heeft betaald?"}
                  </h3>
                  <p>
                    Meerdere betalers? Vul per persoon het betaalde bedrag in.
                  </p>
                  <div className="form-grid">
                    {data.members.map((m, i) => (
                      <Field
                        key={m.user_id}
                        name={`paid_${m.user_id}`}
                        label={`${m.profiles.display_name} (€)`}
                        value={i === 0 ? total : "0"}
                      />
                    ))}
                  </div>
                </div>
                <label className="field">
                  Hoe verdelen jullie de kosten?
                  <select
                    value={weights}
                    onChange={(e) => setWeights(e.target.value)}
                  >
                    <option value="50/50">Gelijk verdelen</option>
                    {data.members.length === 2 && (
                      <>
                        <option value="60/40">
                          60 / 40 — in onderstaande volgorde
                        </option>
                        <option value="70/30">
                          70 / 30 — in onderstaande volgorde
                        </option>
                      </>
                    )}
                    <option value="custom">Eigen percentages</option>
                    <option value="fixed">Vaste bedragen</option>
                    <option value="personal">Persoonlijke uitgave</option>
                  </select>
                </label>
                <p className="form-hint">
                  Volgorde:{" "}
                  {data.members.map((m) => m.profiles.display_name).join(" / ")}
                  . Afronding wordt exact in centen verdeeld.
                </p>
                {["fixed", "custom"].includes(weights) && (
                  <div className="form-grid">
                    {data.members.map((m) => (
                      <Field
                        key={m.user_id}
                        name={`${weights === "fixed" ? "share" : "weight"}_${m.user_id}`}
                        label={`${m.profiles.display_name} (${weights === "fixed" ? "€" : "%"})`}
                        value={
                          weights === "custom" ? 100 / data.members.length : 0
                        }
                      />
                    ))}
                  </div>
                )}
                {weights === "personal" && (
                  <label className="field">
                    Voor wie?
                    <select name="personal_user">
                      {data.members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.profiles.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {entity === "documents" && (
              <>
                <label className="field">
                  Bestand
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                  />
                </label>
                <Field name="category" label="Categorie" value="Document" />
                <p className="form-hint">
                  JPG, PNG, WebP of PDF · maximaal 3 MB · privé opgeslagen.
                </p>
              </>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-footer">
              <Button
                variant="ghost"
                type="button"
                onClick={onClose}
                disabled={busy}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Opslaan…"
                  : purchase
                    ? `Aankoop opslaan${
                        total
                          ? " · " +
                            (() => {
                              try {
                                return euro(cents(total));
                              } catch {
                                return "";
                              }
                            })()
                          : ""
                      }`
                    : "Opslaan"}
              </Button>
            </div>
          </form>
        </Dialog>
      }
    </CopyScope>
  );
}

function AppointmentTime({ record }: { record?: RecordData }) {
  const format = "yyyy-MM-dd'T'HH:mm";
  const [start] = useState(() =>
    record?.starts_at
      ? DateTime.fromISO(record.starts_at).setZone(ZONE)
      : DateTime.now().setZone(ZONE).plus({ hours: 1 }).startOf("hour"),
  );
  const [end, setEnd] = useState(() =>
    record?.ends_at
      ? DateTime.fromISO(record.ends_at).setZone(ZONE).toFormat(format)
      : start.plus({ hours: 1 }).toFormat(format),
  );
  const [endEdited, setEndEdited] = useState(false);

  return (
    <fieldset className="appointment-time">
      <legend>
        <CalendarDays size={17} /> Datum en tijd
      </legend>
      <div className="form-grid">
        <label className="field">
          Begint (Amsterdam)
          <input
            name="starts_at"
            type="datetime-local"
            defaultValue={start.toFormat(format)}
            required
            onInput={(event) => {
              if (record || endEdited) return;
              const nextStart = DateTime.fromISO(event.currentTarget.value, {
                zone: ZONE,
              });
              if (nextStart.isValid)
                setEnd(nextStart.plus({ hours: 1 }).toFormat(format));
            }}
          />
        </label>
        <label className="field">
          Eindigt (Amsterdam)
          <input
            name="ends_at"
            type="datetime-local"
            value={end}
            required
            onInput={(event) => {
              setEndEdited(true);
              setEnd(event.currentTarget.value);
            }}
          />
        </label>
      </div>
    </fieldset>
  );
}

const Field = ({
  name,
  label,
  type = "text",
  value,
  required = false,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  step?: string;
}) => (
  <label className="field">
    {label}
    <input
      name={name}
      type={type}
      defaultValue={value}
      required={required}
      step={step}
      min={["number"].includes(type) ? 0 : undefined}
    />
  </label>
);
const DateField = ({
  name,
  label,
  value,
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) => (
  <Field
    name={name}
    label={label}
    type="date"
    value={value || undefined}
    required={required}
  />
);
