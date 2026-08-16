"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG, formatTZS, type TradeIn } from "@/lib/types";

export default function AdminTradeInsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { grade: string; topUp: string }>>({});

  async function reload(biz: string) {
    const { data } = await supabase.from("trade_ins").select("*").eq("business_id", biz).order("created_at", { ascending: false });
    const rows = (data || []) as TradeIn[];
    setTradeIns(rows);
    setDrafts((prev) => {
      const next = { ...prev };
      rows.forEach((t) => {
        if (!next[t.id]) {
          next[t.id] = {
            grade: t.final_grade || t.self_grade || "B",
            topUp: String(t.final_top_up ?? t.estimated_top_up)
          };
        }
      });
      return next;
    });
  }

  useEffect(() => {
    supabase.from("businesses").select("id").eq("slug", BUSINESS_SLUG).single().then(({ data }) => {
      if (data) { setBusinessId(data.id); reload(data.id); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmReview(id: string) {
    if (!businessId) return;
    const draft = drafts[id];
    await supabase.from("trade_ins").update({
      final_grade: draft.grade, final_top_up: Number(draft.topUp), status: "reviewed"
    }).eq("id", id);
    reload(businessId);
  }

  async function remove(id: string) {
    if (!businessId || !confirm("Delete this trade-up request?")) return;
    await supabase.from("trade_ins").delete().eq("id", id);
    reload(businessId);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h1 className="text-lg font-bold mb-1">Trade-in requests</h1>
      <p className="text-sm text-slate-500 mb-4">Review disclosure, photos, and the AI-suggested grade, then confirm the final grade and value.</p>

      {tradeIns.length === 0 ? (
        <p className="text-sm text-slate-400">No trade-up requests yet.</p>
      ) : (
        <div className="space-y-4">
          {tradeIns.map((t) => {
            const draft = drafts[t.id] || { grade: t.self_grade, topUp: String(t.estimated_top_up) };
            return (
              <div key={t.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <div className="font-semibold text-sm">{t.contact_name} · {t.contact_phone}</div>
                    <div className="text-xs text-slate-500">{t.model} → {t.target_name}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full h-fit ${t.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-accent/10 text-accent"}`}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm mb-2"><strong>Disclosure:</strong> {t.disclosure}</div>
                {Object.keys(t.photos || {}).length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3 max-w-md">
                    {Object.entries(t.photos).map(([slot, url]) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={slot} src={url} alt={slot} title={slot} className="aspect-square object-cover rounded border border-slate-200" />
                    ))}
                  </div>
                )}
                <div className="text-xs text-slate-500 mb-3">
                  Customer self-grade: <strong>{t.self_grade}</strong>.{" "}
                  {t.ai_suggestion
                    ? <>AI suggested grade <strong>{t.ai_suggestion.overallGrade}</strong>: {t.ai_suggestion.reasoning}</>
                    : "No AI suggestion (manual grade only)."}
                </div>
                <div className="text-sm mb-3">Estimated top-up: <strong>{formatTZS(t.estimated_top_up)}</strong></div>

                <div className="grid grid-cols-2 gap-3 max-w-xs mb-3">
                  <select
                    value={draft.grade}
                    onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...draft, grade: e.target.value } }))}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                  </select>
                  <input
                    type="number"
                    value={draft.topUp}
                    onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...draft, topUp: e.target.value } }))}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="space-x-3">
                  <button onClick={() => confirmReview(t.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white">Confirm &amp; mark reviewed</button>
                  <button onClick={() => remove(t.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
