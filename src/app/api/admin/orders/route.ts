import { NextResponse } from "next/server";
import { z } from "zod";
import { toAdminOrder } from "@/server/admin-orders";
import { parseWith, withAuth } from "@/server/http";
import { listOrders } from "@/server/orders";

const viewSchema = z.enum(["active", "today", "recent"]).default("active");

// Polled by the order board every few seconds.
export const GET = withAuth(async (req) => {
  const view = parseWith(viewSchema, req.nextUrl.searchParams.get("view") ?? undefined);
  const orders = await listOrders(view);
  return NextResponse.json({ orders: orders.map(toAdminOrder), now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
});
