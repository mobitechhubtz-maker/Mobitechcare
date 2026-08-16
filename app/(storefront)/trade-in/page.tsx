import { createClient } from "@/lib/supabase/server";
import { BUSINESS_SLUG, type Business, type InventoryItem, type TradeInValue } from "@/lib/types";
import TradeInForm from "./TradeInForm";

export const revalidate = 0;

export default async function TradeInPage() {
  const supabase = createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", BUSINESS_SLUG)
    .single();

  if (!business) {
    return <div className="text-sm text-slate-500">This shop isn&apos;t set up yet.</div>;
  }

  const [{ data: inventory }, { data: tradeInValues }] = await Promise.all([
    supabase.from("inventory").select("*").eq("business_id", business.id).order("name"),
    supabase.from("trade_in_values").select("*").eq("business_id", business.id).order("model")
  ]);

  return (
    <TradeInForm
      business={business as Business}
      inventory={(inventory || []) as InventoryItem[]}
      tradeInValues={(tradeInValues || []) as TradeInValue[]}
    />
  );
}
