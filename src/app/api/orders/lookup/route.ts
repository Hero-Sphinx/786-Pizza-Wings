import { NextResponse } from "next/server";
import { orderLookupSchema } from "@/lib/cart-schema";
import { ApiError, readJson, withPublic } from "@/server/http";
import { findOrderToken } from "@/server/orders";

// "Track my order": order number + the phone used on the order -> the private status-page link.
// Tight rate limit, because order numbers are sequential and could otherwise be guessed.
export const POST = withPublic(
  async (req) => {
    const { orderNumber, phone } = await readJson(req, orderLookupSchema);
    const token = await findOrderToken(orderNumber, phone);
    if (!token) {
      throw new ApiError(404, "We couldn't find an order with that number and phone number. Check both, or call us.");
    }
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  },
  { rateLimit: { bucket: "order-lookup", limit: 10, windowSeconds: 600 } },
);
