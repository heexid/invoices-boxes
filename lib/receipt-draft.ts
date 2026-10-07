import type { Box, ExtractedReceiptDraft, Receipt, ReceiptDraft } from "./types";

export const blankReceiptDraft = (box?: Box): ReceiptDraft => ({
  merchant: "", date: new Date().toISOString().slice(0, 10), currency: "IDR", subtotal: "", tax: "", total: "",
  payment_method: "", category: box?.name ?? "Unfiled", box_id: box?.id ?? "", notes: "", confidence: {}, line_items: [],
});

export const receiptToDraft = (receipt: Receipt): ReceiptDraft => ({
  id: receipt.id, merchant: receipt.merchant, date: receipt.date, currency: receipt.currency || "IDR",
  subtotal: String(receipt.subtotal ?? ""), tax: String(receipt.tax ?? ""), total: String(receipt.total ?? ""),
  payment_method: receipt.payment_method ?? "", category: receipt.category ?? "Unfiled", box_id: receipt.box_id ?? "",
  notes: receipt.notes ?? "", confidence: receipt.confidence ?? {},
  line_items: (receipt.line_items ?? []).map((item) => ({ id: item.id || crypto.randomUUID(), description: item.description, quantity: String(item.quantity), amount: String(item.amount), confidence: item.confidence ?? 1 })),
});

export const extractionToDraft = (extracted: ExtractedReceiptDraft, current: ReceiptDraft, boxes: Box[]): ReceiptDraft => {
  const matchedBox = boxes.find((box) => box.name.toLowerCase() === (extracted.suggested_category ?? "").toLowerCase());
  return {
    ...current,
    merchant: extracted.merchant ?? current.merchant,
    date: extracted.date ?? current.date,
    currency: extracted.currency ?? current.currency ?? "IDR",
    subtotal: extracted.subtotal == null ? current.subtotal : String(extracted.subtotal),
    tax: extracted.tax == null ? current.tax : String(extracted.tax),
    total: extracted.total == null ? current.total : String(extracted.total),
    payment_method: extracted.payment_method ?? current.payment_method,
    category: matchedBox?.name ?? extracted.suggested_category ?? current.category,
    box_id: matchedBox?.id ?? current.box_id,
    notes: extracted.notes ?? current.notes,
    confidence: extracted.confidence ?? {},
    line_items: extracted.line_items?.map((item) => ({ id: crypto.randomUUID(), description: item.description ?? "", quantity: String(item.quantity ?? 1), amount: item.amount == null ? "" : String(item.amount), confidence: item.confidence ?? 0 })) ?? [],
  };
};
