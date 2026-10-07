# Drawer Design System

## Product feel

Drawer should make everyday expense tracking feel gentle, tactile, and easy to return to. Use warm paper and cardboard cues, small playful details, and calm language. Avoid financial shame, alarming colors, dense dashboards, and spreadsheet-like presentation.

## Layout

- Use a mobile-first interface at every viewport size. On wide screens, center the app in a phone-width canvas capped at approximately 480px; do not introduce a separate desktop dashboard.
- Keep screens single-column. Use two columns for box cards and, where space permits, receipt slips in box details. Let narrow content wrap without clipping merchant names or item descriptions.
- Keep the box detail navigation bar sticky, white, and subtly shadowed. Use an icon-only back control, centered truncated box title, and a vertical overflow menu for secondary actions.
- Keep the primary “Add a receipt” action easy to reach as a floating button. Keep export actions full-width and outlined where they sit below a major visual section.

## Visual tokens

The current CSS variables in `app/globals.css` are the source of truth:

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#24251f` | Primary text |
| `--muted` | `#989891` | Supporting text |
| `--paper` | `#fffefa` | Receipt and card surfaces |
| `--canvas` | `#faf9f5` | App background |
| `--green` | `#416b57` | Primary actions and calm accents |
| `--green-light` | `#e8eee8` | Soft green surfaces |
| `--line` | `#e8e6df` | Subtle borders and dividers |
| `--brown` | `#a8764c` | Cardboard accents |

Use brown gradients and inset shadows for cardboard scenes, pale green gingham as a restrained backdrop, and soft neutral shadows to give objects depth. Color tints may distinguish boxes but should remain muted.

## Typography

- Use DM Sans for interface text and friendly, clear headings.
- Use DM Mono for dates, amounts, line items, receipt metadata, and box totals.
- Keep receipt data compact and legible. Use uppercase merchant names on printed-style slips; use normal title casing for interface headings.
- Use sentence case for controls and short, warm microcopy.

## Components and materials

- **Receipt slips:** Warm-white paper with zigzag edges, dashed rules, monospace content, clear totals, and a barcode accent. Each receipt remains its own slip and shows its own items and total.
- **Boxes:** Cardboard-like cards with an inset frame, optional small object illustration, a few receipt previews, name, total, and receipt count.
- **Drawer scene:** Gingham surface behind an open cardboard box with a small set of receipt slips and a month total.
- **Controls:** Rounded, quiet controls with a visible focus ring. Primary actions use green fill; secondary/export actions use a thin neutral outline and white paper surface.
- **Empty states:** Inline illustrations in the same paper/cardboard style, a short heading and helper sentence, and no extra actions beyond the section’s existing create controls.
- **Motion:** Use short, restrained transitions. Receipt and box motion should feel light and physical without delaying actions or making essential content move unexpectedly.

## Interaction and accessibility

- Preserve keyboard access, visible focus states, semantic buttons and labels, and accessible names for icon-only actions.
- Truncate long titles only where space is limited; preserve full names in accessible labels or native titles. Wrap long slip content.
- Provide loading, disabled, success, and error feedback for network actions. Keep receipt drafts intact when OCR fails.
- Never communicate overspending as failure. Budgets use a quiet fill indicator rather than red alerts.

## Copy principles

Use plain, kind, neutral language such as “receipts in your drawer,” “recently added,” and “Nothing tucked in here yet.” Avoid guilt, warnings about normal spending, and dense finance jargon.
