// Initial menu, transcribed from the live site (786pizza.com, index.php) on 2026-09-26.
// Prices are in cents exactly as published there. Re-run safely with `npm run db:seed`:
// it only inserts what's missing, so prices the owner edits in /admin are never overwritten.
//
// SOURCE NOTES (things the owner should confirm — see README "Data to confirm"):
// - Every web price is an even menu price x 1.08 (e.g. $9.99 -> $10.79, 20 wings $17.99 -> $19.43).
//   The old site seems to add 8% on top of the in-store menu. Kept as published.
// - Extra-topping prices aren't published, so pizza_sizes.extra_topping_cents is NULL:
//   extras beyond what an item includes are blocked online until the owner sets a price.
// - Deal #10 text says "2 Large Pizzas 12″" and "2 Medium Pizzas 14″" (inches swapped). Every other
//   deal says Medium = 12″, Large = 14″, which is what we use.
// - Deal #8 banner says "Unlimited toppings", menu text says "Upto 6 Toppings on each pizza". Using 6.
// - Deal #01 banner: all four #01 options are "Pick up - Cash Only - No Tax".
// - Specialty pizza ingredients (Feta, Red Onions, Chicken Bacon, Mozzarella) are kept as the
//   store's wording; they are not in the orderable toppings list, so they aren't mapped to it.
// - Wing flavour splits (max_flavours) aren't published: 1 flavour per 10 wings, capped at 4.
// - Small, X-Large and Party pizza diameters aren't published.

import type { DealConfig, ItemKind, TaxMode } from "@/lib/menu-types";

export type SeedVariant = {
  code: string;
  label: string;
  priceCents: number;
  pizzaSize?: string;
  wingCount?: number;
  maxFlavours?: number;
};

export type SeedItem = {
  slug: string;
  category: string;
  kind: ItemKind;
  name: string;
  description?: string;
  image?: string;
  standardToppings?: string[];
  includedToppingUnits?: number;
  deal?: DealConfig;
  taxMode?: TaxMode;
  cashOnly?: boolean;
  pickupOnly?: boolean;
  availableDays?: number[];
  badge?: string;
  variants: SeedVariant[];
};

export const pizzaSizes = [
  { code: "small", label: "Small", inches: null, extraToppingCents: null },
  { code: "medium", label: "Medium", inches: 12, extraToppingCents: null },
  { code: "large", label: "Large", inches: 14, extraToppingCents: null },
  { code: "xlarge", label: "X-Large", inches: null, extraToppingCents: null },
  { code: "party", label: "Party", inches: null, extraToppingCents: null },
] as const;

export const toppings = [
  { slug: "mushrooms", name: "Fresh Mushrooms", group: "veg", units: 1 },
  { slug: "tomatoes", name: "Tomatoes", group: "veg", units: 1 },
  { slug: "green-peppers", name: "Green Peppers", group: "veg", units: 1 },
  { slug: "hot-peppers", name: "Hot Peppers", group: "veg", units: 1 },
  { slug: "onions", name: "Onions", group: "veg", units: 1 },
  { slug: "pineapple", name: "Pineapple", group: "veg", units: 1 },
  { slug: "green-olives", name: "Green Olives", group: "veg", units: 1 },
  { slug: "black-olives", name: "Black Olives", group: "veg", units: 1 },
  { slug: "sun-dried-tomatoes", name: "Sun-dried Tomatoes", group: "veg", units: 1 },
  { slug: "roasted-red-peppers", name: "Roasted Red Peppers", group: "veg", units: 1 },
  { slug: "jalapeno-peppers", name: "Jalapeño Peppers", group: "veg", units: 1 },
  { slug: "double-cheese", name: "Double Cheese", group: "veg", units: 2 },
  { slug: "bbq-chicken", name: "BBQ Chicken", group: "meat", units: 2 },
  { slug: "tandoori-chicken", name: "Tandoori Chicken", group: "meat", units: 2 },
  { slug: "ground-beef", name: "Ground Beef", group: "meat", units: 2 },
  { slug: "beef-pepperoni", name: "Beef Pepperoni", group: "meat", units: 1 },
  { slug: "beef-bacon", name: "Beef Bacon", group: "meat", units: 1 },
  { slug: "beef-sausage", name: "Beef Sausage", group: "meat", units: 1 },
  { slug: "chicken-ham", name: "Chicken Ham", group: "meat", units: 1 },
] as const;

export const wingFlavours = [
  { slug: "bbq", name: "BBQ" },
  { slug: "mild", name: "Mild" },
  { slug: "medium", name: "Medium" },
  { slug: "hot", name: "Hot" },
  { slug: "suicide", name: "Suicide" },
  { slug: "honey-garlic", name: "Honey Garlic" },
  { slug: "honey-mustard", name: "Honey Mustard" },
  { slug: "sweet-thai-chilli", name: "Sweet Thai Chilli" },
  { slug: "sweet-n-sour", name: "Sweet n Sour" },
] as const;

export const categories = [
  { slug: "deals", name: "Deals & Combos", blurb: "Feed the whole crew for less." },
  { slug: "pizzas", name: "Pizzas", blurb: "Hand-tossed, stone-baked, finished with extra virgin olive oil." },
  { slug: "wings", name: "Fresh Wings", blurb: "Never frozen. Pick your sauce." },
  { slug: "burgers", name: "Burgers & Hot Dogs", blurb: null },
  { slug: "sides", name: "Sides", blurb: null },
  { slug: "drinks", name: "Drinks", blurb: null },
] as const;

/** Five-size ladder; prices in cents for Small, Medium, Large, X-Large, Party. */
function pizzaLadder(prices: [number, number, number, number, number]): SeedVariant[] {
  return pizzaSizes.map((s, i) => ({ code: s.code, label: s.label, priceCents: prices[i], pizzaSize: s.code }));
}
const TIER_A: [number, number, number, number, number] = [1079, 1187, 1457, 1781, 2267];
const TIER_B: [number, number, number, number, number] = [1187, 1295, 1619, 1943, 2483];
const TIER_C: [number, number, number, number, number] = [1295, 1403, 1781, 2105, 2699];

const flavoursFor = (wings: number) => Math.min(4, Math.max(1, Math.floor(wings / 10)));
const one = (priceCents: number): SeedVariant[] => [{ code: "regular", label: "Regular", priceCents }];
const threeSizes = (s: number, m: number, l: number): SeedVariant[] => [
  { code: "small", label: "Small", priceCents: s },
  { code: "medium", label: "Medium", priceCents: m },
  { code: "large", label: "Large", priceCents: l },
];
const pizzaDeal = (sizes: [string, number][]): SeedVariant[] =>
  sizes.map(([code, priceCents]) => ({
    code,
    label: pizzaSizes.find((s) => s.code === code)!.label,
    priceCents,
    pizzaSize: code,
  }));

const MOZZ = "Mozzarella";

export const items: SeedItem[] = [
  // --- Deals ---------------------------------------------------------------
  {
    slug: "weekday-special",
    category: "deals",
    kind: "deal",
    name: "Mon–Wed Special: 2 Large Pizzas",
    description: "2 large pizzas with 3 toppings each. Tax included!",
    image: "/images/deals/weekday-special.webp",
    deal: { pizzas: { count: 2, toppingsPerPizza: 3 }, includes: [] },
    taxMode: "included",
    availableDays: [1, 2, 3],
    badge: "Mon–Wed",
    variants: pizzaDeal([["large", 2650]]),
  },
  {
    slug: "deal-01",
    category: "deals",
    kind: "deal",
    name: "#01 786 No-Tax Special: 3 Large Pizzas",
    description: "3 large 14″ pizzas with 3 toppings each.",
    image: "/images/deals/deal-01.webp",
    deal: { pizzas: { count: 3, toppingsPerPizza: 3 }, includes: [] },
    taxMode: "exempt",
    cashOnly: true,
    pickupOnly: true,
    badge: "#01",
    variants: pizzaDeal([["large", 3888]]),
  },
  {
    slug: "deal-01-pops",
    category: "deals",
    kind: "deal",
    name: "#01 3 Large Pizzas + 6 Pops",
    description: "3 large 14″ pizzas with 3 toppings each and 6 pops.",
    image: "/images/deals/deal-01.webp",
    deal: { pizzas: { count: 3, toppingsPerPizza: 3 }, includes: ["6 Pops (in-store selection)"] },
    taxMode: "exempt",
    cashOnly: true,
    pickupOnly: true,
    badge: "#01",
    variants: pizzaDeal([["large", 4427]]),
  },
  {
    slug: "deal-01-wings",
    category: "deals",
    kind: "deal",
    name: "#01 3 Large Pizzas + 20 Wings",
    description: "3 large 14″ pizzas with 3 toppings each and 20 chicken wings.",
    image: "/images/deals/deal-01.webp",
    deal: {
      pizzas: { count: 3, toppingsPerPizza: 3 },
      wings: { count: 20, maxFlavours: flavoursFor(20) },
      includes: [],
    },
    taxMode: "exempt",
    cashOnly: true,
    pickupOnly: true,
    badge: "#01",
    variants: pizzaDeal([["large", 5615]]),
  },
  {
    slug: "deal-01-wings-pops",
    category: "deals",
    kind: "deal",
    name: "#01 3 Large Pizzas + 20 Wings + 6 Pops",
    description: "3 large 14″ pizzas with 3 toppings each, 20 chicken wings and 6 pops.",
    image: "/images/deals/deal-01.webp",
    deal: {
      pizzas: { count: 3, toppingsPerPizza: 3 },
      wings: { count: 20, maxFlavours: flavoursFor(20) },
      includes: ["6 Pops (in-store selection)"],
    },
    taxMode: "exempt",
    cashOnly: true,
    pickupOnly: true,
    badge: "#01",
    variants: pizzaDeal([["large", 6155]]),
  },
  {
    slug: "deal-02",
    category: "deals",
    kind: "deal",
    name: "#02 Wings for Two",
    description: "20 chicken wings and a garlic bread.",
    image: "/images/deals/deal-02.webp",
    deal: { wings: { count: 20, maxFlavours: flavoursFor(20) }, includes: ["1 Garlic Bread"] },
    badge: "#02",
    variants: one(2159),
  },
  {
    slug: "deal-03",
    category: "deals",
    kind: "deal",
    name: "#03 Pizza & Wings (Medium)",
    description: "1 medium 12″ pizza with 3 toppings and 25 chicken wings.",
    image: "/images/deals/deal-03.webp",
    deal: {
      pizzas: { count: 1, toppingsPerPizza: 3 },
      wings: { count: 25, maxFlavours: flavoursFor(25) },
      includes: [],
    },
    badge: "#03",
    variants: pizzaDeal([["medium", 3455]]),
  },
  {
    slug: "deal-04",
    category: "deals",
    kind: "deal",
    name: "#04 Pizza & Wings (Large)",
    description: "1 large 14″ pizza with 3 toppings, 30 chicken wings, a garlic bread and 4 pops.",
    image: "/images/deals/deal-03.webp",
    deal: {
      pizzas: { count: 1, toppingsPerPizza: 3 },
      wings: { count: 30, maxFlavours: flavoursFor(30) },
      includes: ["1 Garlic Bread", "4 Pops (in-store selection)"],
    },
    badge: "#04",
    variants: pizzaDeal([["large", 4481]]),
  },
  {
    slug: "deal-05",
    category: "deals",
    kind: "deal",
    name: "#05 40 Wings Deal",
    description: "40 chicken wings, a garlic bread, potato wedges and 4 pops.",
    image: "/images/deals/deal-05.webp",
    deal: {
      wings: { count: 40, maxFlavours: flavoursFor(40) },
      includes: ["1 Garlic Bread", "1 Potato Wedges", "4 Pops (in-store selection)"],
    },
    badge: "#05",
    variants: one(4211),
  },
  {
    slug: "deal-06",
    category: "deals",
    kind: "deal",
    name: "#06 60 Wings Deal",
    description: "60 chicken wings, a garlic bread, potato wedges and 6 pops.",
    image: "/images/deals/deal-06.webp",
    deal: {
      wings: { count: 60, maxFlavours: flavoursFor(60) },
      includes: ["1 Garlic Bread", "1 Potato Wedges", "6 Pops (in-store selection)"],
    },
    badge: "#06",
    variants: one(6479),
  },
  {
    slug: "deal-07",
    category: "deals",
    kind: "deal",
    name: "#07 Mega Deal",
    description: "1 pizza with 3 toppings, 12 chicken wings, 2 dipping sauces and 2 pops.",
    image: "/images/deals/deal-07.webp",
    deal: {
      pizzas: { count: 1, toppingsPerPizza: 3 },
      wings: { count: 12, maxFlavours: flavoursFor(12) },
      includes: ["2 Dipping Sauces", "2 Pops (in-store selection)"],
    },
    badge: "#07",
    variants: pizzaDeal([
      ["medium", 2807],
      ["large", 3347],
    ]),
  },
  {
    slug: "deal-08",
    category: "deals",
    kind: "deal",
    name: "#08 Super Family Deal",
    description: "2 pizzas with up to 6 toppings each and 12 chicken wings.",
    image: "/images/deals/deal-08.webp",
    deal: {
      pizzas: { count: 2, toppingsPerPizza: 6 },
      wings: { count: 12, maxFlavours: flavoursFor(12) },
      includes: [],
    },
    badge: "#08",
    variants: pizzaDeal([
      ["medium", 3779],
      ["large", 4319],
    ]),
  },
  {
    slug: "deal-09",
    category: "deals",
    kind: "deal",
    name: "#09 Any Size Pizza Deal",
    description: "1 small, medium or large pizza with 3 toppings, 15 chicken wings and a dipping sauce.",
    image: "/images/deals/deal-09.webp",
    deal: {
      pizzas: { count: 1, toppingsPerPizza: 3 },
      wings: { count: 15, maxFlavours: flavoursFor(15) },
      includes: ["1 Dipping Sauce"],
    },
    badge: "#09",
    variants: pizzaDeal([
      ["small", 2699],
      ["medium", 2699],
      ["large", 2699],
    ]),
  },
  {
    slug: "deal-10",
    category: "deals",
    kind: "deal",
    name: "#10 786 Special: 2 Pizzas",
    description: "2 pizzas with up to 8 toppings combined, 4 pops and a dipping sauce.",
    image: "/images/deals/deal-10.webp",
    deal: {
      pizzas: { count: 2, toppingsCombined: 8 },
      includes: ["4 Pops (in-store selection)", "1 Dipping Sauce"],
    },
    badge: "#10",
    variants: pizzaDeal([
      ["medium", 3023],
      ["large", 3455],
    ]),
  },
  {
    slug: "deal-11",
    category: "deals",
    kind: "deal",
    name: "#11 30 Wings Combo",
    description: "30 chicken wings and a garlic bread.",
    image: "/images/deals/deal-11.webp",
    deal: { wings: { count: 30, maxFlavours: flavoursFor(30) }, includes: ["1 Garlic Bread"] },
    badge: "#11",
    variants: one(2969),
  },

  // --- Pizzas --------------------------------------------------------------
  {
    slug: "create-your-own",
    category: "pizzas",
    kind: "pizza",
    name: "Create Your Own Pizza",
    description: "Pick any 3 toppings. Double cheese, BBQ chicken, tandoori chicken and ground beef count as 2.",
    image: "/images/pizzas/create-your-own.webp",
    includedToppingUnits: 3,
    badge: "3 toppings",
    variants: pizzaLadder(TIER_A),
  },
  {
    slug: "deluxe",
    category: "pizzas",
    kind: "pizza",
    name: "Deluxe",
    image: "/images/pizzas/deluxe.webp",
    standardToppings: ["Beef Pepperoni", "Green Peppers", "Mushrooms", MOZZ],
    variants: pizzaLadder(TIER_A),
  },
  {
    slug: "hawaiian",
    category: "pizzas",
    kind: "pizza",
    name: "The Hawaiian",
    image: "/images/pizzas/hawaiian.webp",
    standardToppings: ["Pineapple", "Chicken Ham", "Beef Bacon", MOZZ],
    variants: pizzaLadder(TIER_A),
  },
  {
    slug: "meat-lover",
    category: "pizzas",
    kind: "pizza",
    name: "Meat Lover",
    image: "/images/pizzas/meat-lover.webp",
    standardToppings: ["Beef Pepperoni", "Beef Bacon", "Ground Beef", MOZZ],
    variants: pizzaLadder(TIER_B),
  },
  {
    slug: "greek-special",
    category: "pizzas",
    kind: "pizza",
    name: "The Greek Special",
    image: "/images/pizzas/greek.webp",
    standardToppings: ["Red Onions", "Feta Cheese", "Black Olives", "Tomatoes", MOZZ],
    variants: pizzaLadder(TIER_B),
  },
  {
    slug: "bbq-chicken",
    category: "pizzas",
    kind: "pizza",
    name: "The BBQ Chicken",
    image: "/images/pizzas/bbq-chicken.webp",
    standardToppings: ["BBQ Chicken", "Mushrooms", "Green Pepper", "Onions", MOZZ],
    variants: pizzaLadder(TIER_C),
  },
  {
    slug: "mediterranean",
    category: "pizzas",
    kind: "pizza",
    name: "The Mediterranean",
    image: "/images/pizzas/mediterranean.webp",
    standardToppings: ["Black Olives", "Feta Cheese", "Jalapeño Peppers", "Red Onions", MOZZ],
    variants: pizzaLadder(TIER_B),
  },
  {
    slug: "mexican",
    category: "pizzas",
    kind: "pizza",
    name: "The Mexican",
    image: "/images/pizzas/mexican.webp",
    standardToppings: ["Hot Peppers", "Tomatoes", "Ground Beef", MOZZ],
    variants: pizzaLadder(TIER_B),
  },
  {
    slug: "classic-canadian",
    category: "pizzas",
    kind: "pizza",
    name: "The Classic Canadian",
    image: "/images/pizzas/classic-canadian.webp",
    standardToppings: ["Pepperoni", "Chicken Bacon", "Mushrooms", MOZZ],
    variants: pizzaLadder(TIER_A),
  },

  // --- Wings ---------------------------------------------------------------
  {
    slug: "chicken-wings",
    category: "wings",
    kind: "wings",
    name: "Fresh Chicken Wings",
    description: "Fresh, never frozen, tossed in your choice of sauce.",
    image: "/images/wings.webp",
    variants: (
      [
        [10, 1047],
        [20, 1943],
        [30, 2753],
        [40, 3617],
        [60, 5075],
        [90, 7559],
      ] as const
    ).map(([count, priceCents]) => ({
      code: String(count),
      label: `${count} wings`,
      priceCents,
      wingCount: count,
      maxFlavours: flavoursFor(count),
    })),
  },

  // --- Burgers & hot dogs --------------------------------------------------
  {
    slug: "beef-burger",
    category: "burgers",
    kind: "simple",
    name: "Beef Burger",
    image: "/images/burger.webp",
    variants: one(647),
  },
  {
    slug: "jumbo-hot-dog",
    category: "burgers",
    kind: "simple",
    name: "#12 Jumbo Hot Dog",
    image: "/images/hot-dog.webp",
    badge: "#12",
    variants: one(539),
  },

  // --- Sides ---------------------------------------------------------------
  {
    slug: "poutine",
    category: "sides",
    kind: "simple",
    name: "Poutine",
    image: "/images/sides/poutine.webp",
    variants: threeSizes(863, 1079, 1187),
  },
  {
    slug: "potato-wedges",
    category: "sides",
    kind: "simple",
    name: "Potato Wedges",
    image: "/images/sides/potato-wedges.webp",
    variants: threeSizes(647, 809, 971),
  },
  {
    slug: "french-fries",
    category: "sides",
    kind: "simple",
    name: "French Fries",
    image: "/images/sides/french-fries.webp",
    variants: threeSizes(485, 647, 809),
  },
  {
    slug: "onion-rings",
    category: "sides",
    kind: "simple",
    name: "Onion Rings",
    image: "/images/sides/onion-rings.webp",
    variants: threeSizes(485, 647, 809),
  },
  {
    slug: "garlic-bread-cheese",
    category: "sides",
    kind: "simple",
    name: "Garlic Bread with Cheese",
    image: "/images/sides/garlic-bread-cheese.webp",
    variants: one(539),
  },
  {
    slug: "garlic-bread",
    category: "sides",
    kind: "simple",
    name: "Garlic Bread",
    image: "/images/sides/garlic-bread.webp",
    variants: one(431),
  },
  {
    slug: "coleslaw",
    category: "sides",
    kind: "simple",
    name: "Coleslaw (250 g)",
    image: "/images/sides/coleslaw.webp",
    variants: one(377),
  },
  {
    slug: "dipping-sauce",
    category: "sides",
    kind: "simple",
    name: "Dipping Sauce",
    description: "Tell us which sauce in the item note.",
    image: "/images/sides/dipping-sauce.webp",
    variants: one(108),
  },

  // --- Drinks --------------------------------------------------------------
  {
    slug: "canned-pop",
    category: "drinks",
    kind: "simple",
    name: "Canned Pop",
    description: "Flavour from what's in store. Add a preference in the item note.",
    image: "/images/sides/canned-pop.webp",
    variants: one(162),
  },
];

export const storeSettings = {
  name: "786 Pizza & Wings",
  phone: "9054530786",
  addressLine: "400 Queen Street West",
  city: "Brampton",
  province: "ON",
  postalCode: "L6X 1B3",
  landmark: "Northwest corner of Queen & McLaughlin, in the FreshCo plaza",
  timezone: "America/Toronto",
  deliveryFeeCents: 499, // from the old online-ordering page ("DELIVERY - $4.99")
  deliveryMinCents: null, // "Minimum order required" but the amount isn't published
  deliveryFsas: ["L6X", "L6Y", "L6V", "L6W"], // placeholder: nearby areas, owner to confirm
};

// 11:30 AM – 11:30 PM, every day.
export const storeHours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: "11:30",
  closesAt: "23:30",
}));

export const promos = [
  {
    slug: "weekday-special",
    eyebrow: "Monday, Tuesday & Wednesday only",
    title: "2 Large Pizzas, 3 toppings each",
    body: "Our Meat Products are HMA Certified.",
    priceText: "$26.50 including tax",
    image: "/images/promos/weekday.webp",
    ctaLabel: "Order the special",
    ctaHref: "/menu?item=weekday-special",
  },
  {
    slug: "no-tax-special",
    eyebrow: "Pickup · Cash only · No tax",
    title: "786 Special: 3 Large Pizzas",
    body: "3 toppings on each. Add 20 wings or 6 pops.",
    priceText: "$38.88",
    image: "/images/promos/pizzas.webp",
    ctaLabel: "See the deal",
    ctaHref: "/menu?item=deal-01",
  },
  {
    slug: "mega-deal",
    eyebrow: "#07 Mega Deal",
    title: "Pizza, 12 wings, 2 dips & 2 pops",
    body: null,
    priceText: "Medium $28.07 · Large $33.47",
    image: "/images/promos/mega.webp",
    ctaLabel: "Build yours",
    ctaHref: "/menu?item=deal-07",
  },
  {
    slug: "we-deliver",
    eyebrow: "Hot to your door",
    title: "We deliver!",
    body: "Minimum order and delivery charges apply.",
    priceText: null,
    image: "/images/promos/deliver.webp",
    ctaLabel: "Start an order",
    ctaHref: "/menu",
  },
];
