"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Member, RecordData } from "@/lib/types";
import { euro } from "@/lib/domain/finance";
export function FinanceChart({
  expenses,
  members,
  payments,
  total,
  budget,
  rooms = [],
  projects = [],
}: {
  expenses: RecordData[];
  members: Member[];
  payments: { expense_id: string; user_id: string; amount_cents: number }[];
  total: number;
  budget: number;
  rooms?: RecordData[];
  projects?: RecordData[];
}) {
  const [mode, setMode] = useState("Per maand");
  const group = new Map<string, number>();
  for (const e of [...expenses].sort((a, b) =>
    (a.expense_date || " ").localeCompare(b.expense_date || " "),
  )) {
    const key =
      mode === "Per maand"
        ? new Date(e.expense_date!).toLocaleDateString("nl-NL", {
            month: "short",
            year: "2-digit",
            timeZone: "Europe/Amsterdam",
          })
        : mode === "Per kamer"
          ? rooms.find((r) => r.id === e.room_id)?.title || "Hele huis"
          : mode === "Per project"
            ? projects.find((p) => p.id === e.project_id)?.title ||
              "Zonder project"
            : e.category || "Overig";
    group.set(key, (group.get(key) || 0) + (e.amount_cents || 0));
  }
  const points = [...group].map(([name, amount]) => ({ name, amount }));
  const ids = new Set(expenses.map((e) => e.id));
  return (
    <div className="finance-top">
      <section className="panel chart-panel">
        <div className="section-heading">
          <h2>Een blik op jullie uitgaven</h2>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            aria-label="Grafiekgroepering"
          >
            <option>Per maand</option>
            <option>Per categorie</option>
            <option>Per kamer</option>
            <option>Per project</option>
          </select>
        </div>
        <div className="chart-container">
          {points.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={points}
                margin={{ top: 15, right: 10, bottom: 0, left: 10 }}
              >
                <CartesianGrid vertical={false} stroke="#ece9e2" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v) => "€" + v / 100}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) => euro(Number(v))}
                  cursor={{ fill: "#f7f5f0" }}
                />
                <Bar
                  dataKey="amount"
                  name="Uitgaven"
                  fill="#77836C"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="small-empty">
              <WalletMark />
              <p>Jullie eerste uitgave vertelt het begin.</p>
            </div>
          )}
        </div>
      </section>
      <section className="panel finance-total">
        <p className="eyebrow">VOOR ONS THUIS</p>
        <h2>{euro(total)}</h2>
        <p>Totale gezamenlijke uitgaven</p>
        {members.map((m) => (
          <div className="list-row" key={m.user_id}>
            <span>{m.profiles.display_name} betaald</span>
            <strong>
              {euro(
                payments
                  .filter(
                    (p) => ids.has(p.expense_id) && p.user_id === m.user_id,
                  )
                  .reduce((n, p) => n + p.amount_cents, 0),
              )}
            </strong>
          </div>
        ))}
        {budget > 0 && (
          <>
            <div className="list-row">
              <span>Beschikbaar</span>
              <strong className={total > budget ? "over-budget" : ""}>
                {euro(budget - total)}
              </strong>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: Math.min((total / budget) * 100, 100) + "%",
                  background: total > budget ? "#b86950" : undefined,
                }}
              />
            </div>
            {total > budget && (
              <p className="over-budget">Jullie huisbudget is overschreden.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function WalletMark() {
  return <span className="empty-icon">€</span>;
}
