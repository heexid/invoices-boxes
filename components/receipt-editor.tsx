"use client";

import { ArrowDown, ArrowUp, Check, FileText, ImagePlus, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { NumericFormat } from "react-number-format";
import { calculateReceiptTotals } from "@/lib/receipt-draft";
import type { Box, ReceiptDraft } from "@/lib/types";

export type OCRState = "idle" | "uploading" | "extracting" | "ready" | "error";

const currencies = [
  ["IDR", "IDR · Indonesian rupiah"],
  ["MYR", "MYR · Malaysian ringgit"],
  ["SGD", "SGD · Singapore dollar"],
  ["USD", "USD · US dollar"],
] as const;
const paymentMethods = ["QRIS", "Card", "Debit"];

export function ReceiptEditor({
  draft, onChange, onSubmit, onChooseFile, onDropFile, onManual, onRetry, onClose,
  boxes, ocrState, ocrError, fileName, fileUrl, saving, editing,
}: {
  draft: ReceiptDraft;
  onChange: (draft: ReceiptDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChooseFile: () => void;
  onDropFile: (file: File) => void;
  onManual: () => void;
  onRetry: () => void;
  onClose: () => void;
  boxes: Box[];
  ocrState: OCRState;
  ocrError: string;
  fileName: string;
  fileUrl: string;
  saving: boolean;
  editing: boolean;
}) {
  const hasDraft = editing || ocrState === "ready" || ocrState === "error" || draft.merchant.length > 0 || draft.line_items.length > 0;
  const precision = draft.currency === "IDR" ? 0 : 2;
  // Legacy IDR receipts can have fractional unit prices after dividing their
  // saved line totals by quantity. Keep that precision when the receipt edits.
  const unitPricePrecision = draft.currency === "IDR" ? 8 : precision;
  const totals = calculateReceiptTotals(draft);
  const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: draft.currency || "IDR", maximumFractionDigits: precision }).format(Number.isFinite(value) ? value : 0);
  const fieldConfidence = (key: string) => draft.confidence[key] ?? 1;
  const inputClass = (key: string) => fieldConfidence(key) < 0.7 ? "field low-confidence" : "field";
  const update = (key: "merchant" | "date" | "currency" | "payment_method" | "notes", value: string) => onChange({ ...draft, [key]: value });
  const updateItem = (id: string, key: "description" | "quantity" | "amount", value: string) => onChange({ ...draft, line_items: draft.line_items.map((item) => item.id === id ? { ...item, [key]: value } : item) });
  const moveItem = (index: number, step: number) => {
    const next = [...draft.line_items]; const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...draft, line_items: next });
  };
  const addItem = () => onChange({ ...draft, line_items: [...draft.line_items, { id: crypto.randomUUID(), description: "", quantity: "1", amount: "", confidence: 1 }] });
  const activePaymentIsCustom = !!draft.payment_method && !paymentMethods.includes(draft.payment_method);

  return <section className="receipt-editor" aria-labelledby="modal-title">
    <div className="modal-head"><div><h2 id="modal-title">{editing ? "A little receipt, tidied up" : "A new little receipt"}</h2><p>{editing ? "Change whatever needs changing." : "Scan a receipt or pop the details in yourself."}</p></div><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
    {!editing&&<>
      {fileName ? <div className="upload-preview">{fileUrl?<img src={fileUrl} alt="Selected receipt preview"/>:<><FileText size={25}/><span>{fileName}</span></>}</div> : <button type="button" className="upload-zone" onClick={onChooseFile} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const uploaded=event.dataTransfer.files?.[0];if(uploaded)onDropFile(uploaded);}}>
        <span className="upload-icon"><ImagePlus size={23}/></span><b>Drop your receipt right in</b><span>Take a photo or choose a photo or PDF</span><span className="secondary-btn" style={{marginTop:6,fontSize:11}}><Upload size={14}/> Choose a file</span>
      </button>}
      <div className="ocr-status" aria-live="polite">
        {(ocrState === "uploading" || ocrState === "extracting")&&<><LoaderCircle className="spin-icon" size={15}/><span>{ocrState === "uploading" ? "Tucking your original away…" : "Reading the little details…"}</span></>}
        {ocrState === "ready"&&<><Check size={15}/><span>Here’s what we found. Have a little look before saving.</span></>}
        {ocrState === "error"&&<><span>{ocrError || "The scan didn’t come through. You can enter the details by hand."}</span>{fileName&&<button type="button" className="subtle-link" onClick={onRetry}>Try again</button>}</>}
      </div>
      {!hasDraft&&<button type="button" className="manual-entry-link" onClick={onManual}>Or enter a receipt by hand <span>→</span></button>}
    </>}

    {hasDraft&&<form onSubmit={onSubmit}>
      <div className="form-grid receipt-form-grid">
        <div className={`${inputClass("merchant")} full`}><label className="required">Merchant name</label><input value={draft.merchant} onChange={(e)=>update("merchant",e.target.value)} placeholder="Where was this from?" required autoFocus/><small>{fieldConfidence("merchant")<0.7?"A quick check might help":""}</small></div>
        <div className={inputClass("date")}><label className="required">Date</label><input type="date" value={draft.date} onChange={(e)=>update("date",e.target.value)} required/></div>
        <div className={inputClass("currency")}><label className="required">Currency</label><select value={draft.currency} onChange={(e)=>update("currency",e.target.value)} required>{currencies.map(([code,label])=><option key={code} value={code}>{label}</option>)}{!currencies.some(([code])=>code===draft.currency)&&<option value={draft.currency}>{draft.currency}</option>}</select></div>
        <div className="field"><label>Tuck it into</label><select value={draft.box_id} onChange={(e)=>onChange({...draft,box_id:e.target.value,category:boxes.find(box=>box.id===e.target.value)?.name??"Unfiled"})}><option value="">Unfiled</option>{boxes.map((box)=><option key={box.id} value={box.id}>{box.name}</option>)}</select></div>
        <div className="field"><label>Paid with</label><select value={draft.payment_method} onChange={(e)=>update("payment_method",e.target.value)}><option value="">Choose a payment method</option>{paymentMethods.map((method)=><option key={method} value={method}>{method}</option>)}{activePaymentIsCustom&&<option value={draft.payment_method}>{draft.payment_method} · saved value</option>}</select></div>
        <fieldset className="tax-field full">
          <label className="tax-toggle"><input type="checkbox" checked={draft.tax_enabled} onChange={(e)=>onChange({...draft,tax_enabled:e.target.checked})}/><span className="tax-check"><Check size={12}/></span><span>Add tax</span></label>
          {draft.tax_enabled&&<div className="tax-input-row">
            <label className="required tax-mode-label" htmlFor="tax-mode-input">Tax</label>
            <select id="tax-mode-input" value={draft.tax_mode} onChange={(e)=>onChange({...draft,tax_mode:e.target.value as "amount"|"percent"})} aria-label="Tax calculation type"><option value="amount">Amount</option><option value="percent">Percentage</option></select>
            <NumericFormat className="tax-number-input" value={draft.tax_input} valueIsNumericString thousandSeparator="." decimalSeparator="," decimalScale={draft.tax_mode === "percent" ? 2 : precision} allowNegative={false} inputMode="decimal" suffix={draft.tax_mode === "percent" ? "%" : undefined} aria-label={draft.tax_mode === "percent" ? "Tax percentage" : `Tax amount in ${draft.currency}`} required onValueChange={({value})=>onChange({...draft,tax_input:value})}/>
          </div>}
        </fieldset>
        <div className="field full"><label>A little note</label><textarea value={draft.notes} onChange={(e)=>update("notes",e.target.value)} placeholder="Anything you’d like to remember"/></div>
      </div>

      <div className="item-editor-heading"><div><h3>Line items</h3><p>Prices are per item; quantity is included in the subtotal.</p></div><button type="button" className="secondary-btn" onClick={addItem}><Plus size={14}/> Add item</button></div>
      <div className="line-item-editor">
        {draft.line_items.map((item,index)=><div className="line-item-edit-row" key={item.id}>
          <div className={item.confidence<0.7?"field low-confidence":"field"}><label className="required">Item</label><input aria-label={`Item ${index+1} name`} value={item.description} onChange={(e)=>updateItem(item.id,"description",e.target.value)} placeholder="What was it?" required/></div>
          <div className="field qty-field"><label className="required">Qty</label><input aria-label={`Item ${index+1} quantity`} type="number" min="0.01" step="any" value={item.quantity} onChange={(e)=>updateItem(item.id,"quantity",e.target.value)} required/></div>
          <div className={item.confidence<0.7?"field low-confidence":"field"}><label className="required">Price</label><NumericFormat aria-label={`Item ${index+1} price`} value={item.amount} valueIsNumericString thousandSeparator="." decimalSeparator="," decimalScale={unitPricePrecision} allowNegative={false} inputMode="decimal" onValueChange={({value})=>updateItem(item.id,"amount",value)} placeholder="0" required/></div>
          <div className="item-row-actions"><button type="button" onClick={()=>moveItem(index,-1)} disabled={index===0} aria-label={`Move item ${index+1} up`}><ArrowUp size={14}/></button><button type="button" onClick={()=>moveItem(index,1)} disabled={index===draft.line_items.length-1} aria-label={`Move item ${index+1} down`}><ArrowDown size={14}/></button><button type="button" onClick={()=>onChange({...draft,line_items:draft.line_items.filter((candidate)=>candidate.id!==item.id)})} aria-label={`Remove item ${index+1}`}><Trash2 size={14}/></button></div>
        </div>)}
      </div>

      <div className="paper-slip preview-paper"><div className="paper-head"><b>{draft.merchant||"your receipt"}</b><small>{draft.date} · {draft.currency||"IDR"}</small></div><div className="paper-rule"/>{draft.line_items.filter((item)=>item.description||item.amount).map((item)=><div className="paper-line" key={item.id}><span>{String(item.quantity||1).padStart(2,"0")}</span><span>{item.description||"A little something"}</span><span>{money((Number(item.quantity)||0)*(Number(item.amount)||0))}</span></div>)}<div className="paper-line"><span/><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>{draft.tax_enabled&&<div className="paper-line"><span/><span>Tax{draft.tax_mode === "percent"&&draft.tax_input?` · ${draft.tax_input}%`:""}</span><span>{money(totals.tax)}</span></div>}<div className="paper-total"><span>TOTAL</span><span>{money(totals.total)}</span></div><div className="barcode"/></div>
      <div className="modal-actions receipt-submit-actions"><span className="receipt-required-note"><i/> Required field</span><button className="primary-btn" type="submit" disabled={saving||ocrState==="uploading"||ocrState==="extracting"}>{saving?<LoaderCircle className="spin-icon" size={15}/>:<Check size={15}/>} {saving?"Saving your receipt…":editing?"Save changes":"Save receipt"}</button></div>
    </form>}
  </section>;
}
