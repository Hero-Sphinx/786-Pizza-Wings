// Reading the saved cart back from localStorage. Pure (string in, lines out) so it's testable without a browser.
import { cartLineSchema, type CartLineInput } from "./cart-schema";

export type StoredCartLine = CartLineInput & { id: string };

/** The saved lines that still fit the schema. Anything else (e.g. saved by an older version of the site) is dropped. */
export function parseStoredCart(raw: string | null): StoredCartLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((l) => {
    if (typeof l !== "object" || l === null || typeof l.id !== "string") return [];
    // The id is only for the browser. cartLineSchema is strict, so it's split off before validating the line.
    const { id, ...line } = l as { id: string };
    const ok = cartLineSchema.safeParse(line);
    return ok.success ? [{ ...ok.data, id }] : [];
  });
}
