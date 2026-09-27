import { NextResponse } from "next/server";
import type { QuoteResponse } from "@/lib/api-types";
import { quoteSchema } from "@/lib/cart-schema";
import { postalFsa } from "@/lib/format";
import { localParts } from "@/lib/hours";
import { quoteCart } from "@/lib/pricing";
import { readJson, withPublic } from "@/server/http";
import { loadMenuFresh, loadStoreFresh } from "@/server/menu";

// Authoritative price check for the checkout page, using fresh (uncached) prices.
export const POST = withPublic(
  async (req) => {
    const body = await readJson(req, quoteSchema);
    const [menu, store] = await Promise.all([loadMenuFresh(), loadStoreFresh()]);
    const at = body.scheduledFor ? new Date(body.scheduledFor) : new Date();
    const quote = quoteCart(menu, body.lines, {
      fulfilment: body.fulfilment,
      paymentMethod: body.paymentMethod,
      weekday: localParts(at, store.hours.timezone).weekday,
    });
    const errors = [...quote.errors];
    if (body.fulfilment === "delivery" && body.postalCode && !store.deliveryFsas.includes(postalFsa(body.postalCode))) {
      errors.push({ line: null, message: "Sorry, that address is outside our delivery area. Please choose pickup or call us." });
    }
    const response: QuoteResponse = {
      lines: quote.lines.map((l) => ({
        index: l.index,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
        details: l.details,
      })),
      subtotalCents: quote.subtotalCents,
      deliveryFeeCents: quote.deliveryFeeCents,
      taxCents: quote.taxCents,
      totalCents: quote.totalCents,
      cashOnly: quote.cashOnly,
      pickupOnly: quote.pickupOnly,
      errors,
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  },
  { rateLimit: { bucket: "quote", limit: 60, windowSeconds: 60 } },
);
