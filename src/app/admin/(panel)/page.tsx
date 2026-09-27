import type { Metadata } from "next";
import { OrderBoard } from "@/components/admin/OrderBoard";
import { toAdminOrder } from "@/server/admin-orders";
import { requireAdmin } from "@/server/auth";
import { loadStoreFresh } from "@/server/menu";
import { listOrders } from "@/server/orders";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  await requireAdmin();
  const [orders, store] = await Promise.all([listOrders("active"), loadStoreFresh()]);
  return <OrderBoard initial={orders.map(toAdminOrder)} timezone={store.hours.timezone} orderingEnabled={store.orderingEnabled} />;
}
