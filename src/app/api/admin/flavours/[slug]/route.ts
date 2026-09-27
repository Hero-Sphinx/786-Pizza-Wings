import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ApiError, readJson, withAuth } from "@/server/http";
import { invalidateMenu } from "@/server/menu";

const bodySchema = z.object({ isAvailable: z.boolean() }).strict();

export const PATCH = withAuth<{ slug: string }>(async (req, { params, session }) => {
  const { isAvailable } = await readJson(req, bodySchema);
  const updated = await db().wing_flavours.updateMany({ where: { slug: params.slug }, data: { is_available: isAvailable } });
  if (updated.count === 0) throw new ApiError(404, "Flavour not found");
  await audit(session.userId, "menu.flavour.availability", "wing_flavour", params.slug, { isAvailable });
  invalidateMenu();
  return NextResponse.json({ ok: true });
});
