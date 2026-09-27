// Order lifecycle. Pure so both the admin UI and the API agree on what's allowed.
import type { Fulfilment } from "./cart-schema";

export const ORDER_STATUSES = ["new", "accepted", "ready", "out_for_delivery", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["ready", "out_for_delivery", "cancelled"],
  ready: ["completed", "out_for_delivery", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function allowedTransitions(from: OrderStatus, fulfilment: Fulfilment): OrderStatus[] {
  return NEXT[from].filter((s) => s !== "out_for_delivery" || fulfilment === "delivery");
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: Fulfilment): boolean {
  return allowedTransitions(from, fulfilment).includes(to);
}

export const ACTIVE_STATUSES: OrderStatus[] = ["new", "accepted", "ready", "out_for_delivery"];

/** Labels for staff (admin) and customers (status page). */
export const STATUS_LABEL: Record<OrderStatus, { staff: string; customer: string }> = {
  new: { staff: "New", customer: "Order received" },
  accepted: { staff: "Accepted", customer: "In the oven" },
  ready: { staff: "Ready", customer: "Ready for pickup" },
  out_for_delivery: { staff: "Out for delivery", customer: "On the way" },
  completed: { staff: "Completed", customer: "Completed. Enjoy!" },
  cancelled: { staff: "Cancelled", customer: "Cancelled" },
};

/** Button text for moving an order to `to`. */
export const ACTION_LABEL: Record<OrderStatus, string> = {
  new: "Reopen",
  accepted: "Accept",
  ready: "Mark ready",
  out_for_delivery: "Out for delivery",
  completed: "Complete",
  cancelled: "Cancel",
};
