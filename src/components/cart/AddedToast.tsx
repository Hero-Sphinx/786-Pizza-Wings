"use client";

import { CheckIcon } from "../icons";
import { useCart } from "./CartProvider";

export function AddedToast() {
  const { lastAdded, setCartOpen } = useCart();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      {lastAdded && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-lg"
        >
          <CheckIcon className="text-gold-400" /> Added {lastAdded} · View order
        </button>
      )}
    </div>
  );
}
