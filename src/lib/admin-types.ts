// Plain shapes the admin pages receive (no Date, no BigInt), shared by server and browser.
import type { OrderStatus } from "./order-status";

export type AdminOrder = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  fulfilment: "pickup" | "delivery";
  paymentMethod: "cash" | "card_in_person";
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  address: { line: string; unit: string | null; city: string | null; postalCode: string; notes: string | null } | null;
  notes: string | null;
  scheduledFor: string | null;
  createdAt: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  totalCents: number;
  cancelReason: string | null;
  items: {
    name: string;
    variant: string | null;
    quantity: number;
    lineTotalCents: number;
    details: string[];
    notes: string | null;
  }[];
  events: { status: OrderStatus; at: string; by: string | null; note: string | null }[];
};
