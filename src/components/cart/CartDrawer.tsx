"use client";

import Link from "next/link";
import { formatCents } from "@/lib/money";
import { MinusIcon, PlusIcon } from "../icons";
import { Sheet } from "../ui/Sheet";
import { useCart } from "./CartProvider";

export function CartDrawer() {
  const { lines, quote, menu, cartOpen, setCartOpen, setQuantity, remove } = useCart();
  const items = new Map(menu.categories.flatMap((c) => c.items).map((i) => [i.slug, i]));
  const priced = new Map(quote.lines.map((l) => [l.index, l]));
  const errors = new Map(quote.errors.filter((e) => e.line !== null).map((e) => [e.line!, e.message]));
  const close = () => setCartOpen(false);

  return (
    <Sheet
      open={cartOpen}
      onClose={close}
      title="Your order"
      labelledBy="cart-title"
      footer={
        lines.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between text-lg">
              <span className="font-semibold">Subtotal</span>
              <span className="font-bold">{formatCents(quote.subtotalCents)}</span>
            </div>
            <p className="text-sm text-ink-soft">Tax and any delivery fee are added at checkout.</p>
            {errors.size > 0 ? (
              <p className="rounded-xl bg-tomato-50 p-3 text-sm font-medium text-tomato-700" role="alert">
                Please fix the highlighted items before checking out.
              </p>
            ) : (
              <Link href="/checkout" onClick={close} className="btn btn-primary w-full text-lg">
                Checkout
              </Link>
            )}
          </div>
        ) : undefined
      }
    >
      {lines.length === 0 ? (
        <div className="py-10 text-center">
          <p className="h-display text-xl">Your order is empty</p>
          <p className="mt-2 text-ink-soft">Hungry? Our deals feed the whole crew.</p>
          <Link href="/menu" onClick={close} className="btn btn-gold mt-6">
            Browse the menu
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-ink/10">
          {lines.map((line, index) => {
            const item = items.get(line.itemSlug);
            const variant = item?.variants.find((v) => v.code === line.variantCode);
            const p = priced.get(index);
            const error = errors.get(index);
            return (
              <li key={line.id} className="py-4 first:pt-0">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">
                      {item?.name ?? "Unavailable item"}
                      {variant && item && item.variants.length > 1 && <span className="font-medium text-ink-soft"> · {variant.label}</span>}
                    </p>
                    {p && p.details.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                        {p.details.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    )}
                    {line.notes && <p className="mt-1 text-sm italic text-ink-soft">“{line.notes}”</p>}
                    {error && (
                      <p className="mt-2 text-sm font-semibold text-tomato-700" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-bold">{p ? formatCents(p.lineTotalCents) : ""}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center rounded-full border border-ink/15" role="group" aria-label="Quantity">
                    <button
                      type="button"
                      className="grid size-11 place-items-center rounded-full hover:bg-brand-50 disabled:opacity-40"
                      onClick={() => setQuantity(line.id, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      aria-label="One fewer"
                    >
                      <MinusIcon />
                    </button>
                    <span className="w-8 text-center font-bold" aria-live="polite">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="grid size-11 place-items-center rounded-full hover:bg-brand-50 disabled:opacity-40"
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                      disabled={line.quantity >= 20}
                      aria-label="One more"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                  <button type="button" className="btn btn-ghost min-h-11 text-sm text-tomato-700 hover:bg-tomato-50" onClick={() => remove(line.id)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
