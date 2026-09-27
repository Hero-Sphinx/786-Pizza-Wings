import Image from "next/image";
import Link from "next/link";
import { formatPhone, mapsHref, telHref } from "@/lib/format";
import type { StoreInfo } from "@/lib/store-types";
import { MenuIcon, PhoneIcon, PinIcon, ShieldIcon } from "../icons";
import { CartButton } from "../cart/CartButton";
import { OpenStatus } from "./OpenStatus";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About us" },
  { href: "/track", label: "Track order" },
];

export function Header({ store }: { store: StoreInfo }) {
  const fullAddress = `${store.addressLine}, ${store.city}, ${store.province} ${store.postalCode}`;
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-brand-900 text-sm text-white">
        <div className="container-page flex min-h-9 items-center justify-between gap-4">
          <p className="flex items-center gap-1.5 font-medium">
            <ShieldIcon width={16} height={16} className="text-gold-400" />
            <span>
              <span className="xl:hidden">HMA-certified halal</span>
              <span className="hidden xl:inline">Our meat products are HMA certified · Halal/Zabiha</span>
            </span>
          </p>
          <div className="hidden items-center gap-5 whitespace-nowrap lg:flex">
            <a href={mapsHref(`786 Pizza & Wings, ${fullAddress}`)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-gold-300">
              <PinIcon width={16} height={16} />
              {store.addressLine}, {store.city}
            </a>
            <OpenStatus hours={store.hours} />
          </div>
          <a href={telHref(store.phone)} className="flex items-center gap-1.5 whitespace-nowrap font-semibold hover:text-gold-300">
            <PhoneIcon width={16} height={16} />
            {formatPhone(store.phone)}
          </a>
        </div>
      </div>

      <div className="border-b border-ink/10 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-3 md:h-20">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="786 Pizza & Wings home">
            <Image src="/images/logo.webp" alt="" width={400} height={500} loading="eager" className="h-13 w-auto md:h-16" />
            <span className="h-display text-lg leading-none text-ink sm:text-xl">
              786 Pizza <span className="text-tomato-600">&amp;</span> Wings
              <span className="mt-0.5 block text-[0.65rem] font-semibold tracking-wide text-brand-700 sm:text-xs">STONE-BAKED · SINCE 1998</span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 whitespace-nowrap lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-4 py-2 font-semibold text-ink hover:bg-brand-50 hover:text-brand-700">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <Link href="/menu" className="btn btn-gold hidden whitespace-nowrap sm:inline-flex">
              Order online
            </Link>
            <CartButton />
            <details className="relative lg:hidden">
              <summary className="btn btn-ghost list-none px-3 [&::-webkit-details-marker]:hidden" aria-label="More pages">
                <MenuIcon />
              </summary>
              <nav aria-label="Main" className="card absolute right-0 top-12 z-50 flex w-48 flex-col p-2">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded-xl px-3 py-3 font-semibold hover:bg-brand-50">
                    {n.label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
