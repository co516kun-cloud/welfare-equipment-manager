# 個体の完全消去（管理者限定）設計書（2026-11-18）

田口さんの依頼（2026-11-18）「プロダクトアイテムを個別に完全消去できるようにしたい。管理者権限で。田口だけ管理者にしてアプリ側で実行したい」を受けて、**どう作るか**をまとめたもの。実装はこの設計書を読んだ別セッション（または計画フェーズ）が行う。

対象リポジトリ: `welfare-equipment-manager`（main `d7cc8a6` 時点）。読む前提: `CLAUDE.md`（特に「罠」「Safety Rules」「SQL ファイルの扱い」）、`src/lib/item-status.ts`、`src/pages/item-detail.tsx`、`sql/add-donated-status.sql`（SQL 草稿の書き方の見本）。

---

## 0. 何のための機能か

**登録ミス・重複で作ってしまった個体（管理番号 1 台ぶん）を、DB から跡形なく消す。**

いまある「廃棄」「寄贈」はステータス遷移で、履歴に記録が残る前提の操作。ミスで作った台を「廃棄済み」にすると、存在しなかった台が在庫・集計・履歴に残り続ける。その受け皿が無かった。

- 実行できるのは **管理者だけ**。管理者は **田口さんひとり**
- 操作は **アプリの個体詳細画面** から。MCP や SQL からは行わない
- 消去したこと自体の記録は **残さない**（「完全消去」の指定どおり）

### 田口さんが決めたこと（2026-11-18）

| # | 項目 | 決定 |
|---|---|---|
| 1 | 用途 | 登録ミス・重複の掃除 |
| 2 | 作り方 | **案 2**: Postgres 関数 1 本で、その台に紐づく行をまとめて消す（§4） |
| 3 | 管理者 | 田口さんひとり |
| 4 | 消去の記録 | 残さない |
| 5 | 貸与の履歴がある台（履歴に「貸与中」を通った行がある台） | **DB では止めない。ダイアログに赤字で警告を出し、管理者の目に任せる**（レビュー指摘 Q1 への回答） |
| 6 | MCP サーバーのログインアカウント | **MCP 専用のアカウント**（田口さん本人のものではない）。管理者権限は付けない |

### Claude の判断（違っていたら直す）

| # | 項目 | 判断 | 理由 |
|---|---|---|---|
| a | 管理者の見分け方 | Supabase Auth の **`app_metadata.role = 'admin'`** | ダッシュボード／SQL からしか書けず、本人も他スタッフもアプリから変えられない。`users.role` は CSV 取り込みで誰でも書き換えられるので使わない |
| b | 消せない条件 | ステータスが **貸与中・予約済み・配送準備完了**、または **進行中の発注に割り当て済み**（`order_items.assigned_item_ids` に入っていて、その明細が配送済み・取り消し済みでなく、発注自体も取り消されていない） | 顧客・進行中の発注に結び付いた台は「登録ミス」ではない。配送済み・取り消し済みの発注まで見ると、一度でも発注に乗った台は永久に消せなくなる（割り当てを外す操作がアプリに無い。レビュー指摘 Q3） |
| b' | 貸与の履歴の扱い | 止めずに **件数を数えて警告**。履歴の `from_status` か `to_status` が `rented` の行を「貸与の記録」とみなす | 田口さんの決定 5。操作名ではなくステータス列で数えるので、操作名が増えても漏れない |
| c | 画面の置き場所 | 個体詳細の最下部に、管理者にだけ見える「管理者操作」の枠 | 1 台ずつ確認しながら消す用途なので、詳細画面が自然。一覧からの一括操作は作らない |
| d | 確認の仕方 | ダイアログに商品名・管理番号・ステータス・消える履歴の件数を出し、**管理番号を打ち込まないと実行できない** | 元に戻せない操作なので、タップ 2 回では足りない |
| e | 消す範囲 | `product_items` 本体、`item_histories`（写真も Base64 でここに入っている）、`label_print_queue`、`preparation_tasks`（item_id が一致する行があれば） | これで個体に紐づく行は全部。`deposit_items` と `demo_equipment` は個体を参照していない |
| f | 消去後の動き | 在庫一覧（来た画面）へ戻る。ストアからも即座に除く | Realtime の DELETE 購読で他端末からも消える |

---

## 1. ゴール・非ゴール・アンチゴール

**ゴール**
- 1 台を消すと、紐づく行が **全部消える** か **何も変わらない** かのどちらかしか起きない
- 管理者以外には **ボタンが見えない** し、API を直接叩いても **DB が断る**
- デモモード（`npm run dev:demo`）でも同じ流れを画面で確認できる

**非ゴール（今回はやらない）**
- 複数台をまとめて消す
- 商品（`products`）やカテゴリの削除
- `users` / `orders` / `item_histories` など他テーブルの権限分離（診断 C2 の本体。今回の `app_metadata` 方式はその土台になるが、広げるのは別件）
- 消去ログ（誰がいつ何を消したか）
- MCP サーバーからの消去

**アンチゴール（こうなったら失敗）**
- 貸与の履歴がある台を、管理者が **気づかずに** 消してしまう（警告が出ない・見落とす作りになっている）
- 貸与中や進行中の発注に結び付いた台が消せてしまう
- 履歴だけ消えて本体が残る、のような半端な状態
- 他スタッフの既存操作（履歴の削除、ラベルキューの削除、個体の編集）が動かなくなる
- 公開リポジトリにメールアドレスや本番の識別子が載る

---

## 2. 制約（知らないと踏む）

- **本番 DB の SQL は田口さんが手で流す**（CLAUDE.md「SQL ファイルの扱い」）。Claude は `sql/` に草稿を置き、「これを SQL Editor で流してください」と渡す
- **順序は SQL → アプリのデプロイ。** 逆だとボタンを押した瞬間「関数が無い」エラーになる（致命ではないが混乱する）。アプリ側はこのエラーを日本語で出す（§5.3）
- **管理者の付与も SQL**（`auth.users` の `raw_app_meta_data` を更新）。付けたあとの **ログインで初めて効く**。このアプリは `persistSession: false` なので、画面を再読み込みすれば自然に再ログインになる
- **RLS はいま全テーブル「authenticated なら何でも可」の 1 本**（草稿上の名前は `authenticated_full_access`。本番の実際の名前はダッシュボードが正）。`product_items` の DELETE だけ管理者限定に分ける（§4.4）。他テーブルは触らない
- `item_histories.item_id → product_items.id` の外部キーに **CASCADE が付いているか不明**（草稿が 2 通りある）。関数の中で **先に履歴を消す** ので、どちらでも動く
- `preparation_tasks.item_id` は草稿によって「個体の ID」「発注明細の ID」と説明がぶれている。しかも **アプリはこのテーブルに書き込んでいない**（`createPreparationTask` はストアに定義があるだけで未使用。MCP も触らない）。関数の削除は「古い行が残っていて外部キーで本体の削除が止まる」のを防ぐ保険で、ふつうは 0 件
- `order_items.assigned_item_ids` から個体 ID を **外す操作はアプリにも MCP にも無い**。配送済み・取り消し済みでも ID が残り続けるので、「割り当て済みなら止める」は進行中の明細に限る（§4.3 手順 4）
- 発注の取り消しは 2 か所に書かれる: 発注単位は `orders.status = 'cancelled'`（承認フロー用）、明細単位は `order_items.item_processing_status = 'cancelled'`。配送完了は明細の `item_processing_status = 'delivered'`。進行中の判定は両方を見る
- `label_print_queue.item_id` には外部キーが無い。関数で明示的に消す
- **本番ビルドは console を落とす。** エラーは画面に出す
- **型チェックゲートの罠**: 新規ファイルに `'unknown'` など ItemStatus と同じ文字列リテラルを書くと誤判定で exit 1 になる。ステータスに触る定数は既存の `src/lib/item-status.ts` に書く。管理者判定の新規ファイルには `'admin'` 以外のリテラルを置かない
- `src/lib/item-status.ts` を触ったら `cd mcp-server && npm run build` で `shared/item-status.ts` を再生成する（手で編集しない）
- **公開リポジトリ。** SQL 草稿のメールアドレスは `<田口さんのメールアドレス>` のプレースホルダにし、流すときに田口さんが置き換える

---

## 3. 検討した作り方

| 案 | 中身 | 長所 | 短所 | 結果 |
|---|---|---|---|---|
| 1 | アプリが 履歴 → 印刷キュー → 本体 の順に DELETE を 3 回投げる。`product_items` の DELETE だけ RLS で管理者限定 | ロジックが TypeScript にあり vitest で書ける。SQL はポリシー 1 本 | 途中で通信が切れると履歴だけ消えて本体が残りうる。消えた履歴は戻せない | 落選 |
| **2** | **Postgres 関数 `erase_product_item(id)` が、管理者チェック → 消せるかの判定 → 紐づく行の削除を 1 トランザクションで行う。アプリは rpc を 1 回呼ぶ** | 全部消えるか何も変わらないか。ルールが 1 か所。使われていない既存の削除経路も RLS で塞げる | ルール本体が SQL 側。変えるときはまた田口さんに流してもらう。デモ用に同じ動きをモックに書く | **採用（田口さん 2026-11-18）** |
| － | `users.role === 'admin'` で見分ける | 既存の仕組み | CSV 取り込みで誰でも自分を admin にできる（診断 H3） | 落選 |
| － | 環境変数にメールアドレスを書いてアプリだけで判定 | 実装が最小 | 公開バンドルにメールが出る。DB 側で止まらない | 落選 |

---

## 4. DB 側（SQL 草稿 `sql/add-erase-product-item.sql`）

1 ファイルにまとめる。書き方は `sql/add-donated-status.sql` に揃える（冒頭に目的・影響範囲・流す順序の注意、末尾に確認クエリ）。**流すのは田口さん。**

### 4.1 管理者の付与

```sql
-- 田口さんのアカウントにだけ role=admin を付ける。他の人には何もしない
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = '<田口さんのメールアドレス>';
```

確認: `select email, raw_app_meta_data->>'role' as role from auth.users;` で田口さんだけ `admin`、他は空。

### 4.2 管理者判定関数 `public.is_admin()`

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;
```

RLS ポリシー（§4.4）と消去関数（§4.3）の両方から使う。将来ほかの管理者限定操作もここを見ればよい。

### 4.3 消去関数 `public.erase_product_item(p_item_id text) returns jsonb`

- `security definer`、`set search_path = public`。所有者（`postgres`）として動くので、中の DELETE は RLS に邪魔されない
- 手順（この順で。どこかで例外が出たら全部ロールバック）
  1. `is_admin()` でなければ `raise exception 'ERASE_NOT_ADMIN'`
  2. `select status from product_items where id = p_item_id for update` → 無ければ `ERASE_NOT_FOUND`
  3. status が `rented` / `reserved` / `ready_for_delivery` なら `ERASE_IN_USE`
  4. **進行中の発注** に割り当てられていれば `ERASE_ASSIGNED`:
     ```sql
     exists (
       select 1
       from order_items oi
       join orders o on o.id = oi.order_id
       where oi.assigned_item_ids @> array[p_item_id]
         and coalesce(oi.item_processing_status, '') not in ('delivered', 'cancelled')
         and o.status <> 'cancelled'
     )
     ```
     配送済み・取り消し済みの明細は見ない（§2 のとおり ID が残り続けるため）。貸与の履歴があるかどうかは **関数では見ない**（田口さんの決定 5。画面が警告する）
  5. `delete from item_histories where item_id = p_item_id` → 件数を取る
  6. `delete from label_print_queue where item_id = p_item_id` → 件数
  7. `delete from preparation_tasks where item_id = p_item_id` → 件数
  8. `delete from product_items where id = p_item_id`
  9. `return jsonb_build_object('histories', n1, 'label_queue', n2, 'preparation_tasks', n3)`
- エラーは `raise exception using message = 'ERASE_xxx'` の **コード文字列だけ** にする。日本語への変換はアプリ側（§5.3）。PostgREST は `error.message` にこの文字列をそのまま返す
- 権限: `revoke all on function public.erase_product_item(text) from public, anon; grant execute on function public.erase_product_item(text) to authenticated;`
  （anon は RLS で全ブロック済みだが、関数は別口なので明示的に閉じる）

### 4.4 RLS: `product_items` の DELETE を管理者限定に

いまの `FOR ALL` 1 本を、SELECT / INSERT / UPDATE（authenticated 全員）と DELETE（管理者のみ）に分ける。

```sql
-- product_items に付いているポリシーを名前を問わず全部外す。
-- 草稿ごとに名前が違う（authenticated_full_access / allow_all / allow_all_product_items /
-- temporary_access_product_items / authenticated_access_product_items / "Enable read access for all users"）ので、
-- 名前を列挙せず pg_policies から拾う。1 本でも残ると DELETE が全員に開いたままになる
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'product_items' loop
    execute format('drop policy if exists %I on public.product_items', p.policyname);
  end loop;
end $$;

create policy "authenticated_select" on public.product_items for select to authenticated using (true);
create policy "authenticated_insert" on public.product_items for insert to authenticated with check (true);
create policy "authenticated_update" on public.product_items for update to authenticated using (true) with check (true);
create policy "admin_delete"         on public.product_items for delete to authenticated using (public.is_admin());
```

- 同じトランザクションで外して作り直すので、途中で全員が読めなくなる瞬間は無い（SQL Editor は 1 回の実行を 1 トランザクションで流す）。確認クエリ（§4.5）で `cmd` が 4 行に分かれていれば成功
- アプリ・MCP・スクリプトのどこにも `product_items` を DELETE する経路は無い（`supabaseDb.deleteProductItem` は定義だけで未使用）ので、この変更で壊れる既存機能は無い
- `item_histories` と `label_print_queue` の DELETE 権限は **触らない**（履歴削除・キュー削除は全スタッフの既存機能）

### 4.5 確認クエリ（ファイル末尾）

```sql
select proname from pg_proc where proname in ('is_admin', 'erase_product_item');       -- 2 行
select policyname, cmd from pg_policies where tablename = 'product_items' order by cmd; -- DELETE / INSERT / SELECT / UPDATE の 4 行
select email, raw_app_meta_data->>'role' as role from auth.users;                      -- 田口さんだけ admin
```

---

## 5. アプリ側

### 5.1 管理者判定 — 新規 `src/lib/admin.ts`

```ts
/** Supabase Auth の app_metadata.role が 'admin' か。デモモードの auth_user（localStorage）も同じ形で判定できる */
export function isAdminUser(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean
```

- `useAuth()` が返す `user`（Supabase の `User`）をそのまま渡す。`user.app_metadata.role === 'admin'` のときだけ true
- デモモードでは `useAuth` が localStorage の `auth_user` を `User` として読むので、そこに `app_metadata: { role: 'admin' }` を入れれば管理者になる。`scripts/demo-check.mjs` の `auth_user` にこれを足して、撮影で「管理者操作」の枠が写るようにする（他の E2E スクリプトは管理者でなくてよい）

### 5.2 消せるかの判定 — 既存 `src/lib/item-status.ts` に追記

```ts
/** 完全消去を断るステータス。顧客・発注に結び付いているので「登録ミス」ではない。DB 関数 erase_product_item と同じ並び */
export const ERASE_BLOCKED_STATUSES: readonly ItemStatus[] = ['rented', 'reserved', 'ready_for_delivery']
export function canEraseItem(status: ItemStatus): boolean
```

- 画面はこれでボタンの活性／非活性と理由の 1 行を決める。**発注への割り当ての有無は DB 関数だけが見る**（画面は結果のエラーを表示する）
- ここを変えたら SQL 側の 3 つも揃える、とコメントに書く

```ts
/** 貸与の記録か（貸与中から出た・貸与中に入った履歴）。完全消去の前に件数を数えて警告するのに使う */
export function isRentalRecord(history: { from_status: ItemStatus; to_status: ItemStatus }): boolean
```

- `from_status` か `to_status` が `rented` なら true。操作名（`直接貸与` / `貸与中にする` / `返却` …）ではなくステータス列で見る
- **ここに置く理由**: 新規ファイルに `'rented'` のような ItemStatus と同じ文字列リテラルを書くと型チェックゲートが誤判定する（§2）。`item-status.ts` は既存ファイルなので安全

### 5.3 DB 層 — `src/lib/supabase-database.ts` と新規 `src/lib/erase-product-item.ts`

- `supabase-database.ts` に `async eraseProductItem(id: string): Promise<EraseResult>` を追加。`EraseResult = { histories: number; label_queue: number; preparation_tasks: number }`
  - デモモードなら `mockDb.eraseProductItem(id)`
  - 本番は `supabase.rpc('erase_product_item', { p_item_id: id })`。エラーは `toEraseErrorMessage()` で日本語にして `throw new Error(...)`
- `erase-product-item.ts` に型と `toEraseErrorMessage(error: { message?: string; code?: string }): string` を置く（単体テストしやすいよう DB 層から分ける）

| DB から返る文字列 | 画面に出す文言 |
|---|---|
| `ERASE_NOT_ADMIN` | 管理者だけが実行できます |
| `ERASE_NOT_FOUND` | この個体はすでに存在しません |
| `ERASE_IN_USE` | 貸与中・予約済み・配送準備完了の個体は消去できません。先に返却や取り消しを済ませてください |
| `ERASE_ASSIGNED` | 進行中の発注に割り当てられている個体は消去できません。先にその発注（明細）を取り消すか、配送を済ませてください |
| 関数が無い（PostgREST `PGRST202`、または Postgres `42883`） | 消去機能が DB 側にまだ入っていません。管理者に SQL の適用を確認してください |
| それ以外 | 消去に失敗しました（元のメッセージ） |

### 5.4 モック — `src/lib/mock-database.ts`

`eraseProductItem(id)` を追加し、DB 関数と同じ順で同じコード文字列を投げる。

1. localStorage の `auth_user` を `isAdminUser` で見て、管理者でなければ `ERASE_NOT_ADMIN`
2. `mock_product_items` に無ければ `ERASE_NOT_FOUND`
3. `canEraseItem` が false なら `ERASE_IN_USE`
4. `mock_orders` の中で、発注の `status` が `cancelled` でなく、明細の `item_processing_status` が `delivered` / `cancelled` でもない明細の `assigned_item_ids` に入っていれば `ERASE_ASSIGNED`（DB 関数の手順 4 と同じ条件）
5. `mock_item_histories` / `mock_label_print_queue` / `mock_product_items` から該当行を除いて書き戻し、件数を返す（モックに準備タスクの保存は無いので `preparation_tasks: 0`）

### 5.5 ストア — `src/stores/useInventoryStore.ts`

- `removeItemLocally(itemId: string): void` を追加。`items` と `itemsCache.categories` / `itemsCache.products` の各配列からその ID を除く
- Realtime の DELETE でも消えるが、購読直後の 1 発目は取りこぼすことがある（memory 記載）ので、成功したら必ず呼ぶ

### 5.6 画面 — `src/pages/item-detail.tsx`

**管理者操作の枠**（クイックアクションの下。`isAdminUser(user)` のときだけ描画）

```
┌ 管理者操作 ──────────────────────────────────────┐
│ この個体を DB から完全に消します。履歴・写真・       │
│ ラベル印刷キューも消え、元に戻せません。             │
│ 登録ミス・重複の掃除にだけ使ってください。           │
│                                                    │
│ [ 🗑 この個体を完全に消去 ]   ← variant destructive │
│ （貸与中のため消去できません） ← 非活性のとき 1 行   │
└────────────────────────────────────────────────────┘
```

- 枠は `border-destructive` 系の見た目で、他のカードと区別する
- `canEraseItem(item.status)` が false のときボタンは disabled。理由は「{ステータス表示名}のため消去できません。先に返却や取り消しを済ませてください」

**確認ダイアログ**（既存の `Dialog` 部品。編集ダイアログと同じ流儀）

```
┌ 本当に完全消去しますか？ ─────────────────────────┐
│ 商品名      楽匠プラス 3モーター                   │
│ 管理番号    RP-001                                 │
│ ステータス  利用可能                               │
│ 消える履歴  5 件（写真を含む）                     │
│ ⚠ この台には貸与の記録が 2 件あります。            │  ← 赤字。0 件なら出さない
│   登録ミスではない可能性があります。               │
│ ラベル印刷キューに残っている行も消えます。          │
│ この操作は元に戻せません。                         │
│                                                    │
│ 確認のため管理番号を入力: [ RP-001        ]        │
│                                                    │
│            [ キャンセル ]  [ 完全に消去する ]      │
└────────────────────────────────────────────────────┘
```

- 「消える履歴」は画面がすでに持っている `histories.length`
- 「貸与の記録」は `histories.filter(isRentalRecord).length`（§5.2）。**1 件以上なら赤字の警告を出す。止めはしない**（田口さんの決定 5）。ボタンの活性には影響させない
- 入力が `item.id` と完全一致（前後の空白は除く）するまで「完全に消去する」は disabled
- 実行中はボタンを「消去中…」にして二重押しを防ぐ
- **失敗**: ダイアログの中に赤字で日本語メッセージ（`alert` ではなく、ダイアログを閉じずに出す。入力はそのまま残す）
- **成功**: ダイアログを閉じ、`removeItemLocally(item.id)` → `goBack()`（来た画面へ）。完了の知らせは既存画面の流儀に合わせる（toast 部品は無いので `alert('RP-001 を消去しました（履歴 5 件）')` でよい。`demo.tsx` の削除と同じ）

### 5.7 テスト（vitest、`src/lib/__tests__/`）

- `erase-product-item.test.ts`
  - `isAdminUser`: `app_metadata.role='admin'` → true。`'staff'`・`app_metadata` 無し・`null`・デモの `auth_user` の形 → false／true が正しい
  - `canEraseItem`: 12 ステータス全部。`rented` / `reserved` / `ready_for_delivery` だけ false
  - `isRentalRecord`: `rented` から出た行・`rented` に入った行は true。`available → cleaning` のような行は false
  - `toEraseErrorMessage`: 4 つのコード、関数欠落（`PGRST202` / `42883`）、未知のメッセージ
- `mock-database.test.ts` に追記（既存ファイルの流儀で）
  - 管理者で消すと本体・履歴・キューが消え、件数が返る。**他の個体の履歴は残る**
  - 非管理者 → `ERASE_NOT_ADMIN` で何も消えない
  - 貸与中 → `ERASE_IN_USE`、無い ID → `ERASE_NOT_FOUND`。いずれも何も消えない
  - 進行中の発注に割り当て済み → `ERASE_ASSIGNED`。**配送済み（`delivered`）や取り消し済み（明細 `cancelled`、または発注 `cancelled`）の明細に入っているだけなら消せる**
  - 貸与の履歴がある `available` の台は **消せる**（止めない、が仕様）
- 画面テスト（`src/pages/__tests__/`）は **できれば**: 管理者でないと枠が出ない／管理者なら出る。`item-detail.tsx` は 1000 行超で依存が多いので、重ければ省いてよい

---

## 6. 本番に出す手順

1. アプリを実装 → `npm run type-check` → `npm test` → `npm run build` → `cd mcp-server && npm run build`（item-status.ts を触るため）
2. 田口さんに画面（デモモードの撮影）を見てもらう
3. **田口さんが** `sql/add-erase-product-item.sql` のメールアドレスを置き換えて、Supabase ダッシュボードの SQL Editor で流す。§4.5 の確認クエリ 3 つが期待どおりか見る
4. コミット → push（ここで確認）→ 本番でバンドル名が変わったのを確認
5. 田口さんが本番にログインし直す → 任意の個体詳細に「管理者操作」の枠が出る
6. **動作確認**: テスト用に 1 台を新規登録（状態メモに「新品」を書かなければ消毒〜入庫の履歴が 3 行自動で付く）→ その台を消去 → 在庫一覧・履歴画面・ラベルキューから消えていることを確認
7. 別のスタッフのアカウントで入れるなら、同じ個体詳細に枠が **出ない** ことを確認（任意）

---

## 7. 残しておく既知の点

- `users.role` は引き続き飾り。権限分離を広げるときは `app_metadata` と `is_admin()` を軸にする
- `supabaseDb.deleteProductItem`（1 行だけ消す旧関数）は未使用のまま残す。RLS で管理者以外は失敗する。消すのは別件
- MCP サーバーには消去ツールが無い。MCP は **専用アカウント** でログインしている（田口さん確認 2026-11-18）ので、そのアカウントに `role=admin` を付けない限り、将来ツールを足しても関数が断る。§4.1 の SQL は田口さん本人のメールだけを対象にすること
- 貸与の履歴がある台は **止めない**（警告だけ）。「重複登録のほうを誤って貸与に使ってしまった台」を片付けられるようにするため。貸与・消毒の記録を残したい台は、消去ではなく廃棄にする
- `item_histories` の削除は全スタッフができる（既存機能）。今回は触らない
- 消去の記録は残さない。必要になったら `erase_product_item` の中で別テーブルに 1 行書く形で足せる

---

## 8. 作る人に任せること

- ダイアログ・枠の文言の細部と配色（上の文案は叩き台）
- `toEraseErrorMessage` のエラー判定の細かい分岐（`code` と `message` のどちらを先に見るか）
- 画面テストを書くかどうか（§5.7）
- `demo-check.mjs` 以外の E2E スクリプトに `app_metadata` を足すか（足さなくてよい）
- 計画書（`docs/superpowers/plans/`）の分割の仕方
