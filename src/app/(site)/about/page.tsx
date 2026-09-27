import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FlameIcon, LeafIcon, PinIcon, ShieldIcon } from "@/components/icons";
import { mapsHref } from "@/lib/format";
import { loadStore } from "@/server/menu";

export const metadata: Metadata = {
  title: "About us",
  description: "786 Pizza & Wings: fresh, never-frozen, hand-tossed halal pizza at Queen & McLaughlin in Brampton since 1998.",
};

const VALUES = [
  { icon: LeafIcon, title: "Nothing frozen", body: "Every dish is made with the freshest, finest ingredients. We never use frozen ingredients." },
  { icon: FlameIcon, title: "No microwave", body: "There is no microwave oven at 786 Pizza. Everything is baked to order." },
  { icon: ShieldIcon, title: "Genuinely halal", body: "Our meat products are Halal/Zabiha and certified by the Halal Monitoring Authority (HMA)." },
];

export default async function AboutPage() {
  const store = await loadStore();
  const address = `${store.addressLine}, ${store.city}, ${store.province} ${store.postalCode}`;
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <Image src="/images/banners/pizza.webp" alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
        <div className="container-page relative py-16 sm:py-24">
          <p className="font-display text-xl font-bold text-gold-400">Welcome to 786 Pizza &amp; Wings</p>
          <h1 className="h-display mt-2 max-w-2xl text-4xl leading-tight sm:text-6xl">The quality pizza &amp; best wings in town!</h1>
        </div>
      </section>

      <section className="container-page grid gap-10 py-12 md:grid-cols-[1fr_auto] md:items-center">
        <div className="max-w-2xl space-y-4 text-lg">
          <p>
            At 786 Pizza, every dish is created using only the freshest, finest ingredients. We hand-toss every pizza, use only the finest and
            freshest toppings, and brush extra virgin olive oil on the crust for that extra touch.
          </p>
          <p>
            We&apos;ve been baking for our Brampton neighbours since 1998, from quick weeknight dinners to party-sized orders for the whole
            family.
          </p>
          <a href={mapsHref(`786 Pizza & Wings, ${address}`)} target="_blank" rel="noopener noreferrer" className="card flex items-start gap-3 p-4 text-base hover:bg-brand-50">
            <PinIcon className="mt-0.5 shrink-0 text-brand-700" />
            <span>
              <span className="font-bold">{address}</span>
              {store.landmark && <span className="block text-ink-soft">{store.landmark}</span>}
              <span className="mt-1 block font-semibold text-brand-700 underline underline-offset-4">Get directions</span>
            </span>
          </a>
        </div>
        <Image src="/images/logo.webp" alt="786 Pizza & Wings logo" width={400} height={500} className="mx-auto h-72 w-auto" />
      </section>

      <section className="bg-crust py-12">
        <div className="container-page grid gap-4 sm:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6">
              <span className="grid size-12 place-items-center rounded-full bg-brand-600 text-white">
                <Icon />
              </span>
              <h2 className="h-display mt-4 text-2xl">{title}</h2>
              <p className="mt-1 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
        <div className="container-page mt-10 text-center">
          <Link href="/menu" className="btn btn-primary text-lg">
            See the menu
          </Link>
        </div>
      </section>
    </>
  );
}
