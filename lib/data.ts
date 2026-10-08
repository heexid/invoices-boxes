import type { Receipt } from "./types";

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
