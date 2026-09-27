// Money is integer cents everywhere. Only format at the edge.

const formatter = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

/** Parses "12.34", "$12.34" or "12" into cents. Returns null when it isn't a clean amount. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Basis-point percentage of an amount, rounded half-up (amounts are never negative). */
export function applyRate(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}
