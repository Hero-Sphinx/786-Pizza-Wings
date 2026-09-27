import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ApiError, readJson, withAuth } from "@/server/http";
import { invalidateMenu } from "@/server/menu";

const bodySchema = z
  .object({
    // Staff may mark things sold out / back in stock.
    isAvailable: z.boolean().optional(),
    variants: z
      .array(
        z
          .object({
            code: z.string().min(1).max(30),
            isAvailable: z.boolean().optional(),
            priceCents: z.number().int().min(0).max(100_000).optional(), // owner only
          })
          .strict(),
      )
      .max(20)
      .optional(),
    // Owner only.
    isVisible: z.boolean().optional(),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

export const PATCH = withAuth<{ slug: string }>(async (req, { params, session }) => {
  const body = await readJson(req, bodySchema);
  const ownerOnly =
    body.isVisible !== undefined ||
    body.name !== undefined ||
    body.description !== undefined ||
    body.variants?.some((v) => v.priceCents !== undefined);
  if (ownerOnly && session.role !== "owner") throw new ApiError(403, "Only the owner can change prices and menu text");

  const item = await db().menu_items.findUnique({ where: { slug: params.slug }, include: { item_variants: true } });
  if (!item) throw new ApiError(404, "Item not found");
  for (const v of body.variants ?? []) {
    if (!item.item_variants.some((x) => x.code === v.code)) throw new ApiError(400, `Unknown option "${v.code}"`);
  }

  await db().$transaction(async (tx) => {
    await tx.menu_items.update({
      where: { slug: item.slug },
      data: {
        is_available: body.isAvailable,
        is_visible: body.isVisible,
        name: body.name,
        description: body.description === undefined ? undefined : body.description || null,
        updated_at: new Date(),
      },
    });
    for (const v of body.variants ?? []) {
      await tx.item_variants.update({
        where: { item_slug_code: { item_slug: item.slug, code: v.code } },
        data: { is_available: v.isAvailable, price_cents: v.priceCents },
      });
    }
  });
  await audit(session.userId, "menu.item.update", "menu_item", item.slug, body);
  invalidateMenu();
  return NextResponse.json({ ok: true });
});
