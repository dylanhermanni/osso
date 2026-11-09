export const DEFAULT_RECIPE_PORTIONS = 2;
export const MAX_RECIPE_PORTIONS = 100;

const fractions: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
};
const quantityPattern =
  /^(?:(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)|(\d+(?:[.,]\d+)?))(?![\d.,/¼-¾⅐-⅞]|\s*[-–—])\s*(.*)$/;
const quantityFormat = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 4,
  useGrouping: false,
});

export function scaleRecipeQuantity(
  quantity: string,
  from: number,
  to: number,
) {
  if (from === to) return quantity;

  const normalized = quantity.replace(
    /^(\d*)\s*([¼½¾⅓⅔⅛])/,
    (_, whole, fraction) =>
      [whole, fractions[fraction]].filter(Boolean).join(" "),
  );
  const match = normalized.match(quantityPattern);
  if (!match) return quantity;
  const [, whole, numerator, denominator, decimal, unit] = match;
  const amount = decimal
    ? Number(decimal.replace(",", "."))
    : Number(whole ?? 0) + Number(numerator) / Number(denominator);
  const scaled = (amount / from) * to;
  if (!Number.isFinite(scaled)) return quantity;

  const formatted =
    scaled > 0 && scaled < 0.0001
      ? String(Number(scaled.toPrecision(4))).replace(".", ",")
      : quantityFormat.format(scaled);
  return [formatted, unit].filter(Boolean).join(" ");
}
