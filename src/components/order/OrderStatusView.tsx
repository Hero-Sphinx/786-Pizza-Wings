"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPhone, telHref } from "@/lib/format";
import { formatDayLabel, formatTime } from "@/lib/hours";
import { formatCents } from "@/lib/money";
import { ACTIVE_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import type { PublicOrder } from "@/lib/api-types";
import { CheckIcon } from "../icons";
import { useCart } from "../cart/CartProvider";

function steps(fulfilment: "pickup" | "delivery"): OrderStatus[] {
  return fulfilment === "delivery" ? ["new", "accepted", "out_for_delivery", "completed"] : ["new", "accepted", "ready", "completed"];
}

export function OrderStatusView({ token, initial, timezone }: { token: string; initial: PublicOrder; timezone: string }) {
  const { store } = useCart();
  const [order, setOrder] = useState(initial);
  const active = ACTIVE_STATUSES.includes(order.status);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
        if (res.ok) setOrder((await res.json()) as PublicOrder);
      } catch {
        // Offline for a moment: try again next tick.
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [active, token]);

  const flow = steps(order.fulfilment);
  // "ready" also counts as progress on a delivery order.
  const reached = order.status === "ready" && order.fulfilment === "delivery" ? 1 : flow.indexOf(order.status);
  const when = order.scheduledFor
    ? `${formatDayLabel(new Date(order.scheduledFor), new Date(), timezone)} at ${formatTime(new Date(order.scheduledFor), timezone)}`
    : "As soon as possible";

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="bg-brand-700 px-6 py-6 text-white">
          <p className="font-semibold text-gold-300">Order #{order.orderNumber}</p>
          <h1 className="h-display text-3xl sm:text-4xl" aria-live="polite">
            {order.status === "cancelled" ? "Your order was cancelled" : `Thanks, ${order.firstName}! ${STATUS_LABEL[order.status].customer}.`}
          </h1>
          <p className="mt-1 text-white/85">
            {order.fulfilment === "pickup" ? "Pickup" : "Delivery"} · {when}
          </p>
        </div>

        {order.status !== "cancelled" && (
          <ol className="grid grid-cols-4 gap-1 px-4 py-5 sm:px-6">
            {flow.map((s, i) => {
              const done = i <= reached;
              return (
                <li key={s} className="flex flex-col items-center text-center">
                  <span className={`grid size-9 place-items-center rounded-full ${done ? "bg-brand-600 text-white" : "bg-crust text-ink-soft"}`}>
                    {done ? <CheckIcon width={18} height={18} /> : i + 1}
                  </span>
                  <span className={`mt-2 text-xs font-semibold sm:text-sm ${done ? "text-ink" : "text-ink-soft"}`}>{STATUS_LABEL[s].customer}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="card p-6">
        <h2 className="h-display text-2xl">Your order</h2>
        <ul className="mt-3 divide-y divide-ink/10">
          {order.items.map((i, idx) => (
            <li key={idx} className="py-3">
              <div className="flex justify-between gap-3 font-semibold">
                <span>
                  {i.quantity} × {i.name}
                  {i.variant && <span className="font-normal text-ink-soft"> · {i.variant}</span>}
                </span>
                <span>{formatCents(i.lineTotalCents)}</span>
              </div>
              {i.details.map((d) => (
                <p key={d} className="text-sm text-ink-soft">
                  {d}
                </p>
              ))}
              {i.notes && <p className="text-sm italic text-ink-soft">“{i.notes}”</p>}
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-ink/10 pt-3">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatCents(order.subtotalCents)}</dd>
          </div>
          {order.deliveryFeeCents > 0 && (
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{formatCents(order.deliveryFeeCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>HST</dt>
            <dd>{formatCents(order.taxCents)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-xl font-extrabold">
            <dt>Total to pay</dt>
            <dd>{formatCents(order.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-soft">
          Pay by {order.paymentMethod === "cash" ? "cash" : "debit or credit"} when you {order.fulfilment === "pickup" ? "pick up" : "receive"} your order.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <a href={telHref(store.phone)} className="btn btn-outline flex-1">
          Questions? Call {formatPhone(store.phone)}
        </a>
        <Link href="/menu" className="btn btn-gold flex-1">
          Back to the menu
        </Link>
      </div>
      <p className="text-center text-sm text-ink-soft">Bookmark this page to check on your order. It updates by itself.</p>
    </div>
  );
}
