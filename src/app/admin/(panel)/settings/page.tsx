import type { Metadata } from "next";
import { SettingsForm, type AdminSettings } from "@/components/admin/SettingsForm";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Settings" };

const hhmm = (d: Date) => d.toISOString().slice(11, 16);

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [s, hours, closures, promos] = await Promise.all([
    db().store_settings.findUniqueOrThrow({ where: { id: 1 } }),
    db().store_hours.findMany({ orderBy: { day_of_week: "asc" } }),
    db().store_closures.findMany({ orderBy: { closed_on: "asc" } }),
    db().promos.findMany({ orderBy: { sort_order: "asc" } }),
  ]);
  const settings: AdminSettings = {
    orderingEnabled: s.ordering_enabled,
    orderingPausedMessage: s.ordering_paused_message ?? "",
    deliveryEnabled: s.delivery_enabled,
    deliveryFeeCents: s.delivery_fee_cents,
    deliveryMinCents: s.delivery_min_cents,
    deliveryFsas: s.delivery_fsas,
    pickupLeadMinutes: s.pickup_lead_minutes,
    deliveryLeadMinutes: s.delivery_lead_minutes,
    lastOrderMinutes: s.last_order_minutes,
    maxOrderCents: s.max_order_cents,
    notifyEmail: s.notify_email ?? "",
    hours: hours.map((h) => ({ dayOfWeek: h.day_of_week, isClosed: h.is_closed, opensAt: hhmm(h.opens_at), closesAt: hhmm(h.closes_at) })),
    closures: closures.map((c) => ({ date: c.closed_on.toISOString().slice(0, 10), reason: c.reason ?? "" })),
    promos: promos.map((p) => ({
      slug: p.slug,
      isActive: p.is_active,
      eyebrow: p.eyebrow ?? "",
      title: p.title,
      body: p.body ?? "",
      priceText: p.price_text ?? "",
      ctaLabel: p.cta_label ?? "",
      ctaHref: p.cta_href ?? "",
    })),
  };
  return <SettingsForm initial={settings} isOwner={session.role === "owner"} />;
}
