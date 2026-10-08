"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Box as BoxIcon, Check, ChevronDown, ChevronLeft, ChevronRight, FileImage, FileText, LogIn, LogOut, MoreVertical, Pencil, Plus, Search, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { demoBoxes, demoReceipts, formatDay, formatIDR, formatMoney, formatShortDate, formatTotals } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import { ReceiptEditor } from "@/components/receipt-editor";
import { EmptyStateIllustration, type EmptyIllustrationKind } from "@/components/empty-state-illustration";
import { blankReceiptDraft, extractionToDraft, receiptToDraft } from "@/lib/receipt-draft";
import type { Box, ExtractedReceiptDraft, Receipt, ReceiptDraft } from "@/lib/types";

type Screen = "drawer" | "boxes" | "box" | "print-preview" | "recent" | "receipt" | "profile" | "auth";
type AuthMode = "signin" | "signup" | "reset" | "update-password";
type OCRState = "idle" | "uploading" | "extracting" | "ready" | "error";
const emailName = (email: string | undefined) => email?.split("@")[0]?.split(/[._+-]+/).filter(Boolean)[0] ?? "";
const monthName = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });
const addedAtDate = (receipt: Receipt) => {
  const date = receipt.created_at ? new Date(receipt.created_at) : new Date(`${receipt.date}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${receipt.date}T12:00:00`) : date;
};
const dateMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("drawer");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [isDemo, setIsDemo] = useState(true);
  const [userEmail, setUserEmail] = useState<string>();
  const [boxes, setBoxes] = useState<Box[]>(demoBoxes);
  const [receipts, setReceipts] = useState<Receipt[]>(demoReceipts);
  const [selectedBox, setSelectedBox] = useState<string>(demoBoxes[2].id);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [boxReceiptYear, setBoxReceiptYear] = useState("all");
  const [boxReceiptMonth, setBoxReceiptMonth] = useState("all");
  const [recentQuery, setRecentQuery] = useState("");
  const [recentYear, setRecentYear] = useState("all");
  const [recentMonth, setRecentMonth] = useState("all");
  const [boxMenuOpen, setBoxMenuOpen] = useState(false);
  const [modal, setModal] = useState<"scan" | "box" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "receipt"; receipt: Receipt } | { kind: "box"; box: Box } | null>(null);
  const [editingBox, setEditingBox] = useState<Box | null>(null);
  const [draftBoxName, setDraftBoxName] = useState("");
  const [draftBudget, setDraftBudget] = useState("");
  const [draftIllustration, setDraftIllustration] = useState("📦");
  const [draftColor, setDraftColor] = useState("cream");
  const [draftOrder, setDraftOrder] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [draft, setDraft] = useState<ReceiptDraft>(blankReceiptDraft(demoBoxes[0]));
  const [editorReceiptId, setEditorReceiptId] = useState<string | null>(null);
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [ocrState, setOcrState] = useState<OCRState>("idle");
  const [ocrError, setOcrError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalSignedUrl, setOriginalSignedUrl] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); }, []);

  const loadAccount = useCallback(async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUserEmail(session.user.email);
    setIsDemo(false);
    const [{ data: boxRows, error: boxError }, { data: receiptRows, error: receiptError }] = await Promise.all([
      supabase.from("boxes").select("*").order("sort_order").order("created_at"),
      supabase.from("receipts").select("*").order("created_at", { ascending: false }),
    ]);
    if (boxError || receiptError) { notify(`Couldn’t load your drawer: ${(boxError ?? receiptError)?.message ?? "check your Supabase setup"}`); return; }
    const ids = (receiptRows ?? []).map((row) => row.id);
    const { data: itemRows, error: itemError } = ids.length ? await supabase.from("line_items").select("*").in("receipt_id", ids).order("position") : { data: [], error: null };
    if (itemError) { notify(`Couldn’t load receipt items: ${itemError.message}`); return; }
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const item of itemRows ?? []) grouped.set(item.receipt_id, [...(grouped.get(item.receipt_id) ?? []), item]);
    setBoxes((boxRows ?? []) as Box[]);
    setReceipts((receiptRows ?? []).map((row: Record<string, unknown>) => ({ ...row, line_items: grouped.get(row.id as string) ?? [] })) as Receipt[]);
    setSelectedBox((current) => boxRows?.some((box) => box.id === current)
      ? current
      : (boxRows?.[0] as Box | undefined)?.id ?? "");
  }, [supabase, notify]);

  useEffect(() => {
    if (!supabase) return;
    void loadAccount();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setAuthMode("update-password"); setScreen("auth"); }
      if (session?.user) { setUserEmail(session.user.email); setIsDemo(false); window.setTimeout(() => void loadAccount(), 0); }
      else { setIsDemo(true); setUserEmail(undefined); setBoxes(demoBoxes); setReceipts(demoReceipts); }
    });
    return () => subscription.unsubscribe();
  }, [supabase, loadAccount]);

  useEffect(() => {
    let active = true;
    if (showOriginal && selectedReceipt?.original_image_url && supabase && !isDemo) {
      void supabase.storage.from("receipt-originals").createSignedUrl(selectedReceipt.original_image_url, 3600)
        .then(({ data }) => { if (active) setOriginalSignedUrl(data?.signedUrl ?? ""); });
    } else setOriginalSignedUrl("");
    return () => { active = false; };
  }, [showOriginal, selectedReceipt, supabase, isDemo]);

  const monthReceipts = useMemo(() => receipts.filter((receipt) => receipt.date.slice(0, 7) === month), [receipts, month]);
  const sortedRecentReceipts = useMemo(() => [...receipts]
    .sort((a, b) => addedAtDate(b).getTime() - addedAtDate(a).getTime()), [receipts]);
  const recentReceipts = sortedRecentReceipts.slice(0, 5);
  const recentYears = [...new Set(sortedRecentReceipts.map((receipt) => String(addedAtDate(receipt).getFullYear())))].sort((a, b) => b.localeCompare(a));
  const recentMonths = [...new Set(sortedRecentReceipts.filter((receipt) => recentYear === "all" || String(addedAtDate(receipt).getFullYear()) === recentYear).map((receipt) => dateMonthKey(addedAtDate(receipt))))].sort((a, b) => b.localeCompare(a));
  const visibleRecentReceipts = sortedRecentReceipts.filter((receipt) => {
    const added = addedAtDate(receipt);
    const addedMonth = dateMonthKey(added);
    const yearMatches = recentYear === "all" || String(added.getFullYear()) === recentYear;
    const monthMatches = recentMonth === "all" || addedMonth === recentMonth;
    const boxName = boxes.find((box) => box.id === receipt.box_id)?.name ?? "Unfiled";
    const searchable = [receipt.merchant, boxName, receipt.notes, receipt.payment_method, receipt.category, receipt.currency, receipt.date, added.toLocaleDateString(), addedMonth, receipt.subtotal, receipt.tax, receipt.total, formatMoney(receipt.subtotal, receipt.currency), formatMoney(receipt.tax, receipt.currency), formatMoney(receipt.total, receipt.currency), ...receipt.line_items.map((item) => item.description), ...receipt.line_items.map((item) => item.quantity), ...receipt.line_items.map((item) => item.amount)].join(" ").toLocaleLowerCase();
    return yearMatches && monthMatches && searchable.includes(recentQuery.trim().toLocaleLowerCase());
  });
  const activeBox = boxes.find((box) => box.id === selectedBox) ?? boxes[0];
  useEffect(() => { setBoxReceiptYear("all"); setBoxReceiptMonth("all"); }, [activeBox?.id]);
  const boxReceipts = monthReceipts.filter((receipt) => receipt.box_id === activeBox?.id);
  const boxAllReceipts = receipts.filter((receipt) => receipt.box_id === activeBox?.id).sort((a, b) => b.date.localeCompare(a.date));
  const boxReceiptYears = [...new Set(boxAllReceipts.map((receipt) => receipt.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const boxReceiptMonths = [...new Set(boxAllReceipts.filter((receipt) => boxReceiptYear === "all" || receipt.date.startsWith(`${boxReceiptYear}-`)).map((receipt) => receipt.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  const visibleBoxReceipts = boxAllReceipts.filter((receipt) => (boxReceiptYear === "all" || receipt.date.startsWith(`${boxReceiptYear}-`)) && (boxReceiptMonth === "all" || receipt.date.startsWith(boxReceiptMonth)));
  const boxIDRTotal = boxReceipts.filter((receipt) => receipt.currency === "IDR").reduce((sum, receipt) => sum + receipt.total, 0);

  const openAuth = (mode: AuthMode = "signin") => { setAuthMode(mode); setScreen("auth"); setModal(null); };
  const leaveAuth = () => setScreen("drawer");
  function openRecentReceipts() { setRecentQuery(""); setRecentYear("all"); setRecentMonth("all"); setScreen("recent"); }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { notify("Add your Supabase keys to .env.local to enable account access."); return; }
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")); const password = String(data.get("password") ?? "");
    setAuthBusy(true);
    setAuthError(""); setAuthNotice("");
    try {
      if (authMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
        if (error) throw error;
        setAuthNotice("Check your email for a password reset link."); return;
      }
      if (authMode === "update-password") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setAuthNotice("Password updated. You’re signed in."); setScreen("drawer"); void loadAccount(); return;
      }
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (authMode === "signup" && !result.data.session) { setAuthNotice("Check your email to confirm your account, then sign in."); setAuthMode("signin"); return; }
      setScreen("drawer"); notify(authMode === "signup" ? "Your new drawer is ready." : "Welcome back to your drawer."); void loadAccount();
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Could not complete that account request."); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUserEmail(undefined); setIsDemo(true); setBoxes(demoBoxes); setReceipts(demoReceipts); setScreen("drawer"); notify("Signed out.");
  }

  async function runOCR(path: string): Promise<ExtractedReceiptDraft> {
    if (!supabase) throw new Error("Receipt scanning needs a configured Supabase project.");
    const { data, error } = await supabase.functions.invoke("extract-receipt", { body: { path } });
    if (error) {
      const context = error.context;
      if (context instanceof Response) {
        const body = await context.clone().json().catch(() => null) as { error?: string } | null;
        if (body?.error) throw new Error(body.error);
      }
      throw error;
    }
    if (!data?.draft) throw new Error(data?.error || "No receipt details were found. Enter the details by hand.");
    return data.draft as ExtractedReceiptDraft;
  }

  async function useFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setAuthError("");
    if (!/^image\/(jpeg|png|webp)$/.test(nextFile.type) && nextFile.type !== "application/pdf") { setOcrError("Choose a JPG, PNG, WebP photo, or PDF."); setOcrState("error"); return; }
    if (nextFile.size > 20 * 1024 * 1024) { setOcrError("This file is over 20 MB. Choose a smaller photo or PDF."); setOcrState("error"); return; }
    if (!supabase || isDemo) { openAuth("signin"); return; }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(nextFile); setFileUrl(nextFile.type.startsWith("image/") ? URL.createObjectURL(nextFile) : ""); setOcrState("uploading"); setOcrError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your session expired. Sign in again, then choose the file again.");
      const safeName = nextFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("receipt-originals").upload(path, nextFile, { upsert: false, contentType: nextFile.type });
      if (uploadError) throw uploadError;
      setOriginalPath(path); setOcrState("extracting");
      const extracted = await runOCR(path);
      setDraft((prior) => extractionToDraft(extracted, prior, boxes)); setOcrState("ready");
    } catch (error) { setOcrError(error instanceof Error ? error.message : "The scan could not be read. You can enter it by hand."); setOcrState("error"); }
  }
  async function retryOCR() {
    if (!supabase || !originalPath) { if (file) await useFile(file); return; }
    setOcrState("extracting"); setOcrError("");
    try {
      const extracted = await runOCR(originalPath);
      setDraft((prior) => extractionToDraft(extracted, prior, boxes)); setOcrState("ready");
    } catch (error) { setOcrError(error instanceof Error ? error.message : "The scan could not be read. You can enter it by hand."); setOcrState("error"); }
  }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) { void useFile(event.target.files?.[0]); event.target.value = ""; }

  function openScan() {
    if (isDemo) { openAuth("signin"); notify("Sign in to add receipts to your drawer."); return; }
    setFile(null); setFileUrl(""); setDraft(blankReceiptDraft(activeBox)); setEditorReceiptId(null); setOriginalPath(null); setOcrState("idle"); setOcrError(""); setModal("scan");
  }

  function editReceipt(receipt: Receipt) { setDraft(receiptToDraft(receipt)); setEditorReceiptId(receipt.id); setOriginalPath(receipt.original_image_url); setFile(null); setFileUrl(""); setOcrState("idle"); setSelectedReceipt(null); setModal("scan"); }

  async function saveReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDemo || !supabase) { notify("Sign in to save a receipt to your drawer."); return; }
    if (!draft.merchant.trim() || !draft.total) { notify("Add a merchant and total to continue."); return; }
    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in again to save this receipt.");
      const total = Number(draft.total); const chosenBox = boxes.find((box) => box.id === draft.box_id);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^[A-Z]{3}$/.test(draft.currency.toUpperCase()) || !Number.isFinite(total) || total < 0) throw new Error("Check the receipt date, three-letter currency, and total.");
      const payload = { ...(editorReceiptId ? { id: editorReceiptId } : {}), merchant: draft.merchant.trim(), date: draft.date, currency: draft.currency.toUpperCase(), subtotal: Number(draft.subtotal || 0), tax: Number(draft.tax || 0), total, payment_method: draft.payment_method, category: chosenBox?.name ?? "Unfiled", box_id: chosenBox?.id ?? null, original_image_url: originalPath, confidence: draft.confidence, notes: draft.notes };
      const items = draft.line_items.filter((item) => item.description.trim() || item.amount !== "").map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity || 1), amount: Number(item.amount || 0), confidence: item.confidence }));
      const { data: savedId, error } = await supabase.rpc("save_receipt_with_items", { p_receipt: payload, p_items: items });
      if (error) throw error;
      if (!savedId) throw new Error("The receipt was not saved. Please try again.");
      await loadAccount(); setModal(null); setFile(null); setFileUrl(""); setOriginalPath(null); setEditorReceiptId(null); setOcrState("idle"); notify(editorReceiptId ? "Receipt changes saved." : "Receipt tucked into your drawer.");
    } catch (error) { notify(error instanceof Error ? error.message : "Couldn’t save this receipt."); }
    finally { setSaving(false); }
  }

  async function deleteReceipt(receipt: Receipt) {
    if (!supabase || isDemo) return;
    const { error } = await supabase.from("receipts").delete().eq("id", receipt.id);
    if (error) { notify(error.message); return; }
    if (receipt.original_image_url) await supabase.storage.from("receipt-originals").remove([receipt.original_image_url]);
    setReceipts((prior) => prior.filter((item) => item.id !== receipt.id)); setSelectedReceipt(null); notify("Receipt removed.");
  }

  async function saveBox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (isDemo || !supabase) { notify("Sign in to organize your boxes."); return; }
    const name = draftBoxName.trim(); if (!name) return;
    const payload = { user_id: (await supabase.auth.getUser()).data.user?.id, name, illustration: draftIllustration, color: draftColor, budget: draftBudget ? Number(draftBudget) : null, sort_order: draftOrder };
    const query = editingBox ? supabase.from("boxes").update(payload).eq("id", editingBox.id).select().single() : supabase.from("boxes").insert(payload).select().single();
    const { data, error } = await query;
    if (error) { notify(error.message); return; }
    const reordered = [...boxes.filter((box) => box.id !== (editingBox?.id ?? (data as Box).id))];
    reordered.splice(Math.max(0, Math.min(draftOrder, reordered.length)), 0, data as Box);
    const savedOrder = reordered.map((box, index) => ({ ...box, sort_order: index }));
    await Promise.all(savedOrder.map((box) => supabase.from("boxes").update({ sort_order: box.sort_order }).eq("id", box.id)));
    setBoxes(savedOrder);
    if (!editingBox) setSelectedBox((data as Box).id);
    setModal(null); setEditingBox(null); notify(editingBox ? "Box updated." : "A new little box, ready for receipts.");
  }

  async function deleteBox(box: Box) {
    if (!supabase || isDemo) return;
    const { error: unfileError } = await supabase.from("receipts").update({ box_id: null, category: "Unfiled" }).eq("box_id", box.id);
    if (unfileError) { notify(unfileError.message); return; }
    const { error } = await supabase.from("boxes").delete().eq("id", box.id);
    if (error) { notify(error.message); return; }
    setBoxes((prior) => prior.filter((item) => item.id !== box.id)); setReceipts((prior) => prior.map((receipt) => receipt.box_id === box.id ? { ...receipt, box_id: "", category: "Unfiled" } : receipt)); setModal(null); setEditingBox(null);
    if (selectedBox === box.id) setSelectedBox(boxes.find((item) => item.id !== box.id)?.id ?? ""); notify("Box removed.");
  }

  async function moveReceipt(receipt: Receipt, boxId: string) {
    const destination = boxes.find((box) => box.id === boxId); if (!destination) return;
    if (isDemo || !supabase) { notify("This sample drawer is just for browsing."); return; }
    const { error } = await supabase.from("receipts").update({ box_id: destination.id, category: destination.name }).eq("id", receipt.id);
    if (error) { notify(error.message); return; }
    setReceipts((prior) => prior.map((item) => item.id === receipt.id ? { ...item, box_id: destination.id, category: destination.name } : item));
    setSelectedReceipt((prior) => prior?.id === receipt.id ? { ...receipt, box_id: destination.id, category: destination.name } : prior); notify(`Moved to ${destination.name}.`);
  }

  function exportCSV() {
    if (!monthReceipts.length) { notify("There are no receipts to export for this month yet."); return; }
    const csv = ["Date,Merchant,Box,Subtotal,Tax,Total,Currency,Payment,Notes", ...monthReceipts.map((receipt) => [receipt.date, receipt.merchant, boxes.find((box) => box.id === receipt.box_id)?.name ?? "Unfiled", receipt.subtotal, receipt.tax, receipt.total, receipt.currency, receipt.payment_method, receipt.notes].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `drawer-${month}.csv`; link.click(); URL.revokeObjectURL(link.href); notify("Your receipt list is ready to download.");
  }
  function exportBoxCSV() {
    if (!activeBox || !boxAllReceipts.length) { notify("There are no receipts in this box to export yet."); return; }
    const csv = ["Date,Merchant,Box,Subtotal,Tax,Total,Currency,Payment,Notes", ...boxAllReceipts.map((receipt) => [receipt.date, receipt.merchant, activeBox.name, receipt.subtotal, receipt.tax, receipt.total, receipt.currency, receipt.payment_method, receipt.notes].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
    const slug = activeBox.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "box";
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `${slug}-receipts.csv`; link.click(); URL.revokeObjectURL(link.href); notify("Your box receipts are ready to download.");
  }
  function printBox() {
    document.body.classList.add("printing-roll");
    const clean = () => document.body.classList.remove("printing-roll");
    window.addEventListener("afterprint", clean, { once: true });
    window.print(); window.setTimeout(clean, 1500);
  }

  function changeMonth(step: number) { const next = new Date(`${month}-15T12:00:00`); next.setMonth(next.getMonth() + step); setMonth(next.toISOString().slice(0, 7)); }
  function openProfile() { setSelectedReceipt(null); setScreen("profile"); }
  function openBoxEditor(box?: Box) { setEditingBox(box ?? null); setDraftBoxName(box?.name ?? ""); setDraftBudget(box?.budget ? String(box.budget) : ""); setDraftIllustration(box?.illustration && box.illustration.length <= 4 ? box.illustration : (box?.illustration === "tomato" ? "🍅" : box?.illustration === "cup" ? "☕" : box?.illustration === "fork" ? "🍴" : box?.illustration === "car" ? "🚕" : box?.illustration === "flower" ? "🌼" : "📦")); setDraftColor(box?.color ?? "cream"); setDraftOrder(box ? Math.max(0, boxes.findIndex((item)=>item.id===box.id)) : boxes.length); setModal("box"); }

  function renderBoxCard(box: Box, index: number) {
    const contents = monthReceipts.filter((receipt) => receipt.box_id === box.id);
    return <motion.button key={box.id} className="box-card" data-tone={box.color || ["sage","cream","pink","blue","yellow"][index%5]} onClick={()=>{setSelectedBox(box.id);setScreen("box");setSelectedReceipt(null);}} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const receipt=receipts.find((item)=>item.id===event.dataTransfer.getData("text/plain"));if(receipt)void moveReceipt(receipt,box.id);}} whileTap={{scale:.985}} aria-label={`${box.name} box, ${formatTotals(contents)}`}>
      {contents.slice(0,2).map((receipt,i)=><div className={`mini-slip ${i===0?"a":"b"}`} key={receipt.id}><b>{receipt.merchant}</b><span>{formatDay(receipt.date)} AUG</span><b style={{marginTop:5}}>{formatMoney(receipt.total, receipt.currency)}</b><i/></div>)}
      <span className="box-object">{box.illustration==="tomato"?"🍅":box.illustration==="cup"?"☕":box.illustration==="fork"?"🍴":box.illustration==="car"?"🚕":box.illustration==="flower"?"🌼":box.illustration||"📦"}</span>
      <span className="box-info"><span className="box-info-name">{box.name}</span><strong>{formatTotals(contents)}</strong><span className="box-info-count">×{contents.length}</span></span>
    </motion.button>;
  }

  if (screen === "auth") return <AuthScreen mode={authMode} setMode={setAuthMode} busy={authBusy} configured={!!supabase} onSubmit={handleAuth} onBack={leaveAuth} notice={authNotice} error={authError} />;

  return <main className="app-shell">
    {screen === "drawer" && <div className="drawer-sticky-header"><header className="topbar no-print">
      <div className="email-avatar" role="img" aria-label={userEmail ? `Avatar for ${emailName(userEmail)}` : "Sample drawer avatar"} title={userEmail ? emailName(userEmail) : "Sample drawer"}>{emailName(userEmail) ? emailName(userEmail).slice(0, 3).toUpperCase() : "A"}</div>
      <div className="header-brand"><button className="icon-btn profile-trigger" onClick={openProfile} aria-label="Open profile"><UserRound size={17}/></button></div>
    </header>

    <section className="page-head no-print">
      <div className="month-overview"><p className="month-year">{month.slice(0, 4)}</p><div className="month-switch"><button onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16}/></button><h1>{monthName(month).split(" ")[0]}</h1><button onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={16}/></button></div><p className="subhead">{monthReceipts.length} {monthReceipts.length === 1 ? "receipt" : "receipts"} in {isDemo ? "the drawer" : "your drawer"}</p></div>
      <button className="primary-btn desktop-add-receipt" onClick={openScan}><Plus size={16}/> Add receipt</button>
    </section></div>}

    {screen === "boxes" ? <section className="boxes-page">
      <nav className="detail-navbar boxes-navbar"><button className="detail-nav-back" onClick={() => setScreen("drawer")} aria-label="Back to the drawer"><ChevronLeft size={22}/></button><h1 className="detail-nav-title">Boxes</h1><div className="detail-nav-actions"><button className="detail-nav-menu" onClick={()=>isDemo?openAuth("signup"):openBoxEditor()} aria-label="Add a box" title="Add a box"><Plus size={21}/></button></div></nav>
      <div className="boxes-page-content"><p className="boxes-page-count">{boxes.length} {boxes.length===1?"box":"boxes"}</p><div className="box-grid all-boxes-grid">{boxes.length ? boxes.map(renderBoxCard) : <EmptyState kind="boxes" title="Your boxes are waiting" copy="Give your receipts a place to land by creating your first box." className="boxes-empty-state"/>}</div></div>
    </section> : screen === "recent" ? <section className="recent-page">
      <nav className="detail-navbar recent-navbar"><button className="detail-nav-back" onClick={() => setScreen("drawer")} aria-label="Back to the drawer"><ChevronLeft size={22}/></button><h1 className="detail-nav-title">Recently added</h1><span aria-hidden="true"/></nav>
      <div className="recent-page-content">
        <div className="recent-page-controls">
          <p className="recent-results-count">{visibleRecentReceipts.length} {visibleRecentReceipts.length === 1 ? "receipt" : "receipts"}</p>
          <label className="recent-search-field"><Search size={16}/><span className="sr-only">Search receipts</span><input type="search" value={recentQuery} onChange={(event)=>setRecentQuery(event.target.value)} placeholder="Search receipts, items, amounts…"/><button type="button" onClick={()=>setRecentQuery("")} aria-label="Clear search" hidden={!recentQuery}><X size={15}/></button></label>
          <div className="recent-date-filters">
            <label className="box-month-filter"><span className="sr-only">Filter by month added</span><select aria-label="Filter receipts by added month" value={recentMonth} onChange={(event)=>setRecentMonth(event.target.value)}><option value="all">All months</option>{recentMonths.map((value)=><option key={value} value={value}>{new Date(`${value}-15T12:00:00`).toLocaleDateString("en",{month:"long"})}</option>)}</select><ChevronDown size={14}/></label>
            <label className="box-year-filter"><span className="sr-only">Filter by year added</span><select aria-label="Filter receipts by added year" value={recentYear} onChange={(event)=>{setRecentYear(event.target.value);setRecentMonth("all");}}><option value="all">All years</option>{recentYears.map((year)=><option key={year} value={year}>{year}</option>)}</select></label>
          </div>
        </div>
        <div className="recent-page-list">
          {visibleRecentReceipts.length ? visibleRecentReceipts.map((receipt)=>{const added=addedAtDate(receipt);return <div key={receipt.id} className="receipt-row" onClick={()=>{setSelectedReceipt(receipt);setShowOriginal(false);}} role="button" tabIndex={0} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedReceipt(receipt);setShowOriginal(false);}}}>
            <span className="date-chip"><small>{added.toLocaleDateString("en",{month:"short"})}</small>{String(added.getDate()).padStart(2,"0")}</span><span style={{minWidth:0}}><span className="merchant-name" style={{display:"block"}}>{receipt.merchant}</span><span className="merchant-meta">{boxes.find((box)=>box.id===receipt.box_id)?.name??"Unfiled"}</span></span><span className="receipt-amount">{formatMoney(receipt.total, receipt.currency)}</span>
          </div>;}):receipts.length?<div className="recent-no-results"><EmptyState kind="receipts" title="No receipts match" copy="Try another search or change the date filters." className="recent-empty-state"/><button className="subtle-link" onClick={()=>{setRecentQuery("");setRecentYear("all");setRecentMonth("all");}}>Clear search and filters</button></div>:<EmptyState kind="receipts" title="No receipts yet" copy="Your new receipts will appear here after you add one." className="recent-empty-state"/>}
        </div>
      </div>
    </section> : screen === "profile" ? <section className="profile-page">
      <nav className="detail-navbar profile-navbar"><button className="detail-nav-back" onClick={() => setScreen("drawer")} aria-label="Back to the drawer"><ChevronLeft size={22}/></button><h1 className="detail-nav-title">Profile</h1><span aria-hidden="true"/></nav>
      <div className="profile-card">
        <div className="profile-avatar">{emailName(userEmail) ? emailName(userEmail).slice(0, 3).toUpperCase() : "A"}</div>
        <p className="eyebrow">your profile</p><h1>{emailName(userEmail) || "Guest"}</h1>
        <p className="profile-email">{userEmail || "Sample drawer · browse before signing in"}</p>
        {isDemo ? <div className="profile-actions"><button className="primary-btn" onClick={() => openAuth("signin")}><LogIn size={15}/> Sign in</button><button className="secondary-btn" onClick={() => openAuth("signup")}>Create an account</button></div> : <button className="secondary-btn profile-signout" onClick={() => void signOut()}><LogOut size={15}/> Sign out</button>}
      </div>
    </section> : screen==="print-preview"&&activeBox?<section className="print-preview-page">
      <nav className="detail-navbar preview-navbar"><button className="detail-nav-back" onClick={()=>setScreen("box")} aria-label="Back to box"><ChevronLeft size={22}/></button></nav>
      <div className="print-preview-content"><ReceiptSlipList receipts={boxAllReceipts}/><button className="primary-btn preview-print-button no-print" onClick={printBox}><FileText size={15}/> Print roll</button></div>
    </section> : screen==="box"&&activeBox?<section className="box-detail-page">
      <nav className="detail-navbar"><button className="detail-nav-back" onClick={()=>setScreen("drawer")} aria-label="Back to drawer"><ChevronLeft size={22}/></button><h1 className="detail-nav-title" title={activeBox.name}>{activeBox.name}</h1><div className="detail-nav-actions"><div className="box-menu-wrap"><button className="detail-nav-menu" aria-label="Box actions" aria-haspopup="menu" aria-expanded={boxMenuOpen} onClick={()=>setBoxMenuOpen((open)=>!open)}><MoreVertical size={20}/></button>{boxMenuOpen&&<div className="box-actions-menu" role="menu"><button role="menuitem" onClick={()=>{setBoxMenuOpen(false);setScreen("print-preview");}}><FileText size={14}/> Preview print roll</button>{!isDemo&&<button role="menuitem" onClick={()=>{setBoxMenuOpen(false);openBoxEditor(activeBox);}}><Pencil size={14}/> Edit box</button>}</div>}</div></div></nav>
      <div className="box-detail-layout"><div><div className="box-detail-scene" data-tone={activeBox.color}><span className="big-object">{activeBox.illustration==="tomato"?"🍅":activeBox.illustration==="cup"?"☕":activeBox.illustration==="fork"?"🍴":activeBox.illustration==="car"?"🚕":activeBox.illustration==="flower"?"🌼":activeBox.illustration||"📦"}</span><div className="detail-stamp">{activeBox.name}<strong>{formatTotals(boxAllReceipts)}</strong><small>×{boxAllReceipts.length} little things</small></div><div className="detail-paper-stack">{boxAllReceipts.slice(0,4).map((receipt,index)=><button key={receipt.id} className={`detail-mini-paper dm-${index}`} onClick={()=>setSelectedReceipt(receipt)}><b>{receipt.merchant}</b><span>{formatShortDate(receipt.date)}</span><strong>{formatMoney(receipt.total, receipt.currency)}</strong></button>)}</div></div>{activeBox.budget&&<div className="budget-note"><span>This month’s IDR budget</span><span>{formatIDR(boxIDRTotal)} of {formatIDR(activeBox.budget)}</span><div className="budget-track"><i style={{width:`${Math.min(100,Math.round(boxIDRTotal/activeBox.budget*100))}%`}}/></div></div>}<div className="box-export-row no-print"><button className="box-export-btn" onClick={exportBoxCSV} disabled={!boxAllReceipts.length}><ArrowDownToLine size={15}/> Export box to CSV</button></div></div>
        <div className="summary-column"><div className="box-receipts-heading"><div><h2>Receipts</h2><p>{visibleBoxReceipts.length} {visibleBoxReceipts.length === 1 ? "receipt" : "receipts"}</p></div><div className="box-receipt-filters"><label className="box-month-filter"><span className="sr-only">Filter by month</span><select aria-label="Filter receipts by month" value={boxReceiptMonth} onChange={(event)=>setBoxReceiptMonth(event.target.value)}><option value="all">All months</option>{boxReceiptMonths.map((value)=><option key={value} value={value}>{new Date(`${value}-15T12:00:00`).toLocaleDateString("en",{month:"long"})}</option>)}</select><ChevronDown size={14}/></label><label className="box-year-filter"><span className="sr-only">Filter by year</span><select aria-label="Filter receipts by year" value={boxReceiptYear} onChange={(event)=>{setBoxReceiptYear(event.target.value);setBoxReceiptMonth("all");}}><option value="all">All Years</option>{boxReceiptYears.map((year)=><option key={year} value={year}>{year}</option>)}</select></label></div></div><ReceiptSlipList receipts={visibleBoxReceipts} onReceiptClick={setSelectedReceipt}/></div>
      </div>
    </section>:<div className="home-grid">
      <section>
        <div className="drawer-hero" aria-label="A little cardboard box with receipts resting on a green gingham tablecloth">
          <div className="box-scene">
            {monthReceipts.slice(0,5).map((receipt,index)=><div className={`scene-paper paper-${index+1}`} key={receipt.id}><b>{receipt.merchant}</b><small>{formatDay(receipt.date)} AUG</small><span>{formatMoney(receipt.total, receipt.currency)}</span><span className="tiny-barcode" style={{display:"block",background:"repeating-linear-gradient(90deg,#282720 0 2px,transparent 2px 4px,#282720 4px 5px,transparent 5px 8px)"}}/></div>)}
            <div className="box-stamp">{monthName(month).split(" ")[0]}<strong>{formatTotals(monthReceipts)}</strong></div><div className="scene-heart">♡</div>
          </div>
        </div>
        <div className="hero-caption"><button className="box-export-btn home-export-btn" onClick={exportCSV}><ArrowDownToLine size={15}/> Export drawer</button></div>

        <div className="section-title"><h2>The boxes</h2><div className="box-section-actions"><button className="subtle-link" onClick={()=>{setSelectedReceipt(null);setScreen("boxes");}}>See All</button></div></div>
        <div className="box-grid">
          {boxes.length ? boxes.slice(0, 4).map(renderBoxCard) : <EmptyState kind="boxes" title="Your boxes are waiting" copy="Give your receipts a place to land by creating your first box." className="boxes-empty-state"/>}
        </div>
      </section>

      <aside className="right-panel no-print">
        <div className="panel-card">
          <div className="panel-heading"><h2>Recently added</h2><button className="subtle-link recent-see-all" onClick={openRecentReceipts}>See all</button></div>
          <div className="receipt-list">
            {recentReceipts.length ? recentReceipts.map((receipt)=><div key={receipt.id} className="receipt-row" draggable={!isDemo} onDragStart={(event)=>event.dataTransfer.setData("text/plain",receipt.id)} onClick={()=>{setSelectedReceipt(receipt);setShowOriginal(false);}} role="button" tabIndex={0} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedReceipt(receipt);setShowOriginal(false);}}}>
              <span className="date-chip"><small>{new Date(`${receipt.date}T12:00:00`).toLocaleDateString("en",{month:"short"})}</small>{formatDay(receipt.date)}</span><span style={{minWidth:0}}><span className="merchant-name" style={{display:"block"}}>{receipt.merchant}</span><span className="merchant-meta">{boxes.find((box)=>box.id===receipt.box_id)?.name??"Unfiled"}</span></span><span className="receipt-amount">{formatMoney(receipt.total, receipt.currency)}</span>
            </div>):<EmptyState kind="receipts" title="No receipts yet" copy="Your newest receipts will show up here after you add one." className="recent-empty-state"/>}
          </div>
        </div>
        {isDemo&&<div style={{marginTop:12,padding:"13px 14px",border:"1px solid var(--line)",borderRadius:9,background:"#f4f3ed",fontSize:11,color:"#85847b",lineHeight:1.6}}><Sparkles size={14} style={{verticalAlign:"-3px",marginRight:5,color:"#71866d"}}/> Looking around? This sample drawer is just for browsing. <button onClick={()=>openAuth("signup")} style={{border:0,background:"none",color:"var(--green)",fontWeight:700,padding:0}}>Make one of your own →</button></div>}
      </aside>
    </div>}

    <div className="monthly-print-roll"><div className="paper-slip"><div className="paper-head"><b>{(userEmail?.split("@")[0]||"DRAWER").toUpperCase()} — MONTHLY ROLL</b><small>{monthName(month).toUpperCase()}</small></div><div className="paper-rule"/>{monthReceipts.map((receipt)=><div className="paper-line" key={receipt.id}><span>{formatDay(receipt.date)}</span><span>{receipt.merchant} · {boxes.find((box)=>box.id===receipt.box_id)?.name??"Unfiled"}</span><span>{formatMoney(receipt.total, receipt.currency)}</span></div>)}<div className="paper-total"><span>{monthReceipts.length} RECEIPTS</span><span>{formatTotals(monthReceipts)}</span></div><div className="barcode"/></div></div>

    {screen !== "print-preview"&&<button className="mobile-scan no-print" onClick={openScan}><Plus size={19}/> Add a receipt</button>}
    <input ref={fileInput} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={chooseFile}/>

    <AnimatePresence>{modal&&<div className="modal-backdrop no-print" onMouseDown={(event)=>{if(event.target===event.currentTarget){setModal(null);setFile(null);}}}>
      <motion.section className="modal" initial={{opacity:0,y:20,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10,scale:.98}} transition={{duration:.18}} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {modal==="box"&&<div className="modal-head"><div><h2 id="modal-title">Make a new box</h2><p>A home for one of your everyday things.</p></div><button className="close-btn" onClick={()=>setModal(null)} aria-label="Close"><X size={17}/></button></div>}
        {modal==="scan"?<ReceiptEditor draft={draft} onChange={setDraft} onSubmit={saveReceipt} onChooseFile={()=>fileInput.current?.click()} onDropFile={(nextFile)=>void useFile(nextFile)} onManual={()=>setOcrState("ready")} onRetry={()=>void retryOCR()} onClose={()=>{setModal(null);setFile(null);setFileUrl("");}} boxes={boxes} ocrState={ocrState} ocrError={ocrError} fileName={file?.name ?? ""} fileUrl={fileUrl} saving={saving} editing={!!editorReceiptId}/>:<form onSubmit={saveBox}><div className="form-grid"><div className="field full"><label>What’s it for?</label><input value={draftBoxName} onChange={(e)=>setDraftBoxName(e.target.value)} placeholder="A little something…" required autoFocus/></div><div className="field"><label>Your little sticker</label><select value={draftIllustration} onChange={(e)=>setDraftIllustration(e.target.value)}>{["📦","🍅","☕","🍴","🚕","🌼","🧺","🪴","📚","🎟️"].map((emoji)=><option key={emoji}>{emoji}</option>)}</select></div><div className="field"><label>Box tint</label><select value={draftColor} onChange={(e)=>setDraftColor(e.target.value)}>{[["cream","Warm paper"],["sage","Quiet sage"],["pink","Dusty rose"],["blue","Soft blue"],["yellow","Honey" ]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>Monthly budget · IDR</label><input type="number" min="0" value={draftBudget} onChange={(e)=>setDraftBudget(e.target.value)} placeholder="No budget needed"/></div><div className="field"><label>Place in the drawer</label><select value={draftOrder} onChange={(e)=>setDraftOrder(Number(e.target.value))}>{Array.from({length:boxes.length+(editingBox?0:1)},(_,index)=><option key={index} value={index}>{index+1}{index===0?"st":index===1?"nd":index===2?"rd":"th"} in the drawer</option>)}</select></div></div><div className="modal-actions">{editingBox?<button type="button" className="secondary-btn" style={{color:"#9b7362"}} onClick={()=>setPendingDelete({kind:"box",box:editingBox})}><Trash2 size={14}/> Delete box</button>:<span/>}<button type="submit" className="primary-btn"><Check size={15}/> {editingBox?"Save changes":"Make my box"}</button></div></form>}
      </motion.section>
    </div>}</AnimatePresence>

    <AnimatePresence>{selectedReceipt&&<div className="modal-backdrop no-print" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelectedReceipt(null);}}><motion.section className="modal detail-modal" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} role="dialog" aria-modal="true" aria-label={`${selectedReceipt.merchant} receipt`}>
      <div className="modal-head detail-modal-head"><button className="close-btn" onClick={()=>setSelectedReceipt(null)} aria-label="Close"><X size={17}/></button></div>
      <div className="paper-slip"><div className="paper-head"><b>{selectedReceipt.merchant}</b><small>{new Date(`${selectedReceipt.date}T12:00:00`).toLocaleDateString("en",{day:"numeric",month:"long",year:"numeric"})} · {selectedReceipt.currency}</small></div><div className="paper-rule"/>{selectedReceipt.line_items.map((item)=><div className="paper-line" key={item.id}><span>{item.quantity.toString().padStart(2,"0")}</span><span>{item.description}</span><span>{formatMoney(item.amount, selectedReceipt.currency)}</span></div>)}<div className="paper-line"><span/><span>Subtotal</span><span>{formatMoney(selectedReceipt.subtotal, selectedReceipt.currency)}</span></div><div className="paper-line"><span/><span>Tax</span><span>{formatMoney(selectedReceipt.tax, selectedReceipt.currency)}</span></div><div className="paper-line" style={{border:0,color:"#85847b"}}><span/><span>Paid with {selectedReceipt.payment_method}</span><span/></div><div className="paper-total"><span>TOTAL</span><span>{formatMoney(selectedReceipt.total, selectedReceipt.currency)}</span></div><div className="barcode"/></div>
      {selectedReceipt.notes&&<p style={{fontSize:12,color:"#7d7c74",margin:"0 4px 14px",textAlign:"center"}}>“{selectedReceipt.notes}”</p>}
      {!isDemo&&<div className="move-row"><label htmlFor="move-box">Tuck into</label><select id="move-box" value={selectedReceipt.box_id} onChange={(event)=>void moveReceipt(selectedReceipt,event.target.value)}>{boxes.map((box)=><option key={box.id} value={box.id}>{box.name}</option>)}</select></div>}
      {!isDemo&&<div className="modal-actions"><button className="secondary-btn" onClick={()=>setPendingDelete({kind:"receipt",receipt:selectedReceipt})}><Trash2 size={14}/> Delete</button><button className="primary-btn" onClick={()=>editReceipt(selectedReceipt)}><Pencil size={14}/> Edit receipt</button></div>}
      <button className="toggle-original" onClick={()=>setShowOriginal(!showOriginal)}><FileImage size={14}/>{showOriginal?"Hide original":"View original"}<ChevronDown size={13} style={{transform:showOriginal?"rotate(180deg)":undefined}}/></button>
      {showOriginal&&<div className="original-preview">{originalSignedUrl?<img style={{maxWidth:"100%",maxHeight:260,objectFit:"contain"}} src={originalSignedUrl} alt="Original receipt"/>:selectedReceipt.original_image_url?<span>Opening your original…</span>:<span>No original scan attached to this receipt.</span>}</div>}
    </motion.section></div>}</AnimatePresence>
    <AnimatePresence>{pendingDelete&&<div className="modal-backdrop no-print delete-confirm-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setPendingDelete(null);}}><motion.section className="delete-confirm-dialog" initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:.98}} role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-copy">
      <div className="delete-confirm-icon"><Trash2 size={19}/></div><h2 id="delete-confirm-title">{pendingDelete.kind==="receipt"?"Delete this receipt?":"Delete this box?"}</h2><p id="delete-confirm-copy">{pendingDelete.kind==="receipt"?<>“{pendingDelete.receipt.merchant}” and its saved receipt details will be permanently removed.</>:<>“{pendingDelete.box.name}” will be removed. Receipts inside it will become unfiled.</>}</p>
      <div className="delete-confirm-actions"><button className="secondary-btn" onClick={()=>setPendingDelete(null)}>Cancel</button><button className="danger-btn" onClick={()=>{const target=pendingDelete;setPendingDelete(null);if(target.kind==="receipt")void deleteReceipt(target.receipt);else void deleteBox(target.box);}}>Delete {pendingDelete.kind}</button></div>
    </motion.section></div>}</AnimatePresence>
    {toast&&<div className="toast" role="status">{toast}</div>}
  </main>;
}

function AuthScreen({mode,setMode,busy,configured,onSubmit,onBack,notice,error}:{mode:AuthMode;setMode:(mode:AuthMode)=>void;busy:boolean;configured:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;onBack:()=>void;notice:string;error:string}) {
  const title = mode === "signin" ? "Welcome back." : mode === "signup" ? "Make a little room." : mode === "reset" ? "Find your way back." : "Choose a new password.";
  const passwordMode = mode !== "reset";
  return <main className="auth-shell"><aside className="auth-aside"><button className="brand" onClick={onBack}><span className="brand-mark"><BoxIcon size={17}/></span>drawer</button><div className="auth-copy"><h1>Money stuff,<br/>made a little softer.</h1><p>Receipts have a home here. Come as you are, tuck them away, and get on with your day.</p></div><span className="auth-foot">A little room for real life · IDR</span></aside><section className="auth-main"><form className="auth-form" onSubmit={onSubmit}><button type="button" className="subtle-link" onClick={onBack} style={{padding:0,marginBottom:25}}><ArrowLeft size={13} style={{verticalAlign:"-2px",marginRight:4}}/> back to the sample drawer</button><h2>{title}</h2><p>{mode==="signin"?"Your receipts are right where you left them.":mode==="signup"?"Your own little home for receipts and everyday things.":mode==="reset"?"We’ll send a secure password reset link to your email.":"Use at least 6 characters for your new password."}</p><div className="field"><label>Email</label><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={mode==="update-password"}/></div>{passwordMode&&<div className="field"><label>New password</label><input name="password" type="password" autoComplete={mode==="signin"?"current-password":"new-password"} minLength={6} placeholder="At least 6 characters" required/></div>}<button className="primary-btn" type="submit" disabled={busy||!configured}>{busy?<span className="loading-dot"/>:mode==="signin"?<LogIn size={16}/>:<ArrowRight size={16}/>} {busy?"Just a moment…":mode==="signin"?"Sign in":mode==="signup"?"Create my drawer":mode==="reset"?"Send reset link":"Update password"}</button>{mode==="signin"&&<div className="auth-switch"><button type="button" onClick={()=>setMode("reset")}>Forgot your password?</button></div>}{(mode==="signin"||mode==="signup")&&<div className="auth-switch">{mode==="signin"?"New around here?":"Already have a drawer?"} <button type="button" onClick={()=>setMode(mode==="signin"?"signup":"signin")}>{mode==="signin"?"Make an account":"Sign in"}</button></div>}{error&&<div className="auth-note auth-error" role="alert">{error}</div>}{notice&&<div className="auth-note" role="status">{notice}</div>}{!configured&&<div className="auth-note">Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart the app to enable sign-in.</div>}{mode!=="update-password"&&<div className="auth-note">Your drawer starts with nothing in it. Add just what you need, whenever you’re ready.</div>}</form></section></main>;
}

function ReceiptSlipList({receipts,onReceiptClick}:{receipts:Receipt[];onReceiptClick?:(receipt:Receipt)=>void}) {
  const orderedReceipts = [...receipts].sort((a,b) =>
    a.merchant.localeCompare(b.merchant, undefined, {sensitivity:"base"}) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );

  if (!orderedReceipts.length) return <div className="receipt-slip-list"><EmptyState kind="box" title="Nothing tucked in here yet" copy="The first receipt you add to this box will show up here." className="box-receipts-empty"/></div>;

  return <div className="receipt-slip-list">{orderedReceipts.map((receipt) => {
    const content = <><div className="paper-head"><b>{receipt.merchant}</b><small>{formatShortDate(receipt.date)} · {receipt.currency}</small></div><div className="paper-rule"/>
      {receipt.line_items.map((item) => <div className="paper-line" key={item.id}><span>{item.quantity.toString().padStart(2,"0")}</span><span>{item.description}</span><span>{formatMoney(item.amount,receipt.currency)}</span></div>)}
      {!receipt.line_items.length&&<div className="empty-note receipt-no-items">No line items on this receipt.</div>}
      <div className="paper-total"><span>TOTAL</span><span>{formatMoney(receipt.total,receipt.currency)}</span></div></>;
    return onReceiptClick
      ? <button type="button" className="paper-slip box-receipt-slip" key={receipt.id} onClick={()=>onReceiptClick(receipt)} aria-label={`Open ${receipt.merchant} receipt from ${formatShortDate(receipt.date)}`}>{content}</button>
      : <article className="paper-slip box-receipt-slip" key={receipt.id}>{content}</article>;
  })}</div>;
}

function EmptyState({kind,title,copy,className=""}:{kind:EmptyIllustrationKind;title:string;copy:string;className?:string}) {
  return <div className={`empty-state ${className}`}><EmptyStateIllustration kind={kind}/><h3>{title}</h3><p>{copy}</p></div>;
}
