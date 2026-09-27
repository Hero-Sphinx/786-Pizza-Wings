import type { Metadata } from "next";
import { CheckoutForm, type Slot } from "@/components/checkout/CheckoutForm";
import { acceptsAsap, formatDayLabel, formatTime, orderSlots } from "@/lib/hours";
import { loadStore } from "@/server/menu";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const store = await loadStore();
  const now = new Date();
  const toSlots = (lead: number): Slot[] =>
    orderSlots(now, lead, store.hours).map((d) => ({
      iso: d.toISOString(),
      day: formatDayLabel(d, now, store.hours.timezone),
      time: formatTime(d, store.hours.timezone),
    }));

  return (
    <div className="container-page py-8">
      <h1 className="h-display text-4xl">Checkout</h1>
      <CheckoutForm
        asapOpen={acceptsAsap(now, store.hours)}
        slots={{ pickup: toSlots(store.pickupLeadMinutes), delivery: toSlots(store.deliveryLeadMinutes) }}
      />
    </div>
  );
}
