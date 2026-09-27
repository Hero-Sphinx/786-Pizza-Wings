import "server-only";
import type { AdminOrder } from "@/lib/admin-types";
import type { OrderStatus } from "@/lib/order-status";
import type { AdminOrderRow } from "./orders";

export function toAdminOrder(o: AdminOrderRow): AdminOrder {
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status as OrderStatus,
    fulfilment: o.fulfilment,
    paymentMethod: o.payment_method,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    customerEmail: o.customer_email,
    address:
      o.fulfilment === "delivery" && o.address_line && o.address_postal_code
        ? {
            line: o.address_line,
            unit: o.address_unit,
            city: o.address_city,
            postalCode: o.address_postal_code,
            notes: o.address_notes,
          }
        : null,
    notes: o.notes,
    scheduledFor: o.scheduled_for?.toISOString() ?? null,
    createdAt: o.created_at.toISOString(),
    subtotalCents: o.subtotal_cents,
    deliveryFeeCents: o.delivery_fee_cents,
    taxCents: o.tax_cents,
    totalCents: o.total_cents,
    cancelReason: o.cancel_reason,
    items: o.order_items.map((i) => ({
      name: i.item_name,
      variant: i.variant_label,
      quantity: i.quantity,
      lineTotalCents: i.line_total_cents,
      details: i.details,
      notes: i.notes,
    })),
    events: o.order_events.map((e) => ({
      status: e.status as OrderStatus,
      at: e.created_at.toISOString(),
      by: e.admin_users?.display_name ?? null,
      note: e.note,
    })),
  };
}
