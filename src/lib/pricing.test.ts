import { describe, expect, it } from "vitest";
import type { CartLineInput } from "./cart-schema";
import { quoteCart, type QuoteContext } from "./pricing";
import { seedSnapshot } from "./seed-snapshot";

const TUESDAY: QuoteContext = { fulfilment: "pickup", weekday: 2 };
const FRIDAY: QuoteContext = { fulfilment: "pickup", weekday: 5 };
const menu = seedSnapshot();

const line = (l: Partial<CartLineInput> & Pick<CartLineInput, "itemSlug" | "variantCode">): CartLineInput => ({
  quantity: 1,
  ...l,
});

describe("pizzas", () => {
  it("prices a create-your-own large with 3 toppings at the menu price plus 13% HST", () => {
    const q = quoteCart(
      menu,
      [line({ itemSlug: "create-your-own", variantCode: "large", pizza: { toppings: ["mushrooms", "onions", "tomatoes"], removed: [] } })],
      FRIDAY,
    );
    expect(q.errors).toEqual([]);
    expect(q.subtotalCents).toBe(1457);
    expect(q.taxCents).toBe(189); // 1457 * 13% = 189.41
    expect(q.totalCents).toBe(1646);
    expect(q.lines[0].details).toEqual(["Toppings: Fresh Mushrooms, Onions, Tomatoes"]);
  });

  it("counts premium toppings as 2 and blocks extras while no extra-topping price is set", () => {
    const q = quoteCart(
      menu,
      [line({ itemSlug: "create-your-own", variantCode: "medium", pizza: { toppings: ["bbq-chicken", "ground-beef"], removed: [] } })],
      FRIDAY,
    );
    expect(q.lines).toHaveLength(0);
    expect(q.errors[0].message).toMatch(/includes 3 toppings.*remove 1 topping/);
  });

  it("charges extra toppings per unit once the owner sets a price for that size", () => {
    const priced = seedSnapshot();
    priced.sizes.find((s) => s.code === "medium")!.extraToppingCents = 150;
    const q = quoteCart(
      priced,
      [line({ itemSlug: "create-your-own", variantCode: "medium", pizza: { toppings: ["bbq-chicken", "ground-beef"], removed: [] } })],
      FRIDAY,
    );
    expect(q.errors).toEqual([]);
    expect(q.lines[0].unitPriceCents).toBe(1187 + 150);
  });

  it("lets customers leave standard toppings off a specialty for free", () => {
    const q = quoteCart(menu, [line({ itemSlug: "deluxe", variantCode: "party", pizza: { toppings: [], removed: [2] } })], FRIDAY);
    expect(q.errors).toEqual([]);
    expect(q.lines[0].unitPriceCents).toBe(2267);
    expect(q.lines[0].details).toEqual(["No Mushrooms"]);
  });

  it("rejects an unknown topping, a sold-out topping and a bad removal index", () => {
    const soldOut = seedSnapshot();
    soldOut.toppings.find((t) => t.slug === "pineapple")!.available = false;
    const q = quoteCart(
      soldOut,
      [
        line({ itemSlug: "create-your-own", variantCode: "small", pizza: { toppings: ["caviar"], removed: [] } }),
        line({ itemSlug: "create-your-own", variantCode: "small", pizza: { toppings: ["pineapple"], removed: [] } }),
        line({ itemSlug: "hawaiian", variantCode: "small", pizza: { toppings: [], removed: [9] } }),
      ],
      FRIDAY,
    );
    expect(q.errors.map((e) => e.line)).toEqual([0, 1, 2]);
    expect(q.errors[1].message).toMatch(/Pineapple is sold out/);
  });
});

describe("wings", () => {
  it("requires a flavour and caps flavours by pack size", () => {
    const q = quoteCart(
      menu,
      [
        line({ itemSlug: "chicken-wings", variantCode: "10" }),
        line({ itemSlug: "chicken-wings", variantCode: "10", wingFlavours: ["hot", "mild"] }),
        line({ itemSlug: "chicken-wings", variantCode: "20", wingFlavours: ["hot", "mild"] }),
      ],
      FRIDAY,
    );
    expect(q.errors.map((e) => e.line)).toEqual([0, 1]);
    expect(q.lines[0].unitPriceCents).toBe(1943);
    expect(q.lines[0].details).toEqual(["Flavour: Hot, Mild"]);
  });
});

describe("deals", () => {
  const weekday = (toppings: string[][]): CartLineInput =>
    line({ itemSlug: "weekday-special", variantCode: "large", dealPizzas: toppings.map((t) => ({ toppings: t })) });

  it("sells the Mon–Wed special tax-included on a Tuesday", () => {
    const q = quoteCart(menu, [weekday([["mushrooms"], ["onions", "hot-peppers", "tomatoes"]])], TUESDAY);
    expect(q.errors).toEqual([]);
    expect(q.taxCents).toBe(0);
    expect(q.totalCents).toBe(2650);
  });

  it("refuses the Mon–Wed special on a Friday", () => {
    const q = quoteCart(menu, [weekday([[], []])], FRIDAY);
    expect(q.errors[0].message).toBe("Mon–Wed Special: 2 Large Pizzas is only available on Monday, Tuesday & Wednesday.");
  });

  it("needs a topping choice for every pizza in the deal", () => {
    const q = quoteCart(menu, [weekday([["mushrooms"]])], TUESDAY);
    expect(q.errors[0].message).toMatch(/all 2 pizzas/);
  });

  it("enforces a combined topping pool across the deal's pizzas", () => {
    const five = ["mushrooms", "onions", "tomatoes", "pineapple", "green-olives"];
    const ok = quoteCart(
      menu,
      [line({ itemSlug: "deal-10", variantCode: "large", dealPizzas: [{ toppings: five }, { toppings: ["hot-peppers", "black-olives", "beef-bacon"] }] })],
      FRIDAY,
    );
    expect(ok.errors).toEqual([]);
    const over = quoteCart(
      menu,
      [line({ itemSlug: "deal-10", variantCode: "large", dealPizzas: [{ toppings: five }, { toppings: ["bbq-chicken", "black-olives", "beef-bacon"] }] })],
      FRIDAY,
    );
    expect(over.errors[0].message).toMatch(/up to 8 toppings combined/);
  });

  it("marks #01 as cash-only, pickup-only and tax-exempt", () => {
    const deal01 = line({
      itemSlug: "deal-01-wings",
      variantCode: "large",
      dealPizzas: [{ toppings: [] }, { toppings: ["mushrooms"] }, { toppings: ["onions"] }],
      wingFlavours: ["bbq", "hot"],
    });
    const pickup = quoteCart(menu, [deal01], { ...FRIDAY, paymentMethod: "cash" });
    expect(pickup.errors).toEqual([]);
    expect(pickup).toMatchObject({ cashOnly: true, pickupOnly: true, taxCents: 0, totalCents: 5615 });
    expect(pickup.lines[0].details).toContain("20 wings: BBQ, Hot");

    const card = quoteCart(menu, [deal01], { ...FRIDAY, paymentMethod: "card_in_person" });
    expect(card.errors.map((e) => e.message)).toContain("Your cart has a cash-only deal, so please choose cash.");

    const delivery = quoteCart(menu, [deal01], { fulfilment: "delivery", weekday: 5 });
    expect(delivery.errors[0].message).toMatch(/pickup only/);
  });

  it("rejects choices that don't belong to the item", () => {
    const q = quoteCart(
      menu,
      [
        line({ itemSlug: "deal-02", variantCode: "regular", wingFlavours: ["bbq"], dealPizzas: [{ toppings: [] }] }),
        line({ itemSlug: "garlic-bread", variantCode: "regular", wingFlavours: ["bbq"] }),
        line({ itemSlug: "chicken-wings", variantCode: "10", wingFlavours: ["bbq"], pizza: { toppings: [], removed: [] } }),
      ],
      FRIDAY,
    );
    expect(q.errors.map((e) => e.line)).toEqual([0, 1, 2]);
  });
});

describe("totals", () => {
  it("adds the delivery fee, taxes it, and multiplies quantities", () => {
    const q = quoteCart(
      menu,
      [line({ itemSlug: "garlic-bread", variantCode: "regular", quantity: 3 })],
      { fulfilment: "delivery", weekday: 5 },
    );
    expect(q.subtotalCents).toBe(1293);
    expect(q.deliveryFeeCents).toBe(499);
    expect(q.taxCents).toBe(168 + 65); // 1293 * 13% = 168.09, 499 * 13% = 64.87
    expect(q.totalCents).toBe(1293 + 499 + 233);
  });

  it("charges only 5% on a food purchase of $4.00 or less (Ontario rebate)", () => {
    const q = quoteCart(menu, [line({ itemSlug: "canned-pop", variantCode: "regular", quantity: 2 })], FRIDAY);
    expect(q.subtotalCents).toBe(324);
    expect(q.taxCents).toBe(16); // 324 * 5% = 16.2
  });

  it("mixes taxed and tax-included lines correctly", () => {
    const q = quoteCart(
      menu,
      [
        line({ itemSlug: "weekday-special", variantCode: "large", dealPizzas: [{ toppings: [] }, { toppings: [] }] }),
        line({ itemSlug: "beef-burger", variantCode: "regular" }),
      ],
      TUESDAY,
    );
    expect(q.taxCents).toBe(84); // only the burger: 647 * 13% = 84.11
    expect(q.totalCents).toBe(2650 + 647 + 84);
  });

  it("enforces the delivery minimum and the online order cap", () => {
    const withMin = seedSnapshot({ deliveryMinCents: 2000, maxOrderCents: 10_000 });
    const small = quoteCart(withMin, [line({ itemSlug: "garlic-bread", variantCode: "regular" })], { fulfilment: "delivery", weekday: 5 });
    expect(small.errors[0].message).toBe("Delivery orders need at least $20.00 of food.");
    const huge = quoteCart(withMin, [line({ itemSlug: "chicken-wings", variantCode: "90", wingFlavours: ["bbq"], quantity: 2 })], FRIDAY);
    expect(huge.errors[0].message).toMatch(/by phone/);
  });

  it("reports removed items and unknown variants instead of throwing", () => {
    const q = quoteCart(
      menu,
      [line({ itemSlug: "lobster-pizza", variantCode: "large" }), line({ itemSlug: "poutine", variantCode: "jumbo" })],
      FRIDAY,
    );
    expect(q.lines).toEqual([]);
    expect(q.errors).toHaveLength(2);
  });
});
