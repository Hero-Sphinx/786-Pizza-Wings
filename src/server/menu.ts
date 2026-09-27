import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { dealConfigSchema, type MenuItem, type MenuSnapshot } from "@/lib/menu-types";
import type { StoreInfo } from "@/lib/store-types";
import { db } from "./db";

export const MENU_TAG = "menu";
export const STORE_TAG = "store";

/** Call after any admin change so the public site shows it right away. */
export function invalidateMenu() {
  revalidateTag(MENU_TAG, { expire: 0 });
  revalidateTag(STORE_TAG, { expire: 0 });
}

const hhmm = (d: Date) => d.toISOString().slice(11, 16); // `time` columns come back as 1970-01-01T..Z

async function readSettings() {
  const s = await db().store_settings.findUnique({ where: { id: 1 } });
  if (!s) throw new Error("store_settings row is missing. Run `npm run db:seed`.");
  return s;
}

/** Reads the whole menu. `includeHidden` is for the admin editor. */
export async function loadMenuFresh(opts: { includeHidden?: boolean } = {}): Promise<MenuSnapshot> {
  const [settings, sizes, toppings, flavours, categories] = await Promise.all([
    readSettings(),
    db().pizza_sizes.findMany({ orderBy: { sort_order: "asc" } }),
    db().toppings.findMany({ orderBy: [{ topping_group: "asc" }, { sort_order: "asc" }] }),
    db().wing_flavours.findMany({ orderBy: { sort_order: "asc" } }),
    db().categories.findMany({
      where: opts.includeHidden ? {} : { is_visible: true },
      orderBy: { sort_order: "asc" },
      include: {
        menu_items: {
          where: opts.includeHidden ? {} : { is_visible: true },
          orderBy: { sort_order: "asc" },
          include: { item_variants: { orderBy: { sort_order: "asc" } } },
        },
      },
    }),
  ]);

  return {
    sizes: sizes.map((s) => ({ code: s.code, label: s.label, inches: s.inches, extraToppingCents: s.extra_topping_cents })),
    toppings: toppings.map((t) => ({
      slug: t.slug,
      name: t.name,
      group: t.topping_group,
      units: t.units,
      available: t.is_available,
    })),
    flavours: flavours.map((f) => ({ slug: f.slug, name: f.name, available: f.is_available })),
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      blurb: c.blurb,
      items: c.menu_items.map(
        (i): MenuItem => ({
          slug: i.slug,
          categorySlug: i.category_slug,
          kind: i.kind,
          name: i.name,
          description: i.description,
          image: i.image,
          standardToppings: i.standard_toppings,
          includedToppingUnits: i.included_topping_units,
          // A bad config makes the deal unorderable instead of crashing the menu.
          deal: i.kind === "deal" ? (dealConfigSchema.safeParse(i.deal_config).data ?? null) : null,
          taxMode: i.tax_mode,
          cashOnly: i.cash_only,
          pickupOnly: i.pickup_only,
          availableDays: i.available_days,
          badge: i.badge,
          available: i.is_available && (i.kind !== "deal" || dealConfigSchema.safeParse(i.deal_config).success),
          variants: i.item_variants.map((v) => ({
            code: v.code,
            label: v.label,
            priceCents: v.price_cents,
            pizzaSize: v.pizza_size,
            wingCount: v.wing_count,
            maxFlavours: v.max_flavours,
            available: v.is_available,
          })),
        }),
      ),
    })),
    pricing: {
      taxRateBps: settings.tax_rate_bps,
      smallOrderTaxRateBps: settings.small_order_tax_rate_bps,
      smallOrderMaxCents: settings.small_order_max_cents,
      deliveryEnabled: settings.delivery_enabled,
      deliveryFeeCents: settings.delivery_fee_cents,
      deliveryMinCents: settings.delivery_min_cents,
      maxOrderCents: settings.max_order_cents,
    },
  };
}

/** Public menu, cached briefly and refreshed immediately after admin edits. */
export const loadMenu = unstable_cache(() => loadMenuFresh(), ["menu-v1"], { tags: [MENU_TAG], revalidate: 300 });

export async function loadStoreFresh(): Promise<StoreInfo> {
  const [s, hours, closures, promos] = await Promise.all([
    readSettings(),
    db().store_hours.findMany({ orderBy: { day_of_week: "asc" } }),
    db().store_closures.findMany({ where: { closed_on: { gte: new Date(Date.now() - 86_400_000) } } }),
    db().promos.findMany({ where: { is_active: true }, orderBy: { sort_order: "asc" } }),
  ]);
  return {
    name: s.name,
    phone: s.phone,
    addressLine: s.address_line,
    city: s.city,
    province: s.province,
    postalCode: s.postal_code,
    landmark: s.landmark,
    orderingEnabled: s.ordering_enabled,
    orderingPausedMessage: s.ordering_paused_message,
    deliveryEnabled: s.delivery_enabled,
    deliveryFeeCents: s.delivery_fee_cents,
    deliveryMinCents: s.delivery_min_cents,
    deliveryFsas: s.delivery_fsas,
    pickupLeadMinutes: s.pickup_lead_minutes,
    deliveryLeadMinutes: s.delivery_lead_minutes,
    hours: {
      timezone: s.timezone,
      lastOrderMinutes: s.last_order_minutes,
      hours: hours.map((h) => ({
        dayOfWeek: h.day_of_week,
        isClosed: h.is_closed,
        opensAt: hhmm(h.opens_at),
        closesAt: hhmm(h.closes_at),
      })),
      closures: closures.map((c) => c.closed_on.toISOString().slice(0, 10)),
    },
    promos: promos.map((p) => ({
      slug: p.slug,
      eyebrow: p.eyebrow,
      title: p.title,
      body: p.body,
      priceText: p.price_text,
      image: p.image,
      ctaLabel: p.cta_label,
      ctaHref: p.cta_href,
    })),
  };
}

export const loadStore = unstable_cache(() => loadStoreFresh(), ["store-v1"], { tags: [STORE_TAG], revalidate: 300 });
