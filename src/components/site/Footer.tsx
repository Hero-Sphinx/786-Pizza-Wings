import Image from "next/image";
import Link from "next/link";
import { formatPhone, mapsEmbedSrc, mapsHref, telHref } from "@/lib/format";
import { formatHoursRange } from "@/lib/hours";
import { DAY_NAMES } from "@/lib/menu-types";
import type { StoreInfo } from "@/lib/store-types";
import { ClockIcon, PhoneIcon, PinIcon } from "../icons";

export function Footer({ store, showMap = true }: { store: StoreInfo; showMap?: boolean }) {
  const fullAddress = `${store.addressLine}, ${store.city}, ${store.province} ${store.postalCode}`;
  const mapQuery = `786 Pizza & Wings, ${fullAddress}`;
  // Group identical days: "Monday – Sunday 11:30 AM – 11:30 PM".
  const rows = store.hours.hours;
  const sameEveryDay = rows.length === 7 && rows.every((r) => formatHoursRange(r) === formatHoursRange(rows[0]));
  // Show Monday first.
  const ordered = [...rows].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7));

  return (
    <footer id="visit" className="mt-auto bg-brand-900 text-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <div>
          <Image src="/images/logo.webp" alt="786 Pizza & Wings" width={400} height={500} className="h-24 w-auto rounded-2xl bg-white p-2" />
          <p className="mt-4 max-w-xs text-white/80">
            Hand-tossed, stone-baked pizza and fresh wings. Halal/Zabiha, HMA-certified meat. Serving Brampton since 1998.
          </p>
        </div>

        <div className="space-y-5">
          <h2 className="h-display text-2xl text-gold-400">Visit or call</h2>
          <a href={mapsHref(mapQuery)} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-gold-300">
            <PinIcon className="mt-0.5 shrink-0" />
            <span>
              {store.addressLine}
              <br />
              {store.city}, {store.province} {store.postalCode}
              {store.landmark && <span className="mt-1 block text-sm text-white/70">{store.landmark}</span>}
              <span className="mt-1 block text-sm font-semibold text-gold-300 underline underline-offset-4">Get directions</span>
            </span>
          </a>
          <a href={telHref(store.phone)} className="flex items-center gap-3 text-lg font-bold hover:text-gold-300">
            <PhoneIcon className="shrink-0" />
            {formatPhone(store.phone)}
          </a>
        </div>

        <div>
          <h2 className="h-display flex items-center gap-2 text-2xl text-gold-400">
            <ClockIcon /> Hours
          </h2>
          {sameEveryDay ? (
            <p className="mt-3 text-lg">
              <span className="font-semibold">Monday – Sunday</span>
              <br />
              {formatHoursRange(rows[0])}
            </p>
          ) : (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {ordered.map((h) => (
                <div key={h.dayOfWeek} className="contents">
                  <dt className="font-semibold">{DAY_NAMES[h.dayOfWeek]}</dt>
                  <dd>{formatHoursRange(h)}</dd>
                </div>
              ))}
            </dl>
          )}
          <nav aria-label="Footer" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-white/80">
            <Link href="/menu" className="hover:text-gold-300">Menu</Link>
            <Link href="/about" className="hover:text-gold-300">About us</Link>
            <Link href="/track" className="hover:text-gold-300">Track your order</Link>
            <Link href="/privacy" className="hover:text-gold-300">Privacy</Link>
          </nav>
        </div>
      </div>

      {showMap && (
        <iframe
          title={`Map showing 786 Pizza & Wings at ${fullAddress}`}
          src={mapsEmbedSrc(mapQuery)}
          className="h-72 w-full border-0 grayscale-[20%]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      <div className="border-t border-white/10">
        <p className="container-page py-5 text-sm text-white/60">
          © {new Date().getFullYear()} 786 Pizza &amp; Wings. Prices and availability may change.
        </p>
      </div>
    </footer>
  );
}
