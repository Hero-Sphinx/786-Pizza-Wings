import type { Metadata } from "next";
import { MenuEditor } from "@/components/admin/MenuEditor";
import { requireAdmin } from "@/server/auth";
import { loadMenuFresh } from "@/server/menu";

export const metadata: Metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  const session = await requireAdmin();
  const menu = await loadMenuFresh({ includeHidden: true });
  return <MenuEditor menu={menu} isOwner={session.role === "owner"} />;
}
