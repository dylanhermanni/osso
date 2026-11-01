import type { RecordData } from "../types";
function textCell(value: string | undefined) {
  const text = String(value || "");
  const safe =
    /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function expensesCSV(records: RecordData[]) {
  return (
    "\uFEFFOmschrijving;Datum;Categorie;Bedrag (EUR)\r\n" +
    records
      .filter((e) => !e.reversed_at)
      .map((e) =>
        [
          textCell(e.title),
          textCell(e.expense_date),
          textCell(e.category),
          '"' +
            ((e.amount_cents || 0) / 100).toFixed(2).replace(".", ",") +
            '"',
        ].join(";"),
      )
      .join("\r\n")
  );
}
