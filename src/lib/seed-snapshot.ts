// Builds a MenuSnapshot straight from data/menu-seed.ts, so tests and the seed validator
// exercise the real menu without a database.
import * as seed from "../../data/menu-seed";
import type { MenuSnapshot, PricingSettings } from "./menu-types";

export const defaultPricing: PricingSettings = {
  taxRateBps: 1300,
  smallOrderTaxRateBps: 500,
  smallOrderMaxCents: 400,
  deliveryEnabled: true,
  deliveryFeeCents: seed.storeSettings.deliveryFeeCents,
  deliveryMinCents: seed.storeSettings.deliveryMinCents,
  maxOrderCents: 50_000,
};

export function seedSnapshot(pricing: Partial<PricingSettings> = {}): MenuSnapshot {
  return {
    sizes: seed.pizzaSizes.map((s) => ({ ...s })),
    toppings: seed.toppings.map((t) => ({ ...t, available: true })),
    flavours: seed.wingFlavours.map((f) => ({ ...f, available: true })),
    categories: seed.categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      blurb: c.blurb,
      items: seed.items
        .filter((i) => i.category === c.slug)
        .map((i) => ({
          slug: i.slug,
          categorySlug: i.category,
          kind: i.kind,
          name: i.name,
          description: i.description ?? null,
          image: i.image ?? null,
          standardToppings: i.standardToppings ?? [],
          includedToppingUnits: i.includedToppingUnits ?? 0,
          deal: i.deal ?? null,
          taxMode: i.taxMode ?? "standard",
          cashOnly: i.cashOnly ?? false,
          pickupOnly: i.pickupOnly ?? false,
          availableDays: i.availableDays ?? [],
          badge: i.badge ?? null,
          available: true,
          visible: true,
          variants: i.variants.map((v) => ({
            code: v.code,
            label: v.label,
            priceCents: v.priceCents,
            pizzaSize: v.pizzaSize ?? null,
            wingCount: v.wingCount ?? null,
            maxFlavours: v.maxFlavours ?? null,
            available: true,
          })),
        })),
    })),
    pricing: { ...defaultPricing, ...pricing },
  };
}
