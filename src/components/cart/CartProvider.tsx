"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartLineInput } from "@/lib/cart-schema";
import { parseStoredCart } from "@/lib/cart-storage";
import { localParts } from "@/lib/hours";
import type { MenuSnapshot } from "@/lib/menu-types";
import { quoteCart, type Quote } from "@/lib/pricing";
import type { StoreInfo } from "@/lib/store-types";

export type CartLine = CartLineInput & { id: string };

type CartContextValue = {
  menu: MenuSnapshot;
  store: StoreInfo;
  lines: CartLine[];
  /** False until the saved cart has been read from this browser. */
  ready: boolean;
  count: number;
  /** Pickup preview of the cart, priced with today's weekday. Checkout re-prices on the server. */
  quote: Quote;
  add: (line: CartLineInput) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  /** Set when an item was just added, for a short confirmation. */
  lastAdded: string | null;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "786-cart-v1";
const MAX_LINES = 30;

function readStored(): CartLine[] {
  try {
    return parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage blocked (some private modes throw on access).
    return [];
  }
}

function writeStored(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode or storage full: the cart still works for this visit.
  }
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));

export function CartProvider({ menu, store, children }: { menu: MenuSnapshot; store: StoreInfo; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => {
    // localStorage only exists in the browser, so the saved cart is restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(readStored());
    setLoaded(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (loaded) writeStored(lines);
  }, [lines, loaded]);

  useEffect(() => {
    if (!lastAdded) return;
    const t = setTimeout(() => setLastAdded(null), 2500);
    return () => clearTimeout(t);
  }, [lastAdded]);

  const add = useCallback(
    (line: CartLineInput) => {
      setLines((prev) => (prev.length >= MAX_LINES ? prev : [...prev, { ...line, id: newId() }]));
      const item = menu.categories.flatMap((c) => c.items).find((i) => i.slug === line.itemSlug);
      setLastAdded(item?.name ?? "Item");
    },
    [menu],
  );
  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: Math.min(20, Math.max(1, quantity)) } : l)));
  }, []);
  const remove = useCallback((id: string) => setLines((prev) => prev.filter((l) => l.id !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const quote = useMemo(() => {
    const weekday = localParts(new Date(), store.hours.timezone).weekday;
    return quoteCart(menu, lines, { fulfilment: "pickup", weekday });
  }, [menu, lines, store.hours.timezone]);

  const value = useMemo<CartContextValue>(
    () => ({
      menu,
      store,
      lines,
      ready: loaded,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      quote,
      add,
      setQuantity,
      remove,
      clear,
      cartOpen,
      setCartOpen,
      lastAdded,
    }),
    [menu, store, lines, loaded, quote, add, setQuantity, remove, clear, cartOpen, lastAdded],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
