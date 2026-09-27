"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/history", label: "History" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ name, role }: { name: string; role: "owner" | "staff" }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  };
  return (
    <header className="sticky top-0 z-30 bg-brand-900 text-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:px-5">
        <span className="h-display mr-3 text-xl">786 Staff</span>
        <nav className="flex flex-wrap gap-1" aria-label="Staff">
          {LINKS.map((l) => {
            const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`rounded-full px-4 py-2 font-semibold ${active ? "bg-gold-400 text-ink" : "hover:bg-white/10"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">
            {name} <span className="text-white/60">({role})</span>
          </span>
          <Link href="/" className="rounded-full px-3 py-2 hover:bg-white/10" target="_blank">
            View site
          </Link>
          <button type="button" onClick={logout} className="rounded-full bg-white/10 px-3 py-2 font-semibold hover:bg-white/20">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
