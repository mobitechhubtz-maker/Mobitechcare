import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Trade-In Requests", href: "/admin/trade-ins" },
  { label: "Certificates", href: "/admin/certificates" },
  { label: "Team", href: "/admin/team" },
  { label: "Settings", href: "/admin/settings" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") || "";

  // The login page gets no sidebar — middleware already keeps unauthenticated
  // visitors here, so this is the only admin route a non-admin ever reaches.
  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">{children}</div>;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!profile || !profile.approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm text-center">
          <div className="text-3xl mb-3">⏳</div>
          <h1 className="text-lg font-bold mb-2">Awaiting approval</h1>
          <p className="text-sm text-slate-500 mb-4">
            Your account is registered but hasn&apos;t been approved by an admin yet. Ask an existing admin to approve you from their Team tab, then check back.
          </p>
          <form action="/admin/logout" method="post">
            <button className="text-sm px-4 py-2 rounded-lg border border-slate-300">Sign out</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-60 bg-graphite text-white flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-white/10 font-bold text-sm tracking-tight">
          MOBITECH HUB TANZANIA
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-white/50 space-y-2">
          <div className="truncate">{profile.email}</div>
          <form action="/admin/logout" method="post">
            <button className="text-white/70 hover:text-white underline underline-offset-2">Log out</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Admin portal</h2>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-800">← Back to shop</Link>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
