-- Store line item prices as per-unit values while retaining precision when
-- legacy line totals do not divide evenly by quantity.
alter table public.receipts
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists tax_rate numeric(10,4);

update public.receipts
set tax_enabled = tax > 0
where tax > 0 and tax_enabled = false;

alter table public.line_items
  alter column amount type numeric(20,8) using amount::numeric(20,8);

update public.line_items
set amount = amount / quantity
where quantity > 0;

create or replace function public.save_receipt_with_items(p_receipt jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_receipt_id uuid;
  v_box_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_receipt) <> 'object' then
    raise exception 'Receipt data must be an object' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Line items must be an array' using errcode = '22023';
  end if;

  v_receipt_id := coalesce(nullif(p_receipt->>'id', '')::uuid, gen_random_uuid());
  v_box_id := nullif(p_receipt->>'box_id', '')::uuid;
  if v_box_id is not null and not exists (
    select 1 from public.boxes where id = v_box_id and user_id = v_user_id
  ) then
    raise exception 'Box is not available to this account' using errcode = '42501';
  end if;

  insert into public.receipts as existing_receipt (
    id, user_id, merchant, date, currency, subtotal, tax, tax_enabled, tax_rate,
    total, payment_method, category, box_id, original_image_url, confidence, notes
  ) values (
    v_receipt_id,
    v_user_id,
    trim(coalesce(p_receipt->>'merchant', '')),
    nullif(p_receipt->>'date', '')::date,
    upper(coalesce(nullif(p_receipt->>'currency', ''), 'IDR')),
    coalesce(nullif(p_receipt->>'subtotal', '')::numeric, 0),
    coalesce(nullif(p_receipt->>'tax', '')::numeric, 0),
    coalesce(nullif(p_receipt->>'tax_enabled', '')::boolean, false),
    nullif(p_receipt->>'tax_rate', '')::numeric,
    coalesce(nullif(p_receipt->>'total', '')::numeric, 0),
    coalesce(p_receipt->>'payment_method', ''),
    coalesce(p_receipt->>'category', 'Unfiled'),
    v_box_id,
    nullif(p_receipt->>'original_image_url', ''),
    coalesce(p_receipt->'confidence', '{}'::jsonb),
    coalesce(p_receipt->>'notes', '')
  )
  on conflict (id) do update set
    merchant = excluded.merchant,
    date = excluded.date,
    currency = excluded.currency,
    subtotal = excluded.subtotal,
    tax = excluded.tax,
    tax_enabled = excluded.tax_enabled,
    tax_rate = excluded.tax_rate,
    total = excluded.total,
    payment_method = excluded.payment_method,
    category = excluded.category,
    box_id = excluded.box_id,
    original_image_url = excluded.original_image_url,
    confidence = excluded.confidence,
    notes = excluded.notes
  where existing_receipt.user_id = v_user_id;

  if not found then
    raise exception 'Receipt is not available to this account' using errcode = '42501';
  end if;

  delete from public.line_items as li
  where li.receipt_id = v_receipt_id and li.user_id = v_user_id;

  insert into public.line_items (user_id, receipt_id, description, quantity, amount, position, confidence)
  select
    v_user_id,
    v_receipt_id,
    coalesce(item->>'description', ''),
    coalesce(nullif(item->>'quantity', '')::numeric, 1),
    coalesce(nullif(item->>'amount', '')::numeric, 0),
    ordinal - 1,
    coalesce(nullif(item->>'confidence', '')::numeric, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as rows(item, ordinal);

  return v_receipt_id;
end;
$$;

revoke all on function public.save_receipt_with_items(jsonb, jsonb) from public, anon;
grant execute on function public.save_receipt_with_items(jsonb, jsonb) to authenticated;
