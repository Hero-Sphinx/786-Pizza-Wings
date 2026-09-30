"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPhone, telHref } from "@/lib/format";
import { formatDayLabel, formatTime } from "@/lib/hours";
import { formatCents } from "@/lib/money";
import { ACTION_LABEL, STATUS_LABEL, allowedTransitions, type OrderStatus } from "@/lib/order-status";
import { staffErrorMessage } from "@/lib/staff-errors";

const POLL_MS = 8000;
const SOUND_KEY = "786-admin-sound";

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = [880, 1175, 1568][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.25);
    });
  } catch {
    // No audio available.
  }
}

function minutesAgo(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

function OrderCard({
  order,
  timezone,
  now,
  onStatus,
  onPrint,
  busy,
}: {
  order: AdminOrder;
  timezone: string;
  now: number;
  onStatus: (o: AdminOrder, to: OrderStatus, note?: string) => void;
  onPrint: (o: AdminOrder) => void;
  busy: boolean;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");
  const actions = allowedTransitions(order.status, order.fulfilment).filter((s) => s !== "cancelled");
  const due = order.scheduledFor ? new Date(order.scheduledFor) : null;

  return (
    <article className={`card overflow-hidden ${order.status === "new" ? "ring-4 ring-gold-400" : ""}`} aria-label={`Order ${order.orderNumber}`}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${order.fulfilment === "delivery" ? "bg-tomato-50" : "bg-brand-50"}`}>
        <span className="h-display text-2xl">#{order.orderNumber}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold text-white ${order.fulfilment === "delivery" ? "bg-tomato-600" : "bg-brand-600"}`}>
          {order.fulfilment === "delivery" ? "DELIVERY" : "PICKUP"}
        </span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold">{STATUS_LABEL[order.status].staff}</span>
        <span className="ml-auto text-sm text-ink-soft">{minutesAgo(order.createdAt, now)}</span>
      </div>

      <div className="space-y-3 p-4">
        <p className={`font-bold ${due ? "text-tomato-700" : ""}`}>
          {due ? `⏰ Scheduled: ${formatDayLabel(due, new Date(now), timezone)} ${formatTime(due, timezone)}` : "ASAP"}
        </p>
        <div>
          <p className="font-semibold">{order.customerName}</p>
          <a href={telHref(order.customerPhone)} className="font-semibold text-brand-700 underline">
            {formatPhone(order.customerPhone)}
          </a>
          {order.address && (
            <p className="mt-1">
              {[order.address.unit, order.address.line].filter(Boolean).join(" - ")}, {order.address.city} {order.address.postalCode}
              {order.address.notes && <span className="block text-sm text-ink-soft">{order.address.notes}</span>}
            </p>
          )}
        </div>

        <ul className="space-y-2 border-y border-ink/10 py-3">
          {order.items.map((i, idx) => (
            <li key={idx}>
              <p className="font-bold">
                {i.quantity} × {i.name}
                {i.variant && <span className="font-semibold text-brand-700"> · {i.variant}</span>}
              </p>
              {i.details.map((d) => (
                <p key={d} className="pl-4 text-sm">
                  {d}
                </p>
              ))}
              {i.notes && <p className="pl-4 text-sm font-semibold text-tomato-700">Note: {i.notes}</p>}
            </li>
          ))}
        </ul>
        {order.notes && <p className="rounded-xl bg-gold-100 p-2 text-sm font-semibold">Order note: {order.notes}</p>}
        <p className="flex justify-between font-bold">
          <span>{order.paymentMethod === "cash" ? "💵 Cash" : "💳 Card"} on {order.fulfilment}</span>
          <span>{formatCents(order.totalCents)}</span>
        </p>

        {confirmCancel ? (
          <div className="space-y-2 rounded-xl bg-tomato-50 p-3">
            <label className="label" htmlFor={`reason-${order.id}`}>
              Why cancel? (the customer sees the order as cancelled)
            </label>
            <input id={`reason-${order.id}`} className="field" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer called to cancel" />
            <div className="flex gap-2">
              <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => onStatus(order, "cancelled", reason || undefined)}>
                Cancel order
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {actions.map((to) => (
              <button key={to} type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => onStatus(order, to)}>
                {ACTION_LABEL[to]}
              </button>
            ))}
            <button type="button" className="btn btn-outline" onClick={() => onPrint(order)}>
              Print
            </button>
            {allowedTransitions(order.status, order.fulfilment).includes("cancelled") && (
              <button type="button" className="btn btn-ghost text-tomato-700" onClick={() => setConfirmCancel(true)}>
                Cancel…
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Ticket({ order, timezone }: { order: AdminOrder; timezone: string }) {
  const due = order.scheduledFor ? new Date(order.scheduledFor) : null;
  return (
    <div className="hidden font-mono text-sm print:block">
      <p className="text-center text-lg font-bold">786 PIZZA &amp; WINGS</p>
      <p className="text-center text-2xl font-bold">
        #{order.orderNumber} {order.fulfilment.toUpperCase()}
      </p>
      <p>{due ? `FOR: ${formatDayLabel(due, new Date(), timezone)} ${formatTime(due, timezone)}` : "ASAP"}</p>
      <p>Placed: {formatTime(new Date(order.createdAt), timezone)}</p>
      <p>
        {order.customerName} {formatPhone(order.customerPhone)}
      </p>
      {order.address && (
        <p>
          {[order.address.unit, order.address.line].filter(Boolean).join("-")}, {order.address.city} {order.address.postalCode} {order.address.notes}
        </p>
      )}
      <hr className="my-2 border-dashed border-black" />
      {order.items.map((i, idx) => (
        <div key={idx} className="mb-1">
          <p className="font-bold">
            {i.quantity}x {i.name} {i.variant ? `(${i.variant})` : ""}
          </p>
          {i.details.map((d) => (
            <p key={d}>  - {d}</p>
          ))}
          {i.notes && <p>  NOTE: {i.notes}</p>}
        </div>
      ))}
      {order.notes && <p className="mt-1 font-bold">ORDER NOTE: {order.notes}</p>}
      <hr className="my-2 border-dashed border-black" />
      <p>Subtotal {formatCents(order.subtotalCents)}</p>
      {order.deliveryFeeCents > 0 && <p>Delivery {formatCents(order.deliveryFeeCents)}</p>}
      <p>HST {formatCents(order.taxCents)}</p>
      <p className="text-lg font-bold">TOTAL {formatCents(order.totalCents)}</p>
      <p>PAY: {order.paymentMethod === "cash" ? "CASH" : "CARD"}</p>
    </div>
  );
}

export function OrderBoard({ initial, timezone, orderingEnabled }: { initial: AdminOrder[]; timezone: string; orderingEnabled: boolean }) {
  const [orders, setOrders] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [printing, setPrinting] = useState<AdminOrder | null>(null);
  const seen = useRef(new Set(initial.map((o) => o.id)));
  const router = useRouter();

  useEffect(() => {
    try {
      // Restore the sound preference (browser-only) after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSound(window.localStorage.getItem(SOUND_KEY) === "on");
    } catch {
      // storage unavailable
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders?view=active", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { orders: AdminOrder[]; now: string };
      const fresh = body.orders.filter((o) => !seen.current.has(o.id));
      fresh.forEach((o) => seen.current.add(o.id));
      if (fresh.length > 0) {
        if (sound) chime();
        document.title = `(${fresh.length}) New order!`;
      }
      setOrders(body.orders);
      setStale(false);
    } catch {
      setStale(true);
    }
    setNow(Date.now());
  }, [sound, router]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    const onFocus = () => {
      document.title = "Orders | 786 Staff";
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Keep ringing every 30 s while any order is still unaccepted.
  useEffect(() => {
    if (!sound || !orders.some((o) => o.status === "new")) return;
    const t = setInterval(chime, 30_000);
    return () => clearInterval(t);
  }, [sound, orders]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    if (next) chime(); // the click also unlocks audio in the browser
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // storage unavailable
    }
  };

  const setStatus = async (o: AdminOrder, to: OrderStatus, note?: string) => {
    setBusyId(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, note }),
      });
      if (!res.ok) {
        setError(`#${o.orderNumber}: ${await staffErrorMessage(res, "Update failed")}`);
      }
    } catch {
      setError("Can't reach the server. Check the connection.");
    }
    await refresh();
    setBusyId(null);
  };

  const columns: { title: string; statuses: OrderStatus[] }[] = [
    { title: "New", statuses: ["new"] },
    { title: "In the kitchen", statuses: ["accepted"] },
    { title: "Ready / on the way", statuses: ["ready", "out_for_delivery"] },
  ];

  return (
    <>
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="h-display text-3xl">Live orders</h1>
          {!orderingEnabled && (
            <Link href="/admin/settings" className="rounded-full bg-tomato-600 px-3 py-1 text-sm font-bold text-white">
              Online ordering is PAUSED
            </Link>
          )}
          {stale && <span className="rounded-full bg-gold-100 px-3 py-1 text-sm font-semibold text-gold-700">Connection lost, retrying…</span>}
          <button type="button" onClick={toggleSound} className={`btn ml-auto ${sound ? "btn-outline" : "btn-gold"}`}>
            {sound ? "🔔 Sound on" : "🔕 Tap to turn on sound"}
          </button>
        </div>
        {error && (
          <p className="mb-4 rounded-xl bg-tomato-50 p-3 font-semibold text-tomato-700" role="alert">
            {error}
          </p>
        )}
        {orders.length === 0 ? (
          <p className="card p-10 text-center text-lg text-ink-soft">No open orders. New ones appear here automatically.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {columns.map((col) => {
              const list = orders.filter((o) => col.statuses.includes(o.status));
              return (
                <section key={col.title} aria-label={col.title}>
                  <h2 className="mb-2 font-bold uppercase tracking-wide text-ink-soft">
                    {col.title} ({list.length})
                  </h2>
                  <div className="space-y-4">
                    {list.map((o) => (
                      <OrderCard key={o.id} order={o} timezone={timezone} now={now} onStatus={setStatus} onPrint={setPrinting} busy={busyId === o.id} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      {printing && <Ticket order={printing} timezone={timezone} />}
    </>
  );
}
