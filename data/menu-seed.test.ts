// Guards the seed data itself: a typo here would otherwise only show up as a broken menu.
import { describe, expect, it } from "vitest";
import { dealConfigSchema } from "@/lib/menu-types";
import * as seed from "./menu-seed";

const sizeCodes = new Set<string>(seed.pizzaSizes.map((s) => s.code));
const categorySlugs = new Set<string>(seed.categories.map((c) => c.slug));

const unique = (values: string[]) => new Set(values).size === values.length;

describe("menu seed", () => {
  it("has unique slugs everywhere", () => {
    expect(unique(seed.items.map((i) => i.slug))).toBe(true);
    expect(unique(seed.toppings.map((t) => t.slug))).toBe(true);
    expect(unique(seed.wingFlavours.map((f) => f.slug))).toBe(true);
    expect(unique(seed.promos.map((p) => p.slug))).toBe(true);
    for (const item of seed.items) expect(unique(item.variants.map((v) => v.code)), item.slug).toBe(true);
  });

  it.each(seed.items)("$slug is well formed", (item) => {
    expect(categorySlugs.has(item.category)).toBe(true);
    expect(item.variants.length).toBeGreaterThan(0);
    for (const v of item.variants) {
      expect(Number.isInteger(v.priceCents) && v.priceCents > 0).toBe(true);
      expect(v.code).toMatch(/^[a-z0-9-]+$/);
    }
    const needsSize = item.kind === "pizza" || (item.kind === "deal" && item.deal?.pizzas);
    for (const v of item.variants) {
      if (needsSize) expect(sizeCodes.has(v.pizzaSize ?? ""), `${item.slug}/${v.code} size`).toBe(true);
      else expect(v.pizzaSize).toBeUndefined();
    }
    if (item.kind === "wings") {
      for (const v of item.variants) expect(v.wingCount! > 0 && v.maxFlavours! > 0).toBe(true);
    }
    if (item.kind === "deal") expect(dealConfigSchema.safeParse(item.deal).success).toBe(true);
    else expect(item.deal).toBeUndefined();
    for (const d of item.availableDays ?? []) expect(d >= 0 && d <= 6).toBe(true);
  });

  it("points every item and promo at an image that exists", async () => {
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    const pub = path.resolve(import.meta.dirname, "..", "public");
    const images = [...seed.items.map((i) => i.image), ...seed.promos.map((p) => p.image)].filter(Boolean) as string[];
    const missing = images.filter((img) => !existsSync(path.join(pub, img)));
    expect(missing).toEqual([]);
  });

  it("keeps the published prices (spot check against 786pizza.com)", () => {
    const price = (slug: string, code: string) =>
      seed.items.find((i) => i.slug === slug)!.variants.find((v) => v.code === code)!.priceCents;
    expect(price("create-your-own", "small")).toBe(1079);
    expect(price("bbq-chicken", "party")).toBe(2699);
    expect(price("chicken-wings", "90")).toBe(7559);
    expect(price("deal-07", "large")).toBe(3347);
    expect(price("weekday-special", "large")).toBe(2650);
    expect(price("coleslaw", "regular")).toBe(377);
  });
});
