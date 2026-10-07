-- Run in the Supabase SQL editor. Every workspace row belongs to its auth user.
create table if not exists public.boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 48),
  illustration text not null default '📦',
  color text not null default 'cream',
  budget bigint check (budget is null or budget >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merchant text not null,
  date date not null,
  currency text not null default 'IDR',
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  payment_method text not null default '',
  category text not null default 'Unfiled',
  box_id uuid references public.boxes(id) on delete set null,
  original_image_url text,
  confidence jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  amount numeric(14,2) not null default 0,
  position integer not null default 0,
  confidence numeric(4,3) not null default 0
);

create index if not exists receipts_user_date_idx on public.receipts(user_id, date desc);
create index if not exists receipts_box_idx on public.receipts(box_id);
create index if not exists line_items_receipt_idx on public.line_items(receipt_id);
create index if not exists line_items_receipt_position_idx on public.line_items(receipt_id, position);

alter table public.boxes enable row level security;
alter table public.receipts enable row level security;
alter table public.line_items enable row level security;

drop policy if exists "Users manage their boxes" on public.boxes;
create policy "Users manage their boxes" on public.boxes for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage their receipts" on public.receipts;
create policy "Users manage their receipts" on public.receipts for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid() and
  (box_id is null or exists (
    select 1 from public.boxes b where b.id = box_id and b.user_id = auth.uid()
  ))
);

drop policy if exists "Users manage their line items" on public.line_items;
create policy "Users manage their line items" on public.line_items for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid() and exists (
    select 1 from public.receipts r where r.id = receipt_id and r.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('receipt-originals', 'receipt-originals', false)
on conflict (id) do nothing;

drop policy if exists "Users read their original receipts" on storage.objects;
create policy "Users read their original receipts" on storage.objects for select to authenticated
using (bucket_id = 'receipt-originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload their original receipts" on storage.objects;
create policy "Users upload their original receipts" on storage.objects for insert to authenticated
with check (bucket_id = 'receipt-originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their original receipts" on storage.objects;
create policy "Users update their original receipts" on storage.objects for update to authenticated
using (bucket_id = 'receipt-originals' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'receipt-originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their original receipts" on storage.objects;
create policy "Users delete their original receipts" on storage.objects for delete to authenticated
using (bucket_id = 'receipt-originals' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.save_receipt_with_items(p_receipt jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_receipt_id uuid;
  v_box_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_receipt) <> 'object' then raise exception 'Receipt data must be an object' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'Line items must be an array' using errcode = '22023'; end if;
  v_receipt_id := coalesce(nullif(p_receipt->>'id', '')::uuid, gen_random_uuid());
  v_box_id := nullif(p_receipt->>'box_id', '')::uuid;
  if v_box_id is not null and not exists (select 1 from public.boxes where id = v_box_id and user_id = v_user_id) then
    raise exception 'Box is not available to this account' using errcode = '42501';
  end if;
  insert into public.receipts as existing_receipt (id,user_id,merchant,date,currency,subtotal,tax,total,payment_method,category,box_id,original_image_url,confidence,notes)
  values (v_receipt_id,v_user_id,trim(coalesce(p_receipt->>'merchant','')),nullif(p_receipt->>'date','')::date,
    upper(coalesce(nullif(p_receipt->>'currency',''),'IDR')),coalesce(nullif(p_receipt->>'subtotal','')::numeric,0),
    coalesce(nullif(p_receipt->>'tax','')::numeric,0),coalesce(nullif(p_receipt->>'total','')::numeric,0),
    coalesce(p_receipt->>'payment_method',''),coalesce(p_receipt->>'category','Unfiled'),v_box_id,
    nullif(p_receipt->>'original_image_url',''),coalesce(p_receipt->'confidence','{}'::jsonb),coalesce(p_receipt->>'notes',''))
  on conflict (id) do update set merchant=excluded.merchant,date=excluded.date,currency=excluded.currency,subtotal=excluded.subtotal,
    tax=excluded.tax,total=excluded.total,payment_method=excluded.payment_method,category=excluded.category,box_id=excluded.box_id,
    original_image_url=excluded.original_image_url,confidence=excluded.confidence,notes=excluded.notes
  where existing_receipt.user_id=v_user_id;
  if not found then raise exception 'Receipt is not available to this account' using errcode = '42501'; end if;
  delete from public.line_items as li where li.receipt_id=v_receipt_id and li.user_id=v_user_id;
  insert into public.line_items(user_id,receipt_id,description,quantity,amount,position,confidence)
  select v_user_id,v_receipt_id,coalesce(item->>'description',''),coalesce(nullif(item->>'quantity','')::numeric,1),
    coalesce(nullif(item->>'amount','')::numeric,0),ordinal-1,coalesce(nullif(item->>'confidence','')::numeric,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality as rows(item,ordinal);
  return v_receipt_id;
end;
$$;
revoke all on function public.save_receipt_with_items(jsonb,jsonb) from public, anon;
grant execute on function public.save_receipt_with_items(jsonb,jsonb) to authenticated;
