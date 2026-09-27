import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Staff", template: "%s | 786 Staff" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col bg-[#f4f1ec]">{children}</div>;
}
