import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MobiTech Hub: Shop & Admin System",
  description: "Phones, laptops, and accessories, with real warranty backing and a fair trade-up path."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
