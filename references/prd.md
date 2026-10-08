# Drawer Product Requirements

## Summary

Drawer is a personal receipt tracker that turns receipts into editable digital paper slips organized in cardboard-style boxes. It should make capturing and revisiting everyday spending feel calm rather than punitive.

## Users and problem

People who want a lightweight record of everyday purchases need to save receipts, find details later, and understand totals without maintaining a spreadsheet. Drawer gives each receipt a home and keeps the original scan available when one exists.

## Product goals

- Capture a receipt from a phone camera, photo, or PDF and extract useful receipt fields.
- Let users review, correct, and manually enter receipt information and line items.
- Organize receipts into user-managed boxes and browse a monthly drawer.
- Keep private receipt records and original files isolated by account.
- Make common actions work in a mobile-first interface at all viewport sizes.

## Core experience

1. A visitor without a session sees login or registration. A new account starts with an empty drawer.
2. After successful registration, the app signs out the created session, shows a short success screen, then returns to login. Email confirmation must be disabled in the linked Supabase project.
3. A signed-in user opens the scan/add action, chooses a camera photo, image, or PDF, and reviews editable extracted data. Manual receipt entry is also supported.
4. The user enters merchant, date, currency, payment method, notes, box, and line items. Subtotal and total are calculated from line items; tax is optional.
5. Saved receipts appear in the selected box and drawer, can be edited or deleted, and can be moved between boxes.

## Functional requirements

### Authentication and account

- Support email/password registration, sign-in, persistent sessions, password reset/update, and sign-out through Supabase Auth. Direct registration requires Supabase Email Confirm Email to be disabled.
- Show an account profile using a name derived from the first segment of the email address.
- Require a valid session to open drawer data; never load guest or bundled receipt data.

### Drawer homepage

- Default the month and year to the current local month; allow month navigation across year boundaries.
- Show the selected month’s receipt count and IDR/mixed-currency total without converting currencies.
- Show four box cards initially and link to a dedicated page listing every box.
- Show at most five recently created receipts, using creation time and falling back to receipt date when unavailable.
- Keep the homepage header full-width across the centered phone-width canvas; open receipt details as an overlay so closing one returns to the same drawer view.
- Provide CSV export for the current drawer month. Do not show homepage search, box filter, or PDF controls.
- Provide empty states for boxes and recent receipts when those sections have no content.

### Boxes and box details

- Create, rename, reorder, and delete boxes. Box data includes name, illustration, tint, optional monthly IDR budget, sort order, and creation time.
- Show the box name, total, and receipt count in a full-width warm-paper summary strip. Use type size and color for hierarchy rather than bold weights: total is largest/darkest, merchant/name is medium-weight context, and count is smaller/muted.
- Allow receipts to be filed into or moved between boxes.
- Show box receipts as independent slips with their line items and individual total; do not nest a receipt inside an aggregate receipt.
- Provide month and year filters for box receipts, defaulted to all months and all years, and display the matching receipt count.
- Provide CSV export for every receipt in the current box.
- Provide an empty state for a box with no receipts. Print preview shows the receipt slips in a print-friendly single column.
- Preserve the current box and page after receipt save when the selected box still exists.

### Receipt capture and editing

- Accept camera images, uploaded images, and PDFs in supported browsers.
- Store original files in the private Supabase Storage bucket `receipt-originals`.
- Call the authenticated `extract-receipt` Supabase Edge Function for OpenAI Vision extraction. Keep the OpenAI key in Function secrets, not the browser.
- Extract merchant, date, currency, subtotal, tax, total, payment method, notes/category when available, and ordered line items with confidence cues.
- Let users add, edit, remove, and reorder line items and manually create a receipt without OCR.
- If extraction fails or a file is unreadable, show a recovery message without discarding the editable draft.

### Data, privacy, and exports

- Persist receipts, line items, and boxes in Supabase Postgres. Save receipt and line-item updates atomically.
- Enforce per-account access with row-level security. A user can only access their own records and originals.
- Default new receipts to IDR but retain each receipt’s currency. Display totals grouped by currency without exchange-rate conversion.
- Export drawer-month and box receipts to CSV. Support print preview for receipt slips and monthly receipt summary.

## Out of scope for the current release

- Learned categorization, duplicate detection, and advanced confidence analytics.
- Currency conversion, charts, or an insights dashboard.
- A separate desktop dashboard or wider desktop-only information architecture.
- Fully offline synchronization or native mobile applications.

## Acceptance criteria

- Visitors without a session see login or registration; signed-in accounts load only their own data.
- Users can register, sign in, remain signed in after refresh, reset their password, and sign out.
- Users can upload an image/PDF, review and edit extraction, save it, reload the app, and find the same receipt and line items.
- Users can create and edit receipts manually, move them between boxes, edit box details, and delete records.
- Box filters, month browsing, CSV downloads, and print preview work in the centered phone-width layout.
- Cross-account reads, writes, and original-file access are denied by Supabase policies.

## Measures of success

- A first-time signed-in user can save a manually entered or scanned receipt without losing the draft on extraction failure.
- A saved receipt remains available after reload and can be found from its assigned box.
- Empty account states communicate what the user can do next without clutter or judgmental language.
