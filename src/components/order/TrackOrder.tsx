"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { ApiErrorBody } from "@/lib/api-types";
import { formatPhone, telHref } from "@/lib/format";
import { readRecentOrders, type RecentOrder } from "@/lib/recent-orders";
import { ChevronIcon } from "../icons";
import { useCart } from "../cart/CartProvider";

export function TrackOrder() {
  const { store } = useCart();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Saved orders live in this browser's storage, so they're read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecentOrders());
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, phone }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "Something went wrong. Please call us." }))) as ApiErrorBody;
        setError(body.error);
        setBusy(false);
        return;
      }
      const { token } = (await res.json()) as { token: string };
      router.push(`/order/${token}`);
    } catch {
      setError("We couldn't reach the store. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {recent.length > 0 && (
        <section className="card p-5" aria-labelledby="recent-title">
          <h2 id="recent-title" className="h-display text-2xl">
            Orders from this device
          </h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {recent.map((o) => (
              <li key={o.token}>
                <Link href={`/order/${o.token}`} className="flex min-h-12 items-center justify-between gap-3 py-2 font-semibold hover:text-brand-700">
                  <span>
                    Order #{o.orderNumber}
                    <span className="block text-sm font-normal text-ink-soft">
                      {new Date(o.placedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
        {recent.length > 0 && <h2 className="h-display text-2xl">Look up another order</h2>}
        <div>
          <label className="label" htmlFor="t-order">
            Order number
          </label>
          <input id="t-order" className="field" inputMode="numeric" autoComplete="off" placeholder="e.g. 1037" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="t-phone">
            Phone number on the order
          </label>
          <input id="t-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {error && (
          <p className="rounded-xl bg-tomato-50 p-3 text-sm font-semibold text-tomato-700" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !orderNumber.trim() || !phone.trim()}>
          {busy ? "Looking…" : "Check status"}
        </button>
        <p className="text-center text-sm text-ink-soft">
          Can&apos;t find it? Call us at{" "}
          <a className="font-semibold text-brand-700 underline" href={telHref(store.phone)}>
            {formatPhone(store.phone)}
          </a>
        </p>
      </form>
    </div>
  );
}
