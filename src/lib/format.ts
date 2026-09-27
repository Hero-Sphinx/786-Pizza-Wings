/** "9054530786" -> "(905) 453-0786" */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

/** tel: link that works from any country. */
export function telHref(digits: string): string {
  return `tel:+1${digits.replace(/\D/g, "").slice(-10)}`;
}

/** Opens the address in the phone's maps app (or Google Maps on desktop). */
export function mapsHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Keyless Google Maps embed for an address. */
export function mapsEmbedSrc(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** First 3 characters of a Canadian postal code ("L6X 1B3" -> "L6X"). */
export function postalFsa(postal: string): string {
  return postal.replace(/\s+/g, "").toUpperCase().slice(0, 3);
}
