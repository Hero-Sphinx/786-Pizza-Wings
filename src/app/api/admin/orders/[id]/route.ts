import { NextResponse } from "next/server";
import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/order-status";
import { audit } from "@/server/audit";
import { parseWith, readJson, withAuth } from "@/server/http";
import { updateOrderStatus } from "@/server/orders";

const bodySchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export const PATCH = withAuth<{ id: string }>(async (req, { params, session }) => {
  const id = parseWith(z.uuid("Order not found"), params.id);
  const { status, note } = await readJson(req, bodySchema);
  await updateOrderStatus(id, status, session.userId, note);
  await audit(session.userId, "order.status", "order", id, { status, note: note ?? null });
  return NextResponse.json({ ok: true });
});
