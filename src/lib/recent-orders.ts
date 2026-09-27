// Orders placed from this browser, so customers can get back to their status page without typing
// anything. Browser-only; every storage access is guarded (private mode, blocked storage).

export type RecentOrder = { token: string; orderNumber: number; placedAt: string };

const KEY = "786-recent-orders-v1";
const MAX = 5;
const KEEP_DAYS = 14;

export function readRecentOrders(): RecentOrder[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    return parsed.filter(
      (o): o is RecentOrder =>
        typeof o?.token === "string" &&
        /^[A-Za-z0-9_-]{32}$/.test(o.token) &&
        Number.isInteger(o.orderNumber) &&
        typeof o.placedAt === "string" &&
        Date.parse(o.placedAt) > cutoff,
    );
  } catch {
    return [];
  }
}

export function rememberOrder(order: Omit<RecentOrder, "placedAt">): void {
  try {
    const others = readRecentOrders().filter((o) => o.token !== order.token);
    const next = [{ ...order, placedAt: new Date().toISOString() }, ...others].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the customer can still use the order number + phone lookup.
  }
}
