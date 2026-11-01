import { describe, it, expect } from "vitest";
import { cents, splitCents, balance } from "../src/lib/domain/finance";
import { localToISO, nextMaintenance } from "../src/lib/domain/dates";
import {
  schemas,
  expenseSchema,
  allocationsSchema,
} from "../src/lib/validation";
describe("exacte centbedragen", () => {
  it.each([
    ["0,01", 1],
    ["25.5", 2550],
    ["999.99", 99999],
    ["1", 100],
  ])("zet %s om zonder float-afronding", (v, n) => expect(cents(v)).toBe(n));
  it.each(["-1", "1.001", "1e3", "Infinity", "NaN", "1,2,3", "", "1000001"])(
    "weigert %s",
    (v) => expect(() => cents(v)).toThrow(),
  );
  it("verdeelt oneven centen deterministisch", () => {
    expect(splitCents(101, [50, 50])).toEqual([51, 50]);
    expect(splitCents(101, [60, 40])).toEqual([61, 40]);
    expect(splitCents(101, [70, 30])).toEqual([71, 30]);
  });
  it("bewaart de som bij alle kleine bedragen en aandelen", () => {
    for (let total = 0; total < 1000; total++) {
      const s = splitCents(total, [12, 33, 55]);
      expect(s.reduce((a, b) => a + b, 0)).toBe(total);
      expect(s.every(Number.isInteger)).toBe(true);
    }
  });
  it("ondersteunt persoonlijke uitgaven", () =>
    expect(splitCents(923, [0, 100])).toEqual([0, 923]));
  it("weigert ongeldige gewichten", () => {
    for (const w of [[], [0, 0], [-1, 2], [NaN, 2]])
      expect(() => splitCents(100, w)).toThrow();
  });
  it("verrekening neutraliseert schuld zonder een nieuwe uitgave", () => {
    const p = [{ user_id: "D", amount_cents: 1001 }],
      s = [
        { user_id: "D", amount_cents: 501 },
        { user_id: "F", amount_cents: 500 },
      ];
    expect(balance("D", p, s, [])).toBe(500);
    expect(balance("F", p, s, [])).toBe(-500);
    const settled = [{ from_user: "F", to_user: "D", amount_cents: 500 }];
    expect(balance("D", p, s, settled)).toBe(0);
    expect(balance("F", p, s, settled)).toBe(0);
    expect(
      balance("D", p, s, [{ ...settled[0], reversed_at: "2026-11-01" }]),
    ).toBe(500);
  });
});
describe("Amsterdam en onderhoud", () => {
  it("past wintertijd correct toe", () =>
    expect(localToISO("2026-11-01T10:00")).toBe("2026-11-01T09:00:00.000Z"));
  it("past zomertijd correct toe", () =>
    expect(localToISO("2026-07-01T10:00")).toBe("2026-07-01T08:00:00.000Z"));
  it("weigert niet-bestaande en dubbele lokale tijden", () => {
    expect(() => localToISO("2026-03-29T02:30")).toThrow();
    expect(() => localToISO("2026-10-25T02:30")).toThrow();
  });
  it("houdt rekening met maandgrenzen en schrikkeljaren", () => {
    expect(nextMaintenance("2028-01-31", 1)).toBe("2028-02-29");
    expect(nextMaintenance("2026-01-31", 1)).toBe("2026-02-28");
  });
});
describe("servervalidatie", () => {
  it("weigert lege taken en onveilige links", () => {
    expect(schemas.tasks.safeParse({ title: "" }).success).toBe(false);
    expect(
      schemas.ideas.safeParse({ title: "Test", url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
  it("weigert omgekeerde agenda-afspraken", () =>
    expect(
      schemas.calendar_events.safeParse({
        title: "Klusdag",
        starts_at: "2026-11-02T12:00:00Z",
        ends_at: "2026-11-02T10:00:00Z",
        category: "Klusdag",
      }).success,
    ).toBe(false));
  it("weigert breukcenten en negatieve bedragen", () => {
    expect(
      expenseSchema.safeParse({
        title: "Verf",
        amount_cents: 100.1,
        expense_date: "2026-11-01",
        category: "Verf",
      }).success,
    ).toBe(false);
    expect(
      expenseSchema.safeParse({
        title: "Verf",
        amount_cents: -1,
        expense_date: "2026-11-01",
        category: "Verf",
      }).success,
    ).toBe(false);
  });
  it("weigert dubbele betalers", () =>
    expect(
      allocationsSchema.safeParse([
        { user_id: "11111111-1111-4111-8111-111111111111", amount_cents: 50 },
        { user_id: "11111111-1111-4111-8111-111111111111", amount_cents: 50 },
      ]).success,
    ).toBe(false));
  it("weigert aankoopstatus buiten transactie", () =>
    expect(
      schemas.wishlist_items.safeParse({ title: "Lamp", status: "Gekocht" })
        .success,
    ).toBe(false));
});

import { expensesCSV } from "../src/lib/domain/export";
import type { RecordData } from "../src/lib/types";
describe("CSV-export", () => {
  const row = {
    id: "1",
    household_id: "h",
    title: ' =HYPERLINK("x")',
    amount_cents: -123,
    expense_date: "2026-11-01",
    category: "Retour",
    version: 1,
  } satisfies RecordData;
  it("beschermt tekstcellen tegen spreadsheetformules", () =>
    expect(expensesCSV([row])).toContain(`"' =HYPERLINK(""x"")"`));
  it("houdt retourbedragen numeriek en laat teruggedraaide records weg", () => {
    const csv = expensesCSV([
      row,
      { ...row, title: "Niet exporteren", reversed_at: "2026-11-01" },
    ]);
    expect(csv).toContain('"-1,23"');
    expect(csv).not.toContain("Niet exporteren");
  });
});

it("projectpayload bevat geen onbestaande project_id-kolom", () => {
  expect(
    schemas.projects.parse({ title: "Tuin", project_id: null }),
  ).not.toHaveProperty("project_id");
});
