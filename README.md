# Drawer

A warm, phone-first receipt drawer with a Supabase-backed personal workspace.

## Run locally

Use Node.js 20.9 or newer (the project is pinned to Node 24 in `.nvmrc`).

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Authentication and a configured Supabase project are required to use the drawer. Add the project credentials before starting the app:

1. Create a Supabase project.
2. Copy its Project URL and anon/public key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. For a new database, run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. For the already initialized database, apply the additive migration at [`supabase/migrations/20261007000000_receipt_editing.sql`](./supabase/migrations/20261007000000_receipt_editing.sql) (or link the project and run `supabase db push`).
4. Set the Supabase Auth Site URL to your production origin and add both `http://localhost:3000/**` and your production origin to the allowed redirect URLs.
5. In the Supabase Dashboard, open **Authentication → Providers → Email** and turn off **Confirm Email**. This app creates accounts without email verification and returns users to the login screen after successful registration. If confirmation is still enabled, registration displays setup guidance instead of a success message.
6. Install the Supabase CLI, link the existing project, and deploy the OCR function:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
   supabase functions deploy extract-receipt
   ```

   The optional `OPENAI_MODEL` function secret can select another Responses API model with image input and structured outputs. The key belongs in Supabase Function secrets only, never in `.env.local` or browser code.
7. Restart the development server.

Visitors without a session are sent to login or registration. New accounts start with an empty drawer. Receipts and uploaded originals are private to the signed-in account.

## What works

- Monthly drawer, month navigation, search and box filter.
- Box detail with a printable receipt roll; CSV export for the current month.
- Email/password registration and sign-in, password reset, persistent sessions, and sign-out through Supabase Auth.
- Authenticated receipt photo/PDF upload and OpenAI Vision extraction, full editable review and manual entry, receipt and item changes, private original viewing, box management, and receipt movement.
- Supabase row-level security for user records and a private Storage bucket for original files.

The extraction function needs the additive migration and an `OPENAI_API_KEY` Supabase Function secret. OCR provides a starting point for review; merchant names, dates, amounts, categories, and line items can all be corrected before or after saving.
