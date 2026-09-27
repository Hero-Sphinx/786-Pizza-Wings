import "server-only";
import nodemailer from "nodemailer";
import { formatPhone } from "@/lib/format";
import { formatDayLabel, formatTime } from "@/lib/hours";
import { formatCents } from "@/lib/money";
import { db } from "./db";
import { env } from "./env";

function transport() {
  const e = env();
  if (!e.SMTP_HOST || !e.SMTP_USER || !e.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: Number(e.SMTP_PORT ?? 465),
    secure: Number(e.SMTP_PORT ?? 465) === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
  });
}

/**
 * Emails the store (and the customer, if they gave an email) about a new order.
 * Plain text only, so nothing a customer typed can inject markup. Never throws:
 * the order is already saved and shows on the staff board regardless.
 */
export async function notifyNewOrder(orderId: string): Promise<void> {
  try {
    const mailer = transport();
    const [order, settings] = await Promise.all([
      db().orders.findUnique({ where: { id: orderId }, include: { order_items: { orderBy: { position: "asc" } } } }),
      db().store_settings.findUnique({ where: { id: 1 } }),
    ]);
    if (!mailer || !order || !settings) return;

    const tz = settings.timezone;
    const when = order.scheduled_for
      ? `${formatDayLabel(order.scheduled_for, order.created_at, tz)} at ${formatTime(order.scheduled_for, tz)}`
      : "ASAP";
    const items = order.order_items.flatMap((i) => [
      `${i.quantity} x ${i.item_name}${i.variant_label ? ` (${i.variant_label})` : ""}  ${formatCents(i.line_total_cents)}`,
      ...i.details.map((d) => `    - ${d}`),
      ...(i.notes ? [`    Note: ${i.notes}`] : []),
    ]);
    const totals = [
      `Subtotal: ${formatCents(order.subtotal_cents)}`,
      ...(order.delivery_fee_cents ? [`Delivery: ${formatCents(order.delivery_fee_cents)}`] : []),
      `Tax: ${formatCents(order.tax_cents)}`,
      `Total: ${formatCents(order.total_cents)} (${order.payment_method === "cash" ? "cash" : "card"} on ${order.fulfilment === "pickup" ? "pickup" : "delivery"})`,
    ];
    const statusUrl = `${env().APP_URL}/order/${order.public_token}`;
    const from = env().SMTP_FROM ?? env().SMTP_USER!;

    if (settings.notify_email) {
      const address =
        order.fulfilment === "delivery"
          ? [`Deliver to: ${[order.address_unit, order.address_line].filter(Boolean).join("-")}, ${order.address_city} ${order.address_postal_code}`, ...(order.address_notes ? [`Address notes: ${order.address_notes}`] : [])]
          : ["PICKUP"];
      await mailer.sendMail({
        from,
        to: settings.notify_email,
        subject: `New ${order.fulfilment} order #${order.order_number} (${formatCents(order.total_cents)}, ${when})`,
        text: [
          `Order #${order.order_number}: ${when}`,
          `${order.customer_name}  ${formatPhone(order.customer_phone)}`,
          ...address,
          ...(order.notes ? [`Order notes: ${order.notes}`] : []),
          "",
          ...items,
          "",
          ...totals,
          "",
          `Open the order board: ${env().APP_URL}/admin`,
        ].join("\n"),
      });
    }
    if (order.customer_email) {
      await mailer.sendMail({
        from,
        to: order.customer_email,
        subject: `${settings.name}: order #${order.order_number} received`,
        text: [
          `Thanks ${order.customer_name.split(/\s+/)[0]}! We've got your order #${order.order_number} for ${order.fulfilment} (${when}).`,
          "",
          ...items,
          "",
          ...totals,
          "",
          `Track it here: ${statusUrl}`,
          `Questions? Call us at ${formatPhone(settings.phone)}.`,
        ].join("\n"),
      });
    }
  } catch (err) {
    console.error("[notify] failed to send order email", err instanceof Error ? err.message : err);
  }
}
