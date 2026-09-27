import type { Metadata } from "next";
import { formatPhone, telHref } from "@/lib/format";
import { loadStore } from "@/server/menu";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const store = await loadStore();
  return (
    <div className="container-page max-w-3xl space-y-4 py-10 text-lg">
      <h1 className="h-display text-4xl">Privacy</h1>
      <p>When you order online we collect your name and phone number, your email if you give it, and your address for delivery orders. We use them only to prepare, deliver and ask about your order, and to send your receipt.</p>
      <p>We don&apos;t sell or share your details with anyone else. Payment happens in person, so we never see or store card numbers online.</p>
      <p>Your cart is saved in your own browser until you place the order. We don&apos;t use advertising or tracking cookies.</p>
      <p>
        To see, correct or delete the details we hold about you, call us at{" "}
        <a className="font-semibold text-brand-700 underline" href={telHref(store.phone)}>
          {formatPhone(store.phone)}
        </a>{" "}
        or visit us at {store.addressLine}, {store.city}.
      </p>
    </div>
  );
}
