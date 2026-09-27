import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatusView } from "@/components/order/OrderStatusView";
import { loadStore } from "@/server/menu";
import { getPublicOrder } from "@/server/orders";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: PageProps<"/order/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const [order, store] = await Promise.all([getPublicOrder(token), loadStore()]);
  if (!order) notFound();
  return (
    <div className="container-page max-w-3xl py-8">
      <OrderStatusView token={token} initial={order} timezone={store.hours.timezone} />
    </div>
  );
}
