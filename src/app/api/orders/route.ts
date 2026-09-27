import { NextResponse } from "next/server";
import type { CreateOrderResponse } from "@/lib/api-types";
import { checkoutSchema } from "@/lib/cart-schema";
import { readJson, withPublic } from "@/server/http";
import { createOrder } from "@/server/orders";

export const POST = withPublic(
  async (req, { ip }) => {
    const input = await readJson(req, checkoutSchema);
    const result: CreateOrderResponse = await createOrder(input, ip);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  },
  // Loose cap on attempts (customers fix form errors and retry; many phones share a carrier IP).
  // The real anti-spam limits count placed orders only, in createOrder().
  { rateLimit: { bucket: "orders", limit: 30, windowSeconds: 600 } },
);
