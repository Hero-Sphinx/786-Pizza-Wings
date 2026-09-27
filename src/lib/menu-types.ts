// Shapes of the menu as the app uses it (browser and server). Plain data, no DB types.
import { z } from "zod";

export type TaxMode = "standard" | "included" | "exempt";
export type ItemKind = "pizza" | "wings" | "simple" | "deal";

/** What a deal bundles. Stored in menu_items.deal_config and validated with this schema on every read and write. */
export const dealConfigSchema = z
  .object({
    pizzas: z
      .object({
        count: z.number().int().min(1).max(6),
        // Topping units allowed on each pizza before extras are charged.
        toppingsPerPizza: z.number().int().min(0).max(20).optional(),
        // Topping units allowed across all pizzas combined (e.g. "up to 8 toppings combined").
        toppingsCombined: z.number().int().min(0).max(40).optional(),
      })
      .strict()
      .refine((p) => p.toppingsPerPizza !== undefined || p.toppingsCombined !== undefined, {
        message: "a pizza deal needs toppingsPerPizza or toppingsCombined",
      })
      .optional(),
    wings: z
      .object({
        count: z.number().int().min(1).max(200),
        maxFlavours: z.number().int().min(1).max(10),
      })
      .strict()
      .optional(),
    // Fixed extras with no choices online, e.g. "1 Garlic Bread", "6 Pops (in-store selection)".
    includes: z.array(z.string().min(1).max(80)).max(10),
  })
  .strict();
export type DealConfig = z.infer<typeof dealConfigSchema>;

export type PizzaSize = {
  code: string;
  label: string;
  inches: number | null;
  extraToppingCents: number | null;
};

export type Topping = {
  slug: string;
  name: string;
  group: "veg" | "meat";
  units: number;
  available: boolean;
};

export type WingFlavour = { slug: string; name: string; available: boolean };

export type Variant = {
  code: string;
  label: string;
  priceCents: number;
  pizzaSize: string | null;
  wingCount: number | null;
  maxFlavours: number | null;
  available: boolean;
};

export type MenuItem = {
  slug: string;
  categorySlug: string;
  kind: ItemKind;
  name: string;
  description: string | null;
  image: string | null;
  standardToppings: string[];
  includedToppingUnits: number;
  deal: DealConfig | null;
  taxMode: TaxMode;
  cashOnly: boolean;
  pickupOnly: boolean;
  /** Store-local weekdays (0 = Sunday). Empty = every day. */
  availableDays: number[];
  badge: string | null;
  available: boolean;
  variants: Variant[];
};

export type Category = { slug: string; name: string; blurb: string | null; items: MenuItem[] };

export type PricingSettings = {
  taxRateBps: number;
  smallOrderTaxRateBps: number;
  smallOrderMaxCents: number;
  deliveryEnabled: boolean;
  deliveryFeeCents: number;
  deliveryMinCents: number | null;
  maxOrderCents: number;
};

export type MenuSnapshot = {
  sizes: PizzaSize[];
  toppings: Topping[];
  flavours: WingFlavour[];
  categories: Category[];
  pricing: PricingSettings;
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Monday, Tuesday & Wednesday" */
export function describeDays(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
