import type { Box, Receipt } from "./types";

export const demoBoxes: Box[] = [
  { id: "groceries", name: "Groceries", illustration: "tomato", color: "sage", budget: 1800000, created_at: "2026-08-01" },
  { id: "coffee", name: "Coffee", illustration: "cup", color: "cream", budget: null, created_at: "2026-08-01" },
  { id: "eating-out", name: "Eating out", illustration: "fork", color: "pink", budget: 900000, created_at: "2026-08-01" },
  { id: "transport", name: "Transport", illustration: "car", color: "blue", budget: null, created_at: "2026-08-01" },
  { id: "little-things", name: "Little things", illustration: "flower", color: "yellow", budget: null, created_at: "2026-08-01" },
];

const rows: [string, string, number, string, string, number][] = [
  ["2026-08-18", "Ottimo Pizza", 54300, "eating-out", "Dinner with Mia", 0],
  ["2026-08-15", "Sushi Ran", 62300, "eating-out", "Little Friday treat", 0],
  ["2026-08-05", "Chipotle", 13650, "eating-out", "Lunch", 0],
  ["2026-08-16", "Market Lane", 31800, "coffee", "Flat white & a slow morning", 0],
  ["2026-08-12", "Blue Bottle Coffee", 26700, "coffee", "", 0],
  ["2026-08-08", "Toko Buah Ibu", 156400, "groceries", "Market run", 0],
  ["2026-08-13", "Whole Foods Market", 234500, "groceries", "", 0],
  ["2026-08-20", "Pasar Santa", 128700, "groceries", "Fresh flowers, too", 0],
  ["2026-08-21", "Gojek", 38500, "transport", "Ride home", 0],
  ["2026-08-11", "Shell Gas", 328000, "transport", "", 0],
  ["2026-08-09", "Bluebird Taxi", 64500, "transport", "To the station", 0],
  ["2026-08-14", "Kinokuniya", 189000, "little-things", "A book for Sunday", 0],
  ["2026-08-07", "Flower Market", 73500, "little-things", "Just because", 0],
];

export const demoReceipts: Receipt[] = rows.map(([date, merchant, total, box_id, notes], index) => ({
  id: `demo-${index + 1}`, merchant, date, currency: "IDR",
  line_items: [{ id: `line-${index + 1}`, description: merchant === "Ottimo Pizza" ? "Margherita pizza" : merchant === "Sushi Ran" ? "Lunch set" : merchant === "Toko Buah Ibu" ? "Market produce" : "Purchase", quantity: 1, amount: total * 0.9, position: 0 }],
  subtotal: total * 0.9, tax: total * 0.1, total, payment_method: index % 2 ? "Debit card" : "QRIS", category: demoBoxes.find((box) => box.id === box_id)?.name ?? "Little things", box_id,
  original_image_url: null, confidence: {}, notes,
}));

export const formatMoney = (amount: number, currency = "IDR") => {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "IDR";
  try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: code, maximumFractionDigits: code === "IDR" ? 0 : 2 }).format(amount); }
  catch { return `${code} ${amount.toLocaleString("id-ID")}`; }
};
export const formatIDR = (amount: number) => formatMoney(amount, "IDR");
export function formatTotals(receipts: Array<Pick<Receipt, "currency" | "total">>) {
  if (!receipts.length) return formatMoney(0, "IDR");
  const grouped = new Map<string, number>();
  for (const receipt of receipts) grouped.set(receipt.currency || "IDR", (grouped.get(receipt.currency || "IDR") ?? 0) + receipt.total);
  return [...grouped.entries()].map(([currency, total]) => formatMoney(total, currency)).join(" · ");
}
export const formatDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en", { day: "2-digit" });
export const formatShortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" });
