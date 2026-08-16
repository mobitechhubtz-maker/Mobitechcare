"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatTZS, type Business, type InventoryItem, type TradeInValue } from "@/lib/types";

const GRADE_LETTERS = ["A", "B", "C", "D"] as const;
const PHOTO_SLOTS: { key: string; label: string }[] = [
  { key: "display", label: "Front / display" },
  { key: "body", label: "Back / body" },
  { key: "battery", label: "Battery health screen" },
  { key: "camera", label: "Camera lens" }
];

function resizeImageFile(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadDataUrl(bucket: string, path: string, dataUrl: string) {
  const supabase = createClient();
  const mediaType = dataUrl.split(";")[0].split(":")[1];
  const b64 = dataUrl.split(",")[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: mediaType,
    upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default function TradeInForm({
  business,
  inventory,
  tradeInValues
}: {
  business: Business;
  inventory: InventoryItem[];
  tradeInValues: TradeInValue[];
}) {
  const [targetId, setTargetId] = useState(inventory[0]?.id || "");
  const [model, setModel] = useState("");
  const [disclosure, setDisclosure] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [grade, setGrade] = useState<(typeof GRADE_LETTERS)[number]>("B");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [aiResult, setAiResult] = useState<{ overallGrade: string; reasoning: string; perPhoto?: { label: string; observation: string }[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const target = inventory.find((i) => i.id === targetId) || null;
  const matchedValue = useMemo(
    () => tradeInValues.find((v) => v.model.toLowerCase().trim() === model.toLowerCase().trim()),
    [tradeInValues, model]
  );

  const quote = useMemo(() => {
    const base = matchedValue?.base_value || 0;
    const multiplier = business.grades[grade].multiplier;
    const credit = Math.round(base * multiplier);
    const topUp = target ? Math.max(0, target.price - credit) : 0;
    return { base, credit, topUp };
  }, [matchedValue, grade, target, business.grades]);

  async function handlePhotoChange(slot: string, file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 700, 0.7);
      setPhotos((p) => ({ ...p, [slot]: dataUrl }));
    } catch {
      setStatus("Could not read that photo.");
    }
  }

  async function handleAiGrade() {
    if (Object.keys(photos).length === 0) {
      setStatus("Add at least one photo first.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/grade-device`,
        {
          method: "POST",
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ photos, grades: business.grades })
        }
      );
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);
      setAiResult(parsed);
      const g = (parsed.overallGrade || "").toUpperCase();
      if ((GRADE_LETTERS as readonly string[]).includes(g)) setGrade(g as typeof grade);
    } catch (e) {
      setStatus(`AI grading unavailable: ${(e as Error).message}. Pick a grade manually instead.`);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    const missing: string[] = [];
    if (!contactName) missing.push("your name");
    if (!contactPhone) missing.push("your phone");
    if (!disclosure) missing.push("condition disclosure");
    if (!model) missing.push("your phone's model");
    if (!target) missing.push("a target phone");
    if (missing.length) {
      setStatus(`Please fill in: ${missing.join(", ")}.`);
      return;
    }

    setSubmitting(true);
    setStatus("Submitting…");
    try {
      const photoUrls: Record<string, string> = {};
      for (const slot of Object.keys(photos)) {
        const path = `${business.id}/tradeins/${crypto.randomUUID()}/${slot}.jpg`;
        photoUrls[slot] = await uploadDataUrl("tradein-photos", path, photos[slot]);
      }

      const supabase = createClient();
      const { error } = await supabase.from("trade_ins").insert({
        business_id: business.id,
        contact_name: contactName,
        contact_phone: contactPhone,
        disclosure,
        model,
        target_id: target!.id,
        target_name: target!.name,
        target_price: target!.price,
        self_grade: grade,
        ai_suggestion: aiResult,
        photos: photoUrls,
        base_value: quote.base,
        estimated_credit: quote.credit,
        estimated_top_up: quote.topUp,
        status: "pending"
      });
      if (error) throw error;

      setStatus("Request submitted. We'll confirm your final quote in person or by phone.");
      setPhotos({}); setAiResult(null); setDisclosure(""); setContactName(""); setContactPhone(""); setModel("");
    } catch (e) {
      setStatus(`Couldn't submit: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1">Trade-Up estimator</h1>
      <p className="text-sm text-slate-500 mb-6">
        An instant estimate. Our team confirms the final grade and price before your trade-up is complete.
      </p>

      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400 block mb-2">1. Phone you want</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {inventory.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({formatTZS(i.price)})</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400 block">2. Your current phone</label>
          <input
            list="model-list"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model, e.g. iPhone 12, Samsung A54"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <datalist id="model-list">
            {tradeInValues.map((v) => <option key={v.id} value={v.model} />)}
          </datalist>
          {model && (
            <p className="text-xs text-slate-400">
              {matchedValue
                ? `Base trade-in value on file: ${formatTZS(matchedValue.base_value)}`
                : "Not on our price list yet. We'll assess this model manually in-store."}
            </p>
          )}
          <textarea
            value={disclosure}
            onChange={(e) => setDisclosure(e.target.value)}
            placeholder="Full disclosure: cracks, repairs, water exposure, battery issues, non-working buttons or ports, etc."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
          />
          <div className="grid grid-cols-2 gap-3">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Your phone" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400 block">3. Condition grade</label>
          <div className="grid grid-cols-4 gap-2">
            {GRADE_LETTERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={`rounded-lg border py-2 text-center ${grade === g ? "border-accent bg-accent/10" : "border-slate-200"}`}
              >
                <div className="text-lg font-bold">{g}</div>
                <div className="text-[10px] text-slate-400">{Math.round(business.grades[g].multiplier * 100)}%</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Grade {grade}: {business.grades[grade].desc}</p>

          <p className="text-xs text-slate-500">
            In the shop? Skip photos and our team will grade it in person. Remote? Upload clear photos for an AI-assisted estimate.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PHOTO_SLOTS.map((slot) => (
              <div key={slot.key} className="border border-dashed border-slate-300 rounded-lg p-2 text-center">
                <label className="text-[11px] font-semibold block mb-1">{slot.label}</label>
                <input type="file" accept="image/*" onChange={(e) => handlePhotoChange(slot.key, e.target.files?.[0])} className="text-[10px] w-full" />
                {photos[slot.key] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[slot.key]} alt={slot.label} className="aspect-square object-cover rounded mt-2 w-full" />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAiGrade}
            disabled={aiLoading}
            className="text-sm px-4 py-2 rounded-lg bg-accent/10 text-accent font-semibold disabled:opacity-50"
          >
            {aiLoading ? "Analyzing photos…" : "Get AI-assisted grade"}
          </button>
          {aiResult && (
            <div className="bg-accent/10 rounded-lg p-3 text-sm">
              <div className="font-bold text-accent">Suggested grade: {aiResult.overallGrade}</div>
              <p className="text-xs mt-1">{aiResult.reasoning}</p>
              <p className="text-[11px] text-slate-400 mt-2">AI-suggested. Our team confirms the final grade before your trade-up is complete.</p>
            </div>
          )}
        </div>

        <div className="bg-graphite text-white rounded-2xl p-5">
          <div className="flex justify-between text-sm py-1.5 border-b border-white/10"><span>Target phone</span><span>{target?.name || "—"}</span></div>
          <div className="flex justify-between text-sm py-1.5 border-b border-white/10"><span>Target price</span><span>{target ? formatTZS(target.price) : "—"}</span></div>
          <div className="flex justify-between text-sm py-1.5 border-b border-white/10"><span>Trade-in base value</span><span>{matchedValue ? formatTZS(quote.base) : "—"}</span></div>
          <div className="flex justify-between text-sm py-1.5"><span>Grade {grade} credit ({Math.round(business.grades[grade].multiplier * 100)}%)</span><span>{formatTZS(quote.credit)}</span></div>
          <div className="mt-2 pt-2">
            <div className="text-[11px] text-white/55">Estimated top-up</div>
            <div className="text-2xl font-bold">{formatTZS(quote.topUp)}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-lg bg-accent text-white font-semibold disabled:opacity-50"
        >
          Submit trade-up request
        </button>
        {status && <p className="text-xs text-slate-500">{status}</p>}
      </div>
    </div>
  );
}
