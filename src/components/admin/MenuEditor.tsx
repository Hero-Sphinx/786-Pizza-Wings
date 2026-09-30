"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import type { MenuItem, MenuSnapshot, Topping, WingFlavour } from "@/lib/menu-types";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { Sheet } from "../ui/Sheet";
import { useAdminApi } from "./useAdminApi";

type Filter = "all" | "out" | "hidden";
type Tab = "items" | "extras";

const isOut = (i: MenuItem) => !i.available || i.variants.every((v) => !v.available);
const someSizesOut = (i: MenuItem) => i.available && i.variants.some((v) => !v.available) && i.variants.some((v) => v.available);
const toDollars = (cents: number) => (cents / 100).toFixed(2);

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-brand-600" : "bg-ink/25"}`}
    >
      <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

function Pill({ tone, children }: { tone: "red" | "gold" | "grey" | "green"; children: ReactNode }) {
  const tones = {
    red: "bg-tomato-50 text-tomato-700",
    gold: "bg-gold-100 text-gold-700",
    grey: "bg-ink/8 text-ink-soft",
    green: "bg-brand-50 text-brand-800",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function Thumb({ item }: { item: MenuItem }) {
  return (
    <div className={`relative size-20 shrink-0 overflow-hidden rounded-xl bg-crust ${isOut(item) || !item.visible ? "opacity-50 grayscale" : ""}`}>
      {item.image ? (
        <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
      ) : (
        <span className="h-display grid size-full place-items-center text-3xl text-ink-soft">{item.name.replace(/^#\d+\s*/, "").charAt(0)}</span>
      )}
    </div>
  );
}

function ItemCard({ item, onEdit }: { item: MenuItem; onEdit: () => void }) {
  const { patch, busy, error } = useAdminApi();
  const out = isOut(item);
  return (
    <li className={`card flex flex-col gap-3 p-3 transition-shadow hover:shadow-lg ${out ? "ring-2 ring-tomato-500/40" : ""}`}>
      <div className="flex gap-3">
        <Thumb item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className={`min-w-0 flex-1 font-bold leading-tight ${out ? "text-ink-soft" : ""}`}>{item.name}</p>
            <Toggle
              on={item.available}
              label={`${item.name} in stock`}
              disabled={busy}
              onChange={(v) => patch(`/api/admin/items/${item.slug}`, { isAvailable: v }, v ? "Back on" : "Marked sold out")}
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {out && <Pill tone="red">Sold out</Pill>}
            {someSizesOut(item) && <Pill tone="gold">Some sizes out</Pill>}
            {!item.visible && <Pill tone="grey">Hidden from website</Pill>}
            {/* Deal numbers like "#01" are already in the name. */}
            {item.badge && !item.name.startsWith(item.badge) && <Pill tone="green">{item.badge}</Pill>}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-end gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {item.variants.map((v) => (
            <span
              key={v.code}
              className={`rounded-lg border px-2 py-1 text-xs ${v.available ? "border-ink/10 bg-cream" : "border-tomato-500/30 bg-tomato-50 text-tomato-700 line-through"}`}
            >
              {item.variants.length > 1 || v.label !== "Regular" ? <span className="text-ink-soft">{v.label} </span> : null}
              <span className="font-bold tabular-nums">{formatCents(v.priceCents)}</span>
            </span>
          ))}
        </div>
        <button type="button" className="btn btn-outline min-h-9 shrink-0 px-4 text-sm" onClick={onEdit}>
          Edit
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-tomato-700">{error}</p>}
    </li>
  );
}

function ItemSheet({ item, isOwner, onClose }: { item: MenuItem; isOwner: boolean; onClose: () => void }) {
  const { patch, busy, error } = useAdminApi();
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [visible, setVisible] = useState(item.visible);
  const [prices, setPrices] = useState(() => Object.fromEntries(item.variants.map((v) => [v.code, toDollars(v.priceCents)])));
  const [stock, setStock] = useState(() => Object.fromEntries(item.variants.map((v) => [v.code, v.available])));
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    setProblem(null);
    const body: Record<string, unknown> = {};
    const variants: { code: string; priceCents?: number; isAvailable?: boolean }[] = [];
    for (const v of item.variants) {
      const change: { code: string; priceCents?: number; isAvailable?: boolean } = { code: v.code };
      if (isOwner) {
        const cents = parseDollarsToCents(prices[v.code] ?? "");
        if (cents === null) return setProblem(`Check the price for ${v.label}.`);
        if (cents !== v.priceCents) change.priceCents = cents;
      }
      if (stock[v.code] !== v.available) change.isAvailable = stock[v.code];
      if (Object.keys(change).length > 1) variants.push(change);
    }
    if (variants.length) body.variants = variants;
    if (isOwner) {
      if (name.trim().length < 2) return setProblem("The name needs at least 2 letters.");
      if (name.trim() !== item.name) body.name = name.trim();
      if (description.trim() !== (item.description ?? "")) body.description = description.trim() || null;
      if (visible !== item.visible) body.isVisible = visible;
    }
    if (Object.keys(body).length === 0) return onClose();
    if (await patch(`/api/admin/items/${item.slug}`, body, "Saved")) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      labelledBy={`edit-${item.slug}`}
      footer={
        <div className="flex flex-wrap items-center gap-3">
          {(problem || error) && (
            <p className="w-full text-sm font-semibold text-tomato-700" role="alert">
              {problem ?? error}
            </p>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary ml-auto min-w-32" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{isOwner ? "Prices and stock" : "Stock"}</h3>
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
            {item.variants.map((v) => (
              <li key={v.code} className="flex items-center gap-3 px-3 py-2">
                <span className={`flex-1 font-semibold ${stock[v.code] ? "" : "text-ink-soft line-through"}`}>{v.label}</span>
                {isOwner ? (
                  <label className="flex items-center gap-1">
                    <span className="text-ink-soft">$</span>
                    <input
                      className="field w-24 text-right tabular-nums"
                      inputMode="decimal"
                      aria-label={`${v.label} price`}
                      value={prices[v.code]}
                      onChange={(e) => setPrices({ ...prices, [v.code]: e.target.value })}
                    />
                  </label>
                ) : (
                  <span className="font-bold tabular-nums">{formatCents(v.priceCents)}</span>
                )}
                <Toggle on={stock[v.code]} label={`${v.label} in stock`} onChange={(on) => setStock({ ...stock, [v.code]: on })} />
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-soft">Switch a size off when you run out of it. The rest stay orderable.</p>
        </section>

        {isOwner ? (
          <>
            <section className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Menu text</h3>
              <div>
                <label className="label" htmlFor={`name-${item.slug}`}>
                  Name
                </label>
                <input id={`name-${item.slug}`} className="field" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor={`desc-${item.slug}`}>
                  Description
                </label>
                <textarea
                  id={`desc-${item.slug}`}
                  className="field min-h-24"
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Shown under the name on the website"
                />
                <p className="mt-1 text-right text-xs text-ink-soft">{description.length}/300</p>
              </div>
            </section>
            <section className="flex items-center gap-3 rounded-xl bg-crust/60 p-3">
              <div className="flex-1">
                <p className="font-semibold">Show on the website</p>
                <p className="text-sm text-ink-soft">Hidden items stay here but customers can&apos;t see or order them.</p>
              </div>
              <Toggle on={visible} label="Show on the website" onChange={setVisible} />
            </section>
          </>
        ) : (
          <p className="rounded-xl bg-crust/60 p-3 text-sm text-ink-soft">Only the owner can change prices and menu text.</p>
        )}
      </div>
    </Sheet>
  );
}

function OptionChip({ url, name, available }: { url: string; name: string; available: boolean }) {
  const { patch, busy, error } = useAdminApi();
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={available}
        disabled={busy}
        title={error ?? undefined}
        onClick={() => patch(url, { isAvailable: !available })}
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border-2 px-3 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
          available ? "border-brand-600 bg-brand-50 text-brand-800 hover:bg-brand-100" : "border-dashed border-tomato-500/50 bg-white text-ink-soft line-through hover:bg-tomato-50"
        } ${error ? "ring-2 ring-tomato-500" : ""}`}
      >
        <span className={`size-2.5 shrink-0 rounded-full ${available ? "bg-brand-600" : "bg-tomato-500"}`} aria-hidden />
        {name}
      </button>
    </li>
  );
}

function OptionGroup({ title, items, urlBase }: { title: string; items: (Topping | WingFlavour)[]; urlBase: string }) {
  const on = items.filter((i) => i.available).length;
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="h-display text-xl">{title}</h2>
        <span className={`text-sm font-semibold ${on < items.length ? "text-tomato-700" : "text-ink-soft"}`}>
          {on} of {items.length} available
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((t) => (
          <OptionChip key={t.slug} url={`${urlBase}/${t.slug}`} name={t.name} available={t.available} />
        ))}
      </ul>
    </section>
  );
}

function ExtraToppingPrices({ menu }: { menu: MenuSnapshot }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [values, setValues] = useState(() => Object.fromEntries(menu.sizes.map((s) => [s.code, s.extraToppingCents === null ? "" : toDollars(s.extraToppingCents)])));
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    setProblem(null);
    const parsed = menu.sizes.map((s) => {
      const raw = values[s.code].trim();
      return { size: s, raw, cents: raw === "" ? null : parseDollarsToCents(raw) };
    });
    const bad = parsed.find((p) => p.raw !== "" && p.cents === null);
    if (bad) return setProblem(`Check the price for ${bad.size.label}.`);
    for (const p of parsed) {
      if (p.cents === p.size.extraToppingCents) continue;
      if (!(await patch(`/api/admin/sizes/${p.size.code}`, { extraToppingCents: p.cents }, "Extra topping prices saved"))) return;
    }
  };
  return (
    <section className="card p-5">
      <h2 className="h-display text-xl">Extra topping prices</h2>
      <p className="mt-1 text-sm text-ink-soft">Price per extra topping, by pizza size. Leave a size empty to not offer extra toppings on it online.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {menu.sizes.map((s) => (
          <div key={s.code}>
            <label className="label" htmlFor={`extra-${s.code}`}>
              {s.label}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-ink-soft">$</span>
              <input
                id={`extra-${s.code}`}
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="not offered"
                value={values[s.code]}
                onChange={(e) => setValues({ ...values, [s.code]: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          Save prices
        </button>
        {(problem || error || saved) && (
          <p className={`text-sm font-semibold ${problem || error ? "text-tomato-700" : "text-brand-700"}`} role="status">
            {problem ?? error ?? saved}
          </p>
        )}
      </div>
    </section>
  );
}

export function MenuEditor({ menu, isOwner }: { menu: MenuSnapshot; isOwner: boolean }) {
  const [tab, setTab] = useState<Tab>("items");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);

  const allItems = useMemo(() => menu.categories.flatMap((c) => c.items), [menu]);
  const outCount = allItems.filter(isOut).length;
  const hiddenCount = allItems.filter((i) => !i.visible).length;
  const optionsOff = menu.toppings.filter((t) => !t.available).length + menu.flavours.filter((f) => !f.available).length;
  const editingItem = allItems.find((i) => i.slug === editing) ?? null;

  const q = query.trim().toLowerCase();
  const sections = menu.categories
    .filter((c) => category === "all" || c.slug === category)
    .map((c) => ({
      ...c,
      items: c.items.filter(
        (i) =>
          (!q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)) &&
          (filter === "all" || (filter === "out" && (isOut(i) || someSizesOut(i))) || (filter === "hidden" && !i.visible)),
      ),
    }))
    .filter((c) => c.items.length > 0);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${allItems.length})` },
    { key: "out", label: `Sold out (${allItems.filter((i) => isOut(i) || someSizesOut(i)).length})` },
    { key: "hidden", label: `Hidden (${hiddenCount})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">Menu</h1>
          <p className="text-ink-soft">Switch things off when you run out. The website updates right away.</p>
        </div>
        <dl className="flex gap-2 text-center">
          <div className="card min-w-24 px-4 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Items</dt>
            <dd className="h-display text-2xl">{allItems.length}</dd>
          </div>
          <div className={`card min-w-24 px-4 py-2 ${outCount ? "bg-tomato-50" : ""}`}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Sold out</dt>
            <dd className={`h-display text-2xl ${outCount ? "text-tomato-700" : ""}`}>{outCount}</dd>
          </div>
          <div className="card min-w-24 px-4 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Hidden</dt>
            <dd className="h-display text-2xl">{hiddenCount}</dd>
          </div>
        </dl>
      </div>

      <div role="tablist" aria-label="Menu sections" className="inline-flex rounded-full bg-white p-1 shadow-(--shadow-card)">
        {(
          [
            ["items", "Items"],
            ["extras", `Toppings & sauces${optionsOff ? ` (${optionsOff} off)` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-5 py-2 font-semibold transition-colors ${tab === key ? "bg-brand-600 text-white" : "text-ink-soft hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "items" ? (
        <>
          <div className="z-20 -mx-3 space-y-3 bg-[#f4f1ec]/95 px-3 py-3 backdrop-blur sm:sticky sm:top-14 sm:-mx-5 sm:px-5">
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                className="field basis-full sm:max-w-sm sm:flex-1 sm:basis-auto"
                placeholder="Search the menu…"
                aria-label="Search the menu"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
                {filters.map((f) => (
                  <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Category">
              <button type="button" className="chip shrink-0" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
                Everything
              </button>
              {menu.categories.map((c) => (
                <button key={c.slug} type="button" className="chip shrink-0" aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)}>
                  {c.name}
                  <span className="opacity-60">{c.items.length}</span>
                </button>
              ))}
            </div>
          </div>

          {sections.length === 0 ? (
            <p className="card p-10 text-center text-ink-soft">Nothing matches. Try another search or filter.</p>
          ) : (
            sections.map((c) => (
              <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
                <h2 id={`cat-${c.slug}`} className="h-display mb-3 text-2xl">
                  {c.name} <span className="text-base font-semibold text-ink-soft">({c.items.length})</span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {c.items.map((i) => (
                    <ItemCard key={i.slug} item={i} onEdit={() => setEditing(i.slug)} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <OptionGroup title="Veggie toppings" items={menu.toppings.filter((t) => t.group === "veg")} urlBase="/api/admin/toppings" />
            <OptionGroup title="Meat toppings" items={menu.toppings.filter((t) => t.group === "meat")} urlBase="/api/admin/toppings" />
          </div>
          <OptionGroup title="Wing sauces" items={menu.flavours} urlBase="/api/admin/flavours" />
          {isOwner && <ExtraToppingPrices menu={menu} />}
        </div>
      )}

      {editingItem && <ItemSheet key={editingItem.slug} item={editingItem} isOwner={isOwner} onClose={() => setEditing(null)} />}
    </div>
  );
}
