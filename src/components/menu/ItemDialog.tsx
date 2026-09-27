"use client";

import { useMemo, useState } from "react";
import type { CartLineInput } from "@/lib/cart-schema";
import { localParts } from "@/lib/hours";
import { describeDays, type MenuItem } from "@/lib/menu-types";
import { formatCents } from "@/lib/money";
import { quoteCart } from "@/lib/pricing";
import { MinusIcon, PlusIcon } from "../icons";
import { useCart } from "../cart/CartProvider";
import { Sheet } from "../ui/Sheet";
import { FlavourPicker, ToppingPicker, UnitMeter } from "./pickers";

function defaultVariant(item: MenuItem) {
  const open = item.variants.filter((v) => v.available);
  return (open.find((v) => v.code === "large") ?? open[0] ?? item.variants[0]).code;
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-ink/10 py-5 first:pt-1 last:border-0">
      <h3 className="flex items-center gap-2 font-bold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm text-white">{n}</span>
        {title}
      </h3>
      {hint && <p className="ml-9 mt-0.5 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ItemDialog({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { menu, store, add, setCartOpen } = useCart();
  const [variantCode, setVariantCode] = useState(() => defaultVariant(item));
  const [toppings, setToppings] = useState<string[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [flavours, setFlavours] = useState<string[]>([]);
  const [dealPizzas, setDealPizzas] = useState<string[][]>(() => Array.from({ length: item.deal?.pizzas?.count ?? 0 }, () => []));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const variant = item.variants.find((v) => v.code === variantCode)!;
  const size = menu.sizes.find((s) => s.code === variant.pizzaSize);
  const unitsOf = (slugs: string[]) => slugs.reduce((n, s) => n + (menu.toppings.find((t) => t.slug === s)?.units ?? 1), 0);
  const extrasAllowed = size?.extraToppingCents != null;

  const line: CartLineInput = useMemo(() => {
    const l: CartLineInput = { itemSlug: item.slug, variantCode, quantity, notes: notes.trim() || undefined };
    if (item.kind === "pizza") l.pizza = { toppings, removed };
    if (item.kind === "wings" || item.deal?.wings) l.wingFlavours = flavours;
    if (item.deal?.pizzas) l.dealPizzas = dealPizzas.map((t) => ({ toppings: t }));
    return l;
  }, [item, variantCode, quantity, notes, toppings, removed, flavours, dealPizzas]);

  const weekday = localParts(new Date(), store.hours.timezone).weekday;
  const quote = quoteCart(menu, [line], { fulfilment: "pickup", weekday });
  const priced = quote.lines[0];
  const error = quote.errors.find((e) => e.line === 0)?.message;
  const dayRestricted = item.availableDays.length > 0 && !item.availableDays.includes(weekday);

  const submit = () => {
    if (error) return setShowErrors(true);
    add(line);
    onClose();
    setCartOpen(false);
  };

  let step = 0;
  const maxFlavours = item.kind === "wings" ? (variant.maxFlavours ?? 1) : (item.deal?.wings?.maxFlavours ?? 1);

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy="item-title"
      title={
        <>
          {item.name}
          {item.description && <span className="mt-1 block font-sans text-sm font-normal text-ink-soft">{item.description}</span>}
        </>
      }
      footer={
        <div className="space-y-3">
          {showErrors && error && (
            <p className="rounded-xl bg-tomato-50 p-3 text-sm font-semibold text-tomato-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-ink/15" role="group" aria-label="Quantity">
              <button type="button" className="grid size-11 place-items-center disabled:opacity-40" onClick={() => setQuantity((q) => q - 1)} disabled={quantity <= 1} aria-label="One fewer">
                <MinusIcon />
              </button>
              <span className="w-7 text-center font-bold">{quantity}</span>
              <button type="button" className="grid size-11 place-items-center disabled:opacity-40" onClick={() => setQuantity((q) => q + 1)} disabled={quantity >= 20} aria-label="One more">
                <PlusIcon />
              </button>
            </div>
            <button type="button" onClick={submit} className="btn btn-primary flex-1 text-lg" aria-disabled={!!error || dayRestricted} disabled={dayRestricted}>
              {dayRestricted
                ? `Available ${describeDays(item.availableDays)}`
                : `Add · ${formatCents(priced?.lineTotalCents ?? variant.priceCents * quantity)}`}
            </button>
          </div>
        </div>
      }
    >
      {(item.cashOnly || item.pickupOnly || item.taxMode !== "standard" || item.availableDays.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm font-semibold">
          {item.availableDays.length > 0 && <span className="rounded-full bg-gold-100 px-3 py-1 text-gold-700">{describeDays(item.availableDays)} only</span>}
          {item.pickupOnly && <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">Pickup only</span>}
          {item.cashOnly && <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">Cash only</span>}
          {item.taxMode === "exempt" && <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">No tax</span>}
          {item.taxMode === "included" && <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">Tax included</span>}
        </div>
      )}

      {item.variants.length > 1 && (
        <Step n={++step} title={item.kind === "wings" ? "How many wings?" : "Choose a size"}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
            {item.variants.map((v) => {
              const s = menu.sizes.find((x) => x.code === v.pizzaSize);
              return (
                <label key={v.code} className="chip cursor-pointer justify-between rounded-2xl py-2">
                  <input
                    type="radio"
                    name="variant"
                    className="sr-only"
                    checked={v.code === variantCode}
                    disabled={!v.available}
                    onChange={() => {
                      setVariantCode(v.code);
                      setFlavours((f) => f.slice(0, v.maxFlavours ?? 1));
                    }}
                  />
                  <span>
                    {v.label}
                    {s?.inches && <span className="block text-xs opacity-80">{s.inches}″</span>}
                  </span>
                  <span className="font-bold">{formatCents(v.priceCents)}</span>
                </label>
              );
            })}
          </div>
        </Step>
      )}

      {item.kind === "pizza" && item.includedToppingUnits > 0 && (
        <Step n={++step} title={`Pick ${item.includedToppingUnits} toppings`} hint="Double cheese, BBQ chicken, tandoori chicken and ground beef count as 2.">
          <div className="mb-3">
            <UnitMeter used={unitsOf(toppings)} limit={item.includedToppingUnits} />
          </div>
          <ToppingPicker
            name="toppings"
            toppings={menu.toppings}
            selected={toppings}
            onChange={setToppings}
            remainingUnits={extrasAllowed ? Infinity : item.includedToppingUnits - unitsOf(toppings)}
          />
          {extrasAllowed && <p className="mt-3 text-sm text-ink-soft">Extra toppings: {formatCents(size!.extraToppingCents!)} each on a {size!.label}.</p>}
        </Step>
      )}

      {item.kind === "pizza" && item.standardToppings.length > 0 && (
        <Step n={++step} title="What's on it" hint="Tap anything you'd like left off.">
          <div className="flex flex-wrap gap-2">
            {item.standardToppings.map((t, i) => (
              <label key={t} className="chip cursor-pointer select-none has-[input:checked]:border-tomato-600! has-[input:checked]:bg-tomato-50! has-[input:checked]:text-tomato-700! has-[input:checked]:line-through">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={removed.includes(i)}
                  onChange={() => setRemoved((r) => (r.includes(i) ? r.filter((x) => x !== i) : [...r, i]))}
                />
                {t}
              </label>
            ))}
          </div>
          {extrasAllowed ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">Add extra toppings ({formatCents(size!.extraToppingCents!)} each)</p>
              <ToppingPicker name="extras" toppings={menu.toppings} selected={toppings} onChange={setToppings} remainingUnits={Infinity} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Want extra toppings? Add a note or call us.</p>
          )}
        </Step>
      )}

      {item.deal?.pizzas &&
        dealPizzas.map((selected, i) => {
          const cfg = item.deal!.pizzas!;
          const combinedUsed = dealPizzas.reduce((n, t) => n + unitsOf(t), 0);
          const perLimit = cfg.toppingsPerPizza;
          const remaining = extrasAllowed
            ? Infinity
            : Math.min(perLimit !== undefined ? perLimit - unitsOf(selected) : Infinity, cfg.toppingsCombined !== undefined ? cfg.toppingsCombined - combinedUsed : Infinity);
          return (
            <Step
              key={i}
              n={++step}
              title={`Pizza ${i + 1}${size ? ` (${size.label}${size.inches ? ` ${size.inches}″` : ""})` : ""}`}
              hint={perLimit !== undefined ? `Up to ${perLimit} toppings. Leave empty for cheese.` : `Up to ${cfg.toppingsCombined} toppings across all pizzas.`}
            >
              <div className="mb-3">
                {perLimit !== undefined ? <UnitMeter used={unitsOf(selected)} limit={perLimit} /> : <UnitMeter used={combinedUsed} limit={cfg.toppingsCombined!} label="toppings in total" />}
              </div>
              <ToppingPicker
                name={`deal-pizza-${i}`}
                toppings={menu.toppings}
                selected={selected}
                onChange={(next) => setDealPizzas((all) => all.map((t, j) => (j === i ? next : t)))}
                remainingUnits={remaining}
              />
            </Step>
          );
        })}

      {(item.kind === "wings" || item.deal?.wings) && (
        <Step
          n={++step}
          title={item.deal?.wings ? `${item.deal.wings.count} wings: choose a sauce` : "Choose your sauce"}
          hint={maxFlavours > 1 ? `Pick up to ${maxFlavours} sauces and we'll split them.` : undefined}
        >
          <FlavourPicker name="flavours" flavours={menu.flavours} selected={flavours} max={maxFlavours} onChange={setFlavours} />
        </Step>
      )}

      {item.deal && item.deal.includes.length > 0 && (
        <Step n={++step} title="Also included">
          <ul className="space-y-1">
            {item.deal.includes.map((inc) => (
              <li key={inc} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
                {inc}
              </li>
            ))}
          </ul>
          {item.deal.includes.some((i) => /pop/i.test(i)) && <p className="mt-2 text-sm text-ink-soft">Pop flavours depend on what&apos;s in store. Add a preference below.</p>}
        </Step>
      )}

      <Step n={++step} title="Anything else?">
        <label htmlFor="item-notes" className="sr-only">
          Note for the kitchen
        </label>
        <textarea
          id="item-notes"
          className="field min-h-20"
          maxLength={140}
          placeholder="e.g. well done, sauce on the side, Coke please"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Step>
    </Sheet>
  );
}
