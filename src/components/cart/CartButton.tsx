"use client";

import { BagIcon } from "../icons";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { count, setCartOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      className="btn btn-primary relative px-4"
      aria-label={`Your order, ${count} item${count === 1 ? "" : "s"}`}
    >
      <BagIcon />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full bg-tomato-600 px-1.5 text-xs font-bold leading-6 text-white">
          {count}
        </span>
      )}
    </button>
  );
}
