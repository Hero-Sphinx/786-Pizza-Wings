"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { describeDays, type MenuItem } from "@/lib/menu-types";
import { formatCents } from "@/lib/money";
import { PlusIcon } from "../icons";
import { useCart } from "../cart/CartProvider";
import { ItemDialog } from "./ItemDialog";

function PriceLadder({ item }: { item: MenuItem }) {
  if (item.variants.length === 1) return <p className="text-lg font-extrabold text-brand-700">{formatCents(item.variants[0].priceCents)}</p>;
  const allSame = item.variants.every((v) => v.priceCents === item.variants[0].priceCents);
  if (allSame) {
    return (
      <p className="text-sm">
        <span className="text-lg font-extrabold text-brand-700">{formatCents(item.variants[0].priceCents)}</span>{" "}
        <span className="text-ink-soft">{item.variants.map((v) => v.label).join(", ")}</span>
      </p>
    );
  }
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {item.variants.map((v) => (
        <div key={v.code} className={`flex gap-1 ${v.available ? "" : "line-through opacity-50"}`}>
          <dt className="text-ink-soft">{v.label}</dt>
          <dd className="font-bold text-ink">{formatCents(v.priceCents)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ItemCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const { add } = useCart();
  const quickAdd = item.kind === "simple" && item.variants.length === 1;
  const soldOut = !item.available || item.variants.every((v) => !v.available);
  const detail = item.standardToppings.length ? item.standardToppings.join(", ") : item.description;

  return (
    <article className="card flex overflow-hidden sm:flex-col">
      {item.image && (
        <div className="relative w-32 shrink-0 bg-crust sm:aspect-[4/3] sm:w-full">
          <Image src={item.image} alt="" fill sizes="(min-width: 640px) 33vw, 128px" className="object-cover" />
          {item.badge && (
            <span className="absolute left-2 top-2 rounded-full bg-tomato-600 px-2.5 py-0.5 text-xs font-bold text-white shadow">{item.badge}</span>
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="h-display text-xl leading-tight">{item.name}</h3>
        {detail && <p className="line-clamp-3 text-sm text-ink-soft">{detail}</p>}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {item.availableDays.length > 0 && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-gold-700">{describeDays(item.availableDays)}</span>}
          {item.pickupOnly && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">Pickup</span>}
          {item.cashOnly && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">Cash only</span>}
          {item.taxMode === "exempt" && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">No tax</span>}
          {item.taxMode === "included" && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">Tax included</span>}
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-1">
          <PriceLadder item={item} />
          <button
            type="button"
            disabled={soldOut}
            onClick={() => (quickAdd ? add({ itemSlug: item.slug, variantCode: item.variants[0].code, quantity: 1 }) : onOpen())}
            className="btn btn-primary ml-auto shrink-0 px-4"
            aria-label={soldOut ? `${item.name} is sold out` : `${quickAdd ? "Add" : "Choose"} ${item.name}`}
          >
            {soldOut ? "Sold out" : quickAdd ? <><PlusIcon /> Add</> : "Choose"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function MenuBrowser() {
  const { menu } = useCart();
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [active, setActive] = useState(menu.categories[0]?.slug);
  const allItems = menu.categories.flatMap((c) => c.items);

  // Deep links from promos: /menu?item=deal-07
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("item");
    const item = slug ? allItems.find((i) => i.slug === slug) : undefined;
    if (!item) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(item);
    document.getElementById(item.categorySlug)?.scrollIntoView();
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight the category being read.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    menu.categories.forEach((c) => {
      const el = document.getElementById(c.slug);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [menu.categories]);

  const closeDialog = () => {
    setOpen(null);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  };

  return (
    <>
      <nav aria-label="Menu categories" className="sticky top-[100px] z-30 border-b border-ink/10 bg-cream/95 backdrop-blur md:top-[116px]">
        <div className="container-page flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          {menu.categories.map((c) => (
            <a key={c.slug} href={`#${c.slug}`} className="chip shrink-0" aria-current={active === c.slug ? "true" : undefined}>
              {c.name}
            </a>
          ))}
        </div>
      </nav>

      <div className="container-page space-y-14 py-8">
        {menu.categories.map((c) => (
          <section key={c.slug} id={c.slug} aria-labelledby={`${c.slug}-title`} className="scroll-mt-40">
            <h2 id={`${c.slug}-title`} className="h-display text-3xl sm:text-4xl">
              {c.name}
            </h2>
            {c.blurb && <p className="mt-1 text-ink-soft">{c.blurb}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.items.map((item) => (
                <ItemCard key={item.slug} item={item} onOpen={() => setOpen(item)} />
              ))}
            </div>

            {c.slug === "pizzas" && (
              <div className="card mt-6 grid gap-6 p-5 sm:grid-cols-2">
                <div>
                  <h3 className="h-display text-xl text-brand-700">Vegetarian toppings</h3>
                  <p className="mt-1 text-ink-soft">
                    {menu.toppings.filter((t) => t.group === "veg").map((t) => (t.units > 1 ? `${t.name} (counts as ${t.units})` : t.name)).join(", ")}
                  </p>
                </div>
                <div>
                  <h3 className="h-display text-xl text-brand-700">Halal meat toppings</h3>
                  <p className="mt-1 text-ink-soft">
                    {menu.toppings.filter((t) => t.group === "meat").map((t) => (t.units > 1 ? `${t.name} (counts as ${t.units})` : t.name)).join(", ")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand-800">All our meat is HMA certified.</p>
                </div>
              </div>
            )}
            {c.slug === "wings" && (
              <p className="card mt-6 p-5">
                <span className="h-display text-xl text-brand-700">Sauces: </span>
                {menu.flavours.map((f) => f.name).join(", ")}
              </p>
            )}
          </section>
        ))}
      </div>

      {open && <ItemDialog key={open.slug} item={open} onClose={closeDialog} />}
    </>
  );
}
