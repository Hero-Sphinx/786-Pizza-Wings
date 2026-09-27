import type { Metadata } from "next";
import { formatPhone } from "@/lib/format";
import { formatDayLabel, formatTime } from "@/lib/hours";
import { formatCents } from "@/lib/money";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth";
import { loadStoreFresh } from "@/server/menu";
import { listOrders } from "@/server/orders";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  await requireAdmin();
  const [orders, store] = await Promise.all([listOrders("recent"), loadStoreFresh()]);
  const tz = store.hours.timezone;
  const now = new Date();
  const today = orders.filter((o) => formatDayLabel(o.created_at, now, tz) === "Today" && o.status !== "cancelled");
  const todayTotal = today.reduce((n, o) => n + o.total_cents, 0);

  return (
    <div className="space-y-5">
      <h1 className="h-display text-3xl">Order history</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink-soft">Orders today</p>
          <p className="h-display text-3xl">{today.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink-soft">Sales today (incl. tax)</p>
          <p className="h-display text-3xl">{formatCents(todayTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink-soft">Showing</p>
          <p className="h-display text-3xl">Last {orders.length}</p>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-ink/10 bg-crust/60">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Placed</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {orders.map((o) => (
              <tr key={o.id} className={o.status === "cancelled" ? "text-ink-soft line-through" : ""}>
                <td className="px-3 py-2 font-bold">{o.order_number}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDayLabel(o.created_at, now, tz)} {formatTime(o.created_at, tz)}
                </td>
                <td className="px-3 py-2">
                  {o.customer_name}
                  <span className="block text-ink-soft">{formatPhone(o.customer_phone)}</span>
                </td>
                <td className="px-3 py-2 capitalize">{o.fulfilment}</td>
                <td className="px-3 py-2">{o.order_items.map((i) => `${i.quantity}× ${i.item_name}`).join(", ")}</td>
                <td className="px-3 py-2">{STATUS_LABEL[o.status as OrderStatus].staff}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCents(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-6 text-center text-ink-soft">No orders yet.</p>}
      </div>
    </div>
  );
}
