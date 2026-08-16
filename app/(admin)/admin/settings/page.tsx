"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG, type Business, type Grades } from "@/lib/types";

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

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [business, setBusiness] = useState<Business | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    supabase.from("businesses").select("*").eq("slug", BUSINESS_SLUG).single().then(({ data }) => {
      if (data) setBusiness(data as Business);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!business) return null;

  function set<K extends keyof Business>(key: K, value: Business[K]) {
    setBusiness((b) => (b ? { ...b, [key]: value } : b));
  }

  function setGrade(letter: keyof Grades, field: "desc" | "multiplier", value: string) {
    setBusiness((b) => {
      if (!b) return b;
      const grades = { ...b.grades, [letter]: { ...b.grades[letter], [field]: field === "multiplier" ? Number(value) : value } };
      return { ...b, grades };
    });
  }

  async function handleSave() {
    if (!business) return;
    setStatus("Saving…");

    let logoUrl: string | undefined;
    if (logoDataUrl) {
      const path = `${business.id}/logo.jpg`;
      const mediaType = logoDataUrl.split(";")[0].split(":")[1];
      const bytes = Uint8Array.from(atob(logoDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const { error } = await supabase.storage.from("public-assets").upload(path, bytes, { contentType: mediaType, upsert: true });
      if (error) { setStatus(`Couldn't save: ${error.message}`); return; }
      logoUrl = supabase.storage.from("public-assets").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from("businesses").update({
      name: business.name, city: business.city, phone: business.phone, whatsapp: business.whatsapp,
      qr_mode: business.qr_mode, cert_prefix: business.cert_prefix, next_cert_number: business.next_cert_number,
      terms: business.terms, grades: business.grades,
      ...(logoUrl ? { logo_url: logoUrl } : {})
    }).eq("id", business.id);

    if (error) { setStatus(`Couldn't save: ${error.message}`); return; }
    setStatus("Settings saved.");
    setLogoDataUrl(null);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl space-y-6">
      <h1 className="text-lg font-bold">Business settings</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <input value={business.name} onChange={(e) => set("name", e.target.value)} placeholder="Business name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={business.city} onChange={(e) => set("city", e.target.value)} placeholder="Location" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={business.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Shop phone" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={business.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="WhatsApp (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={business.qr_mode} onChange={(e) => set("qr_mode", e.target.value as Business["qr_mode"])} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="details">QR shows certificate details</option>
            <option value="whatsapp">QR opens WhatsApp verification</option>
          </select>
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLogoDataUrl(await resizeImageFile(f, 300, 0.8)); }} className="text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3 content-start">
          <input value={business.cert_prefix} onChange={(e) => set("cert_prefix", e.target.value.toUpperCase())} placeholder="Certificate prefix" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={business.next_cert_number} onChange={(e) => set("next_cert_number", Number(e.target.value))} placeholder="Next certificate number" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold mb-2">Warranty terms</h2>
        <textarea value={business.terms} onChange={(e) => set("terms", e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[140px]" />
      </div>

      <div>
        <h2 className="text-sm font-bold mb-1">Trade-up grading</h2>
        <p className="text-xs text-slate-500 mb-3">Each grade&apos;s description (used to brief the AI grader) and its multiplier of base trade-in value.</p>
        {(["A", "B", "C", "D"] as const).map((letter) => (
          <div key={letter} className="grid grid-cols-[1fr_100px] gap-3 mb-2 items-start">
            <input value={business.grades[letter].desc} onChange={(e) => setGrade(letter, "desc", e.target.value)} placeholder={`Grade ${letter} description`} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input type="number" step="0.01" min="0" max="1" value={business.grades[letter].multiplier} onChange={(e) => setGrade(letter, "multiplier", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold">Save settings</button>
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>
    </div>
  );
}
