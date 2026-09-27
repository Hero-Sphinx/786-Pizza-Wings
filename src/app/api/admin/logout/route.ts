import { NextResponse } from "next/server";
import { logout } from "@/server/auth";
import { withAuth } from "@/server/http";

export const POST = withAuth(async () => {
  await logout();
  return NextResponse.json({ ok: true });
});
