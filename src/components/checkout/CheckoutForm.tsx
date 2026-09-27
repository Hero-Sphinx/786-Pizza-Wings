"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiErrorBody, CreateOrderResponse, QuoteResponse } from "@/lib/api-types";
import type { Fulfilment, PaymentMethod } from "@/lib/cart-schema";
import { formatPhone, telHref } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { useCart } from "../cart/CartProvider";

export type Slot = { iso: string; day: string; time: string };

type FieldErrors = Record<string, string[] | undefined>;

function randomKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function Radio({ name, value, checked, onChange, disabled, children }: { name: string; value: string; checked: boolean; onChange: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 ${checked ? "border-brand-600 bg-brand-50" : "border-ink/15 bg-white"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="size-5 accent-brand-600" />
      <span className="flex-1">{children}</span>
    </label>
  );
}

export function CheckoutForm({ asapOpen, slots }: { asapOpen: boolean; slots: Record<Fulfilment, Slot[]> }) {
  const { lines, ready, store, menu, clear, quote: localQuote } = useCart();
  const router = useRouter();
  const [idempotencyKey] = useState(randomKey);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [when, setWhen] = useState<string>(asapOpen ? "asap" : "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState({ line: "", unit: "", city: store.city, postalCode: "", notes: "" });
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const cashOnly = localQuote.cashOnly;
  const pickupOnly = localQuote.pickupOnly;
  const deliveryPossible = store.deliveryEnabled && !pickupOnly;
  const effectiveFulfilment: Fulfilment = deliveryPossible ? fulfilment : "pickup";
  const effectivePayment: PaymentMethod = cashOnly ? "cash" : payment;
  const scheduledFor = when && when !== "asap" ? when : undefined;
  const slotList = slots[effectiveFulfilment];
  const slotDays = useMemo(() => [...new Set(slotList.map((s) => s.day))], [slotList]);

  // Authoritative price from the server whenever something that affects it changes.
  const cartKey = JSON.stringify(lines.map(({ id: _id, ...l }) => l));
  const postal = effectiveFulfilment === "delivery" ? address.postalCode.trim() : "";
  useEffect(() => {
    if (lines.length === 0) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            lines: JSON.parse(cartKey),
            fulfilment: effectiveFulfilment,
            paymentMethod: effectivePayment,
            scheduledFor,
            postalCode: postal.length >= 6 ? postal : undefined,
          }),
        });
        if (res.ok) setQuote((await res.json()) as QuoteResponse);
      } catch {
        // Aborted or offline: keep showing the last quote.
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cartKey, lines.length, effectiveFulfilment, effectivePayment, scheduledFor, postal]);

  // An error from a previous attempt shouldn't linger once the customer changes something.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
  }, [cartKey, effectiveFulfilment, effectivePayment, when, name, phone, email, address, notes]);

  const items = new Map(menu.categories.flatMap((c) => c.items).map((i) => [i.slug, i]));
  const shown = quote ?? null;

  if (!ready) return <p className="mt-6 text-ink-soft">Loading your order…</p>;
  if (lines.length === 0) {
    return (
      <div className="card mt-6 p-8 text-center">
        <p className="h-display text-2xl">Your order is empty</p>
        <Link href="/menu" className="btn btn-gold mt-5">
          Browse the menu
        </Link>
      </div>
    );
  }

  const err = (path: string) => fieldErrors[path]?.[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (!when) return setFormError("Choose when you'd like your order.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          lines: lines.map(({ id: _id, ...l }) => l),
          fulfilment: effectiveFulfilment,
          paymentMethod: effectivePayment,
          customer: { name, phone, email: email || undefined },
          address: effectiveFulfilment === "delivery" ? { ...address, unit: address.unit || undefined, notes: address.notes || undefined } : undefined,
          scheduledFor,
          notes: notes || undefined,
          website: website || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "Something went wrong. Please call the store." }))) as ApiErrorBody;
        const details = body.details as { fieldErrors?: FieldErrors } | undefined;
        if (details?.fieldErrors) {
          // Flatten nested zod paths like customer.phone into our field keys.
          setFieldErrors(details.fieldErrors);
        }
        setFormError(body.error);
        setSubmitting(false);
        return;
      }
      const { token } = (await res.json()) as CreateOrderResponse;
      clear();
      router.push(`/order/${token}`);
    } catch {
      setFormError("We couldn't reach the store. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-8">
        <fieldset className="card p-5">
          <legend className="h-display float-left mb-3 w-full text-2xl">1. Pickup or delivery</legend>
          <div className="clear-both flex flex-col gap-3 sm:flex-row">
            <Radio name="fulfilment" value="pickup" checked={effectiveFulfilment === "pickup"} onChange={() => setFulfilment("pickup")}>
              <span className="font-bold">Pickup</span>
              <span className="block text-sm text-ink-soft">Free · {store.addressLine}</span>
            </Radio>
            <Radio name="fulfilment" value="delivery" checked={effectiveFulfilment === "delivery"} onChange={() => setFulfilment("delivery")} disabled={!deliveryPossible}>
              <span className="font-bold">Delivery</span>
              <span className="block text-sm text-ink-soft">
                {!store.deliveryEnabled ? "Not available right now" : pickupOnly ? "Your cart has a pickup-only deal" : `${formatCents(store.deliveryFeeCents)} delivery fee`}
              </span>
            </Radio>
          </div>

          {effectiveFulfilment === "delivery" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label className="label" htmlFor="addr-line">Street address</label>
                <input id="addr-line" className="field" autoComplete="address-line1" required value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} aria-invalid={!!err("address")} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="addr-unit">Unit / Apt (optional)</label>
                <input id="addr-unit" className="field" autoComplete="address-line2" value={address.unit} onChange={(e) => setAddress({ ...address, unit: e.target.value })} />
              </div>
              <div className="sm:col-span-3">
                <label className="label" htmlFor="addr-city">City</label>
                <input id="addr-city" className="field" autoComplete="address-level2" required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              </div>
              <div className="sm:col-span-3">
                <label className="label" htmlFor="addr-postal">Postal code</label>
                <input id="addr-postal" className="field uppercase" autoComplete="postal-code" required maxLength={7} value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
              </div>
              <div className="sm:col-span-6">
                <label className="label" htmlFor="addr-notes">Buzzer, directions (optional)</label>
                <input id="addr-notes" className="field" maxLength={200} value={address.notes} onChange={(e) => setAddress({ ...address, notes: e.target.value })} />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="card p-5">
          <legend className="h-display float-left mb-3 w-full text-2xl">2. When</legend>
          <div className="clear-both space-y-3">
            {asapOpen && (
              <Radio name="when" value="asap" checked={when === "asap"} onChange={() => setWhen("asap")}>
                <span className="font-bold">As soon as possible</span>
                <span className="block text-sm text-ink-soft">
                  About {effectiveFulfilment === "delivery" ? store.deliveryLeadMinutes : store.pickupLeadMinutes} minutes
                </span>
              </Radio>
            )}
            {slotList.length > 0 ? (
              <div>
                <label className="label" htmlFor="slot">
                  {asapOpen ? "Or schedule for later" : "We're closed right now. Schedule your order:"}
                </label>
                <select id="slot" className="field" value={when === "asap" ? "" : when} onChange={(e) => setWhen(e.target.value || (asapOpen ? "asap" : ""))}>
                  <option value="">{asapOpen ? "Choose a time…" : "Choose a time"}</option>
                  {slotDays.map((day) => (
                    <optgroup key={day} label={day}>
                      {slotList
                        .filter((s) => s.day === day)
                        .map((s) => (
                          <option key={s.iso} value={s.iso}>
                            {s.day} · {s.time}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : (
              !asapOpen && (
                <p className="font-semibold text-tomato-700">
                  We&apos;re not taking online orders right now. Please call{" "}
                  <a className="underline" href={telHref(store.phone)}>
                    {formatPhone(store.phone)}
                  </a>
                  .
                </p>
              )
            )}
          </div>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="h-display float-left mb-3 w-full text-2xl">3. Your details</legend>
          <div className="clear-both grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="c-name">Name</label>
              <input id="c-name" className="field" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err("customer")} />
            </div>
            <div>
              <label className="label" htmlFor="c-phone">Phone</label>
              <input id="c-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="mt-1 text-xs text-ink-soft">
                We&apos;ll call only if there&apos;s a question about your order.{" "}
                <Link href="/privacy" className="underline">
                  Privacy
                </Link>
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-email">Email for your receipt (optional)</label>
              <input id="c-email" className="field" type="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-notes">Order notes (optional)</label>
              <textarea id="c-notes" className="field min-h-20" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="h-display float-left mb-3 w-full text-2xl">4. Payment</legend>
          <div className="clear-both flex flex-col gap-3 sm:flex-row">
            <Radio name="payment" value="cash" checked={effectivePayment === "cash"} onChange={() => setPayment("cash")}>
              <span className="font-bold">Cash</span>
              <span className="block text-sm text-ink-soft">Pay on {effectiveFulfilment}</span>
            </Radio>
            <Radio name="payment" value="card_in_person" checked={effectivePayment === "card_in_person"} onChange={() => setPayment("card_in_person")} disabled={cashOnly}>
              <span className="font-bold">Debit or credit</span>
              <span className="block text-sm text-ink-soft">{cashOnly ? "Your cart has a cash-only deal" : `Pay on ${effectiveFulfilment}`}</span>
            </Radio>
          </div>
        </fieldset>
      </div>

      <aside className="card p-5 lg:sticky lg:top-32" aria-labelledby="summary-title">
        <h2 id="summary-title" className="h-display text-2xl">
          Order summary
        </h2>
        <ul className="mt-3 divide-y divide-ink/10">
          {lines.map((l, i) => {
            const item = items.get(l.itemSlug);
            const p = shown?.lines.find((x) => x.index === i);
            const lineError = shown?.errors.find((e) => e.line === i);
            return (
              <li key={l.id} className="py-3">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">
                    {l.quantity} × {item?.name ?? "Item"}
                  </span>
                  <span className="font-semibold">{p ? formatCents(p.lineTotalCents) : "…"}</span>
                </div>
                {p?.details.map((d) => (
                  <p key={d} className="text-sm text-ink-soft">
                    {d}
                  </p>
                ))}
                {lineError && <p className="mt-1 text-sm font-semibold text-tomato-700">{lineError.message}</p>}
              </li>
            );
          })}
        </ul>
        {shown && (
          <dl className="mt-3 space-y-1 border-t border-ink/10 pt-3">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatCents(shown.subtotalCents)}</dd>
            </div>
            {shown.deliveryFeeCents > 0 && (
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>{formatCents(shown.deliveryFeeCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>HST</dt>
              <dd>{formatCents(shown.taxCents)}</dd>
            </div>
            <div className="flex justify-between pt-2 text-xl font-extrabold">
              <dt>Total</dt>
              <dd>{formatCents(shown.totalCents)}</dd>
            </div>
          </dl>
        )}
        {shown?.errors
          .filter((e) => e.line === null)
          .map((e) => (
            <p key={e.message} className="mt-3 rounded-xl bg-tomato-50 p-3 text-sm font-semibold text-tomato-700">
              {e.message}
            </p>
          ))}
        {formError && (
          <p className="mt-3 rounded-xl bg-tomato-50 p-3 text-sm font-semibold text-tomato-700" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-5 w-full text-lg" disabled={submitting || !shown || shown.errors.length > 0 || !when}>
          {submitting ? "Placing order…" : shown ? `Place order · ${formatCents(shown.totalCents)}` : "Checking prices…"}
        </button>
        <p className="mt-3 text-center text-sm text-ink-soft">
          You pay when you get your food. Questions?{" "}
          <a href={telHref(store.phone)} className="font-semibold text-brand-700 underline">
            {formatPhone(store.phone)}
          </a>
        </p>
      </aside>
    </form>
  );
}
