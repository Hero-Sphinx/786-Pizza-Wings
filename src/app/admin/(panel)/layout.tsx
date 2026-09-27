import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/server/auth";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  // Pages check the session too; this just gets the name for the nav.
  const session = await requireAdmin();
  return (
    <>
      <AdminNav name={session.displayName} role={session.role} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-5">{children}</main>
    </>
  );
}
