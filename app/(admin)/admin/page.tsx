import { createClient } from "@/lib/supabase/server";
import { BUSINESS_SLUG, computeExpiry } from "@/lib/types";

export const revalidate = 0;

export default async function AdminOverviewPage() {
  const supabase = createClient();
  const { data: business } = await supabase.from("businesses").select("id").eq("slug", BUSINESS_SLUG).single();
  if (!business) return null;

  const [{ count: invCount }, { data: certs }, { count: pendingCount }] = await Promise.all([
    supabase.from("inventory").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    supabase.from("certificates").select("issue_date,period_months,voided").eq("business_id", business.id),
    supabase.from("trade_ins").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "pending")
  ]);

  const activeCerts = (certs || []).filter((c) => !c.voided && new Date() <= computeExpiry(c.issue_date, c.period_months)).length;

  const stats = [
    { label: "Items in inventory", value: invCount || 0 },
    { label: "Certificates issued", value: (certs || []).length },
    { label: "Trade-in requests awaiting review", value: pendingCount || 0 },
    { label: "Certificates currently active", value: activeCerts }
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
