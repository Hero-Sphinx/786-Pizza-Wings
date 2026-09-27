"use client";

import { useState } from "react";
import { DAY_NAMES } from "@/lib/menu-types";
import { parseDollarsToCents } from "@/lib/money";
import { useAdminApi } from "./useAdminApi";

export type AdminSettings = {
  orderingEnabled: boolean;
  orderingPausedMessage: string;
  deliveryEnabled: boolean;
  deliveryFeeCents: number;
  deliveryMinCents: number | null;
  deliveryFsas: string[];
  pickupLeadMinutes: number;
  deliveryLeadMinutes: number;
  lastOrderMinutes: number;
  maxOrderCents: number;
  notifyEmail: string;
  hours: { dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string }[];
  closures: { date: string; reason: string }[];
  promos: { slug: string; isActive: boolean; eyebrow: string; title: string; body: string; priceText: string; ctaLabel: string; ctaHref: string }[];
};

const dollars = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));

function Status({ error, saved }: { error: string | null; saved: string | null }) {
  if (!error && !saved) return null;
  return (
    <p className={`mt-3 text-sm font-semibold ${error ? "text-tomato-700" : "text-brand-700"}`} role={error ? "alert" : "status"}>
      {error ?? saved}
    </p>
  );
}

function OrderingSwitches({ initial }: { initial: AdminSettings }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [message, setMessage] = useState(initial.orderingPausedMessage);
  return (
    <section className="card p-5">
      <h2 className="h-display text-2xl">Online ordering</h2>
      <p className="text-sm text-ink-soft">Busy night? Pause online orders or delivery here. Staff can do this too.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          className={`btn ${initial.orderingEnabled ? "btn-danger" : "btn-primary"}`}
          onClick={() => patch("/api/admin/settings", { orderingEnabled: !initial.orderingEnabled, orderingPausedMessage: message || null }, initial.orderingEnabled ? "Online ordering paused" : "Online ordering is on")}
        >
          {initial.orderingEnabled ? "Pause online ordering" : "Resume online ordering"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-outline"
          onClick={() => patch("/api/admin/settings", { deliveryEnabled: !initial.deliveryEnabled }, initial.deliveryEnabled ? "Delivery turned off" : "Delivery turned on")}
        >
          {initial.deliveryEnabled ? "Turn off delivery" : "Turn on delivery"}
        </button>
      </div>
      <p className="mt-3 font-semibold">
        Status: {initial.orderingEnabled ? "✅ Taking online orders" : "⏸ Paused"} · Delivery {initial.deliveryEnabled ? "on" : "off"}
      </p>
      <label className="label mt-4" htmlFor="pause-msg">
        Message customers see while paused (optional)
      </label>
      <input id="pause-msg" className="field" maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We're very busy tonight. Please call to order." />
      <Status error={error} saved={saved} />
    </section>
  );
}

function OwnerSettings({ initial }: { initial: AdminSettings }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [f, setF] = useState({
    deliveryFee: dollars(initial.deliveryFeeCents),
    deliveryMin: dollars(initial.deliveryMinCents),
    fsas: initial.deliveryFsas.join(", "),
    pickupLead: String(initial.pickupLeadMinutes),
    deliveryLead: String(initial.deliveryLeadMinutes),
    lastOrder: String(initial.lastOrderMinutes),
    maxOrder: dollars(initial.maxOrderCents),
    notifyEmail: initial.notifyEmail,
  });
  const [hours, setHours] = useState(initial.hours);
  const [closures, setClosures] = useState(initial.closures);

  const save = () => {
    const fee = parseDollarsToCents(f.deliveryFee);
    const min = f.deliveryMin.trim() ? parseDollarsToCents(f.deliveryMin) : null;
    const max = parseDollarsToCents(f.maxOrder);
    if (fee === null || max === null || (f.deliveryMin.trim() && min === null)) return alert("Check the dollar amounts.");
    void patch("/api/admin/settings", {
      deliveryFeeCents: fee,
      deliveryMinCents: min,
      deliveryFsas: f.fsas.split(/[\s,]+/).filter(Boolean),
      pickupLeadMinutes: Number(f.pickupLead),
      deliveryLeadMinutes: Number(f.deliveryLead),
      lastOrderMinutes: Number(f.lastOrder),
      maxOrderCents: max,
      notifyEmail: f.notifyEmail.trim() || null,
      hours,
      closures: closures.filter((c) => c.date).map((c) => ({ date: c.date, reason: c.reason || null })),
    });
  };

  const input = (key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`s-${key}`}>
        {label}
      </label>
      <input id={`s-${key}`} className="field" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <section className="card p-5">
      <h2 className="h-display text-2xl">Store settings (owner)</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {input("deliveryFee", "Delivery fee ($)", { inputMode: "decimal" })}
        {input("deliveryMin", "Delivery minimum ($, blank = none)", { inputMode: "decimal" })}
        {input("maxOrder", "Largest online order ($)", { inputMode: "decimal" })}
        {input("notifyEmail", "Email new orders to", { type: "email" })}
        {input("pickupLead", "Pickup ready in (minutes)", { inputMode: "numeric" })}
        {input("deliveryLead", "Delivery takes (minutes)", { inputMode: "numeric" })}
        {input("lastOrder", "Stop ASAP orders before closing (minutes)", { inputMode: "numeric" })}
        <div className="sm:col-span-2 lg:col-span-4">{input("fsas", "Delivery areas (first 3 characters of postal codes)", { placeholder: "L6X, L6Y, L6V" })}</div>
      </div>

      <h3 className="mt-6 font-bold">Opening hours</h3>
      <div className="mt-2 space-y-2">
        {hours.map((h, i) => (
          <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-3">
            <span className="w-28 font-semibold">{DAY_NAMES[h.dayOfWeek]}</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-5 accent-brand-600" checked={h.isClosed} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, isClosed: e.target.checked } : x)))} />
              Closed
            </label>
            <input type="time" aria-label={`${DAY_NAMES[h.dayOfWeek]} opens`} className="field w-36" disabled={h.isClosed} value={h.opensAt} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))} />
            <span>to</span>
            <input type="time" aria-label={`${DAY_NAMES[h.dayOfWeek]} closes`} className="field w-36" disabled={h.isClosed} value={h.closesAt} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))} />
          </div>
        ))}
      </div>

      <h3 className="mt-6 font-bold">Holiday closures</h3>
      <div className="mt-2 space-y-2">
        {closures.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3">
            <input type="date" aria-label="Closed on" className="field w-44" value={c.date} onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
            <input aria-label="Reason" className="field w-64" placeholder="Reason (optional)" value={c.reason} onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} />
            <button type="button" className="btn btn-ghost text-tomato-700" onClick={() => setClosures(closures.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => setClosures([...closures, { date: "", reason: "" }])}>
          Add a closed day
        </button>
      </div>

      <button type="button" className="btn btn-primary mt-6" disabled={busy} onClick={save}>
        Save settings
      </button>
      <Status error={error} saved={saved} />
    </section>
  );
}

function PromoEditor({ promo }: { promo: AdminSettings["promos"][number] }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [p, setP] = useState(promo);
  const field = (key: "eyebrow" | "title" | "body" | "priceText" | "ctaLabel" | "ctaHref", label: string) => (
    <div>
      <label className="label" htmlFor={`${promo.slug}-${key}`}>
        {label}
      </label>
      <input id={`${promo.slug}-${key}`} className="field" value={p[key]} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
    </div>
  );
  return (
    <div className="rounded-2xl border border-ink/10 p-4">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" className="size-5 accent-brand-600" checked={p.isActive} onChange={(e) => setP({ ...p, isActive: e.target.checked })} />
        Show this slide
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field("eyebrow", "Small heading")}
        {field("title", "Title")}
        {field("priceText", "Price text")}
        {field("body", "Text")}
        {field("ctaLabel", "Button label")}
        {field("ctaHref", "Button link (e.g. /menu?item=deal-07)")}
      </div>
      <button type="button" className="btn btn-primary mt-3" disabled={busy} onClick={() => {
          const { slug: _slug, ...fields } = p;
          void patch(`/api/admin/promos/${promo.slug}`, { ...fields, ctaHref: fields.ctaHref || null }, "Slide saved");
        }}>
        Save slide
      </button>
      <Status error={error} saved={saved} />
    </div>
  );
}

export function SettingsForm({ initial, isOwner }: { initial: AdminSettings; isOwner: boolean }) {
  return (
    <div className="space-y-6">
      <h1 className="h-display text-3xl">Settings</h1>
      <OrderingSwitches initial={initial} />
      {isOwner && <OwnerSettings initial={initial} />}
      {isOwner && (
        <section className="card space-y-4 p-5">
          <h2 className="h-display text-2xl">Home page slides</h2>
          {initial.promos.map((p) => (
            <PromoEditor key={p.slug} promo={p} />
          ))}
        </section>
      )}
    </div>
  );
}
