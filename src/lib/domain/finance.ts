export function cents(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Vul een positief bedrag in met maximaal twee decimalen.");
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000)
    throw new Error("Bedrag te groot.");
  return result;
}
export function splitCents(total: number, weights: number[]): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    weights.length === 0 ||
    weights.some((w) => !Number.isFinite(w) || w < 0) ||
    weights.reduce((a, b) => a + b, 0) <= 0
  )
    throw new Error("Ongeldige verdeling.");
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const result = exact.map(Math.floor);
  const order = exact
    .map((v, i) => ({ i, remainder: v - result[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  let remaining = total - result.reduce((a, b) => a + b, 0);
  for (let i = 0; remaining > 0; i++, remaining--)
    result[order[i % order.length].i]++;
  return result;
}
export const euro = (amount: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    amount / 100,
  );
export type Allocation = { user_id: string; amount_cents: number };
export function balance(
  user: string,
  payments: Allocation[],
  shares: Allocation[],
  settlements: {
    from_user: string;
    to_user: string;
    amount_cents: number;
    reversed_at?: string | null;
  }[],
) {
  return (
    payments
      .filter((p) => p.user_id === user)
      .reduce((s, p) => s + p.amount_cents, 0) -
    shares
      .filter((p) => p.user_id === user)
      .reduce((s, p) => s + p.amount_cents, 0) +
    settlements
      .filter((s) => !s.reversed_at)
      .reduce(
        (n, s) =>
          n +
          (s.from_user === user ? s.amount_cents : 0) -
          (s.to_user === user ? s.amount_cents : 0),
        0,
      )
  );
}
