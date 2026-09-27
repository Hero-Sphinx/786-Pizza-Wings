// Response shapes shared by API routes and the browser code that calls them.
import type { OrderStatus } from "./order-status";
import type { LineError } from "./pricing";

export type ApiErrorBody = { error: string; details?: unknown };

export type QuoteResponse = {
  lines: { index: number; unitPriceCents: number; lineTotalCents: number; details: string[] }[];
  subtotalCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  totalCents: number;
  cashOnly: boolean;
  pickupOnly: boolean;
  errors: LineError[];
};

export type CreateOrderResponse = { token: string; orderNumber: number };

/** What a customer's order status page may show: no phone, email or address. */
export type PublicOrder = {
  orderNumber: number;
  status: OrderStatus;
  fulfilment: "pickup" | "delivery";
  paymentMethod: "cash" | "card_in_person";
  firstName: string;
  scheduledFor: string | null;
  createdAt: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  totalCents: number;
  items: { name: string; variant: string | null; quantity: number; lineTotalCents: number; details: string[]; notes: string | null }[];
};
