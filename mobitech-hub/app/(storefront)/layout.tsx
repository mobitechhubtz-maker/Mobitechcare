import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_SLUG } from "@/lib/types";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("logo_url,name")
    .eq("slug", BUSINESS_SLUG)
    .single();

  const initials = (business?.name || "MH")
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-graphite text-white">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {business?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logo_url} alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <span className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-bold text-sm">
                {initials}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-white/70">Home</Link>
            <Link href="/catalog" className="hover:text-white/70">Inventory</Link>
            <Link href="/trade-in" className="hover:text-white/70">Trade-Up</Link>
            <Link href="/warranty" className="hover:text-white/70">Warranty</Link>
          </nav>
          <Link href="/admin/login" className="text-xs text-white/55 underline underline-offset-2 hover:text-white/80">
            Staff sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8">{children}</main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        Warranty terms, contact details, and full identity are available on request in-store.
      </footer>
    </div>
  );
}
