# Drawer Project Context

## Current product decisions

- The original brief proposed a responsive desktop dashboard. Later product direction chose the mobile layout at every viewport size: center the app in a canvas capped at 480px, with no separate desktop layout.
- The app opens to login or registration when there is no active Supabase session. A signed-in account loads only its own data; a new account starts empty.
- The homepage shows four boxes initially with a See All link to the dedicated all-boxes page, and lists up to five recently added receipts with a See All link to the searchable/filterable recent-receipts page. The homepage has no search/filter or PDF control; CSV export is available.
- The drawer header spans the centered canvas while its controls align with the content inset. Homepage receipt details open as an overlay without changing the active drawer screen.
- The drawer month stamp, box-card summaries, and box-detail summary use matching full-width warm-paper strips. Summary hierarchy comes from size and tone, not bold weight: total is largest/darkest, name is medium-weight, and count is smaller/muted.
- Box details show a cardboard box scene, CSV export, receipt count, and independent receipt slips. Month/year filters start at “All months” and “All Years.” Print preview is single-column.
- The profile is reached from the drawer header. The box detail header has a back icon, truncated title, and overflow menu. The receipt action stays available as a floating button.
- Preserve the selected box across account reloads when that box still exists; saving a receipt should not move the user to another box detail page.
- The homepage opens on the current local month and year. New receipts default to IDR; saved receipts retain their currency and mixed-currency totals are not converted.

## Architecture

- **Framework:** Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4. Main application interaction is in the client component `app/page.tsx`.
- **Styling and motion:** `app/globals.css` contains the design tokens and responsive styles. Framer Motion handles light interaction transitions; Lucide React supplies interface icons.
- **Components:** `components/receipt-editor.tsx` handles editable receipt capture/review; `components/empty-state-illustration.tsx` provides inline SVG empty-state artwork.
- **Data and types:** `lib/types.ts` defines `Receipt`, `LineItem`, `ReceiptDraft`, `ExtractedReceiptDraft`, and `Box`. `lib/data.ts` supplies currency/date formatting helpers. `lib/receipt-draft.ts` maps persisted and extracted receipt data into the editor draft.
- **Backend:** `lib/supabase.ts` creates the browser Supabase client. Supabase Auth handles email/password accounts; Postgres stores boxes, receipts, and line items; Storage holds private originals.
- **OCR:** `supabase/functions/extract-receipt/index.ts` is the authenticated Edge Function that validates receipt ownership and calls OpenAI Vision for structured extraction. Configure `OPENAI_API_KEY` as a Supabase Function secret.

## Data and security model

- `boxes` belong to an authenticated user and include name, illustration, color, optional budget, sort order, and creation timestamp.
- `receipts` belong to a user and include merchant, date, currency, monetary totals, payment method, category, optional box, original storage path, confidence data, notes, and creation timestamp.
- `line_items` belong to a receipt and user and include description, quantity, amount, order/position, and optional confidence.
- RLS policies isolate each user’s boxes, receipts, and line items. Receipt writes validate that any selected box belongs to the same user.
- Original files stay in the private `receipt-originals` bucket with storage policies scoped to the authenticated user’s folder.
- `save_receipt_with_items` performs receipt and line-item persistence transactionally. Keep database changes additive and preserve existing user data.

## Important flows

- **Account load:** fetch the current user’s boxes and receipts, then line items for the returned receipt IDs; map rows into typed application records. Preserve the selected box if it remains present.
- **Authentication:** visitors without a session see login/registration. Registration must return a Supabase session; the app signs that session out, displays success briefly, then returns to login. If signup returns no session, show guidance to disable Confirm Email in the linked Supabase project.
- **New receipt:** initialize a draft from the active box, optionally upload the source and run OCR, edit the draft, then call `save_receipt_with_items` and refresh account data.
- **OCR failure:** keep the user’s draft and source available for manual correction or retry; show a clear error.
- **Box receipt filtering:** derive available years/months from receipts in the active box; default both selectors to “all.”

## Local development

- Use Node.js 20.9 or newer; `.nvmrc` pins Node 24.
- Install with `pnpm install`, copy `.env.example` to `.env.local`, configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then run `pnpm dev`.
- Apply `supabase/schema.sql` for a new database. For an already initialized database, use the additive migrations under `supabase/migrations/`.
- Deploy the `extract-receipt` Edge Function and set its OpenAI key in Supabase Function secrets to enable OCR.
- Supabase Auth redirect settings must include the local app URL and production origin. Disable **Confirm Email** under Authentication → Providers → Email for direct registration; the linked project’s setting is managed in the Supabase Dashboard, not by the checked-in function config.

## Known limitations

- OCR is a starting point and requires user review; it is not a guarantee of accurate extraction.
- Learned categorization, duplicate detection, and currency conversion are not part of the current product.
- The UI is intentionally phone-width even on desktop. It is not a desktop dashboard.
