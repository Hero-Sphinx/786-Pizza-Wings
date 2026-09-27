import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition } from "./order-status";

describe("order status transitions", () => {
  it("moves pickup orders new -> accepted -> ready -> completed", () => {
    expect(canTransition("new", "accepted", "pickup")).toBe(true);
    expect(canTransition("accepted", "ready", "pickup")).toBe(true);
    expect(canTransition("ready", "completed", "pickup")).toBe(true);
  });

  it("only offers 'out for delivery' on delivery orders", () => {
    expect(allowedTransitions("accepted", "pickup")).toEqual(["ready", "cancelled"]);
    expect(allowedTransitions("accepted", "delivery")).toEqual(["ready", "out_for_delivery", "cancelled"]);
  });

  it("never reopens finished orders or skips acceptance", () => {
    expect(allowedTransitions("completed", "pickup")).toEqual([]);
    expect(allowedTransitions("cancelled", "delivery")).toEqual([]);
    expect(canTransition("new", "completed", "pickup")).toBe(false);
  });
});
