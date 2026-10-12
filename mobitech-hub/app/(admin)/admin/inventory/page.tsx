"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG, formatTZS, type InventoryItem, type TradeInValue } from "@/lib/types";

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

export default function AdminInventoryPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [values, setValues] = useState<TradeInValue[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "Phone", price: "", stock: "1", description: "" });
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [tvForm, setTvForm] = useState({ model: "", value: "" });

  async function reload(biz: string) {
    const [{ data: inv }, { data: tv }] = await Promise.all([
      supabase.from("inventory").select("*").eq("business_id", biz).order("created_at", { ascending: false }),
      supabase.from("trade_in_values").select("*").eq("business_id", biz).order("model")
    ]);
    setItems((inv || []) as InventoryItem[]);
    setValues((tv || []) as TradeInValue[]);
  }

  useEffect(() => {
    supabase.from("businesses").select("id").eq("slug", BUSINESS_SLUG).single().then(({ data }) => {
      if (data) { setBusinessId(data.id); reload(data.id); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", category: "Phone", price: "", stock: "1", description: "" });
    setPhotoDataUrl(null);
  }

  async function handleSave() {
    if (!businessId) return;
    if (!form.name.trim() || !form.price) { setStatus("Fill in the required fields."); return; }
    setStatus("Saving…");

    let imageUrl: string | undefined;
    if (photoDataUrl) {
      const path = `${businessId}/inventory/${crypto.randomUUID()}.jpg`;
      const mediaType = photoDataUrl.split(";")[0].split(":")[1];
      const bytes = Uint8Array.from(atob(photoDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabase.storage.from("public-assets").upload(path, bytes, { contentType: mediaType, upsert: true });
      if (upErr) { setStatus(`Couldn't save: ${upErr.message}`); return; }
      imageUrl = supabase.storage.from("public-assets").getPublicUrl(path).data.publicUrl;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(), category: form.category, price: Number(form.price),
      stock: Number(form.stock || 0), description: form.description.trim()
    };
    if (imageUrl) payload.image_url = imageUrl;

    const result = editingId
      ? await supabase.from("inventory").update(payload).eq("id", editingId)
      : await supabase.from("inventory").insert({ ...payload, business_id: businessId });

    if (result.error) { setStatus(`Couldn't save: ${result.error.message}`); return; }
    setStatus("Saved.");
    resetForm();
    reload(businessId);
  }

  async function handleDelete(id: string, name: string) {
    if (!businessId || !confirm(`Delete ${name}?`)) return;
    await supabase.from("inventory").delete().eq("id", id);
    reload(businessId);
  }

  function handleEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category, price: String(item.price), stock: String(item.stock), description: item.description });
    setPhotoDataUrl(null);
  }

  async function handleTvSave() {
    if (!businessId || !tvForm.model.trim() || !tvForm.value) return;
    const existing = values.find((v) => v.model.toLowerCase() === tvForm.model.toLowerCase());
    if (existing) {
      await supabase.from("trade_in_values").update({ base_value: Number(tvForm.value) }).eq("id", existing.id);
    } else {
      await supabase.from("trade_in_values").insert({ business_id: businessId, model: tvForm.model.trim(), base_value: Number(tvForm.value) });
    }
    setTvForm({ model: "", value: "" });
    reload(businessId);
  }

  async function handleTvDelete(id: string) {
    if (!businessId) return;
    await supabase.from("trade_in_values").delete().eq("id", id);
    reload(businessId);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-lg font-bold mb-4">{editingId ? "Edit item" : "Add inventory item"}</h1>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option>Phone</option><option>Laptop</option><option>Accessory</option>
          </select>
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="Selling price (TZS)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} type="number" placeholder="Stock quantity" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3" />
        <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhotoDataUrl(await resizeImageFile(f, 500, 0.72)); }} className="text-sm mb-3" />
        <div className="flex gap-2 items-center">
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">{editingId ? "Update item" : "Save item"}</button>
          {editingId && <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Cancel edit</button>}
          {status && <span className="text-xs text-slate-500">{status}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold mb-4">Current inventory</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No inventory yet. Add your first item above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">Item</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="py-2">{i.name}</td><td>{i.category}</td><td>{formatTZS(i.price)}</td><td>{i.stock}</td>
                  <td className="text-right space-x-2">
                    <button onClick={() => handleEdit(i)} className="text-accent text-xs font-semibold">Edit</button>
                    <button onClick={() => handleDelete(i.id, i.name)} className="text-red-500 text-xs font-semibold">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold mb-1">Trade-in value list</h2>
        <p className="text-sm text-slate-500 mb-4">Base wholesale/trade-in value per model, used to calculate top-up quotes.</p>
        <div className="flex gap-2 mb-4">
          <input value={tvForm.model} onChange={(e) => setTvForm({ ...tvForm, model: e.target.value })} placeholder="Model" className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" />
          <input value={tvForm.value} onChange={(e) => setTvForm({ ...tvForm, value: e.target.value })} type="number" placeholder="Base value (TZS)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40" />
          <button onClick={handleTvSave} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Save</button>
        </div>
        {values.map((v) => (
          <div key={v.id} className="flex justify-between text-sm py-1.5 border-t border-slate-100">
            <span>{v.model}</span><span>{formatTZS(v.base_value)}</span>
            <button onClick={() => handleTvDelete(v.id)} className="text-red-500 text-xs font-semibold">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
