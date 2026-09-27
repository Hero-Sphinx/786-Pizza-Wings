import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "786 Pizza & Wings | Halal pizza & wings in Brampton",
    template: "%s | 786 Pizza & Wings",
  },
  description:
    "Hand-tossed, stone-baked halal pizza and fresh wings at Queen & McLaughlin in Brampton. HMA-certified meat. Order online for pickup or delivery.",
  openGraph: {
    type: "website",
    siteName: "786 Pizza & Wings",
    images: [{ url: "/images/promos/pizzas.webp", width: 900, height: 596 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#148043",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${inter.variable} ${baloo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
