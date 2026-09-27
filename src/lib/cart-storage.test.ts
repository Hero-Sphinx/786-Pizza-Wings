import { describe, expect, it } from "vitest";
import { parseStoredCart } from "./cart-storage";

const burger = { itemSlug: "beef-burger", variantCode: "regular", quantity: 2, id: "line-1" };
const wings = { itemSlug: "chicken-wings", variantCode: "w20", quantity: 1, wingFlavours: ["honey-garlic"], id: "line-2" };

describe("saved cart", () => {
  it("restores what the cart saved, ids included", () => {
    // Exactly what CartProvider writes: the lines with their ids, as JSON.
    expect(parseStoredCart(JSON.stringify([burger, wings]))).toEqual([burger, wings]);
  });

  it("drops lines that no longer fit, and keeps the rest", () => {
    const stale = { itemSlug: "beef-burger", variantCode: "regular", quantity: 1, size: "large", id: "line-3" };
    const noId = { itemSlug: "beef-burger", variantCode: "regular", quantity: 1 };
    expect(parseStoredCart(JSON.stringify([stale, burger, noId, null, "x"]))).toEqual([burger]);
  });

  it("treats missing or broken storage as an empty cart", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("")).toEqual([]);
    expect(parseStoredCart("{not json")).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ lines: [burger] }))).toEqual([]);
  });
});
