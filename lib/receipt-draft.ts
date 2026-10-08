import type { Box, ExtractedReceiptDraft, Receipt, ReceiptDraft } from "./types";

export const blankReceiptDraft = (box?: Box): ReceiptDraft => ({
  merchant: "", date: new Date().toISOString().slice(0, 10), currency: "IDR", subtotal: "", tax: "", tax_enabled: false, tax_mode: "amount", tax_input: "", total: "",
  payment_method: "", category: box?.name ?? "Unfiled", box_id: box?.id ?? "", notes: "", confidence: {}, line_items: [],
});

export function calculateReceiptTotals(draft: ReceiptDraft) {
  const precision = draft.currency === "IDR" ? 0 : 2;
  const round = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(precision));
  const subtotal = round(draft.line_items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.amount) || 0;
    return sum + quantity * price;
  }, 0));
  const input = Number(draft.tax_input) || 0;
  const tax = draft.tax_enabled ? round(draft.tax_mode === "percent" ? subtotal * input / 100 : input) : 0;
  return { subtotal, tax, total: round(subtotal + tax) };
}

export const receiptToDraft = (receipt: Receipt): ReceiptDraft => ({
  id: receipt.id, merchant: receipt.merchant, date: receipt.date, currency: receipt.currency || "IDR",
  subtotal: String(receipt.subtotal ?? ""), tax: String(receipt.tax ?? ""), total: String(receipt.total ?? ""),
  tax_enabled: receipt.tax_enabled ?? (Number(receipt.tax) > 0 || receipt.tax_rate != null),
  tax_mode: receipt.tax_rate == null ? "amount" : "percent",
  tax_input: String(receipt.tax_rate ?? receipt.tax ?? ""),
  payment_method: receipt.payment_method ?? "", category: receipt.category ?? "Unfiled", box_id: receipt.box_id ?? "",
  notes: receipt.notes ?? "", confidence: receipt.confidence ?? {},
  line_items: (receipt.line_items ?? []).length ? (receipt.line_items ?? []).map((item) => ({ id: item.id || crypto.randomUUID(), description: item.description, quantity: String(item.quantity), amount: String(item.amount), confidence: item.confidence ?? 1 })) : [{ id: crypto.randomUUID(), description: "", quantity: "1", amount: "", confidence: 1 }],
});

export const extractionToDraft = (extracted: ExtractedReceiptDraft, current: ReceiptDraft, boxes: Box[]): ReceiptDraft => {
  const matchedBox = boxes.find((box) => box.name.toLowerCase() === (extracted.suggested_category ?? "").toLowerCase());
  return {
    ...current,
    merchant: extracted.merchant ?? current.merchant,
    date: extracted.date ?? current.date,
    currency: extracted.currency ?? current.currency ?? "IDR",
    subtotal: current.subtotal,
    tax: current.tax,
    tax_enabled: extracted.tax == null ? current.tax_enabled : extracted.tax > 0,
    tax_mode: "amount",
    tax_input: extracted.tax == null ? current.tax_input : String(extracted.tax),
    total: current.total,
    payment_method: extracted.payment_method ?? current.payment_method,
    category: matchedBox?.name ?? extracted.suggested_category ?? current.category,
    box_id: matchedBox?.id ?? current.box_id,
    notes: extracted.notes ?? current.notes,
    confidence: extracted.confidence ?? {},
    line_items: extracted.line_items?.map((item) => {
      const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      // Keep fractional unit prices when splitting a receipt's saved line total;
      // the receipt total is rounded only after quantity × unit price is summed.
      const precision = 8;
      const unitPrice = item.amount == null ? "" : String(Number((Number(item.amount) / quantity).toFixed(precision)));
      return { id: crypto.randomUUID(), description: item.description ?? "", quantity: String(quantity), amount: unitPrice, confidence: item.confidence ?? 0 };
    }) ?? [{ id: crypto.randomUUID(), description: "", quantity: "1", amount: "", confidence: 0 }],
  };
};
