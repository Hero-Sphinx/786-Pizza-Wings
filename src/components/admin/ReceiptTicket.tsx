import Image from "next/image";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPhone } from "@/lib/format";
import { formatDayLabel, formatTime } from "@/lib/hours";
import { formatCents } from "@/lib/money";
import type { StoreInfo } from "@/lib/store-types";

export type ReceiptStore = Pick<StoreInfo, "name" | "phone" | "addressLine" | "city" | "province" | "postalCode">;

// Laid out for an 80mm thermal printer (72mm printable). Thermal heads only print black, so all the
// emphasis comes from solid black blocks, borders and type size, never colour or grey.
function shortDate(at: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(at);
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={`flex items-baseline gap-1 ${strong ? "text-base font-extrabold" : ""}`}>
      <span>{label}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-black" aria-hidden />
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function Divider({ label }: { label?: string }) {
  return (
    <div className="my-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em]">
      <span className="flex-1 border-t-2 border-dashed border-black" />
      {label && <span>{label}</span>}
      {label && <span className="flex-1 border-t-2 border-dashed border-black" />}
    </div>
  );
}

export function ReceiptTicket({ order, store, timezone }: { order: AdminOrder; store: ReceiptStore; timezone: string }) {
  const now = new Date();
  const placed = new Date(order.createdAt);
  const due = order.scheduledFor ? new Date(order.scheduledFor) : null;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const delivery = order.fulfilment === "delivery";
  const cash = order.paymentMethod === "cash";

  return (
    <div className="receipt mx-auto hidden w-[72mm] bg-white font-mono text-[12px] leading-snug text-black print:block">
      <header className="text-center">
        <Image src="/images/logo.webp" alt="" width={400} height={500} loading="eager" className="receipt-logo mx-auto h-20 w-auto" />
        <p className="mt-1 font-display text-xl font-extrabold uppercase tracking-wide">{store.name}</p>
        <p>{store.addressLine}</p>
        <p>
          {store.city}, {store.province} {store.postalCode}
        </p>
        <p className="font-bold">{formatPhone(store.phone)}</p>
      </header>

      <div className="receipt-ink mt-3 rounded-md bg-black px-2 py-2 text-center text-white">
        <p className="text-[11px] font-bold tracking-[0.3em]">{delivery ? "DELIVERY" : "PICKUP"}</p>
        <p className="font-display text-5xl leading-none font-extrabold">#{order.orderNumber}</p>
      </div>

      <div className="mt-2 border-[3px] border-black px-2 py-1.5 text-center">
        {due ? (
          <>
            <p className="text-[10px] font-bold tracking-[0.2em]">SCHEDULED FOR</p>
            <p className="text-lg font-extrabold uppercase">
              {formatDayLabel(due, now, timezone)} · {formatTime(due, timezone)}
            </p>
            <p className="text-[11px]">{shortDate(due, timezone)}</p>
          </>
        ) : (
          <p className="text-lg font-extrabold tracking-[0.2em]">ASAP</p>
        )}
      </div>
      <p className="mt-1 text-center text-[11px]">
        Placed {shortDate(placed, timezone)}, {formatTime(placed, timezone)}
      </p>

      <Divider label="CUSTOMER" />
      <p className="text-base font-extrabold">{order.customerName}</p>
      <p className="font-bold">{formatPhone(order.customerPhone)}</p>
      {order.address && (
        <div className="mt-1 border-l-4 border-black pl-2">
          <p className="font-bold">{[order.address.unit, order.address.line].filter(Boolean).join(" - ")}</p>
          <p>
            {[order.address.city, order.address.postalCode].filter(Boolean).join(" ")}
          </p>
          {order.address.notes && <p className="italic">“{order.address.notes}”</p>}
        </div>
      )}

      <Divider label={`${itemCount} ITEM${itemCount === 1 ? "" : "S"}`} />
      <ul className="space-y-2">
        {order.items.map((i, idx) => (
          <li key={idx}>
            <div className="flex items-start gap-2">
              <span className="receipt-ink min-w-7 rounded bg-black px-1 text-center font-extrabold text-white">{i.quantity}×</span>
              <p className="flex-1 text-[13px] font-extrabold">
                {i.name}
                {i.variant && <span className="font-bold"> ({i.variant})</span>}
              </p>
              <span className="tabular-nums">{formatCents(i.lineTotalCents)}</span>
            </div>
            {i.details.map((d) => (
              <p key={d} className="pl-9">
                › {d}
              </p>
            ))}
            {i.notes && (
              <p className="mt-0.5 ml-9 border border-black px-1 font-bold">
                NOTE: {i.notes}
              </p>
            )}
          </li>
        ))}
      </ul>
      {order.notes && (
        <div className="mt-2 border-2 border-black p-1.5">
          <p className="text-[10px] font-bold tracking-[0.2em]">ORDER NOTE</p>
          <p className="font-bold">{order.notes}</p>
        </div>
      )}

      <Divider />
      <div className="space-y-0.5">
        <Row label="Subtotal" value={formatCents(order.subtotalCents)} />
        {order.deliveryFeeCents > 0 && <Row label="Delivery" value={formatCents(order.deliveryFeeCents)} />}
        <Row label="HST" value={formatCents(order.taxCents)} />
      </div>
      <div className="receipt-ink mt-2 flex items-baseline justify-between rounded-md bg-black px-2 py-1.5 text-white">
        <span className="font-extrabold tracking-[0.2em]">TOTAL</span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{formatCents(order.totalCents)}</span>
      </div>
      <p className="mt-2 border-2 border-dashed border-black py-1 text-center font-extrabold">
        {cash ? "CASH" : "CARD"} · PAY ON {delivery ? "DELIVERY" : "PICKUP"}
      </p>

      <footer className="mt-4 text-center">
        <p className="font-display text-xl font-extrabold">Thank you!</p>
        <p>We hope you love it. See you again soon.</p>
        <p className="mt-2 text-lg tracking-[0.5em]">★ ★ ★</p>
        <p className="mt-2 text-[10px]">Printed {shortDate(now, timezone)}, {formatTime(now, timezone)}</p>
      </footer>
    </div>
  );
}
