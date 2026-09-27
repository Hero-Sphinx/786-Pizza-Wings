import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

/** Records who changed what in the admin, for the owner's peace of mind. */
export async function audit(adminUserId: string, action: string, entity: string, entityId: string | null, detail?: Prisma.InputJsonValue) {
  await db().audit_log.create({
    data: { admin_user_id: adminUserId, action, entity, entity_id: entityId, detail: detail ?? undefined },
  });
}
