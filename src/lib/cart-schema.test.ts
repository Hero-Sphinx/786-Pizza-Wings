import { describe, expect, it } from "vitest";
import { orderLookupSchema } from "./cart-schema";

describe("order lookup input", () => {
  it("accepts the ways people type order and phone numbers", () => {
    expect(orderLookupSchema.parse({ orderNumber: "#1037", phone: "(905) 555-0142" })).toEqual({ orderNumber: 1037, phone: "9055550142" });
    expect(orderLookupSchema.parse({ orderNumber: 1037, phone: "+1 905 555 0142" })).toEqual({ orderNumber: 1037, phone: "9055550142" });
  });

  it("rejects junk", () => {
    expect(orderLookupSchema.safeParse({ orderNumber: "abc", phone: "9055550142" }).success).toBe(false);
    expect(orderLookupSchema.safeParse({ orderNumber: "1037", phone: "123" }).success).toBe(false);
    expect(orderLookupSchema.safeParse({ orderNumber: "1037", phone: "9055550142", token: "x" }).success).toBe(false);
  });
});
