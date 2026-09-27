"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { telHref } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { BagIcon, PhoneIcon } from "../icons";
import { useCart } from "../cart/CartProvider";

/** Always-reachable Call and Order buttons on phones (thumb zone). */
export function MobileBar({ phone }: { phone: string }) {
  const { count, quote, setCartOpen } = useCart();
  const pathname = usePathname();
  const hidden = pathname.startsWith("/checkout") || pathname.startsWith("/order/");

  useEffect(() => {
    document.body.classList.toggle("has-mobile-bar", !hidden);
    return () => document.body.classList.remove("has-mobile-bar");
  }, [hidden]);

  if (hidden) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <div className="flex gap-3">
        <a href={telHref(phone)} className="btn btn-outline flex-1">
          <PhoneIcon /> Call
        </a>
        {count > 0 ? (
          <button type="button" onClick={() => setCartOpen(true)} className="btn btn-primary flex-[2]">
            <BagIcon /> View order ({count}) · {formatCents(quote.subtotalCents)}
          </button>
        ) : (
          <Link href="/menu" className="btn btn-gold flex-[2]">
            Order online
          </Link>
        )}
      </div>
    </div>
  );
}
