"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPhone, mapsHref, telHref } from "@/lib/format";
import { formatDayLabel, formatTime } from "@/lib/hours";
import { formatCents } from "@/lib/money";
import { ACTION_LABEL, STATUS_LABEL, allowedTransitions, type OrderStatus } from "@/lib/order-status";
import { staffErrorMessage } from "@/lib/staff-errors";
import { PhoneIcon, PinIcon } from "../icons";
import { ReceiptTicket, type ReceiptStore } from "./ReceiptTicket";

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

const minutesBetween = (from: number, to: number) => Math.round((to - from) / 60_000);

function formatMinutes(m: number) {
  if (m < 1) return "just now";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

type Urgency = "ok" | "warn" | "late";

/** How worried staff should be: new orders need accepting fast; accepted ones need to beat the due time. */
function urgency(order: AdminOrder, now: number): Urgency {
  const waited = minutesBetween(new Date(order.createdAt).getTime(), now);
  if (order.status === "new") return waited >= 10 ? "late" : waited >= 5 ? "warn" : "ok";
  if (order.scheduledFor) {
    const left = minutesBetween(now, new Date(order.scheduledFor).getTime());
    return left < 0 ? "late" : left < 10 ? "warn" : "ok";
  }
  return waited >= 45 ? "late" : waited >= 30 ? "warn" : "ok";
}

const STEPS = ["Received", "Cooking", "Ready", "Done"];
const stepOf = (s: OrderStatus) => ({ new: 0, accepted: 1, ready: 2, out_for_delivery: 2, completed: 3, cancelled: 0 })[s];

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
  const canCancel = allowedTransitions(order.status, order.fulfilment).includes("cancelled");
  const due = order.scheduledFor ? new Date(order.scheduledFor) : null;
  const delivery = order.fulfilment === "delivery";
  const isNew = order.status === "new";
  const urg = urgency(order, now);
  const waited = minutesBetween(new Date(order.createdAt).getTime(), now);
  const left = due ? minutesBetween(now, due.getTime()) : 0;
  const step = stepOf(order.status);
  const address = order.address ? [[order.address.unit, order.address.line].filter(Boolean).join(" - "), order.address.city, order.address.postalCode].filter(Boolean).join(", ") : null;

  return (
    <article className={`card flex flex-col overflow-hidden ${isNew ? "new-order-glow ring-4 ring-gold-400" : ""}`} aria-label={`Order ${order.orderNumber}`}>
      <header className={`flex items-center gap-3 px-4 py-3 text-white ${delivery ? "bg-tomato-600" : "bg-brand-700"}`}>
        <span className="h-display text-3xl leading-none">#{order.orderNumber}</span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold tracking-wider">{delivery ? "DELIVERY" : "PICKUP"}</span>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${
            urg === "late" ? "bg-white text-tomato-700" : urg === "warn" ? "bg-gold-400 text-ink" : "bg-white/15"
          }`}
          title={`Placed ${formatMinutes(waited)} ago`}
        >
          {waited < 1 ? "just now" : `${formatMinutes(waited)} ago`}
        </span>
      </header>

      <div className="px-4 pt-3">
        <div className="flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? (delivery ? "bg-tomato-500" : "bg-brand-500") : "bg-ink/10"}`} />
          ))}
        </div>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{STATUS_LABEL[order.status].staff}</p>
      </div>

      <div className="flex-1 space-y-3 p-4 pt-2">
        {due ? (
          <div className={`rounded-xl px-3 py-2 ${urg === "late" && !isNew ? "bg-tomato-50 text-tomato-700" : "bg-gold-100 text-gold-700"}`}>
            <p className="text-xs font-bold uppercase tracking-wide">Scheduled</p>
            <p className="font-bold text-ink">
              {formatDayLabel(due, new Date(now), timezone)} · {formatTime(due, timezone)}
            </p>
            <p className="text-sm font-semibold">{left >= 0 ? `due in ${formatMinutes(left)}` : `${formatMinutes(-left)} past due`}</p>
          </div>
        ) : (
          <p className="inline-block rounded-full bg-ink px-3 py-1 text-sm font-bold tracking-wider text-white">ASAP</p>
        )}

        <div className="space-y-2">
          <p className="text-lg font-bold leading-tight">{order.customerName}</p>
          <div className="flex flex-wrap gap-2">
            <a href={telHref(order.customerPhone)} className="btn btn-outline min-h-9 px-3 text-sm">
              <PhoneIcon className="size-4" /> {formatPhone(order.customerPhone)}
            </a>
            {address && (
              <a href={mapsHref(address)} target="_blank" rel="noreferrer" className="btn btn-outline min-h-9 px-3 text-sm">
                <PinIcon className="size-4" /> Map
              </a>
            )}
          </div>
          {address && (
            <p className="border-l-4 border-tomato-500 pl-2 text-sm">
              <span className="font-semibold">{address}</span>
              {order.address?.notes && <span className="block text-ink-soft">“{order.address.notes}”</span>}
            </p>
          )}
        </div>

        <ul className="space-y-2 border-t border-ink/10 pt-3">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-ink px-1.5 text-sm font-extrabold text-white">{i.quantity}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug">
                  {i.name}
                  {i.variant && <span className="font-semibold text-brand-700"> · {i.variant}</span>}
                </p>
                {i.details.map((d) => (
                  <p key={d} className="text-sm text-ink-soft">
                    {d}
                  </p>
                ))}
                {i.notes && <p className="mt-1 rounded-lg bg-tomato-50 px-2 py-1 text-sm font-bold text-tomato-700">Note: {i.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="rounded-xl border-2 border-dashed border-gold-400 bg-gold-100 p-2 text-sm font-semibold">
            <span className="block text-xs font-bold uppercase tracking-wide text-gold-700">Order note</span>
            {order.notes}
          </p>
        )}
      </div>

      <footer className="space-y-3 border-t border-ink/10 bg-cream px-4 py-3">
        <p className="flex items-baseline justify-between">
          <span className="font-semibold">
            {order.paymentMethod === "cash" ? "💵 Cash" : "💳 Card"} on {order.fulfilment}
          </span>
          <span className="h-display text-2xl">{formatCents(order.totalCents)}</span>
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
          <>
            <div className="flex flex-wrap gap-2">
              {actions.map((to, i) => (
                <button
                  key={to}
                  type="button"
                  className={`btn min-h-12 flex-1 whitespace-nowrap px-3 ${actions.length > 1 ? "text-base" : "text-lg"} ${i === 0 ? (isNew ? "btn-gold" : "btn-primary") : "btn-outline"}`}
                  disabled={busy}
                  onClick={() => onStatus(order, to)}
                >
                  {busy ? "…" : ACTION_LABEL[to]}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => onPrint(order)}>
                🖨 Print receipt
              </button>
              {canCancel && (
                <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm text-tomato-700 hover:bg-tomato-50" onClick={() => setConfirmCancel(true)}>
                  Cancel…
                </button>
              )}
            </div>
          </>
        )}
      </footer>
    </article>
  );
}

export function OrderBoard({
  initial,
  store,
  timezone,
  orderingEnabled,
}: {
  initial: AdminOrder[];
  store: ReceiptStore;
  timezone: string;
  orderingEnabled: boolean;
}) {
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
    let cancelled = false;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    // Print only once the logo has loaded, or it comes out blank.
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".receipt img"));
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", done);
    };
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

  const columns: { title: string; hint: string; empty: string; statuses: OrderStatus[]; dot: string; tint: string }[] = [
    { title: "New", hint: "Accept to start cooking", empty: "No new orders. They'll pop up here.", statuses: ["new"], dot: "bg-gold-400", tint: "bg-gold-100/50" },
    { title: "In the kitchen", hint: "Mark ready when it's done", empty: "Nothing cooking right now.", statuses: ["accepted"], dot: "bg-brand-500", tint: "bg-brand-50/70" },
    { title: "Ready / on the way", hint: "Complete when it's handed over", empty: "Nothing waiting to go out.", statuses: ["ready", "out_for_delivery"], dot: "bg-tomato-500", tint: "bg-tomato-50/60" },
  ];
  const waiting = orders.filter((o) => o.status === "new").length;

  return (
    <>
      <div className="print:hidden">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div>
            <h1 className="h-display text-3xl">Live orders</h1>
            <p className="text-ink-soft">
              {orders.length === 0 ? "All caught up." : `${orders.length} open`}
              {waiting > 0 && <span className="font-bold text-gold-700"> · {waiting} waiting to be accepted</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!orderingEnabled && (
              <Link href="/admin/settings#ordering" className="rounded-full bg-tomato-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-tomato-700">
                ⏸ Online ordering is paused
              </Link>
            )}
            {stale && <span className="rounded-full bg-gold-100 px-3 py-1.5 text-sm font-semibold text-gold-700">Connection lost, retrying…</span>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="card hidden px-4 py-1.5 text-right sm:block" suppressHydrationWarning>
              <span className="h-display block text-2xl leading-tight tabular-nums">{formatTime(new Date(now), timezone)}</span>
              <span className="text-xs font-semibold text-ink-soft">{formatDayLabel(new Date(now), new Date(now), timezone)}</span>
            </p>
            <button type="button" onClick={toggleSound} className={`btn ${sound ? "btn-outline" : "btn-gold"}`}>
              {sound ? "🔔 Sound on" : "🔕 Tap to turn on sound"}
            </button>
          </div>
        </div>
        {error && (
          <p className="mb-4 rounded-xl bg-tomato-50 p-3 font-semibold text-tomato-700" role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          {columns.map((col) => {
            const list = orders.filter((o) => col.statuses.includes(o.status));
            return (
              <section key={col.title} aria-label={col.title} className={`rounded-3xl p-3 ${col.tint}`}>
                <header className="mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`size-3 rounded-full ${col.dot}`} aria-hidden />
                    <h2 className="h-display text-xl">{col.title}</h2>
                    <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white px-2 text-sm font-bold shadow-(--shadow-card)">{list.length}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{col.hint}</p>
                </header>
                <div className="space-y-4">
                  {list.length === 0 ? (
                    <p className="rounded-2xl border-2 border-dashed border-ink/10 px-4 py-8 text-center text-sm text-ink-soft">{col.empty}</p>
                  ) : (
                    list.map((o) => <OrderCard key={o.id} order={o} timezone={timezone} now={now} onStatus={setStatus} onPrint={setPrinting} busy={busyId === o.id} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {printing && <ReceiptTicket order={printing} store={store} timezone={timezone} />}
    </>
  );
}
