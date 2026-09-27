import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ApiError, readJson, withAuth } from "@/server/http";
import { invalidateMenu } from "@/server/menu";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const cents = z.number().int().min(0).max(100_000);

const bodySchema = z
  .object({
    // Staff may pause ordering or delivery during a rush.
    orderingEnabled: z.boolean().optional(),
    orderingPausedMessage: z.string().trim().max(200).nullable().optional(),
    deliveryEnabled: z.boolean().optional(),
    // Owner only from here.
    deliveryFeeCents: cents.optional(),
    deliveryMinCents: cents.nullable().optional(),
    deliveryFsas: z
      .array(z.string().trim().toUpperCase().regex(/^[A-Z]\d[A-Z]$/, "Use the first 3 characters of a postal code, e.g. L6X"))
      .max(60)
      .optional(),
    pickupLeadMinutes: z.number().int().min(0).max(240).optional(),
    deliveryLeadMinutes: z.number().int().min(0).max(240).optional(),
    lastOrderMinutes: z.number().int().min(0).max(180).optional(),
    maxOrderCents: z.number().int().min(1_000).max(500_000).optional(),
    notifyEmail: z.string().trim().max(120).pipe(z.email()).nullable().optional().or(z.literal("").transform(() => null)),
    hours: z
      .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), isClosed: z.boolean(), opensAt: hhmm, closesAt: hhmm }).strict())
      .length(7)
      .refine((h) => new Set(h.map((d) => d.dayOfWeek)).size === 7, "Give hours for each day once")
      .optional(),
    closures: z
      .array(z.object({ date: z.iso.date(), reason: z.string().trim().max(80).nullable() }).strict())
      .max(60)
      .optional(),
  })
  .strict();

const STAFF_FIELDS = new Set(["orderingEnabled", "orderingPausedMessage", "deliveryEnabled"]);

export const PATCH = withAuth(async (req, { session }) => {
  const b = await readJson(req, bodySchema);
  const touched = Object.keys(b).filter((k) => b[k as keyof typeof b] !== undefined);
  if (session.role !== "owner" && touched.some((k) => !STAFF_FIELDS.has(k))) {
    throw new ApiError(403, "Only the owner can change these settings");
  }

  await db().$transaction(async (tx) => {
    await tx.store_settings.update({
      where: { id: 1 },
      data: {
        ordering_enabled: b.orderingEnabled,
        ordering_paused_message: b.orderingPausedMessage === undefined ? undefined : b.orderingPausedMessage || null,
        delivery_enabled: b.deliveryEnabled,
        delivery_fee_cents: b.deliveryFeeCents,
        delivery_min_cents: b.deliveryMinCents,
        delivery_fsas: b.deliveryFsas ? [...new Set(b.deliveryFsas)] : undefined,
        pickup_lead_minutes: b.pickupLeadMinutes,
        delivery_lead_minutes: b.deliveryLeadMinutes,
        last_order_minutes: b.lastOrderMinutes,
        max_order_cents: b.maxOrderCents,
        notify_email: b.notifyEmail,
        updated_at: new Date(),
      },
    });
    if (b.hours) {
      for (const h of b.hours) {
        const data = {
          is_closed: h.isClosed,
          opens_at: new Date(`1970-01-01T${h.opensAt}:00Z`),
          closes_at: new Date(`1970-01-01T${h.closesAt}:00Z`),
        };
        await tx.store_hours.upsert({ where: { day_of_week: h.dayOfWeek }, create: { day_of_week: h.dayOfWeek, ...data }, update: data });
      }
    }
    if (b.closures) {
      await tx.store_closures.deleteMany({});
      await tx.store_closures.createMany({
        data: b.closures.map((c) => ({ closed_on: new Date(`${c.date}T00:00:00Z`), reason: c.reason || null })),
        skipDuplicates: true,
      });
    }
  });
  await audit(session.userId, "settings.update", "store_settings", "1", b);
  invalidateMenu();
  return NextResponse.json({ ok: true });
});
