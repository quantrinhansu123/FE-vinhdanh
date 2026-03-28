-- Chiến dịch marketing + gán TKQC (CRM → Marketing → Chiến dịch)
-- Chạy sau create_tkqc_accounts.sql (cần public.tkqc_accounts)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- marketing_campaigns: một chiến dịch quảng cáo / theo đợt
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  ma_chien_dich text unique,
  ten_chien_dich text not null,
  mo_ta text,
  nen_tang text,
  ngay_bat_dau date,
  ngay_ket_thuc date,
  trang_thai text not null default 'dang_chay'
    check (trang_thai in ('nhap', 'dang_chay', 'tam_dung', 'ket_thuc')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_trang_thai_idx on public.marketing_campaigns (trang_thai);
create index if not exists marketing_campaigns_ten_idx on public.marketing_campaigns (ten_chien_dich);

comment on table public.marketing_campaigns is 'Chiến dịch marketing (Facebook/Google/...)';
comment on column public.marketing_campaigns.ma_chien_dich is 'Mã ngắn (VD: CD-2025-Q1)';
comment on column public.marketing_campaigns.nen_tang is 'Nền tảng: Facebook, Google, TikTok, ...';

-- ---------------------------------------------------------------------------
-- marketing_campaign_tkqc: mỗi dòng = một TKQC tham gia một chiến dịch
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_campaign_tkqc (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns (id) on delete cascade,
  tkqc_account_id uuid not null references public.tkqc_accounts (id) on delete cascade,
  ngan_sach_gan numeric(18, 2) not null default 0 check (ngan_sach_gan >= 0),
  chi_phi_thuc_te numeric(18, 2) not null default 0 check (chi_phi_thuc_te >= 0),
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, tkqc_account_id)
);

create index if not exists marketing_campaign_tkqc_campaign_idx on public.marketing_campaign_tkqc (campaign_id);
create index if not exists marketing_campaign_tkqc_tkqc_idx on public.marketing_campaign_tkqc (tkqc_account_id);

comment on table public.marketing_campaign_tkqc is 'Gán tài khoản TKQC vào chiến dịch (ngân sách / chi phí theo TK)';
comment on column public.marketing_campaign_tkqc.ngan_sach_gan is 'Ngân sách gán cho TK trong chiến dịch (VND)';
comment on column public.marketing_campaign_tkqc.chi_phi_thuc_te is 'Chi phí thực tế theo TK (VND)';

-- updated_at
create or replace function public.marketing_campaigns_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_campaigns_set_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_set_updated_at
before update on public.marketing_campaigns
for each row execute procedure public.marketing_campaigns_set_updated_at();

drop trigger if exists marketing_campaign_tkqc_set_updated_at on public.marketing_campaign_tkqc;
create trigger marketing_campaign_tkqc_set_updated_at
before update on public.marketing_campaign_tkqc
for each row execute procedure public.marketing_campaigns_set_updated_at();

-- RLS
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_tkqc enable row level security;

drop policy if exists "anon can read marketing_campaigns" on public.marketing_campaigns;
drop policy if exists "anon can insert marketing_campaigns" on public.marketing_campaigns;
drop policy if exists "anon can update marketing_campaigns" on public.marketing_campaigns;
drop policy if exists "anon can delete marketing_campaigns" on public.marketing_campaigns;

create policy "anon can read marketing_campaigns" on public.marketing_campaigns for select to anon using (true);
create policy "anon can insert marketing_campaigns" on public.marketing_campaigns for insert to anon with check (true);
create policy "anon can update marketing_campaigns" on public.marketing_campaigns for update to anon using (true) with check (true);
create policy "anon can delete marketing_campaigns" on public.marketing_campaigns for delete to anon using (true);

drop policy if exists "anon can read marketing_campaign_tkqc" on public.marketing_campaign_tkqc;
drop policy if exists "anon can insert marketing_campaign_tkqc" on public.marketing_campaign_tkqc;
drop policy if exists "anon can update marketing_campaign_tkqc" on public.marketing_campaign_tkqc;
drop policy if exists "anon can delete marketing_campaign_tkqc" on public.marketing_campaign_tkqc;

create policy "anon can read marketing_campaign_tkqc" on public.marketing_campaign_tkqc for select to anon using (true);
create policy "anon can insert marketing_campaign_tkqc" on public.marketing_campaign_tkqc for insert to anon with check (true);
create policy "anon can update marketing_campaign_tkqc" on public.marketing_campaign_tkqc for update to anon using (true) with check (true);
create policy "anon can delete marketing_campaign_tkqc" on public.marketing_campaign_tkqc for delete to anon using (true);
