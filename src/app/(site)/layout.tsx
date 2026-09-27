import { cookies } from "next/headers";
import { AddedToast } from "@/components/cart/AddedToast";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { MobileBar } from "@/components/site/MobileBar";
import { PizzaIntro } from "@/components/site/PizzaIntro";
import { INTRO_SEEN_COOKIE } from "@/lib/routes";
import { loadMenu, loadStore } from "@/server/menu";

// Rendered per request (the CSP nonce needs it); the data itself comes from a short cache.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [menu, store, jar] = await Promise.all([loadMenu(), loadStore(), cookies()]);
  // The opening animation plays once per browser session (PizzaIntro sets the cookie).
  const introSeen = jar.has(INTRO_SEEN_COOKIE);
  return (
    <CartProvider menu={menu} store={store}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header store={store} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer store={store} />
      <MobileBar phone={store.phone} />
      <CartDrawer />
      <AddedToast />
      {!introSeen && <PizzaIntro />}
    </CartProvider>
  );
}
