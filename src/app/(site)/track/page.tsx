import type { Metadata } from "next";
import { TrackOrder } from "@/components/order/TrackOrder";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your 786 Pizza & Wings order with your order number and phone number.",
  robots: { index: false },
};

export default function TrackPage() {
  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="h-display text-4xl">Track your order</h1>
      <p className="mt-2 text-ink-soft">Enter the order number from your confirmation and the phone number you ordered with.</p>
      <TrackOrder />
    </div>
  );
}
