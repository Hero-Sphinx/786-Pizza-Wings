// Loads data/menu-seed.ts into the database. Safe to re-run.
//   npm run db:seed                 insert anything missing; never touches existing rows
//   npm run db:seed -- --reset-menu also overwrite menu rows (names, prices, deals) from the file.
//                                   Store settings, hours and staff accounts are never overwritten.
import "dotenv/config";
import * as seed from "../data/menu-seed";
import { dealConfigSchema } from "../src/lib/menu-types";
import { db } from "../src/server/db";

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

async function main() {
  const reset = process.argv.includes("--reset-menu");
  for (const item of seed.items) {
    if (item.deal) dealConfigSchema.parse(item.deal);
  }

  const counts = await db().$transaction(
    async (tx) => {
      const n = { inserted: 0, updated: 0 };
      const upsert = async <T>(exists: boolean, create: () => Promise<T>, update: () => Promise<T>) => {
        if (!exists) {
          await create();
          n.inserted++;
        } else if (reset) {
          await update();
          n.updated++;
        }
      };

      if (!(await tx.store_settings.findUnique({ where: { id: 1 } }))) {
        const s = seed.storeSettings;
        await tx.store_settings.create({
          data: {
            id: 1,
            name: s.name,
            phone: s.phone,
            address_line: s.addressLine,
            city: s.city,
            province: s.province,
            postal_code: s.postalCode,
            landmark: s.landmark,
            timezone: s.timezone,
            delivery_fee_cents: s.deliveryFeeCents,
            delivery_min_cents: s.deliveryMinCents,
            delivery_fsas: s.deliveryFsas,
          },
        });
        n.inserted++;
      }
      const hours = await tx.store_hours.createMany({
        data: seed.storeHours.map((h) => ({ day_of_week: h.dayOfWeek, opens_at: time(h.opensAt), closes_at: time(h.closesAt) })),
        skipDuplicates: true,
      });
      n.inserted += hours.count;

      for (const [i, s] of seed.pizzaSizes.entries()) {
        const data = { label: s.label, inches: s.inches, sort_order: i };
        await upsert(
          !!(await tx.pizza_sizes.findUnique({ where: { code: s.code } })),
          () => tx.pizza_sizes.create({ data: { code: s.code, extra_topping_cents: s.extraToppingCents, ...data } }),
          // extra_topping_cents is the owner's call once set, so a reset leaves it alone.
          () => tx.pizza_sizes.update({ where: { code: s.code }, data }),
        );
      }
      for (const [i, t] of seed.toppings.entries()) {
        const data = { name: t.name, topping_group: t.group, units: t.units, sort_order: i };
        await upsert(
          !!(await tx.toppings.findUnique({ where: { slug: t.slug } })),
          () => tx.toppings.create({ data: { slug: t.slug, ...data } }),
          () => tx.toppings.update({ where: { slug: t.slug }, data }),
        );
      }
      for (const [i, f] of seed.wingFlavours.entries()) {
        const data = { name: f.name, sort_order: i };
        await upsert(
          !!(await tx.wing_flavours.findUnique({ where: { slug: f.slug } })),
          () => tx.wing_flavours.create({ data: { slug: f.slug, ...data } }),
          () => tx.wing_flavours.update({ where: { slug: f.slug }, data }),
        );
      }
      for (const [i, c] of seed.categories.entries()) {
        const data = { name: c.name, blurb: c.blurb, sort_order: i };
        await upsert(
          !!(await tx.categories.findUnique({ where: { slug: c.slug } })),
          () => tx.categories.create({ data: { slug: c.slug, ...data } }),
          () => tx.categories.update({ where: { slug: c.slug }, data }),
        );
      }
      for (const [i, item] of seed.items.entries()) {
        const data = {
          category_slug: item.category,
          kind: item.kind,
          name: item.name,
          description: item.description ?? null,
          image: item.image ?? null,
          standard_toppings: item.standardToppings ?? [],
          included_topping_units: item.includedToppingUnits ?? 0,
          deal_config: item.deal ?? undefined,
          tax_mode: item.taxMode ?? "standard",
          cash_only: item.cashOnly ?? false,
          pickup_only: item.pickupOnly ?? false,
          available_days: item.availableDays ?? [],
          badge: item.badge ?? null,
          sort_order: i,
          updated_at: new Date(),
        };
        await upsert(
          !!(await tx.menu_items.findUnique({ where: { slug: item.slug } })),
          () => tx.menu_items.create({ data: { slug: item.slug, ...data } }),
          () => tx.menu_items.update({ where: { slug: item.slug }, data }),
        );
        for (const [j, v] of item.variants.entries()) {
          const vdata = {
            label: v.label,
            price_cents: v.priceCents,
            pizza_size: v.pizzaSize ?? null,
            wing_count: v.wingCount ?? null,
            max_flavours: v.maxFlavours ?? null,
            sort_order: j,
          };
          const key = { item_slug_code: { item_slug: item.slug, code: v.code } };
          await upsert(
            !!(await tx.item_variants.findUnique({ where: key })),
            () => tx.item_variants.create({ data: { item_slug: item.slug, code: v.code, ...vdata } }),
            () => tx.item_variants.update({ where: key, data: vdata }),
          );
        }
      }
      for (const [i, p] of seed.promos.entries()) {
        const data = {
          eyebrow: p.eyebrow,
          title: p.title,
          body: p.body,
          price_text: p.priceText,
          image: p.image,
          cta_label: p.ctaLabel,
          cta_href: p.ctaHref,
          sort_order: i,
        };
        await upsert(
          !!(await tx.promos.findUnique({ where: { slug: p.slug } })),
          () => tx.promos.create({ data: { slug: p.slug, ...data } }),
          () => tx.promos.update({ where: { slug: p.slug }, data }),
        );
      }
      return n;
    },
    { timeout: 60_000 },
  );

  console.log(`seed complete: ${counts.inserted} inserted, ${counts.updated} updated${reset ? " (--reset-menu)" : ""}`);
  await db().$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await db().$disconnect();
  process.exit(1);
});
