import { createClient } from "@/lib/supabase/server";
import { BUSINESS_SLUG, formatTZS, type InventoryItem } from "@/lib/types";

export const revalidate = 0;

export default async function CatalogPage() {
  const supabase = createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", BUSINESS_SLUG)
    .single();

  const { data: items } = business
    ? await supabase
        .from("inventory")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
    : { data: [] as InventoryItem[] };

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Inventory</h1>
      <p className="text-sm text-slate-500 mb-6">Everything currently in stock.</p>

      {!items || items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No items yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item: InventoryItem) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="aspect-square bg-slate-100 flex items-center justify-center text-slate-400 font-semibold text-xs">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  item.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold leading-tight">{item.name}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">{item.category}</div>
                <div className="text-sm font-bold text-accent mt-2">{formatTZS(item.price)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
