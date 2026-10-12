"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG, computeExpiry, formatDate, formatTZS, type Certificate } from "@/lib/types";

export default function WarrantyLookup() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [record, setRecord] = useState<Certificate | null>(null);

  async function handleLookup() {
    if (!input.trim()) return;
    setStatus("Looking up…");
    setRecord(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("lookup_certificate", {
        p_business_slug: BUSINESS_SLUG,
        p_number: input.trim()
      });
      if (error) throw error;
      if (!data || !data.number) {
        setStatus("No certificate found with that number.");
        return;
      }
      setRecord(data as Certificate);
      setStatus("");
    } catch {
      setStatus("Lookup failed. Check your connection.");
    }
  }

  async function handleDownloadPdf() {
    if (!record) return;
    const [{ jsPDF }, JsBarcode, QRCode] = await Promise.all([
      import("jspdf"),
      import("jsbarcode").then((m) => m.default),
      import("qrcode").then((m) => m.default)
    ]);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const x = 20;
    let y = 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("MOBITECH HUB TANZANIA", x, y);
    y += 16;

    doc.setTextColor(150); doc.setFontSize(9); doc.text("WARRANTY CERTIFICATE", x, y);
    doc.setTextColor(20); doc.setFontSize(12); doc.setFont("courier", "normal");
    doc.text(`Certificate No. #${record.number}`, x, y + 6);

    const expiry = computeExpiry(record.issue_date, record.period_months);
    const status = record.voided ? "VOID" : new Date() > expiry ? "EXPIRED" : "ACTIVE";
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`STATUS: ${status}`, 150, y);

    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(record.product_name || "—", x, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`${formatTZS(record.product_price)}   Qty: ${record.product_qty}`, x, y + 6);

    y += 14;
    doc.setTextColor(150); doc.setFontSize(8); doc.text("SERIAL / IMEI", x, y);
    doc.setTextColor(20); doc.setFont("courier", "normal"); doc.setFontSize(11);
    doc.text(record.serial_number || "—", x, y + 5);

    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, record.serial_number || record.number, { format: "CODE128", displayValue: false, margin: 4, height: 60 });
    doc.addImage(barcodeCanvas.toDataURL("image/png"), "PNG", x, y + 10, 90, 16);

    y += 34;
    const labels = ["CUSTOMER", "PHONE", "REGION"];
    const vals = [record.customer_name || "—", record.customer_phone || "—", record.customer_region || "—"];
    const cols = [x, x + 60, x + 120];
    labels.forEach((l, i) => {
      doc.setTextColor(150); doc.setFontSize(8); doc.text(l, cols[i], y);
      doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(String(vals[i]), cols[i], y + 5, { maxWidth: 55 });
      doc.setFont("helvetica", "normal");
    });

    y += 16;
    doc.setTextColor(150); doc.setFontSize(8); doc.text("ISSUED / EXPIRES", x, y);
    doc.setTextColor(20); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`${formatDate(new Date(record.issue_date + "T00:00:00"))} \u2013 ${formatDate(expiry)}`, x, y + 5);
    doc.setFont("helvetica", "normal");

    y += 16;
    doc.setTextColor(20); doc.setFontSize(9);
    doc.text("Covered: manufacturing defects and anything disclosed by us at sale.", x, y);
    doc.text("Not covered: screen and physical damage, unless agreed in writing before the sale closed.", x, y + 5);

    const qrText = `MOBITECH HUB TANZANIA\nWarranty #${record.number}\n${record.product_name}\nSerial: ${record.serial_number}`;
    const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 180 });
    doc.addImage(qrDataUrl, "PNG", x, y + 10, 26, 26);
    doc.setFontSize(8); doc.setTextColor(110); doc.text("Scan to verify", x + 30, y + 24);

    doc.save(`MobiTechHub-Warranty-${record.number}.pdf`);
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1 className="text-xl font-bold mb-1">Warranty lookup</h1>
        <p className="text-sm text-slate-500 mb-4">Enter your certificate number to view your warranty and download it as a PDF.</p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. MTH-1001"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={handleLookup} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">
            Look up
          </button>
        </div>
        {status && <p className="text-xs text-slate-500 mt-2">{status}</p>}
      </div>

      {record && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-4">
          <div className="text-sm space-y-1">
            <div className="font-bold text-base">{record.product_name}</div>
            <div className="text-slate-500">{formatTZS(record.product_price)}</div>
            <div className="text-slate-500">Serial: {record.serial_number}</div>
            <div className="text-slate-500">Customer: {record.customer_name}</div>
            <div className="text-slate-500">
              {formatDate(new Date(record.issue_date + "T00:00:00"))} to {formatDate(computeExpiry(record.issue_date, record.period_months))}
            </div>
          </div>
          <button onClick={handleDownloadPdf} className="mt-4 px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-semibold">
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}
