import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import type { PublicOrder } from "@/lib/api-types";
import type { CheckoutInput } from "@/lib/cart-schema";
import { postalFsa } from "@/lib/format";
import { acceptsAsap, isValidSlot, localParts, nextOpening, formatTime, formatDayLabel } from "@/lib/hours";
import { canTransition, ACTIVE_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { quoteCart, type Quote } from "@/lib/pricing";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { ApiError } from "./http";
import type { StoreInfo } from "@/lib/store-types";
import { loadMenuFresh, loadStoreFresh } from "./menu";
import { notifyNewOrder } from "./notify";
import { hashIdentifier } from "./rate-limit";

/** Checks the store is taking orders for the requested time. Returns the store-local weekday the food is for. */
export function resolveOrderTime(store: StoreInfo, fulfilment: "pickup" | "delivery", scheduledFor: string | undefined, now = new Date()) {
  if (!store.orderingEnabled) {
    throw new ApiError(503, store.orderingPausedMessage || "Online ordering is paused right now. Please call the store.");
  }
  const lead = fulfilment === "delivery" ? store.deliveryLeadMinutes : store.pickupLeadMinutes;
  if (scheduledFor) {
    const at = new Date(scheduledFor);
    if (!isValidSlot(at, now, lead, store.hours)) {
      throw new ApiError(409, "That time isn't available any more. Please pick another time.");
    }
    return { scheduledFor: at, weekday: localParts(at, store.hours.timezone).weekday };
  }
  if (!acceptsAsap(now, store.hours)) {
    const next = nextOpening(now, store.hours);
    const when = next ? ` (we open ${formatDayLabel(next.opens, now, store.hours.timezone).toLowerCase()} at ${formatTime(next.opens, store.hours.timezone)})` : "";
    throw new ApiError(409, `We're closed right now${when}. You can schedule your order for later.`);
  }
  return { scheduledFor: null, weekday: localParts(now, store.hours.timezone).weekday };
}

export function assertDeliverable(store: StoreInfo, postalCode: string) {
  if (!store.deliveryEnabled) throw new ApiError(409, "Delivery isn't available right now. Please choose pickup.");
  if (!store.deliveryFsas.includes(postalFsa(postalCode))) {
    throw new ApiError(409, "Sorry, that address is outside our delivery area. Please choose pickup or call us.");
  }
}

export function quoteErrors(quote: Quote) {
  return quote.errors.length ? new ApiError(409, quote.errors[0].message, { lines: quote.errors }) : null;
}

// Anti-spam limits that count only orders actually placed, so failed attempts never lock anyone out.
const MAX_ORDERS_PER_PHONE_PER_HOUR = 4;
const MAX_ORDERS_PER_IP_PER_10_MIN = 10;

async function assertOrderQuota(phone: string, ipHash: string) {
  const now = Date.now();
  const [byPhone, byIp] = await Promise.all([
    db().orders.count({ where: { customer_phone: phone, created_at: { gte: new Date(now - 3_600_000) }, status: { not: "cancelled" } } }),
    db().orders.count({ where: { client_ip_hash: ipHash, created_at: { gte: new Date(now - 600_000) } } }),
  ]);
  if (byPhone >= MAX_ORDERS_PER_PHONE_PER_HOUR || byIp >= MAX_ORDERS_PER_IP_PER_10_MIN) {
    throw new ApiError(429, "You've placed several orders in a short time. To order more, please call us and we'll sort it out.");
  }
}

export async function createOrder(input: CheckoutInput, ip: string): Promise<{ token: string; orderNumber: number }> {
  if (input.website) throw new ApiError(400, "Invalid request"); // honeypot

  const existing = await db().orders.findUnique({
    where: { idempotency_key: input.idempotencyKey },
    select: { public_token: true, order_number: true },
  });
  if (existing) return { token: existing.public_token, orderNumber: existing.order_number };

  await assertOrderQuota(input.customer.phone, hashIdentifier(ip));

  const [store, menu] = await Promise.all([loadStoreFresh(), loadMenuFresh()]);
  const time = resolveOrderTime(store, input.fulfilment, input.scheduledFor);
  if (input.fulfilment === "delivery") assertDeliverable(store, input.address!.postalCode);

  const quote = quoteCart(menu, input.lines, {
    fulfilment: input.fulfilment,
    paymentMethod: input.paymentMethod,
    weekday: time.weekday,
  });
  const problem = quoteErrors(quote);
  if (problem) throw problem;

  const token = randomBytes(24).toString("base64url");
  const address = input.fulfilment === "delivery" ? input.address : undefined;
  try {
    const order = await db().$transaction(async (tx) => {
      const created = await tx.orders.create({
        data: {
          public_token: token,
          idempotency_key: input.idempotencyKey,
          fulfilment: input.fulfilment,
          payment_method: input.paymentMethod,
          customer_name: input.customer.name,
          customer_phone: input.customer.phone,
          customer_email: input.customer.email ?? null,
          address_line: address?.line ?? null,
          address_unit: address?.unit ?? null,
          address_city: address?.city ?? null,
          address_postal_code: address?.postalCode ?? null,
          address_notes: address?.notes ?? null,
          notes: input.notes ?? null,
          scheduled_for: time.scheduledFor,
          subtotal_cents: quote.subtotalCents,
          delivery_fee_cents: quote.deliveryFeeCents,
          tax_cents: quote.taxCents,
          total_cents: quote.totalCents,
          client_ip_hash: hashIdentifier(ip),
          order_items: {
            create: quote.lines.map((l, position) => ({
              position,
              item_slug: l.item.slug,
              item_name: l.item.name,
              variant_label: l.item.variants.length > 1 || l.variant.code !== "regular" ? l.variant.label : null,
              quantity: l.quantity,
              unit_price_cents: l.unitPriceCents,
              line_total_cents: l.lineTotalCents,
              tax_mode: l.taxMode,
              details: l.details,
              selection: input.lines[l.index] as unknown as Prisma.InputJsonValue,
              notes: l.notes ?? null,
            })),
          },
          order_events: { create: { status: "new" } },
        },
        select: { id: true, order_number: true },
      });
      return created;
    });
    after(() => notifyNewOrder(order.id));
    return { token, orderNumber: order.order_number };
  } catch (err) {
    // Two identical submissions raced: return the one that won.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db().orders.findUnique({ where: { idempotency_key: input.idempotencyKey } });
      if (winner) return { token: winner.public_token, orderNumber: winner.order_number };
    }
    throw err;
  }
}

/** What the customer's status page may show. No phone, email or address. */
export async function getPublicOrder(token: string): Promise<PublicOrder | null> {
  const o = await db().orders.findUnique({
    where: { public_token: token },
    include: { order_items: { orderBy: { position: "asc" } } },
  });
  if (!o) return null;
  return {
    orderNumber: o.order_number,
    status: o.status as OrderStatus,
    fulfilment: o.fulfilment,
    paymentMethod: o.payment_method,
    firstName: o.customer_name.split(/\s+/)[0],
    scheduledFor: o.scheduled_for?.toISOString() ?? null,
    createdAt: o.created_at.toISOString(),
    subtotalCents: o.subtotal_cents,
    deliveryFeeCents: o.delivery_fee_cents,
    taxCents: o.tax_cents,
    totalCents: o.total_cents,
    items: o.order_items.map((i) => ({
      name: i.item_name,
      variant: i.variant_label,
      quantity: i.quantity,
      lineTotalCents: i.line_total_cents,
      details: i.details,
      notes: i.notes,
    })),
  };
}

const adminOrderInclude = {
  order_items: { orderBy: { position: "asc" } },
  order_events: { orderBy: { created_at: "asc" }, include: { admin_users: { select: { display_name: true } } } },
} satisfies Prisma.ordersInclude;

export type AdminOrderRow = Prisma.ordersGetPayload<{ include: typeof adminOrderInclude }>;

export async function listOrders(view: "active" | "today" | "recent"): Promise<AdminOrderRow[]> {
  const where: Prisma.ordersWhereInput =
    view === "active"
      ? { status: { in: ACTIVE_STATUSES } }
      : view === "today"
        ? { created_at: { gte: new Date(Date.now() - 24 * 3_600_000) } }
        : {};
  return db().orders.findMany({
    where,
    include: adminOrderInclude,
    orderBy: { created_at: view === "active" ? "asc" : "desc" },
    take: view === "recent" ? 200 : 100,
  });
}

export async function updateOrderStatus(orderId: string, to: OrderStatus, adminUserId: string, note?: string) {
  return db().$transaction(async (tx) => {
    // Lock the row so two tablets tapping at once can't both win.
    const rows = await tx.$queryRaw<{ status: OrderStatus; fulfilment: "pickup" | "delivery" }[]>`
      SELECT status, fulfilment FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const current = rows[0];
    if (!current) throw new ApiError(404, "Order not found");
    if (!canTransition(current.status, to, current.fulfilment)) {
      throw new ApiError(409, `This order is "${STATUS_LABEL[current.status].staff}" and can't be moved to "${STATUS_LABEL[to].staff}". Refresh to see the latest.`);
    }
    await tx.orders.update({
      where: { id: orderId },
      data: { status: to, updated_at: new Date(), ...(to === "cancelled" ? { cancel_reason: note ?? null } : {}) },
    });
    await tx.order_events.create({ data: { order_id: orderId, status: to, admin_user_id: adminUserId, note: note ?? null } });
  });
}
