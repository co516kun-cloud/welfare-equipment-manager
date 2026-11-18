-- 個体の完全消去（管理者限定）を DB 側に入れる（2026-11-18・田口さん依頼）
--
-- 目的: 登録ミス・重複で作ってしまった個体（管理番号 1 台ぶん）を、履歴・ラベル印刷キューごと
--       DB から跡形なく消す。消せるのは管理者（田口さんひとり）だけ。アプリの個体詳細画面から呼ぶ。
--       設計書: docs/superpowers/specs/2026-11-18-erase-product-item-design.md
--
-- 影響範囲:
--   1. auth.users — 田口さんのアカウントの raw_app_meta_data に role=admin を足す。他の人は触らない
--   2. 関数 public.is_admin() と public.erase_product_item(text) を新規に作る
--   3. product_items の RLS ポリシーを作り直す。SELECT / INSERT / UPDATE は今までどおり全スタッフ、
--      DELETE だけ管理者限定。アプリ・MCP・スクリプトに product_items を DELETE する経路は無いので
--      既存の機能は壊れない
--   既存の行は 1 行も変更・削除しない。
--
-- ⚠️ 流す前に:
--   - 下の '<田口さんのメールアドレス>' を本人のメールに置き換える。
--     MCP 専用アカウントのメールにしないこと（MCP が管理者になってしまう）
--   - アプリを本番に出す「前」に、Supabase ダッシュボードの SQL Editor で全文を流す。
--     先にアプリが出ると、ボタンを押した瞬間「消去機能が DB 側にまだ入っていません」と出る
-- ⚠️ 流した後:
--   - 田口さんが一度ログインし直すと管理者として効く（app_metadata がログイン情報に乗るのはログイン時）
--   - 末尾の確認クエリ 3 つの結果を見る


-- ============================================================
-- 1. 管理者の付与（田口さんだけ）
-- ============================================================

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = '<田口さんのメールアドレス>';


-- ============================================================
-- 2. 管理者判定。RLS ポリシーと消去関数の両方がこれを見る。
--    将来ほかの管理者限定の操作を足すときもここを使う
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;


-- ============================================================
-- 3. 消去関数。全部消えるか、何も変わらないかのどちらかしか起きない
--    （途中で raise exception すれば、それまでの delete も巻き戻る）
--
--    security definer: 所有者（postgres）として動くので、中の delete は RLS に邪魔されない。
--    その代わり、管理者かどうかはこの関数の先頭で自分で確かめる。
--    エラーはコード文字列だけを返し、日本語への変換はアプリ側（src/lib/erase-product-item.ts）。
-- ============================================================

create or replace function public.erase_product_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status            text;
  v_histories         integer := 0;
  v_label_queue       integer := 0;
  v_preparation_tasks integer := 0;
begin
  -- 1. 管理者だけ
  if not public.is_admin() then
    raise exception 'ERASE_NOT_ADMIN';
  end if;

  -- 2. 個体があるか（この行をロックして、同時に 2 人が消すのを防ぐ）
  select status into v_status
  from product_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'ERASE_NOT_FOUND';
  end if;

  -- 3. 顧客に結び付いたステータスは断る
  --    🔴 src/lib/item-status.ts の ERASE_BLOCKED_STATUSES と同じ並び。片方を変えたらもう片方も
  if v_status in ('rented', 'reserved', 'ready_for_delivery') then
    raise exception 'ERASE_IN_USE';
  end if;

  -- 4. 進行中の発注に割り当てられていれば断る。
  --    配送済み・取り消し済みの明細は見ない（割り当てを外す操作がアプリに無く、ID が残り続けるため）
  if exists (
    select 1
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.assigned_item_ids @> array[p_item_id]
      and coalesce(oi.item_processing_status, '') not in ('delivered', 'cancelled')
      and o.status <> 'cancelled'
  ) then
    raise exception 'ERASE_ASSIGNED';
  end if;

  -- 5. 履歴（写真も Base64 でここに入っている）。外部キーが CASCADE でなくても困らないよう本体より先に
  delete from item_histories where item_id = p_item_id;
  get diagnostics v_histories = row_count;

  -- 6. ラベル印刷キュー（外部キーは無い）
  delete from label_print_queue where item_id = p_item_id;
  get diagnostics v_label_queue = row_count;

  -- 7. 準備タスク。アプリはこのテーブルに書いていないので通常 0 件。
  --    古い行が外部キーで本体の削除を止めるのを防ぐための保険
  delete from preparation_tasks where item_id = p_item_id;
  get diagnostics v_preparation_tasks = row_count;

  -- 8. 本体
  delete from product_items where id = p_item_id;

  -- 9. 何件消えたかを返す（アプリの完了メッセージに使う）
  return jsonb_build_object(
    'histories',         v_histories,
    'label_queue',       v_label_queue,
    'preparation_tasks', v_preparation_tasks
  );
end
$$;

-- 関数は RLS とは別口なので、匿名からは明示的に閉じる。ログイン済みなら呼べる（管理者チェックは関数の中）
revoke all on function public.erase_product_item(text) from public, anon;
grant execute on function public.erase_product_item(text) to authenticated;


-- ============================================================
-- 4. product_items の RLS: DELETE だけ管理者限定に
--
--    いまは「authenticated なら何でも可」の FOR ALL が 1 本。草稿ごとに名前が違う
--    （authenticated_full_access / allow_all / allow_all_product_items / temporary_access_product_items /
--      authenticated_access_product_items / "Enable read access for all users"）ので、名前を列挙せず
--    pg_policies から拾って全部外す。1 本でも残ると DELETE が全員に開いたままになる。
--    同じトランザクションで作り直すので、途中で全員が読めなくなる瞬間は無い。
-- ============================================================

alter table public.product_items enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'product_items'
  loop
    execute format('drop policy if exists %I on public.product_items', p.policyname);
  end loop;
end $$;

create policy "authenticated_select" on public.product_items for select to authenticated using (true);
create policy "authenticated_insert" on public.product_items for insert to authenticated with check (true);
create policy "authenticated_update" on public.product_items for update to authenticated using (true) with check (true);
create policy "admin_delete"         on public.product_items for delete to authenticated using (public.is_admin());


-- ============================================================
-- 確認（流した直後に見る）
-- ============================================================

-- 関数が 2 行
select proname from pg_proc where proname in ('is_admin', 'erase_product_item');

-- product_items のポリシーが DELETE / INSERT / SELECT / UPDATE の 4 行
select policyname, cmd from pg_policies where tablename = 'product_items' order by cmd;

-- 田口さんだけ admin、他は空
select email, raw_app_meta_data->>'role' as role from auth.users order by email;
