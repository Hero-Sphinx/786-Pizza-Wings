import type { Metadata } from "next";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { formatPhone, telHref } from "@/lib/format";
import { loadStore } from "@/server/menu";

export const metadata: Metadata = {
  title: "Menu",
  description: "Specialty pizzas, fresh wings, combo deals, burgers and sides. Halal, HMA-certified meat. Order online for pickup or delivery in Brampton.",
};

export default async function MenuPage() {
  const store = await loadStore();
  return (
    <>
      <div className="bg-ink text-white">
        <div className="container-page py-8">
          <h1 className="h-display text-4xl sm:text-5xl">Our menu</h1>
          <p className="mt-1 text-white/80">Prices before tax unless noted. Tap an item to build it your way.</p>
          {!store.orderingEnabled && (
            <p className="mt-4 rounded-xl bg-gold-400 px-4 py-3 font-semibold text-ink" role="status">
              {store.orderingPausedMessage || "Online ordering is paused right now."} Please call{" "}
              <a className="underline" href={telHref(store.phone)}>
                {formatPhone(store.phone)}
              </a>
              .
            </p>
          )}
        </div>
      </div>
      <MenuBrowser />
    </>
  );
}
