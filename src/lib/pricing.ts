// The single pricing engine. The browser uses it for live previews; the server runs the same
// code against fresh menu data before saving an order, so a tampered cart can never change a price.
import type { CartLineInput, Fulfilment, PaymentMethod } from "./cart-schema";
import { applyRate, formatCents } from "./money";
import { describeDays } from "./menu-types";
import type { MenuItem, MenuSnapshot, PizzaSize, TaxMode, Topping, Variant } from "./menu-types";

export type LineError = { line: number | null; message: string };

export type PricedLine = {
  index: number;
  item: MenuItem;
  variant: Variant;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  taxMode: TaxMode;
  /** Human-readable choices, e.g. ["Toppings: Mushrooms, Onions", "Extra toppings (2): +$3.00"] */
  details: string[];
  notes?: string;
};

export type Quote = {
  lines: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  totalCents: number;
  cashOnly: boolean;
  pickupOnly: boolean;
  errors: LineError[];
};

export type QuoteContext = {
  fulfilment: Fulfilment;
  paymentMethod?: PaymentMethod;
  /** Store-local weekday of when the food is for (0 = Sunday). */
  weekday: number;
};

class LineProblem extends Error {}

type Lookup = {
  sizes: Map<string, PizzaSize>;
  toppings: Map<string, Topping>;
  flavours: Map<string, { name: string; available: boolean }>;
  items: Map<string, MenuItem>;
};

export function buildLookup(menu: MenuSnapshot): Lookup {
  return {
    sizes: new Map(menu.sizes.map((s) => [s.code, s])),
    toppings: new Map(menu.toppings.map((t) => [t.slug, t])),
    flavours: new Map(menu.flavours.map((f) => [f.slug, f])),
    items: new Map(menu.categories.flatMap((c) => c.items).map((i) => [i.slug, i])),
  };
}

function resolveToppings(slugs: string[], lk: Lookup): Topping[] {
  return slugs.map((s) => {
    const t = lk.toppings.get(s);
    if (!t) throw new LineProblem("That topping isn't on our menu any more.");
    if (!t.available) throw new LineProblem(`${t.name} is sold out right now.`);
    return t;
  });
}

const units = (ts: Topping[]) => ts.reduce((n, t) => n + t.units, 0);
const names = (ts: Topping[]) => ts.map((t) => t.name).join(", ");

/** Extra-topping charge for `extraUnits` on `size`, or a clear error when extras aren't offered. */
function extraCharge(extraUnits: number, size: PizzaSize, limitText: string): number {
  if (extraUnits <= 0) return 0;
  if (size.extraToppingCents === null) {
    throw new LineProblem(`${limitText} Please remove ${extraUnits} topping${extraUnits > 1 ? "s" : ""}.`);
  }
  return extraUnits * size.extraToppingCents;
}

function sizeOf(variant: Variant, lk: Lookup): PizzaSize {
  const size = variant.pizzaSize ? lk.sizes.get(variant.pizzaSize) : undefined;
  if (!size) throw new LineProblem("That pizza size isn't available.");
  return size;
}

function checkFlavours(slugs: string[] | undefined, max: number, lk: Lookup): string[] {
  if (!slugs || slugs.length === 0) throw new LineProblem("Choose a wing flavour.");
  if (slugs.length > max) throw new LineProblem(`Choose up to ${max} wing flavour${max > 1 ? "s" : ""}.`);
  return slugs.map((s) => {
    const f = lk.flavours.get(s);
    if (!f) throw new LineProblem("That wing flavour isn't on our menu any more.");
    if (!f.available) throw new LineProblem(`${f.name} sauce is sold out right now.`);
    return f.name;
  });
}

function priceLine(input: CartLineInput, index: number, lk: Lookup, ctx: QuoteContext): PricedLine {
  const item = lk.items.get(input.itemSlug);
  if (!item) throw new LineProblem("This item is no longer on the menu.");
  if (!item.available) throw new LineProblem(`${item.name} is sold out right now.`);
  const variant = item.variants.find((v) => v.code === input.variantCode);
  if (!variant || !variant.available) throw new LineProblem(`That option for ${item.name} isn't available.`);
  if (item.availableDays.length > 0 && !item.availableDays.includes(ctx.weekday)) {
    throw new LineProblem(`${item.name} is only available on ${describeDays(item.availableDays)}.`);
  }
  if (item.pickupOnly && ctx.fulfilment === "delivery") {
    throw new LineProblem(`${item.name} is for pickup only.`);
  }

  const details: string[] = [];
  let extras = 0;

  if (item.kind === "pizza") {
    if (input.wingFlavours || input.dealPizzas) throw new LineProblem("Invalid choices for a pizza.");
    const size = sizeOf(variant, lk);
    const choice = input.pizza ?? { toppings: [], removed: [] };
    const removed = [...new Set(choice.removed)].map((i) => {
      const name = item.standardToppings[i];
      if (name === undefined) throw new LineProblem("Invalid topping removal.");
      return name;
    });
    const added = resolveToppings(choice.toppings, lk);
    const used = units(added);
    const included = item.includedToppingUnits;
    const limitText =
      included > 0
        ? `${item.name} includes ${included} topping${included > 1 ? "s" : ""} and extra toppings aren't available online.`
        : "Extra toppings aren't available online.";
    extras = extraCharge(used - included, size, limitText);
    if (removed.length) details.push(`No ${removed.join(", no ")}`);
    if (added.length) details.push(`${included > 0 ? "Toppings" : "Add"}: ${names(added)}`);
    if (extras > 0) details.push(`Extra toppings (${used - included}): +${formatCents(extras)}`);
  } else if (item.kind === "wings") {
    if (input.pizza || input.dealPizzas) throw new LineProblem("Invalid choices for wings.");
    const flavours = checkFlavours(input.wingFlavours, variant.maxFlavours ?? 1, lk);
    details.push(`Flavour: ${flavours.join(", ")}`);
  } else if (item.kind === "deal") {
    if (input.pizza) throw new LineProblem("Invalid choices for a deal.");
    const deal = item.deal;
    if (!deal) throw new LineProblem("This deal is misconfigured.");
    if (deal.pizzas) {
      const size = sizeOf(variant, lk);
      const pizzas = input.dealPizzas ?? [];
      if (pizzas.length !== deal.pizzas.count) {
        throw new LineProblem(`Choose toppings for all ${deal.pizzas.count} pizzas.`);
      }
      const perPizza = pizzas.map((p) => resolveToppings(p.toppings, lk));
      let extraUnits = 0;
      if (deal.pizzas.toppingsPerPizza !== undefined) {
        for (const ts of perPizza) extraUnits += Math.max(0, units(ts) - deal.pizzas.toppingsPerPizza);
      }
      if (deal.pizzas.toppingsCombined !== undefined) {
        const total = perPizza.reduce((n, ts) => n + units(ts), 0);
        extraUnits = Math.max(extraUnits, total - deal.pizzas.toppingsCombined);
      }
      const limitText =
        deal.pizzas.toppingsPerPizza !== undefined
          ? `This deal includes up to ${deal.pizzas.toppingsPerPizza} toppings per pizza.`
          : `This deal includes up to ${deal.pizzas.toppingsCombined} toppings combined.`;
      extras = extraCharge(extraUnits, size, limitText);
      perPizza.forEach((ts, i) => details.push(`Pizza ${i + 1} (${size.label}): ${ts.length ? names(ts) : "Cheese only"}`));
      if (extras > 0) details.push(`Extra toppings (${extraUnits}): +${formatCents(extras)}`);
    } else if (input.dealPizzas?.length) {
      throw new LineProblem("This deal has no pizzas to choose.");
    }
    if (deal.wings) {
      const flavours = checkFlavours(input.wingFlavours, deal.wings.maxFlavours, lk);
      details.push(`${deal.wings.count} wings: ${flavours.join(", ")}`);
    } else if (input.wingFlavours?.length) {
      throw new LineProblem("This deal has no wings to choose.");
    }
    details.push(...deal.includes);
  } else if (input.pizza || input.wingFlavours || input.dealPizzas) {
    throw new LineProblem(`${item.name} has no options to choose.`);
  }

  const unitPriceCents = variant.priceCents + extras;
  return {
    index,
    item,
    variant,
    quantity: input.quantity,
    unitPriceCents,
    lineTotalCents: unitPriceCents * input.quantity,
    taxMode: item.taxMode,
    details,
    notes: input.notes || undefined,
  };
}

export function quoteCart(menu: MenuSnapshot, inputs: CartLineInput[], ctx: QuoteContext): Quote {
  const lk = buildLookup(menu);
  const p = menu.pricing;
  const errors: LineError[] = [];
  const lines: PricedLine[] = [];

  inputs.forEach((input, i) => {
    try {
      lines.push(priceLine(input, i, lk, ctx));
    } catch (err) {
      if (!(err instanceof LineProblem)) throw err;
      errors.push({ line: i, message: err.message });
    }
  });

  const subtotalCents = lines.reduce((n, l) => n + l.lineTotalCents, 0);
  const cashOnly = lines.some((l) => l.item.cashOnly);
  const pickupOnly = lines.some((l) => l.item.pickupOnly);

  let deliveryFeeCents = 0;
  if (ctx.fulfilment === "delivery") {
    if (!p.deliveryEnabled) errors.push({ line: null, message: "Delivery isn't available right now. Please choose pickup." });
    deliveryFeeCents = p.deliveryFeeCents;
    if (p.deliveryMinCents !== null && subtotalCents < p.deliveryMinCents) {
      errors.push({ line: null, message: `Delivery orders need at least ${formatCents(p.deliveryMinCents)} of food.` });
    }
  }
  if (cashOnly && ctx.paymentMethod && ctx.paymentMethod !== "cash") {
    errors.push({ line: null, message: "Your cart has a cash-only deal, so please choose cash." });
  }

  // Tax: "standard" lines get HST on top. Ontario charges only the federal 5% when the whole
  // food-and-drink purchase is $4.00 or less. Delivery fees are always taxed at the full rate.
  const taxableFood = lines.filter((l) => l.taxMode === "standard").reduce((n, l) => n + l.lineTotalCents, 0);
  const foodRate = subtotalCents <= p.smallOrderMaxCents ? p.smallOrderTaxRateBps : p.taxRateBps;
  const taxCents = applyRate(taxableFood, foodRate) + applyRate(deliveryFeeCents, p.taxRateBps);
  const totalCents = subtotalCents + deliveryFeeCents + taxCents;

  if (totalCents > p.maxOrderCents) {
    errors.push({
      line: null,
      message: `Orders over ${formatCents(p.maxOrderCents)} need to be placed by phone so we can plan them properly.`,
    });
  }

  return { lines, subtotalCents, deliveryFeeCents, taxCents, totalCents, cashOnly, pickupOnly, errors };
}
