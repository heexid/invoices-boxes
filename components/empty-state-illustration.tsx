"use client";

export type EmptyIllustrationKind = "box" | "boxes" | "receipts";

const labels: Record<EmptyIllustrationKind, string> = {
  box: "An open cardboard box waiting for a receipt",
  boxes: "A pair of empty cardboard receipt boxes",
  receipts: "A few blank paper receipts",
};

export function EmptyStateIllustration({kind}:{kind:EmptyIllustrationKind}) {
  return <svg className={`empty-state-art empty-state-art-${kind}`} viewBox="0 0 160 112" role="img" aria-label={labels[kind]}>
    <ellipse cx="80" cy="99" rx="57" ry="7" fill="#4b38271a"/>
    {kind === "box" && <>
      <path d="M27 47 78 26l55 20-53 23z" fill="#d3a477" stroke="#9b7049" strokeWidth="2"/>
      <path d="m27 47 53 22v26L27 72z" fill="#b98254" stroke="#9b7049" strokeWidth="2"/>
      <path d="m80 69 53-23v26L80 95z" fill="#a97249" stroke="#8e6342" strokeWidth="2"/>
      <path d="m48 55 31 13v14L48 69z" fill="#fffdf7" stroke="#d9d3c8"/>
      <path d="M56 62 72 69M56 67 72 74M56 72 66 76" stroke="#807d73" strokeWidth="2" strokeLinecap="round"/>
      <path d="m22 43 30-15 15 6-31 15zM101 32l18-8 19 9-18 8z" fill="#e3bd96" stroke="#aa7b51" strokeWidth="2"/>
    </>}
    {kind === "boxes" && <>
      <path d="m22 53 38-17 40 16-39 18z" fill="#d8ad82" stroke="#9b7049" strokeWidth="2"/>
      <path d="m22 53 39 17v23L22 76z" fill="#b98254" stroke="#9b7049" strokeWidth="2"/>
      <path d="m61 70 39-18v24L61 93z" fill="#a97249" stroke="#8e6342" strokeWidth="2"/>
      <path d="m67 36 29-13 32 13-31 15z" fill="#e2bc94" stroke="#9b7049" strokeWidth="2"/>
      <path d="m67 36 30 15v21L67 58z" fill="#c89363" stroke="#9b7049" strokeWidth="2"/>
      <path d="m97 51 31-15v22L97 72z" fill="#b17b50" stroke="#8e6342" strokeWidth="2"/>
      <path d="M79 46v17M39 63v15" stroke="#e8c8a3" strokeWidth="3" opacity=".85"/>
    </>}
    {kind === "receipts" && <>
      <path d="m43 22 8 4 8-4 8 4 8-4 8 4 8-4 8 4 8-4v67l-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4z" fill="#fffef9" stroke="#d6d0c5" strokeWidth="2"/>
      <path d="M58 39h43M58 47h31M58 55h39" stroke="#c6c0b4" strokeWidth="3" strokeLinecap="round"/>
      <path d="M58 68h39v15H58z" fill="url(#receipt-bars)"/>
      <path d="M110 31c0-7 10-8 12-1 3-7 13-6 13 2 0 7-13 15-13 15s-12-8-12-16" fill="#b77e58"/>
      <defs><pattern id="receipt-bars" width="7" height="15" patternUnits="userSpaceOnUse"><path d="M1 0v15M4 0v15" stroke="#39362f" strokeWidth="2"/></pattern></defs>
    </>}
  </svg>;
}
