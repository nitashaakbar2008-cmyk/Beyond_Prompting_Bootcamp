-- Lumière Books shared database (Supabase / PostgreSQL). Run once in the Supabase SQL Editor.
-- Customer/order data is private: the public (anon) role cannot read it. See docs/database-setup.md.
create table if not exists public.products(
  id text primary key, title text not null, author text not null, category text not null,
  price_pkr integer not null check(price_pkr>0), original_price_pkr integer,
  short_description text, description text, rating numeric(2,1), review_count integer not null default 0,
  stock_quantity integer not null default 0 check(stock_quantity>=0), is_available boolean not null default true,
  isbn text, publisher text, publication_year integer, pages integer, language text,
  is_featured boolean not null default false, is_bestseller boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.customers(
  id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email)),
  name text not null, phone text, city text, address text, postal_code text, internal_notes text,
  created_at timestamptz not null default now());
create table if not exists public.orders(
  id text primary key, customer_id uuid references public.customers(id),
  status text not null default 'Pending' check(status in ('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled')),
  payment_method text not null default 'Cash on Delivery (demo)',
  subtotal_pkr integer not null default 0, delivery_pkr integer not null default 0, total_pkr integer not null default 0,
  ship_name text, ship_phone text, ship_address text, ship_city text, ship_postal text,
  customer_notes text, internal_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.order_items(
  id bigserial primary key, order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null, title text not null,
  unit_price_pkr integer not null, quantity integer not null check(quantity>0));
create table if not exists public.inquiries(
  id text primary key default ('INQ-'||upper(substr(md5(random()::text),1,8))),
  inquiry_type text not null check(inquiry_type in ('Complaint','Suggestion','General inquiry','Order-related inquiry')),
  name text not null check(char_length(name) between 2 and 100), email text not null check(char_length(email) between 5 and 200),
  phone text check(char_length(phone)<=40), order_id text, subject text not null check(char_length(subject) between 3 and 200),
  message text not null check(char_length(message) between 10 and 4000),
  status text not null default 'New' check(status in ('New','In Progress','Resolved','Closed')),
  internal_notes text, created_at timestamptz not null default now());
create table if not exists public.reviews(
  id uuid primary key default gen_random_uuid(), product_id text not null references public.products(id) on delete cascade,
  reviewer_name text not null, reviewer_email text not null, rating integer not null check(rating between 1 and 5),
  review_text text not null check(char_length(review_text) between 10 and 2000),
  status text not null default 'Published' check(status in ('Published','Hidden')),
  is_verified boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.newsletter_subscriptions(
  id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email) and char_length(email)<=200),
  status text not null default 'Subscribed' check(status in ('Subscribed','Unsubscribed')), created_at timestamptz not null default now());
create table if not exists public.admins(user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;

-- Public view of published reviews WITHOUT reviewer e-mail addresses.
create or replace view public.public_reviews as
  select id,product_id,reviewer_name,rating,review_text,is_verified,created_at from public.reviews where status='Published';

-- Row Level Security
alter table public.products enable row level security;   alter table public.customers enable row level security;
alter table public.orders enable row level security;     alter table public.order_items enable row level security;
alter table public.inquiries enable row level security;  alter table public.reviews enable row level security;
alter table public.newsletter_subscriptions enable row level security; alter table public.admins enable row level security;
create policy products_public_read on public.products for select to anon,authenticated using(true);
create policy inquiries_public_insert on public.inquiries for insert to anon with check(status='New' and internal_notes is null);
create policy newsletter_public_insert on public.newsletter_subscriptions for insert to anon with check(status='Subscribed');
create policy admin_all_products on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all_customers on public.customers for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all_orders on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all_items on public.order_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all_inquiries on public.inquiries for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all_reviews on public.reviews for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all_newsletter on public.newsletter_subscriptions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_read_admins on public.admins for select to authenticated using(user_id=auth.uid());
revoke all on all tables in schema public from anon,authenticated;
grant select on public.products to anon,authenticated; grant select on public.public_reviews to anon,authenticated;
grant insert on public.inquiries,public.newsletter_subscriptions to anon;
grant select,insert,update,delete on public.products,public.customers,public.orders,public.order_items,public.inquiries,public.reviews,public.newsletter_subscriptions to authenticated;
grant select on public.admins to authenticated; grant usage,select on all sequences in schema public to authenticated;

-- Order status rules (same workflow as the CRM) and restock on cancellation
create or replace function public.enforce_order_status() returns trigger language plpgsql as $$
begin
  if new.status<>old.status then
    if not ((old.status='Pending' and new.status in('Confirmed','Cancelled')) or (old.status='Confirmed' and new.status in('Processing','Cancelled'))
         or (old.status='Processing' and new.status in('Shipped','Cancelled')) or (old.status='Shipped' and new.status='Delivered')) then
      raise exception 'Invalid status change % -> %',old.status,new.status; end if;
    if new.status='Cancelled' then
      update public.products p set stock_quantity=p.stock_quantity+i.quantity from public.order_items i where i.order_id=new.id and i.product_id=p.id; end if;
  end if; new.updated_at=now(); return new; end $$;
drop trigger if exists orders_status_rules on public.orders;
create trigger orders_status_rules before update on public.orders for each row execute function public.enforce_order_status();

-- Atomic checkout. Prices and stock are read from the products table, never trusted from the browser. Server (service role) only.
create or replace function public.place_order(p_order_id text,p_customer jsonb,p_items jsonb,p_notes text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_cid uuid; v_sub integer:=0; v_del integer; v_it jsonb; v_p public.products%rowtype; v_q integer;
begin
  if coalesce(trim(p_customer->>'name'),'')='' or coalesce(p_customer->>'email','') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid customer'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then raise exception 'invalid items'; end if;
  insert into customers(email,name,phone,city,address,postal_code) values(lower(trim(p_customer->>'email')),trim(p_customer->>'name'),p_customer->>'phone',p_customer->>'city',p_customer->>'address',p_customer->>'postal')
    on conflict(email) do update set name=excluded.name,phone=excluded.phone,city=excluded.city,address=excluded.address,postal_code=excluded.postal_code returning id into v_cid;
  insert into orders(id,customer_id,ship_name,ship_phone,ship_address,ship_city,ship_postal,customer_notes)
    values(p_order_id,v_cid,p_customer->>'name',p_customer->>'phone',p_customer->>'address',p_customer->>'city',p_customer->>'postal',left(coalesce(p_notes,''),500));
  for v_it in select * from jsonb_array_elements(p_items) loop
    v_q:=(v_it->>'quantity')::integer; select * into v_p from products where id=v_it->>'product_id' for update;
    if not found or not v_p.is_available or v_q is null or v_q<1 or v_p.stock_quantity<v_q then raise exception 'unavailable: %',v_it->>'product_id'; end if;
    update products set stock_quantity=stock_quantity-v_q,updated_at=now() where id=v_p.id;
    insert into order_items(order_id,product_id,title,unit_price_pkr,quantity) values(p_order_id,v_p.id,v_p.title,v_p.price_pkr,v_q);
    v_sub:=v_sub+v_p.price_pkr*v_q; end loop;
  v_del:=case when v_sub>=5000 then 0 else 250 end;
  update orders set subtotal_pkr=v_sub,delivery_pkr=v_del,total_pkr=v_sub+v_del where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'subtotal_pkr',v_sub,'delivery_pkr',v_del,'total_pkr',v_sub+v_del,'status','Pending');
end $$;
revoke all on function public.place_order(text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.place_order(text,jsonb,jsonb,text) to service_role;
