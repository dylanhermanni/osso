import catalogData from "./catalog.json";
export type CopyEntry = {
  key: string;
  source: string;
  groups: string[];
  template: boolean;
};
export type CopyRecord = {
  key: string;
  value: string | null;
  version: number;
  updated_at: string;
};
export const catalog = catalogData as CopyEntry[];
export const normalizeCopy = (text: string) => text.replace(/\s+/g, " ").trim();
export const catalogByKey = new Map(catalog.map((entry) => [entry.key, entry]));
const bySource = new Map(catalog.map((entry) => [entry.source, entry]));
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = catalog
  .filter((entry) => entry.template)
  .map((entry) => ({
    entry,
    pattern: new RegExp(
      "^" +
        entry.source
          .split(/\{\d+\}/)
          .map(escapeRegExp)
          .join("(.*?)") +
        "$",
    ),
  }))
  .sort((a, b) => b.entry.source.length - a.entry.source.length);
export function findCopy(
  text: string,
): { entry: CopyEntry; values: string[] } | undefined {
  const source = normalizeCopy(text);
  const exact = bySource.get(source);
  if (exact) return { entry: exact, values: [] };
  for (const { entry, pattern } of templates) {
    const match = source.match(pattern);
    if (match) return { entry, values: match.slice(1) };
  }
}
export function translateCopy(
  text: string,
  overrides: Record<string, string>,
): string {
  const match = findCopy(text);
  if (!match || overrides[match.entry.key] === undefined) return text;
  const prefix = text.match(/^\s*/)?.[0] || "";
  const suffix = text.match(/\s*$/)?.[0] || "";
  const value = overrides[match.entry.key].replace(
    /\{(\d+)\}/g,
    (_, index: string) => match.values[Number(index) - 1] ?? `{${index}}`,
  );
  return prefix + value + suffix;
}
export function validateCopyValue(
  key: string,
  value: string | null,
): string | null {
  const entry = catalogByKey.get(key);
  if (!entry)
    throw new Error("Deze tekst bestaat niet meer. Vernieuw de pagina.");
  if (value === null) return null;
  if (!value.trim() || value.length > 5000)
    throw new Error("Gebruik tussen 1 en 5.000 tekens.");
  const tokens = (text: string) =>
    [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
  if (
    entry.template &&
    JSON.stringify(tokens(entry.source)) !== JSON.stringify(tokens(value))
  )
    throw new Error(
      "Laat alle invulvelden zoals {1} en {2} precies één keer staan.",
    );
  return value;
}
export function copyOverrides(records: CopyRecord[]): Record<string, string> {
  return Object.fromEntries(
    records
      .filter((record) => record.value !== null)
      .map((record) => [record.key, record.value!]),
  ) as Record<string, string>;
}
