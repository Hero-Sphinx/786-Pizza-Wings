import Image from "next/image";
import Link from "next/link";
import { FlameIcon, LeafIcon, ShieldIcon, ChevronIcon } from "@/components/icons";
import { HeroCarousel } from "@/components/site/HeroCarousel";
import { OpenStatus } from "@/components/site/OpenStatus";
import { formatPhone, telHref } from "@/lib/format";
import { describeDays } from "@/lib/menu-types";
import { formatCents } from "@/lib/money";
import { DELIVERY_PARTNERS } from "@/lib/partners";
import { loadMenu, loadStore } from "@/server/menu";

const PROMISES = [
  { icon: ShieldIcon, title: "HMA-certified halal", body: "All our meat is Halal/Zabiha and HMA certified." },
  { icon: LeafIcon, title: "Never frozen", body: "Only the freshest ingredients. No microwave in our kitchen." },
  { icon: FlameIcon, title: "Hand-tossed & stone-baked", body: "Finished with extra virgin olive oil on the crust." },
];

const TILES = [
  { href: "/menu#deals", label: "Deals & Combos", image: "/images/promos/pizzas.webp" },
  { href: "/menu#pizzas", label: "Pizzas", image: "/images/banners/pizza.webp" },
  { href: "/menu#wings", label: "Fresh Wings", image: "/images/wings.webp" },
  { href: "/menu#sides", label: "Sides & More", image: "/images/banners/sides.webp" },
];

const FEATURED_DEALS = ["weekday-special", "deal-07", "deal-08", "deal-10"];

export default async function HomePage() {
  const [store, menu] = await Promise.all([loadStore(), loadMenu()]);
  const items = menu.categories.flatMap((c) => c.items);
  const deals = FEATURED_DEALS.map((slug) => items.find((i) => i.slug === slug)).filter((i) => i !== undefined);
  const pizzas = items.filter((i) => i.kind === "pizza").slice(0, 8);

  return (
    <>
      <HeroCarousel promos={store.promos} />

      <section aria-label="Our promise" className="bg-brand-700 text-white">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-400 text-ink">
                <Icon />
              </span>
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="text-sm text-white/85">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!store.orderingEnabled && (
        <div className="bg-gold-100">
          <p className="container-page py-4 text-center font-semibold text-gold-700" role="status">
            {store.orderingPausedMessage || "Online ordering is paused right now."} Call us at{" "}
            <a className="underline" href={telHref(store.phone)}>
              {formatPhone(store.phone)}
            </a>
            .
          </p>
        </div>
      )}

      <section className="container-page py-12" aria-labelledby="browse-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="browse-title" className="h-display text-3xl sm:text-4xl">
              What are you craving?
            </h2>
            <OpenStatus hours={store.hours} className="mt-1 block font-semibold text-ink-soft" />
          </div>
          <Link href="/menu" className="btn btn-outline">
            Full menu <ChevronIcon />
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {TILES.map((t) => (
            <Link key={t.href} href={t.href} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink shadow-(--shadow-card)">
              <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" aria-hidden />
              <span className="h-display absolute bottom-3 left-3 right-3 text-xl text-white sm:text-2xl">{t.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {deals.length > 0 && (
        <section className="bg-crust py-12" aria-labelledby="deals-title">
          <div className="container-page">
            <h2 id="deals-title" className="h-display text-3xl sm:text-4xl">
              Crowd-pleasing deals
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {deals.map((d) => (
                <Link key={d.slug} href={`/menu?item=${d.slug}`} className="card group flex flex-col overflow-hidden">
                  <div className="relative aspect-[4/3] bg-ink">
                    {d.image && <Image src={d.image} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />}
                    {d.availableDays.length > 0 && (
                      <span className="absolute left-3 top-3 rounded-full bg-gold-400 px-3 py-1 text-sm font-bold text-ink">{describeDays(d.availableDays)}</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="h-display text-xl leading-tight group-hover:text-brand-700">{d.name}</h3>
                    <p className="mt-1 flex-1 text-sm text-ink-soft">{d.description}</p>
                    <p className="mt-3 font-extrabold text-brand-700">
                      {d.variants.length > 1 ? "From " : ""}
                      {formatCents(Math.min(...d.variants.map((v) => v.priceCents)))}
                      {d.taxMode === "included" && <span className="font-semibold text-ink-soft"> incl. tax</span>}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-12" aria-labelledby="pizzas-title">
        <h2 id="pizzas-title" className="h-display text-3xl sm:text-4xl">
          Our specialty pizzas
        </h2>
        <p className="mt-1 text-ink-soft">Small to party size. Every pizza includes 3 toppings or our signature combo.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pizzas.map((p) => (
            <Link key={p.slug} href={`/menu?item=${p.slug}`} className="group text-center">
              <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-full bg-crust shadow-(--shadow-card)">
                {p.image && <Image src={p.image} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />}
              </div>
              <h3 className="h-display mt-3 text-lg leading-tight group-hover:text-brand-700">{p.name}</h3>
              <p className="text-sm font-semibold text-ink-soft">from {formatCents(Math.min(...p.variants.map((v) => v.priceCents)))}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pb-14" aria-labelledby="partners-title">
        <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 id="partners-title" className="h-display text-2xl">
              Prefer your delivery app?
            </h2>
            <p className="text-ink-soft">You&apos;ll find us there too. Ordering here directly supports our kitchen.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {DELIVERY_PARTNERS.map((p) => (
              <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                {p.name}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
