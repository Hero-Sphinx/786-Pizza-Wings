import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ApiError, readJson, withAuth } from "@/server/http";
import { invalidateMenu } from "@/server/menu";

const text = (max: number) => z.string().trim().max(max).nullable().optional();

const bodySchema = z
  .object({
    isActive: z.boolean().optional(),
    eyebrow: text(80),
    title: z.string().trim().min(2).max(80).optional(),
    body: text(200),
    priceText: text(60),
    ctaLabel: text(40),
    // Only links within the site or phone links: never an arbitrary external URL.
    ctaHref: z
      .string()
      .trim()
      .max(120)
      .regex(/^(\/(?!\/)[^\s]*|tel:\+?\d{10,11})$/, "Link must start with / or tel:")
      .nullable()
      .optional(),
  })
  .strict();

export const PATCH = withAuth<{ slug: string }>(
  async (req, { params, session }) => {
    const b = await readJson(req, bodySchema);
    const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    const updated = await db().promos.updateMany({
      where: { slug: params.slug },
      data: {
        is_active: b.isActive,
        eyebrow: blankToNull(b.eyebrow),
        title: b.title,
        body: blankToNull(b.body),
        price_text: blankToNull(b.priceText),
        cta_label: blankToNull(b.ctaLabel),
        cta_href: blankToNull(b.ctaHref),
      },
    });
    if (updated.count === 0) throw new ApiError(404, "Promo not found");
    await audit(session.userId, "promo.update", "promo", params.slug, b);
    invalidateMenu();
    return NextResponse.json({ ok: true });
  },
  { role: "owner" },
);
