import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ApiError, readJson, withAuth } from "@/server/http";
import { invalidateMenu } from "@/server/menu";

// null = extra toppings not offered online for this size.
const bodySchema = z.object({ extraToppingCents: z.number().int().min(0).max(2_000).nullable() }).strict();

export const PATCH = withAuth<{ code: string }>(
  async (req, { params, session }) => {
    const { extraToppingCents } = await readJson(req, bodySchema);
    const updated = await db().pizza_sizes.updateMany({
      where: { code: params.code },
      data: { extra_topping_cents: extraToppingCents },
    });
    if (updated.count === 0) throw new ApiError(404, "Size not found");
    await audit(session.userId, "menu.size.extra_topping", "pizza_size", params.code, { extraToppingCents });
    invalidateMenu();
    return NextResponse.json({ ok: true });
  },
  { role: "owner" },
);
