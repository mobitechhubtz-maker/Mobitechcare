"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG, computeExpiry, formatDate, formatTZS, type Business, type Certificate } from "@/lib/types";

const TZ_REGIONS = ["Arusha","Dar es Salaam","Dodoma","Geita","Iringa","Kagera","Katavi","Kigoma","Kilimanjaro","Lindi","Manyara","Mara","Mbeya","Morogoro","Mtwara","Mwanza","Njombe","Pemba North","Pemba South","Pwani","Rukwa","Ruvuma","Shinyanga","Simiyu","Singida","Songwe","Tabora","Tanga","Unguja North","Unguja South","Zanzibar Urban West"];

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  customerName: "", customerPhone: "", customerRegion: "", customerGender: "",
  productName: "", productPrice: "", productQty: "1", serialNumber: "", serialNumber2: "",
  issueDate: todayInput(), periodMonths: "6"
};

export default function AdminCertificatesPage() {
  const supabase = createClient();
  const [business, setBusiness] = useState<Business | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [lastIssued, setLastIssued] = useState<Certificate | null>(null);
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  async function reload(biz: string) {
    const { data } = await supabase.from("certificates").select("*").eq("business_id", biz).order("created_at", { ascending: false });
    setCertificates((data || []) as Certificate[]);
  }

  useEffect(() => {
    supabase.from("businesses").select("*").eq("slug", BUSINESS_SLUG).single().then(({ data }) => {
      if (data) { setBusiness(data as Business); reload(data.id); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!barcodeRef.current || !form.serialNumber) return;
    import("jsbarcode").then((m) => {
      try {
        m.default(barcodeRef.current!, form.serialNumber.replace(/\s+/g, ""), { format: "CODE128", displayValue: false, height: 40, margin: 0 });
      } catch { /* invalid characters for a barcode — preview just stays blank */ }
    });
  }, [form.serialNumber]);

  function resetForm() {
    setForm(emptyForm);
    setLastIssued(null);
    setStatus("");
  }

  async function handleSave() {
    if (!business) return;
    if (!form.customerName || !form.productName || !form.productPrice || !form.serialNumber) {
      setStatus("Fill in the required fields: customer name, product name, price, and serial.");
      return;
    }
    const number = `${business.cert_prefix}-${business.next_cert_number}`;
    setStatus("Saving…");

    const { data: inserted, error } = await supabase.from("certificates").insert({
      business_id: business.id, number,
      customer_name: form.customerName, customer_phone: form.customerPhone,
      customer_region: form.customerRegion, customer_gender: form.customerGender,
      product_name: form.productName, product_price: Number(form.productPrice), product_qty: Number(form.productQty || 1),
      serial_number: form.serialNumber, serial_number2: form.serialNumber2,
      issue_date: form.issueDate, period_months: Number(form.periodMonths)
    }).select().single();

    if (error) { setStatus(`Couldn't save: ${error.message}`); return; }

    const { data: updatedBiz } = await supabase.from("businesses").update({ next_cert_number: business.next_cert_number + 1 }).eq("id", business.id).select().single();
    if (updatedBiz) setBusiness(updatedBiz as Business);

    setLastIssued(inserted as Certificate);
    setStatus(`Saved as certificate #${number}.`);
    reload(business.id);
  }

  async function handleVoidToggle(cert: Certificate) {
    await supabase.from("certificates").update({ voided: !cert.voided }).eq("id", cert.id);
    if (business) reload(business.id);
  }

  async function handleDelete(cert: Certificate) {
    if (!confirm(`Delete certificate #${cert.number}?`)) return;
    await supabase.from("certificates").delete().eq("id", cert.id);
    if (business) reload(business.id);
  }

  async function handleDownloadPdf(cert: Certificate) {
    if (!business) return;
    const [{ jsPDF }, JsBarcode, QRCode] = await Promise.all([
      import("jspdf"), import("jsbarcode").then((m) => m.default), import("qrcode").then((m) => m.default)
    ]);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const x = 20; let y = 20;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(business.name, x, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text([business.city, business.phone].filter(Boolean).join("  ·  "), x, y + 6);
    y += 22;
    doc.setTextColor(150); doc.setFontSize(9); doc.text("WARRANTY CERTIFICATE", x, y);
    doc.setTextColor(20); doc.setFontSize(12); doc.setFont("courier", "normal");
    doc.text(`Certificate No. #${cert.number}`, x, y + 6);
    const expiry = computeExpiry(cert.issue_date, cert.period_months);
    const certStatus = cert.voided ? "VOID" : new Date() > expiry ? "EXPIRED" : "ACTIVE";
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`STATUS: ${certStatus}`, 150, y);
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(cert.product_name, x, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`${formatTZS(cert.product_price)}   Qty: ${cert.product_qty}`, x, y + 6);
    y += 14;
    doc.setTextColor(150); doc.setFontSize(8); doc.text("SERIAL / IMEI", x, y);
    doc.setTextColor(20); doc.setFont("courier", "normal"); doc.setFontSize(11); doc.text(cert.serial_number, x, y + 5);
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, cert.serial_number || cert.number, { format: "CODE128", displayValue: false, margin: 4, height: 60 });
    doc.addImage(barcodeCanvas.toDataURL("image/png"), "PNG", x, y + 10, 90, 16);
    y += 34;
    const labels = ["CUSTOMER", "PHONE", "REGION", "GENDER"];
    const vals = [cert.customer_name, cert.customer_phone, cert.customer_region, cert.customer_gender];
    const cols = [x, x + 45, x + 90, x + 135];
    labels.forEach((l, i) => {
      doc.setTextColor(150); doc.setFontSize(8); doc.text(l, cols[i], y);
      doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(String(vals[i] || "—"), cols[i], y + 5, { maxWidth: 42 }); doc.setFont("helvetica", "normal");
    });
    y += 16;
    doc.setTextColor(150); doc.setFontSize(8); doc.text("ISSUED / EXPIRES", x, y);
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`${formatDate(new Date(cert.issue_date + "T00:00:00"))} to ${formatDate(expiry)}`, x, y + 5);
    doc.setFont("helvetica", "normal");
    y += 16;
    doc.setTextColor(20); doc.setFontSize(9);
    doc.text("Covered: manufacturing defects and anything disclosed by us at sale.", x, y);
    doc.text("Not covered: screen and physical damage, unless agreed in writing before the sale closed.", x, y + 5);
    y += 16;
    doc.setFontSize(8); doc.setTextColor(90);
    const lines = doc.splitTextToSize(business.terms, 170);
    doc.text(lines, x, y);
    y += lines.length * 3.6 + 6;
    const qrText = `${business.name}\nWarranty #${cert.number}\n${cert.product_name}\nSerial: ${cert.serial_number}\nCustomer: ${cert.customer_name}`;
    const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 180 });
    doc.addImage(qrDataUrl, "PNG", x, y, 26, 26);
    doc.setFontSize(8); doc.setTextColor(110); doc.text("Scan to verify", x + 30, y + 14);
    doc.save(`MobiTechHub-Warranty-${cert.number}.pdf`);
  }

  const filtered = certificates.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.number, c.customer_name, c.product_name, c.serial_number].join(" ").toLowerCase().includes(q);
  });

  if (!business) return null;

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-lg font-bold mb-1">Issue certificate</h1>
        <p className="text-sm text-slate-500 mb-4">Only visible here in Admin. Customers can look up a certificate but never issue one.</p>

        <div className="space-y-3">
          <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer name *" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="Phone" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input list="tz-regions" value={form.customerRegion} onChange={(e) => setForm({ ...form, customerRegion: e.target.value })} placeholder="Region" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <datalist id="tz-regions">{TZ_REGIONS.map((r) => <option key={r} value={r} />)}</datalist>
          </div>
          <select value={form.customerGender} onChange={(e) => setForm({ ...form, customerGender: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Not specified</option><option>Male</option><option>Female</option><option>Prefer not to say</option>
          </select>
          <input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} placeholder="Product name *" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.productPrice} onChange={(e) => setForm({ ...form, productPrice: e.target.value })} type="number" placeholder="Price (TZS) *" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input value={form.productQty} onChange={(e) => setForm({ ...form, productQty: e.target.value })} type="number" placeholder="Quantity" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Serial / IMEI 1 *" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={form.serialNumber2} onChange={(e) => setForm({ ...form, serialNumber2: e.target.value })} placeholder="IMEI 2 (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.periodMonths} onChange={(e) => setForm({ ...form, periodMonths: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option>
            </select>
          </div>
          <canvas ref={barcodeRef} className="w-full" />
          <div className="flex gap-2 items-center">
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Save &amp; issue certificate</button>
            <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Reset form</button>
          </div>
          {status && <p className="text-xs text-slate-500">{status}</p>}
          {lastIssued && (
            <button onClick={() => handleDownloadPdf(lastIssued)} className="text-sm px-4 py-2 rounded-lg bg-accent/10 text-accent font-semibold">
              Download PDF for #{lastIssued.number}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold mb-4">Issued certificates</h2>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search certificates…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4" />
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400">{certificates.length ? "No matches." : "No certificates issued yet."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">#</th><th>Customer</th><th>Product</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((c) => {
                const expiry = computeExpiry(c.issue_date, c.period_months);
                const badge = c.voided ? "VOID" : new Date() > expiry ? "EXPIRED" : "ACTIVE";
                const badgeClass = c.voided ? "bg-slate-200 text-slate-600" : badge === "EXPIRED" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700";
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2 font-semibold">#{c.number}</td>
                    <td>{c.customer_name}</td>
                    <td>{c.product_name}</td>
                    <td>{formatDate(expiry)}</td>
                    <td><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>{badge}</span></td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => handleDownloadPdf(c)} className="text-accent text-xs font-semibold">PDF</button>
                      <button onClick={() => handleVoidToggle(c)} className="text-slate-500 text-xs font-semibold">{c.voided ? "Unvoid" : "Void"}</button>
                      <button onClick={() => handleDelete(c)} className="text-red-500 text-xs font-semibold">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
