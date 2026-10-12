"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG, type Profile } from "@/lib/types";

export default function AdminTeamPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  async function reload(biz: string) {
    const { data } = await supabase.from("profiles").select("*").eq("business_id", biz).order("created_at");
    setProfiles((data || []) as Profile[]);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id || null);
      const { data: business } = await supabase.from("businesses").select("id").eq("slug", BUSINESS_SLUG).single();
      if (business) { setBusinessId(business.id); reload(business.id); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id: string) {
    if (!businessId) return;
    await supabase.from("profiles").update({ role: "admin", approved: true }).eq("id", id);
    reload(businessId);
  }

  async function remove(id: string) {
    if (!businessId || !confirm("Remove this admin's access?")) return;
    await supabase.from("profiles").delete().eq("id", id);
    reload(businessId);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h1 className="text-lg font-bold mb-1">Team</h1>
      <p className="text-sm text-slate-500 mb-4">Approve new admin registrations, or remove access.</p>
      {profiles.length === 0 ? (
        <p className="text-sm text-slate-400">No team members yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2">{p.email}</td>
                <td className="capitalize">{p.role}</td>
                <td>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.approved ? "APPROVED" : "PENDING"}
                  </span>
                </td>
                <td className="text-right space-x-2">
                  {p.id === meId ? (
                    <span className="text-xs text-slate-400">You</span>
                  ) : p.role === "owner" ? null : (
                    <>
                      {!p.approved && <button onClick={() => approve(p.id)} className="text-accent text-xs font-semibold">Approve</button>}
                      <button onClick={() => remove(p.id)} className="text-red-500 text-xs font-semibold">Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
