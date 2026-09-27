import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, parseWith, withPublic } from "@/server/http";
import { getPublicOrder } from "@/server/orders";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/, "Order not found");

// Polled by the customer's order status page.
export const GET = withPublic<{ token: string }>(
  async (_req, { params }) => {
    const order = await getPublicOrder(parseWith(tokenSchema, params.token));
    if (!order) throw new ApiError(404, "Order not found");
    return NextResponse.json(order, { headers: { "Cache-Control": "no-store" } });
  },
  { rateLimit: { bucket: "order-status", limit: 60, windowSeconds: 60 } },
);
