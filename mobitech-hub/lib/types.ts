export type GradeInfo = { desc: string; multiplier: number };
export type Grades = { A: GradeInfo; B: GradeInfo; C: GradeInfo; D: GradeInfo };

export type Business = {
  id: string;
  slug: string;
  name: string;
  city: string;
  phone: string;
  whatsapp: string;
  logo_url: string;
  qr_mode: "details" | "whatsapp";
  cert_prefix: string;
  next_cert_number: number;
  terms: string;
  grades: Grades;
};

export type InventoryItem = {
  id: string;
  business_id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image_url: string;
  created_at: string;
};

export type TradeInValue = {
  id: string;
  business_id: string;
  model: string;
  base_value: number;
};

export type Certificate = {
  id: string;
  business_id: string;
  number: string;
  customer_name: string;
  customer_phone: string;
  customer_region: string;
  customer_gender: string;
  product_name: string;
  product_price: number;
  product_qty: number;
  serial_number: string;
  serial_number2: string;
  issue_date: string;
  period_months: number;
  voided: boolean;
  created_at: string;
};

export type TradeIn = {
  id: string;
  business_id: string;
  contact_name: string;
  contact_phone: string;
  disclosure: string;
  model: string;
  target_id: string | null;
  target_name: string;
  target_price: number;
  self_grade: string;
  ai_suggestion: { overallGrade: string; reasoning: string } | null;
  photos: Record<string, string>;
  base_value: number;
  estimated_credit: number;
  estimated_top_up: number;
  final_grade: string | null;
  final_top_up: number | null;
  status: "pending" | "reviewed";
  created_at: string;
};

export type Profile = {
  id: string;
  business_id: string;
  email: string;
  role: "owner" | "admin" | "pending";
  approved: boolean;
  created_at: string;
};

export const BUSINESS_SLUG = process.env.NEXT_PUBLIC_BUSINESS_SLUG || "mobitech-hub";

export function formatTZS(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  return Number(n).toLocaleString("en-US") + " TZS";
}

export function computeExpiry(issueDate: string, periodMonths: number) {
  const d = new Date(issueDate + "T00:00:00");
  d.setMonth(d.getMonth() + Number(periodMonths || 6));
  return d;
}

export function formatDate(d: Date) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return String(d.getDate()).padStart(2, "0") + " " + months[d.getMonth()] + ", " + d.getFullYear();
}
