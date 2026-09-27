"use client";

import { useState } from "react";
import type { MenuItem, MenuSnapshot } from "@/lib/menu-types";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { useAdminApi } from "./useAdminApi";

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

function ItemRow({ item, isOwner }: { item: MenuItem; isOwner: boolean }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [prices, setPrices] = useState(() => Object.fromEntries(item.variants.map((v) => [v.code, (v.priceCents / 100).toFixed(2)])));
  const [editing, setEditing] = useState(false);

  const savePrices = async () => {
    const variants = item.variants.map((v) => ({ code: v.code, priceCents: parseDollarsToCents(prices[v.code] ?? "") }));
    const bad = variants.find((v) => v.priceCents === null);
    if (bad) return alert(`Check the price for ${bad.code}`);
    if (await patch(`/api/admin/items/${item.slug}`, { variants }, "Prices saved")) setEditing(false);
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Toggle on={item.available} label={`${item.name} available`} disabled={busy} onChange={(v) => patch(`/api/admin/items/${item.slug}`, { isAvailable: v }, v ? "Back on" : "Marked sold out")} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${item.available ? "" : "text-ink-soft line-through"}`}>{item.name}</p>
          <p className="text-sm text-ink-soft">{item.variants.map((v) => `${v.label} ${formatCents(v.priceCents)}`).join(" · ")}</p>
        </div>
        {isOwner && (
          <button type="button" className="btn btn-ghost min-h-10 text-sm" onClick={() => setEditing((e) => !e)}>
            {editing ? "Close" : "Edit prices"}
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-3 rounded-xl bg-crust/60 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {item.variants.map((v) => (
              <div key={v.code}>
                <label className="label" htmlFor={`${item.slug}-${v.code}`}>
                  {v.label}
                </label>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input id={`${item.slug}-${v.code}`} className="field" inputMode="decimal" value={prices[v.code]} onChange={(e) => setPrices({ ...prices, [v.code]: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary mt-3" disabled={busy} onClick={savePrices}>
            Save prices
          </button>
        </div>
      )}
      {(error || saved) && <p className={`mt-1 text-sm font-semibold ${error ? "text-tomato-700" : "text-brand-700"}`}>{error ?? saved}</p>}
    </li>
  );
}

function SimpleToggle({ url, name, available }: { url: string; name: string; available: boolean }) {
  const { patch, busy, error } = useAdminApi();
  return (
    <li className="flex items-center gap-3 py-2">
      <Toggle on={available} label={`${name} available`} disabled={busy} onChange={(v) => patch(url, { isAvailable: v })} />
      <span className={available ? "" : "text-ink-soft line-through"}>{name}</span>
      {error && <span className="text-sm text-tomato-700">{error}</span>}
    </li>
  );
}

function ExtraToppingPrices({ menu }: { menu: MenuSnapshot }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [values, setValues] = useState(() => Object.fromEntries(menu.sizes.map((s) => [s.code, s.extraToppingCents === null ? "" : (s.extraToppingCents / 100).toFixed(2)])));
  const save = async () => {
    for (const s of menu.sizes) {
      const raw = values[s.code].trim();
      const cents = raw === "" ? null : parseDollarsToCents(raw);
      if (raw !== "" && cents === null) return alert(`Check the price for ${s.label}`);
      if (!(await patch(`/api/admin/sizes/${s.code}`, { extraToppingCents: cents }, "Extra topping prices saved"))) return;
    }
  };
  return (
    <section className="card p-5">
      <h2 className="h-display text-2xl">Extra topping prices</h2>
      <p className="mt-1 text-sm text-ink-soft">Price per extra topping, by pizza size. Leave empty to not offer extra toppings online for that size.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {menu.sizes.map((s) => (
          <div key={s.code}>
            <label className="label" htmlFor={`extra-${s.code}`}>
              {s.label}
            </label>
            <div className="flex items-center gap-1">
              <span>$</span>
              <input id={`extra-${s.code}`} className="field" inputMode="decimal" placeholder="not offered" value={values[s.code]} onChange={(e) => setValues({ ...values, [s.code]: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary mt-3" disabled={busy} onClick={save}>
        Save
      </button>
      {(error || saved) && <p className={`mt-2 text-sm font-semibold ${error ? "text-tomato-700" : "text-brand-700"}`}>{error ?? saved}</p>}
    </section>
  );
}

export function MenuEditor({ menu, isOwner }: { menu: MenuSnapshot; isOwner: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-3xl">Menu</h1>
        <p className="text-ink-soft">Switch items off when you run out. Changes show on the website right away.{!isOwner && " Only the owner can change prices."}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          {menu.categories.map((c) => (
            <section key={c.slug} className="card p-5">
              <h2 className="h-display text-2xl">{c.name}</h2>
              <ul className="divide-y divide-ink/10">
                {c.items.map((i) => (
                  <ItemRow key={i.slug} item={i} isOwner={isOwner} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="h-display text-2xl">Toppings</h2>
            <ul>
              {menu.toppings.map((t) => (
                <SimpleToggle key={t.slug} url={`/api/admin/toppings/${t.slug}`} name={t.name} available={t.available} />
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="h-display text-2xl">Wing sauces</h2>
            <ul>
              {menu.flavours.map((f) => (
                <SimpleToggle key={f.slug} url={`/api/admin/flavours/${f.slug}`} name={f.name} available={f.available} />
              ))}
            </ul>
          </section>
        </div>
      </div>

      {isOwner && <ExtraToppingPrices menu={menu} />}
    </div>
  );
}
