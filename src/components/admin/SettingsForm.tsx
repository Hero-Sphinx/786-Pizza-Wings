"use client";

import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
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

type SectionKey = "ordering" | "hours" | "delivery" | "rules" | "slides";

const SECTIONS: { key: SectionKey; label: string; hint: string; ownerOnly: boolean }[] = [
  { key: "ordering", label: "Online ordering", hint: "Pause orders or delivery", ownerOnly: false },
  { key: "hours", label: "Hours & closures", hint: "Opening times, holidays", ownerOnly: true },
  { key: "delivery", label: "Delivery", hint: "Fee, minimum, areas", ownerOnly: true },
  { key: "rules", label: "Order rules", hint: "Timing, limits, emails", ownerOnly: true },
  { key: "slides", label: "Home page slides", hint: "The banner carousel", ownerOnly: true },
];

const dollars = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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

/** A settings panel with a title, and a footer that saves only this panel's fields. */
function Panel({
  title,
  intro,
  children,
  dirty,
  busy,
  onSave,
  onReset,
  message,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  dirty?: boolean;
  busy?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  message?: { error: string | null; saved: string | null };
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-ink/10 px-5 py-4">
        <h2 className="h-display text-2xl">{title}</h2>
        <p className="text-sm text-ink-soft">{intro}</p>
      </header>
      <div className="space-y-6 p-5">{children}</div>
      {onSave && (
        <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-white/95 px-5 py-3 backdrop-blur">
          {message?.error ? (
            <p className="text-sm font-semibold text-tomato-700" role="alert">
              {message.error}
            </p>
          ) : dirty ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-gold-700">
              <span className="size-2 rounded-full bg-gold-500" aria-hidden /> Unsaved changes
            </p>
          ) : message?.saved ? (
            <p className="text-sm font-semibold text-brand-700" role="status">
              ✓ {message.saved}
            </p>
          ) : (
            <p className="text-sm text-ink-soft">All changes saved</p>
          )}
          <div className="ml-auto flex gap-2">
            {dirty && onReset && (
              <button type="button" className="btn btn-ghost" onClick={onReset}>
                Undo
              </button>
            )}
            <button type="button" className="btn btn-primary min-w-28" disabled={busy || !dirty} onClick={onSave}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

function Field({ id, label, help, ...props }: { id: string; label: string; help?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="field" {...props} />
      {help && <p className="mt-1 text-xs text-ink-soft">{help}</p>}
    </div>
  );
}

function Prefixed({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {prefix && <span className="text-ink-soft">{prefix}</span>}
      <div className="flex-1">{children}</div>
      {suffix && <span className="text-sm text-ink-soft">{suffix}</span>}
    </div>
  );
}

function OrderingPanel({ initial }: { initial: AdminSettings }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [message, setMessage] = useState(initial.orderingPausedMessage);
  const dirty = message !== initial.orderingPausedMessage;
  const on = initial.orderingEnabled;

  return (
    <Panel
      title="Online ordering"
      intro="Busy night? Pause online orders or delivery here. Staff can do this too. Changes take effect right away."
      dirty={dirty}
      busy={busy}
      onSave={() => patch("/api/admin/settings", { orderingPausedMessage: message || null }, "Message saved")}
      onReset={() => setMessage(initial.orderingPausedMessage)}
      message={{ error, saved }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`flex items-center gap-4 rounded-2xl p-4 ${on ? "bg-brand-50" : "bg-tomato-50"}`}>
          <span className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl text-white ${on ? "bg-brand-600" : "bg-tomato-600"}`} aria-hidden>
            {on ? "✓" : "⏸"}
          </span>
          <div className="flex-1">
            <p className="font-bold">{on ? "Taking online orders" : "Online ordering paused"}</p>
            <p className="text-sm text-ink-soft">{on ? "Customers can order on the website." : "Customers see your message instead."}</p>
          </div>
          <Toggle
            on={on}
            label="Online ordering"
            disabled={busy}
            onChange={(v) => patch("/api/admin/settings", { orderingEnabled: v, orderingPausedMessage: message || null }, v ? "Online ordering is on" : "Online ordering paused")}
          />
        </div>
        <div className={`flex items-center gap-4 rounded-2xl p-4 ${initial.deliveryEnabled ? "bg-brand-50" : "bg-ink/5"}`}>
          <span className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl text-white ${initial.deliveryEnabled ? "bg-brand-600" : "bg-ink/30"}`} aria-hidden>
            🛵
          </span>
          <div className="flex-1">
            <p className="font-bold">Delivery {initial.deliveryEnabled ? "on" : "off"}</p>
            <p className="text-sm text-ink-soft">{initial.deliveryEnabled ? "Customers can choose delivery." : "Pickup only for now."}</p>
          </div>
          <Toggle
            on={initial.deliveryEnabled}
            label="Delivery"
            disabled={busy}
            onChange={(v) => patch("/api/admin/settings", { deliveryEnabled: v }, v ? "Delivery turned on" : "Delivery turned off")}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pause-msg">
          Message customers see while ordering is paused
        </label>
        <textarea
          id="pause-msg"
          className="field min-h-20"
          maxLength={200}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. We're very busy tonight. Please call to order."
        />
        <p className="mt-1 text-right text-xs text-ink-soft">{message.length}/200</p>
      </div>
    </Panel>
  );
}

function HoursPanel({ initial }: { initial: AdminSettings }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [hours, setHours] = useState(initial.hours);
  const [closures, setClosures] = useState(initial.closures);
  const dirty = !same(hours, initial.hours) || !same(closures, initial.closures);
  const setDay = (i: number, change: Partial<AdminSettings["hours"][number]>) => setHours(hours.map((x, j) => (j === i ? { ...x, ...change } : x)));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Panel
      title="Hours & closures"
      intro="When customers can order. A closing time earlier than the opening time means after midnight."
      dirty={dirty}
      busy={busy}
      onSave={() =>
        patch(
          "/api/admin/settings",
          { hours, closures: closures.filter((c) => c.date).map((c) => ({ date: c.date, reason: c.reason || null })) },
          "Hours saved",
        )
      }
      onReset={() => {
        setHours(initial.hours);
        setClosures(initial.closures);
      }}
      message={{ error, saved }}
    >
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-bold">Opening hours</h3>
          <button type="button" className="btn btn-ghost min-h-9 text-sm" onClick={() => setHours(hours.map((h) => ({ ...h, isClosed: hours[1].isClosed, opensAt: hours[1].opensAt, closesAt: hours[1].closesAt })))}>
            Copy Monday to all
          </button>
        </div>
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
          {hours.map((h, i) => (
            <li key={h.dayOfWeek} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <span className="w-24 font-semibold">{DAY_NAMES[h.dayOfWeek]}</span>
              <Toggle on={!h.isClosed} label={`Open on ${DAY_NAMES[h.dayOfWeek]}`} onChange={(open) => setDay(i, { isClosed: !open })} />
              {h.isClosed ? (
                <span className="font-semibold text-tomato-700">Closed all day</span>
              ) : (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <input type="time" aria-label={`${DAY_NAMES[h.dayOfWeek]} opens`} className="field min-w-0 flex-1 sm:w-36 sm:flex-none" value={h.opensAt} onChange={(e) => setDay(i, { opensAt: e.target.value })} />
                  <span className="text-ink-soft">to</span>
                  <input type="time" aria-label={`${DAY_NAMES[h.dayOfWeek]} closes`} className="field min-w-0 flex-1 sm:w-36 sm:flex-none" value={h.closesAt} onChange={(e) => setDay(i, { closesAt: e.target.value })} />
                  {h.closesAt <= h.opensAt && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-700">next day</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-bold">Holiday closures</h3>
        <p className="mb-2 text-sm text-ink-soft">Days the shop is closed even though it normally opens.</p>
        {closures.length === 0 && <p className="mb-2 rounded-xl bg-crust/60 p-3 text-sm text-ink-soft">No closed days coming up.</p>}
        <ul className="space-y-2">
          {closures.map((c, i) => (
            <li key={i} className={`flex flex-wrap items-center gap-2 rounded-xl p-2 ${c.date && c.date < today ? "opacity-50" : "bg-crust/40"}`}>
              <input
                type="date"
                aria-label="Closed on"
                className="field w-44"
                value={c.date}
                onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
              />
              <input
                aria-label="Reason"
                className="field min-w-40 flex-1"
                placeholder="Reason, e.g. Eid (optional)"
                maxLength={80}
                value={c.reason}
                onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
              />
              <button type="button" className="btn btn-ghost text-tomato-700" onClick={() => setClosures(closures.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-outline mt-2" onClick={() => setClosures([...closures, { date: "", reason: "" }])}>
          + Add a closed day
        </button>
      </div>
    </Panel>
  );
}

function DeliveryPanel({ initial }: { initial: AdminSettings }) {
  const { patch, busy, error, saved } = useAdminApi();
  const start = { fee: dollars(initial.deliveryFeeCents), min: dollars(initial.deliveryMinCents), lead: String(initial.deliveryLeadMinutes), fsas: initial.deliveryFsas };
  const [f, setF] = useState(start);
  const [newFsa, setNewFsa] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const dirty = !same(f, start);

  const addFsa = () => {
    const code = newFsa.trim().toUpperCase().replace(/\s/g, "").slice(0, 3);
    if (!/^[A-Z]\d[A-Z]$/.test(code)) return setProblem("Use the first 3 characters of a postal code, e.g. L6X.");
    setProblem(null);
    if (!f.fsas.includes(code)) setF({ ...f, fsas: [...f.fsas, code] });
    setNewFsa("");
  };

  const save = () => {
    setProblem(null);
    const fee = parseDollarsToCents(f.fee);
    const min = f.min.trim() ? parseDollarsToCents(f.min) : null;
    if (fee === null) return setProblem("Check the delivery fee.");
    if (f.min.trim() && min === null) return setProblem("Check the delivery minimum.");
    const lead = Number(f.lead);
    if (!Number.isInteger(lead) || lead < 0 || lead > 240) return setProblem("Delivery time must be 0 to 240 minutes.");
    void patch("/api/admin/settings", { deliveryFeeCents: fee, deliveryMinCents: min, deliveryLeadMinutes: lead, deliveryFsas: f.fsas }, "Delivery settings saved");
  };

  return (
    <Panel
      title="Delivery"
      intro="What delivery costs and where you deliver. Switch delivery on or off under Online ordering."
      dirty={dirty}
      busy={busy}
      onSave={save}
      onReset={() => {
        setF(start);
        setProblem(null);
      }}
      message={{ error: problem ?? error, saved }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="s-fee">
            Delivery fee
          </label>
          <Prefixed prefix="$">
            <input id="s-fee" className="field tabular-nums" inputMode="decimal" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} />
          </Prefixed>
        </div>
        <div>
          <label className="label" htmlFor="s-min">
            Minimum order
          </label>
          <Prefixed prefix="$">
            <input id="s-min" className="field tabular-nums" inputMode="decimal" placeholder="no minimum" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
          </Prefixed>
        </div>
        <div>
          <label className="label" htmlFor="s-dlead">
            Delivery takes
          </label>
          <Prefixed suffix="minutes">
            <input id="s-dlead" className="field tabular-nums" inputMode="numeric" value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value })} />
          </Prefixed>
        </div>
      </div>

      <div>
        <h3 className="font-bold">Delivery areas</h3>
        <p className="mb-3 text-sm text-ink-soft">The first 3 characters of the postal codes you deliver to. Addresses outside these get pickup only.</p>
        <ul className="flex flex-wrap gap-2">
          {f.fsas.map((code) => (
            <li key={code} className="flex items-center gap-1 rounded-full bg-brand-600 py-1 pl-3 pr-1 font-bold text-white">
              {code}
              <button
                type="button"
                aria-label={`Remove ${code}`}
                className="grid size-7 place-items-center rounded-full hover:bg-white/20"
                onClick={() => setF({ ...f, fsas: f.fsas.filter((x) => x !== code) })}
              >
                ×
              </button>
            </li>
          ))}
          {f.fsas.length === 0 && <li className="text-sm font-semibold text-tomato-700">No areas: nobody can get delivery.</li>}
        </ul>
        <div className="mt-3 flex max-w-sm gap-2">
          <input
            aria-label="Add a delivery area"
            className="field uppercase placeholder:normal-case"
            placeholder="e.g. L6Z"
            maxLength={7}
            value={newFsa}
            onChange={(e) => setNewFsa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFsa();
              }
            }}
          />
          <button type="button" className="btn btn-outline" onClick={addFsa}>
            Add
          </button>
        </div>
      </div>
    </Panel>
  );
}

function RulesPanel({ initial }: { initial: AdminSettings }) {
  const { patch, busy, error, saved } = useAdminApi();
  const start = { pickupLead: String(initial.pickupLeadMinutes), lastOrder: String(initial.lastOrderMinutes), maxOrder: dollars(initial.maxOrderCents), notifyEmail: initial.notifyEmail };
  const [f, setF] = useState(start);
  const [problem, setProblem] = useState<string | null>(null);
  const dirty = !same(f, start);

  const save = () => {
    setProblem(null);
    const max = parseDollarsToCents(f.maxOrder);
    if (max === null || max < 1000) return setProblem("The largest order must be at least $10.");
    const pickupLead = Number(f.pickupLead);
    const lastOrder = Number(f.lastOrder);
    if (!Number.isInteger(pickupLead) || pickupLead < 0 || pickupLead > 240) return setProblem("Pickup time must be 0 to 240 minutes.");
    if (!Number.isInteger(lastOrder) || lastOrder < 0 || lastOrder > 180) return setProblem("Last-order time must be 0 to 180 minutes.");
    void patch(
      "/api/admin/settings",
      { pickupLeadMinutes: pickupLead, lastOrderMinutes: lastOrder, maxOrderCents: max, notifyEmail: f.notifyEmail.trim() || null },
      "Order rules saved",
    );
  };

  return (
    <Panel
      title="Order rules"
      intro="How far ahead orders are promised, limits for online orders, and where new-order emails go."
      dirty={dirty}
      busy={busy}
      onSave={save}
      onReset={() => {
        setF(start);
        setProblem(null);
      }}
      message={{ error: problem ?? error, saved }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="s-plead">
            Pickup ready in
          </label>
          <Prefixed suffix="minutes">
            <input id="s-plead" className="field tabular-nums" inputMode="numeric" value={f.pickupLead} onChange={(e) => setF({ ...f, pickupLead: e.target.value })} />
          </Prefixed>
          <p className="mt-1 text-xs text-ink-soft">The earliest pickup time customers are offered.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-last">
            Stop ASAP orders before closing
          </label>
          <Prefixed suffix="minutes">
            <input id="s-last" className="field tabular-nums" inputMode="numeric" value={f.lastOrder} onChange={(e) => setF({ ...f, lastOrder: e.target.value })} />
          </Prefixed>
          <p className="mt-1 text-xs text-ink-soft">So the kitchen isn&apos;t caught by an order right at closing.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-max">
            Largest online order
          </label>
          <Prefixed prefix="$">
            <input id="s-max" className="field tabular-nums" inputMode="decimal" value={f.maxOrder} onChange={(e) => setF({ ...f, maxOrder: e.target.value })} />
          </Prefixed>
          <p className="mt-1 text-xs text-ink-soft">Bigger orders have to call the store.</p>
        </div>
        <Field
          id="s-email"
          label="Email new orders to"
          type="email"
          placeholder="no email"
          value={f.notifyEmail}
          onChange={(e) => setF({ ...f, notifyEmail: e.target.value })}
          help="Leave empty to only use the live orders screen."
        />
      </div>
    </Panel>
  );
}

function PromoEditor({ promo }: { promo: AdminSettings["promos"][number] }) {
  const { patch, busy, error, saved } = useAdminApi();
  const [p, setP] = useState(promo);
  const [base, setBase] = useState(promo);
  const [open, setOpen] = useState(false);
  const dirty = !same(p, base);
  const field = (key: "eyebrow" | "title" | "body" | "priceText" | "ctaLabel" | "ctaHref", label: string, placeholder?: string) => (
    <Field id={`${promo.slug}-${key}`} label={label} placeholder={placeholder} value={p[key]} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
  );
  const save = async () => {
    const { slug: _slug, ...fields } = p;
    if (await patch(`/api/admin/promos/${promo.slug}`, { ...fields, ctaHref: fields.ctaHref || null }, "Slide saved")) setBase(p);
  };

  return (
    <li className={`rounded-2xl border ${dirty ? "border-gold-400" : "border-ink/10"}`}>
      <div className="flex items-center gap-3 p-3">
        <Toggle on={p.isActive} label={`Show "${p.title}"`} onChange={(v) => setP({ ...p, isActive: v })} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {p.eyebrow && <span className="block text-xs font-bold uppercase tracking-wide text-tomato-700">{p.eyebrow}</span>}
          <span className={`block truncate font-bold ${p.isActive ? "" : "text-ink-soft"}`}>{p.title || "Untitled slide"}</span>
          {p.priceText && <span className="block text-sm text-brand-700">{p.priceText}</span>}
        </button>
        {!p.isActive && <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-bold text-ink-soft">Hidden</span>}
        <button type="button" className="btn btn-ghost min-h-9 text-sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {(open || dirty) && (
        <div className="border-t border-ink/10 p-4">
          {open && (
            <div className="grid gap-3 sm:grid-cols-2">
              {field("eyebrow", "Small heading", "e.g. Weekday special")}
              {field("title", "Title")}
              {field("priceText", "Price text", "e.g. Only $26.50")}
              {field("body", "Text")}
              {field("ctaLabel", "Button label", "e.g. Order now")}
              {field("ctaHref", "Button link", "e.g. /menu?item=deal-07")}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {error ? (
              <p className="text-sm font-semibold text-tomato-700">{error}</p>
            ) : dirty ? (
              <p className="text-sm font-semibold text-gold-700">Unsaved changes</p>
            ) : (
              saved && <p className="text-sm font-semibold text-brand-700">✓ {saved}</p>
            )}
            <div className="ml-auto flex gap-2">
              {dirty && (
                <button type="button" className="btn btn-ghost" onClick={() => setP(base)}>
                  Undo
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
                Save slide
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function SlidesPanel({ initial }: { initial: AdminSettings }) {
  const live = initial.promos.filter((p) => p.isActive).length;
  return (
    <Panel title="Home page slides" intro={`The banner carousel at the top of the home page. ${live} of ${initial.promos.length} showing. Each slide saves on its own.`}>
      <ul className="space-y-3">
        {initial.promos.map((p) => (
          <PromoEditor key={p.slug} promo={p} />
        ))}
      </ul>
    </Panel>
  );
}

export function SettingsForm({ initial, isOwner }: { initial: AdminSettings; isOwner: boolean }) {
  const sections = SECTIONS.filter((s) => isOwner || !s.ownerOnly);
  const [active, setActive] = useState<SectionKey>("ordering");

  // Open the section named in the URL (#hours etc.), so a reload stays on the same section.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    const match = SECTIONS.find((s) => s.key === fromHash && (isOwner || !s.ownerOnly));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setActive(match.key);
  }, [isOwner]);

  const go = (key: SectionKey) => {
    setActive(key);
    window.history.replaceState(null, "", `#${key}`);
  };

  const status = (key: SectionKey) => {
    if (key === "ordering") return initial.orderingEnabled ? null : "Paused";
    if (key === "delivery") return initial.deliveryEnabled ? null : "Off";
    return null;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-display text-3xl">Settings</h1>
        <p className="text-ink-soft">Pick a section. Each one saves on its own.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[16rem_1fr] lg:items-start">
        {sections.length > 1 && (
          <nav aria-label="Settings sections" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {sections.map((s) => {
              const flag = status(s.key);
              const current = active === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => go(s.key)}
                  className={`shrink-0 rounded-2xl px-4 py-2.5 text-left transition-colors lg:py-3 ${current ? "bg-brand-900 text-white shadow-(--shadow-card)" : "bg-white hover:bg-brand-50"}`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    {s.label}
                    {flag && <span className="rounded-full bg-tomato-600 px-2 py-0.5 text-[11px] font-bold text-white">{flag}</span>}
                  </span>
                  <span className={`hidden text-sm lg:block ${current ? "text-white/70" : "text-ink-soft"}`}>{s.hint}</span>
                </button>
              );
            })}
          </nav>
        )}
        <div className={sections.length > 1 ? "" : "lg:col-span-2"}>
          {active === "ordering" && <OrderingPanel initial={initial} />}
          {active === "hours" && <HoursPanel initial={initial} />}
          {active === "delivery" && <DeliveryPanel initial={initial} />}
          {active === "rules" && <RulesPanel initial={initial} />}
          {active === "slides" && <SlidesPanel initial={initial} />}
        </div>
      </div>
    </div>
  );
}
