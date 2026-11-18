# 個体の完全消去（管理者限定）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理者（田口さんだけ）が個体詳細画面から、登録ミス・重複の個体を履歴・印刷キューごと DB から跡形なく消せるようにする。

**Architecture:** 消す処理は Postgres 関数 `erase_product_item(p_item_id)` に置き、管理者チェック（Supabase Auth の `app_metadata.role = 'admin'`）→ 消せるかの判定 → 紐づく行の削除を 1 トランザクションで行う。アプリは `supabaseDb.eraseProductItem(id)` から rpc を 1 回呼ぶだけで、画面は管理者にだけ「管理者操作」の枠を出し、管理番号の打ち込みで確認する。デモモードでは `mockDb.eraseProductItem` が同じ順番・同じエラーコードで動く。

**Tech Stack:** React 18 + TypeScript + Vite、zustand、Supabase JS（rpc）、PL/pgSQL、vitest + @testing-library/react、Playwright（デモ撮影）

**Spec:** `docs/superpowers/specs/2026-11-18-erase-product-item-design.md`（この計画は設計書の §4〜§6 を実装する。実装者は両方読む）

## Global Constraints

- 会話・コミットメッセージ・コード内コメントは日本語。コミットは `type(scope): 何をどうしたか`。末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` と `Claude-Session: https://claude.ai/code/session_014MtbxoCpp8AmXmrQwpVpK9` の 2 行
- `src/` を触ったコミットの前に `npm run type-check` と `npm test`（vitest は jsdom 込みで約 90 秒）
- **UI の変更（Task 7・8）は田口さんに画面を見てもらってからコミット**（CLAUDE.md）。それ以外のタスクは各タスクの末尾でコミットする
- `mcp-server/src/shared/item-status.ts` は生成物。直接編集せず `cd mcp-server && npm run build` で再生成する
- **型チェックゲートの罠**: 新規ファイルに `'rented'` `'unknown'` など ItemStatus と同じ文字列リテラルを書くと、ゲートが「解消 N 件・新規 N 件」を同数で出して exit 1 になることがある。ステータスを扱う定数・関数は既存の `src/lib/item-status.ts` に置く。テストで全ステータスが要るときは `Object.keys(STATUS_LABEL)` から取る。同数で出たら memory `typecheck-gate-union-order` のとおり直近のリテラルを疑う。`npm run type-check:all` で見て、中身が同じ既存エラーのユニオン並び替えだけなら `npm run type-check:accept` でベースラインを更新し、その差分を同じコミットに含める
- **Claude は SQL を本番に流さない。** `sql/add-erase-product-item.sql` は草稿。田口さんが Supabase ダッシュボードの SQL Editor で流す
- **公開リポジトリ。** SQL 草稿のメールアドレスは `<田口さんのメールアドレス>` のプレースホルダのまま。実メール・本番 URL・鍵を書かない
- 本番ビルドは console を落とす。エラーは必ず画面に出す
- エラーコード文字列は DB・モック・アプリで完全一致: `ERASE_NOT_ADMIN` / `ERASE_NOT_FOUND` / `ERASE_IN_USE` / `ERASE_ASSIGNED`
- 消せないステータスは 3 つで固定: `rented` / `reserved` / `ready_for_delivery`。SQL と `item-status.ts` の両方に同じ並びで書く
- 進行中の発注の定義: `order_items.assigned_item_ids` に入っていて、`item_processing_status` が `delivered` / `cancelled` でなく、親 `orders.status` が `cancelled` でない

## Review Focus

- 管理番号の入力に前後の空白が付いても（例 `" WC-001 "`）一致とみなして実行できること → Task 7 のテスト「空白を除いて一致すれば実行できる」
- 実行ボタンの二度押しで rpc が 2 回飛ばないこと → Task 7 のテスト「消去中は二度押しできない」
- SQL 未適用の本番で押したとき「消去機能が DB 側にまだ入っていません」と出ること（素のエラーをそのまま見せない） → Task 2 の `toEraseErrorMessage` テスト（`PGRST202` / `42883`）
- 他端末で先に消された個体で押したとき `ERASE_NOT_FOUND` を日本語で出し、ダイアログを閉じないこと → Task 4（モックで NOT_FOUND）と Task 7 のテスト「失敗したらダイアログ内に理由を出す」
- `assigned_item_ids` に未割当枠の `null` が混ざっていても、進行中の発注への割り当てを見逃さないこと → Task 4 のテスト「null 混じりの配列でも割り当て済みと判定する」

---

### Task 1: ステータス側のルール（`item-status.ts`）

**Files:**
- Modify: `src/lib/item-status.ts`（末尾、`usedIntakeSteps` の後）
- Test: `src/lib/__tests__/erase-product-item.test.ts`（新規。この計画のテストはこのファイルに集める）
- Regenerate: `mcp-server/src/shared/item-status.ts`（`cd mcp-server && npm run build`）

**Interfaces:**
- Consumes: 既存の `ItemStatus`、`STATUS_LABEL`
- Produces:
  - `export const ERASE_BLOCKED_STATUSES: readonly ItemStatus[]` = `['rented', 'reserved', 'ready_for_delivery']`
  - `export function canEraseItem(status: ItemStatus): boolean`
  - `export function isRentalRecord(history: { from_status: ItemStatus; to_status: ItemStatus }): boolean`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/__tests__/erase-product-item.test.ts
import { describe, it, expect } from 'vitest'
import { STATUS_LABEL, ERASE_BLOCKED_STATUSES, canEraseItem, isRentalRecord, type ItemStatus } from '../item-status'

// 罠回避: ステータスの一覧はリテラルで並べず STATUS_LABEL から取る
const ALL = Object.keys(STATUS_LABEL) as ItemStatus[]

describe('完全消去できるステータス', () => {
  it('貸与中・予約済み・配送準備完了の 3 つだけ消せない', () => {
    expect([...ERASE_BLOCKED_STATUSES]).toEqual(['rented', 'reserved', 'ready_for_delivery'])
    for (const s of ALL) {
      expect(canEraseItem(s), s).toBe(!ERASE_BLOCKED_STATUSES.includes(s))
    }
  })
})

describe('貸与の記録の判定', () => {
  it('貸与中に入った行・貸与中から出た行は貸与の記録', () => {
    expect(isRentalRecord({ from_status: 'available', to_status: 'rented' })).toBe(true)
    expect(isRentalRecord({ from_status: 'rented', to_status: 'returned' })).toBe(true)
  })
  it('貸与中を通らない行は貸与の記録ではない', () => {
    expect(isRentalRecord({ from_status: 'returned', to_status: 'cleaning' })).toBe(false)
    expect(isRentalRecord({ from_status: 'unknown', to_status: 'available' })).toBe(false)
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/__tests__/erase-product-item.test.ts`
Expected: FAIL（`ERASE_BLOCKED_STATUSES` などが export されていない）

- [ ] **Step 3: `src/lib/item-status.ts` の末尾に 3 つを実装する**

- `ERASE_BLOCKED_STATUSES` のコメントに「DB 関数 `erase_product_item`（`sql/add-erase-product-item.sql`）の手順 3 と同じ並び。片方を変えたらもう片方も」と書く
- `isRentalRecord` のコメントに「操作名ではなくステータス列で見る（操作名が増えても漏れない）。完全消去の前に件数を数えて警告するのに使う」と書く

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/__tests__/erase-product-item.test.ts`
Expected: PASS（3 件）

- [ ] **Step 5: MCP 側の写しを再生成し、差分が `shared/item-status.ts` だけであることを確認する**

Run: `cd mcp-server && npm run build && cd .. && git status --short`
Expected: `src/lib/item-status.ts`、新規テスト、`mcp-server/src/shared/item-status.ts` の 3 つだけ

- [ ] **Step 6: 型チェックとコミット**

Run: `npm run type-check`
Expected: exit 0（「新規 0 件」）。同数の「解消 N 件・新規 N 件」が出たら Global Constraints の罠を疑う

```bash
git add src/lib/item-status.ts src/lib/__tests__/erase-product-item.test.ts mcp-server/src/shared/item-status.ts
git commit -m "feat(item-status): 完全消去できないステータスと貸与の記録の判定を追加"
```

---

### Task 2: 管理者判定とエラー文言（`admin.ts` / `erase-product-item.ts`）

**Files:**
- Create: `src/lib/admin.ts`
- Create: `src/lib/erase-product-item.ts`
- Test: `src/lib/__tests__/erase-product-item.test.ts`（追記）

**Interfaces:**
- Produces（`src/lib/admin.ts`）:
  - `export function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean` — `user.app_metadata.role === 'admin'` のときだけ true
- Produces（`src/lib/erase-product-item.ts`）:
  - `export const ERASE_ERROR = { NOT_ADMIN: 'ERASE_NOT_ADMIN', NOT_FOUND: 'ERASE_NOT_FOUND', IN_USE: 'ERASE_IN_USE', ASSIGNED: 'ERASE_ASSIGNED' } as const`
  - `export type EraseResult = { histories: number; label_queue: number; preparation_tasks: number }`
  - `export function toEraseResult(data: unknown): EraseResult` — rpc の jsonb を数値に揃える。欠けていれば 0
  - `export function toEraseErrorMessage(error: { message?: string; code?: string } | null | undefined): string`
- このファイルには ItemStatus のリテラルを書かない（罠）

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import { isAdminUser } from '../admin'
import { ERASE_ERROR, toEraseErrorMessage, toEraseResult } from '../erase-product-item'

describe('管理者判定', () => {
  it('app_metadata.role が admin のときだけ管理者', () => {
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true)
    expect(isAdminUser({ app_metadata: { role: 'staff' } })).toBe(false)
    expect(isAdminUser({ app_metadata: {} })).toBe(false)
    expect(isAdminUser({})).toBe(false)
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
  })
  it('デモモードの auth_user（localStorage の形）も同じ判定で通る', () => {
    const demoUser = JSON.parse(JSON.stringify({ id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' }, app_metadata: { role: 'admin' } }))
    expect(isAdminUser(demoUser)).toBe(true)
  })
})

describe('消去エラーの日本語化', () => {
  it.each([
    [ERASE_ERROR.NOT_ADMIN, '管理者だけが実行できます'],
    [ERASE_ERROR.NOT_FOUND, 'この個体はすでに存在しません'],
    [ERASE_ERROR.IN_USE, '貸与中・予約済み・配送準備完了の個体は消去できません。先に返却や取り消しを済ませてください'],
    [ERASE_ERROR.ASSIGNED, '進行中の発注に割り当てられている個体は消去できません。先にその発注（明細）を取り消すか、配送を済ませてください'],
  ])('%s → 決まった文言', (code, expected) => {
    expect(toEraseErrorMessage({ message: code })).toBe(expected)
  })
  it('関数が DB に無いときは SQL 未適用だと分かる文言', () => {
    const expected = '消去機能が DB 側にまだ入っていません。管理者に SQL の適用を確認してください'
    expect(toEraseErrorMessage({ code: 'PGRST202', message: 'Could not find the function public.erase_product_item(p_item_id) in the schema cache' })).toBe(expected)
    expect(toEraseErrorMessage({ code: '42883', message: 'function public.erase_product_item(text) does not exist' })).toBe(expected)
  })
  it('知らないエラーは元の文言を添える', () => {
    expect(toEraseErrorMessage({ message: 'network down' })).toBe('消去に失敗しました（network down）')
    expect(toEraseErrorMessage(null)).toBe('消去に失敗しました（原因不明のエラー）')
  })
})

describe('消去結果の整形', () => {
  it('jsonb の件数を数値に揃え、欠けていれば 0', () => {
    expect(toEraseResult({ histories: 5, label_queue: '1', preparation_tasks: 0 })).toEqual({ histories: 5, label_queue: 1, preparation_tasks: 0 })
    expect(toEraseResult(null)).toEqual({ histories: 0, label_queue: 0, preparation_tasks: 0 })
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/__tests__/erase-product-item.test.ts`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: `src/lib/admin.ts` に `isAdminUser` を実装する**

ファイル冒頭のコメントに「管理者は Supabase Auth の app_metadata.role='admin'。users.role は CSV 取り込みで誰でも書けるので使わない。付与は `sql/add-erase-product-item.sql` §1」と書く。

- [ ] **Step 4: `src/lib/erase-product-item.ts` に `ERASE_ERROR` / `EraseResult` / `toEraseResult` / `toEraseErrorMessage` を実装する**

`toEraseErrorMessage` の判定順: ① `message` に `ERASE_ERROR` の 4 コードのどれかが含まれていればその文言 ② `code` が `PGRST202` か `42883`、または `message` が `/Could not find the function|does not exist/` に当たれば未適用の文言 ③ それ以外は `消去に失敗しました（${message || '原因不明のエラー'}）`。

- [ ] **Step 5: テストが通ることを確認する**

Run: `npx vitest run src/lib/__tests__/erase-product-item.test.ts`
Expected: PASS

- [ ] **Step 6: 型チェックとコミット**

Run: `npm run type-check` → exit 0

```bash
git add src/lib/admin.ts src/lib/erase-product-item.ts src/lib/__tests__/erase-product-item.test.ts
git commit -m "feat(erase): 管理者判定と完全消去のエラー文言を追加"
```

---

### Task 3: SQL 草稿（`sql/add-erase-product-item.sql`）

**Files:**
- Create: `sql/add-erase-product-item.sql`
- Test: `src/lib/__tests__/erase-product-item.test.ts`（追記。ファイルの中身を文字列で確認する。`item-status.test.ts` が `readFileSync` でソースを読む流儀に合わせる）

**Interfaces:**
- Produces（DB 側。アプリは Task 5 で呼ぶ）:
  - `public.is_admin() returns boolean`
  - `public.erase_product_item(p_item_id text) returns jsonb` — `{"histories": n, "label_queue": n, "preparation_tasks": n}`。失敗時は `raise exception` のメッセージが `ERASE_NOT_ADMIN` / `ERASE_NOT_FOUND` / `ERASE_IN_USE` / `ERASE_ASSIGNED` のいずれか
  - `product_items` のポリシー 4 本: `authenticated_select` / `authenticated_insert` / `authenticated_update` / `admin_delete`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('SQL 草稿 sql/add-erase-product-item.sql', () => {
  const sql = () => readFileSync(resolve(__dirname, '../../..', 'sql/add-erase-product-item.sql'), 'utf8')

  it('関数・ポリシー・管理者付与が揃っている', () => {
    const s = sql()
    expect(s).toMatch(/create or replace function public\.is_admin\(\)/i)
    expect(s).toMatch(/create or replace function public\.erase_product_item\(p_item_id text\)/i)
    expect(s).toMatch(/security definer/i)
    expect(s).toMatch(/set search_path = public/i)
    for (const code of Object.values(ERASE_ERROR)) expect(s).toContain(code)
    expect(s).toMatch(/from pg_policies where schemaname = 'public' and tablename = 'product_items'/i)
    expect(s).toMatch(/create policy "admin_delete"\s+on public\.product_items for delete to authenticated using \(public\.is_admin\(\)\)/i)
    expect(s).toMatch(/revoke all on function public\.erase_product_item\(text\) from public, anon/i)
    expect(s).toContain("'{\"role\": \"admin\"}'::jsonb")
  })

  it('消せないステータスと進行中の発注の条件が item-status.ts と揃っている', () => {
    const s = sql()
    expect(s).toMatch(/in \('rented', 'reserved', 'ready_for_delivery'\)/i)
    expect(s).toMatch(/not in \('delivered', 'cancelled'\)/i)
    expect(s).toMatch(/o\.status <> 'cancelled'/i)
  })

  it('メールアドレスはプレースホルダのまま（公開リポジトリ）', () => {
    const s = sql()
    expect(s).toContain('<田口さんのメールアドレス>')
    expect(s).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/__tests__/erase-product-item.test.ts`
Expected: FAIL（ENOENT）

- [ ] **Step 3: `sql/add-erase-product-item.sql` を書く**

`sql/add-donated-status.sql` と同じ体裁（冒頭コメント: 目的・影響範囲・**アプリを本番に出す前に流す**・流す前にメールを置き換える。末尾に確認クエリ）。本文は設計書 §4.1〜§4.5 の順で:

1. `auth.users` の `raw_app_meta_data` に `'{"role": "admin"}'::jsonb` をマージ（`where email = '<田口さんのメールアドレス>'`）
2. `public.is_admin()`（`language sql stable`、`coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'`）
3. `public.erase_product_item(p_item_id text)`（`language plpgsql security definer set search_path = public`）。手順は設計書 §4.3 の 1〜9 そのまま。件数は `get diagnostics v_n = row_count`。例外は `raise exception 'ERASE_NOT_ADMIN'` の形（`using` 句は不要）
4. `revoke all on function public.erase_product_item(text) from public, anon; grant execute on function public.erase_product_item(text) to authenticated;`
5. `product_items` のポリシーを `do $$ ... $$` で全部 drop → 4 本を create（設計書 §4.4 のコードをそのまま）
6. 確認クエリ 3 つ（設計書 §4.5）

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/__tests__/erase-product-item.test.ts`
Expected: PASS

- [ ] **Step 5: 目で読み直す**

`cat sql/add-erase-product-item.sql` で、`$$` の対応、`end $$;` の閉じ、`language plpgsql` の位置、`for update` の位置を確認する（psql は使えないので目視が最後の砦）。

- [ ] **Step 6: コミット**

```bash
git add sql/add-erase-product-item.sql src/lib/__tests__/erase-product-item.test.ts
git commit -m "feat(sql): 個体の完全消去関数と product_items の DELETE 管理者限定ポリシーの草稿"
```

---

### Task 4: モック DB の消去（`mock-database.ts`）

**Files:**
- Modify: `src/lib/mock-database.ts`（`deleteProductItem` の直後、292 行付近）
- Test: `src/lib/__tests__/mock-database.test.ts`（末尾に describe を追記）

**Interfaces:**
- Consumes: Task 1 の `canEraseItem`、Task 2 の `isAdminUser` / `ERASE_ERROR` / `EraseResult`
- Produces: `mockDb.eraseProductItem(id: string): Promise<EraseResult>` — DB 関数と同じ順で判定し、`throw new Error(ERASE_ERROR.xxx)`。モックに準備タスクは無いので `preparation_tasks: 0`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import type { Order } from '../../types'

/** デモモードのログイン状態を作る（useAuth.ts が localStorage の auth_user を読む） */
function loginAs(role?: 'admin') {
  localStorage.setItem('auth_user', JSON.stringify({
    id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' },
    ...(role ? { app_metadata: { role } } : {}),
  }))
}

describe('個体の完全消去（管理者限定）', () => {
  it('管理者なら本体・履歴・印刷キューが消え、他の個体の履歴は残る', async () => {
    loginAs('admin')
    await mockDb.createItemHistory('WC-001', '新規登録', 'unknown', 'available', '田中太郎')
    await mockDb.createItemHistory('WC-001', '消毒完了', 'returned', 'cleaning', '田中太郎')
    await mockDb.createItemHistory('WC-002', '新規登録', 'unknown', 'available', '田中太郎')
    await mockDb.addLabelPrintQueue({ item_id: 'WC-001', product_name: 'デモ車いす', management_id: 'WC-001', condition_notes: '', status: 'pending', created_by: '田中太郎' })

    const result = await mockDb.eraseProductItem('WC-001')

    expect(result).toEqual({ histories: 2, label_queue: 1, preparation_tasks: 0 })
    expect(await mockDb.getProductItemById('WC-001')).toBeNull()
    expect(await mockDb.getItemHistoriesByItemId('WC-001')).toEqual([])
    expect((await mockDb.getLabelPrintQueue()).filter(q => q.item_id === 'WC-001')).toEqual([])
    expect((await mockDb.getItemHistoriesByItemId('WC-002')).length).toBe(1)
  })

  it('管理者でなければ ERASE_NOT_ADMIN で何も消えない', async () => {
    loginAs()
    await expect(mockDb.eraseProductItem('WC-001')).rejects.toThrow('ERASE_NOT_ADMIN')
    expect(await mockDb.getProductItemById('WC-001')).not.toBeNull()
  })

  it('無い ID は ERASE_NOT_FOUND', async () => {
    loginAs('admin')
    await expect(mockDb.eraseProductItem('NOPE-999')).rejects.toThrow('ERASE_NOT_FOUND')
  })

  it('貸与中は ERASE_IN_USE で何も消えない', async () => {
    loginAs('admin')
    await expect(mockDb.eraseProductItem('WC-003')).rejects.toThrow('ERASE_IN_USE')
    expect(await mockDb.getProductItemById('WC-003')).not.toBeNull()
  })

  it('進行中の発注に割り当て済みなら ERASE_ASSIGNED。null 混じりの配列でも見逃さない', async () => {
    loginAs('admin')
    const order = (await mockDb.getOrderById('ORD-DEMO-2')) as Order
    order.items[0].assigned_item_ids = [null as unknown as string, 'WC-001']
    await mockDb.saveOrder(order)
    await expect(mockDb.eraseProductItem('WC-001')).rejects.toThrow('ERASE_ASSIGNED')
  })

  it.each([
    ['明細が配送済み', { item_processing_status: 'delivered' as const }, {}],
    ['明細が取り消し済み', { item_processing_status: 'cancelled' as const }, {}],
    ['発注そのものが取り消し済み', {}, { status: 'cancelled' as const }],
  ])('%s の割り当てなら消せる', async (_label, itemPatch, orderPatch) => {
    loginAs('admin')
    const order = (await mockDb.getOrderById('ORD-DEMO-2')) as Order
    order.items[0] = { ...order.items[0], assigned_item_ids: ['WC-001'], ...itemPatch }
    await mockDb.saveOrder({ ...order, ...orderPatch })
    await expect(mockDb.eraseProductItem('WC-001')).resolves.toBeTruthy()
  })

  it('貸与の履歴がある利用可能の台は消せる（止めない、が仕様）', async () => {
    loginAs('admin')
    await mockDb.createItemHistory('WC-001', '直接貸与', 'available', 'rented', '田中太郎')
    await mockDb.createItemHistory('WC-001', '返却', 'rented', 'returned', '田中太郎')
    await expect(mockDb.eraseProductItem('WC-001')).resolves.toEqual({ histories: 2, label_queue: 0, preparation_tasks: 0 })
  })
})
```

シグネチャは現時点の `mock-database.ts` のもの: `createItemHistory(itemId, action, fromStatus, toStatus, userName)`、`addLabelPrintQueue(Omit<LabelPrintQueue, 'id' | 'created_at'>)`、`saveOrder(order)`、`getOrderById(id)`。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/__tests__/mock-database.test.ts`
Expected: 新しい describe が FAIL（`eraseProductItem is not a function`）。既存は PASS のまま

- [ ] **Step 3: `mockDb.eraseProductItem(id)` を実装する**

手順は設計書 §5.4 の 1〜5。管理者判定は `localStorage.getItem('auth_user')` を `JSON.parse` して `isAdminUser` に渡す（壊れていたら非管理者）。進行中の判定は `(await this.getOrders())` を回し、`order.status !== 'cancelled'` かつ `item.item_processing_status` が `delivered` / `cancelled` 以外の明細の `assigned_item_ids?.includes(id)`。削除は `write(STORAGE_KEYS.xxx, list.filter(...))` を 3 回。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/__tests__/mock-database.test.ts`
Expected: PASS（既存 + 新規 8 件）

- [ ] **Step 5: 型チェックとコミット**

Run: `npm run type-check` → exit 0

```bash
git add src/lib/mock-database.ts src/lib/__tests__/mock-database.test.ts
git commit -m "feat(mock): デモモードでも個体の完全消去を同じ順番・同じエラーで動かす"
```

---

### Task 5: DB 層の `eraseProductItem`（`supabase-database.ts`）

**Files:**
- Modify: `src/lib/supabase-database.ts`（`deleteProductItem` の直後、391 行付近。import に `toEraseErrorMessage` / `toEraseResult` / `EraseResult` を足す）
- Modify: `src/lib/__tests__/mock-mode-delegation.test.ts`（`vi.mock('../mock-database')` の一覧に `eraseProductItem: spy('eraseProductItem', { histories: 0, label_queue: 0, preparation_tasks: 0 })` を足し、テストを 1 本追記）

**Interfaces:**
- Consumes: Task 2 の `toEraseErrorMessage` / `toEraseResult` / `EraseResult`、Task 4 の `mockDb.eraseProductItem`
- Produces: `supabaseDb.eraseProductItem(id: string): Promise<EraseResult>` — 失敗時は **日本語化済み** の `Error` を投げる（デモ・本番どちらでも）

- [ ] **Step 1: 失敗するテストを追記する**

```ts
describe('個体の完全消去', () => {
  it('eraseProductItem がモックへ行く', async () => {
    await supabaseDb.eraseProductItem('WC-001')
    expect(calls).toContain('eraseProductItem')
    expect(supabaseTouched).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/__tests__/mock-mode-delegation.test.ts`
Expected: FAIL（`supabaseDb.eraseProductItem is not a function`）

- [ ] **Step 3: `eraseProductItem` を実装する**

- デモモード: `try { return await mockDb.eraseProductItem(id) } catch (e) { throw new Error(toEraseErrorMessage(e as Error)) }`
- 本番: `const { data, error } = await supabase.rpc('erase_product_item', { p_item_id: id })`。`error` なら `console.error` の後 `throw new Error(toEraseErrorMessage(error))`。成功なら `return toEraseResult(data)`
- コメントに「消す処理は DB 関数側（`sql/add-erase-product-item.sql`）。1 行だけ消す `deleteProductItem` は未使用のまま残しているが、RLS で管理者以外は失敗する」と書く

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/__tests__/mock-mode-delegation.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェックとコミット**

Run: `npm run type-check` → exit 0

```bash
git add src/lib/supabase-database.ts src/lib/__tests__/mock-mode-delegation.test.ts
git commit -m "feat(db): erase_product_item を呼ぶ eraseProductItem を追加"
```

---

### Task 6: ストアからの即時除去（`useInventoryStore.ts`）

**Files:**
- Modify: `src/stores/useInventoryStore.ts`（interface に 1 行、実装は `clearItemsCache` の隣）
- Test: `src/stores/__tests__/remove-item-locally.test.ts`（新規。冒頭の `vi.mock` は `optimistic-rollback.test.ts` と同じものを写す）

**Interfaces:**
- Produces: `removeItemLocally: (itemId: string) => void` — `items` と `itemsCache.categories` / `itemsCache.products` の各配列からその ID を除く。DB は触らない

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ProductItem } from '../../types'

// optimistic-rollback.test.ts と同じ: ストアが import する supabase / supabase-database を切る
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: { getProductItems: vi.fn(async () => []), getOrders: vi.fn(async () => []) },
}))

const { useInventoryStore } = await import('../useInventoryStore')

const item = (id: string, product_id: string): ProductItem =>
  ({ id, product_id, status: 'available', condition: 'good', location: '倉庫', qr_code: id })

beforeEach(() => {
  useInventoryStore.setState({
    items: [item('WC-001', 'PRD-1'), item('WC-002', 'PRD-1')],
    itemsCache: {
      categories: { wheelchair: [item('WC-001', 'PRD-1'), item('WC-002', 'PRD-1')] },
      products: { 'PRD-1': [item('WC-001', 'PRD-1'), item('WC-002', 'PRD-1')] },
    },
  })
})

describe('removeItemLocally', () => {
  it('items とキャッシュの両方からその ID だけを除く', () => {
    useInventoryStore.getState().removeItemLocally('WC-001')
    const s = useInventoryStore.getState()
    expect(s.items.map(i => i.id)).toEqual(['WC-002'])
    expect(s.itemsCache.categories.wheelchair.map(i => i.id)).toEqual(['WC-002'])
    expect(s.itemsCache.products['PRD-1'].map(i => i.id)).toEqual(['WC-002'])
  })
  it('無い ID なら何も変わらない（Realtime の DELETE が後から届いても安全）', () => {
    useInventoryStore.getState().removeItemLocally('NOPE')
    expect(useInventoryStore.getState().items.length).toBe(2)
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/stores/__tests__/remove-item-locally.test.ts`
Expected: FAIL（`removeItemLocally is not a function`）

- [ ] **Step 3: `removeItemLocally` を実装する**

interface に `removeItemLocally: (itemId: string) => void` を足し、`set(state => ({ items: ..., itemsCache: { categories: ..., products: ... } }))` で 3 か所を filter する。コメントに「完全消去の成功直後に呼ぶ。Realtime の DELETE も届くが、購読直後の 1 発目は取りこぼすことがあるので待たない」と書く。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/stores/__tests__/remove-item-locally.test.ts`
Expected: PASS（2 件）

- [ ] **Step 5: 型チェックとコミット**

Run: `npm run type-check` → exit 0

```bash
git add src/stores/useInventoryStore.ts src/stores/__tests__/remove-item-locally.test.ts
git commit -m "feat(store): 完全消去した個体を一覧とキャッシュから即座に除く removeItemLocally"
```

---

### Task 7: 個体詳細の「管理者操作」とダイアログ（`item-detail.tsx`）

**Files:**
- Modify: `src/pages/item-detail.tsx`
  - import に `isAdminUser`（`../lib/admin`）、`canEraseItem, isRentalRecord`（`../lib/item-status`）
  - 23 行付近: `const { users, updateItemStatus, removeItemLocally } = useInventoryStore()`
  - state 4 つ: `showEraseDialog: boolean` / `eraseConfirmText: string` / `erasing: boolean` / `eraseError: string | null`
  - クイックアクションのカード（`{/* Quick Actions */}` 〜 その閉じ `</div>`、822 行付近）の **直後** に「管理者操作」カード
  - 編集ダイアログ（`{/* 編集ダイアログ */}`）の直後に確認ダイアログ
- Test: `src/pages/__tests__/item-detail-erase.test.tsx`（新規）

**Interfaces:**
- Consumes: Task 1 `canEraseItem` / `isRentalRecord`、Task 2 `isAdminUser`、Task 5 `supabaseDb.eraseProductItem`、Task 6 `removeItemLocally`、既存の `useAuth().user`、`goBack`、ローカルの `getStatusLabel(status)`
- 画面の文言（テストが名前で探すので固定）:
  - カード見出し `管理者操作`
  - 説明 `この個体を DB から完全に消します。履歴・写真・ラベル印刷キューも消え、元に戻せません。登録ミス・重複の掃除にだけ使ってください。`
  - ボタン `この個体を完全に消去`（`variant="destructive"`）。非活性のときの 1 行: `{getStatusLabel(item.status)}のため消去できません。先に返却や取り消しを済ませてください`
  - ダイアログ見出し `本当に完全消去しますか？`
  - 行: `商品名` / `管理番号` / `ステータス` / `消える履歴 n 件（写真を含む）`（この行の文字列は **1 つの要素** に入れる。テストが `/消える履歴 2 件/` で探す）
  - 警告（`rentalRecordCount >= 1` のときだけ、`text-destructive`）: `この台には貸与の記録が n 件あります。登録ミスではない可能性があります。`
  - 固定文: `ラベル印刷キューに残っている行も消えます。` / `この操作は元に戻せません。`
  - 入力の `<Label>`: `確認のため管理番号を入力`（`htmlFor` で `<Input id="erase-confirm">` に結ぶ。placeholder は `item.id`）
  - ボタン: `キャンセル` / `完全に消去する`（実行中は `消去中…`）
  - 成功時 `alert(\`${item.id} を消去しました（履歴 ${result.histories} 件）\`)`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/pages/__tests__/item-detail-erase.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ProductItem, ItemHistory } from '../../types'

const authUser = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
const goBack = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => ({
  getProductItemById: vi.fn(),
  getProductById: vi.fn(),
  getItemHistoriesByItemId: vi.fn(),
  getOrders: vi.fn(async () => []),
  eraseProductItem: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) }, channel: vi.fn(), removeChannel: vi.fn() },
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: authUser.current, loading: false, isPasswordRecovery: false }) }))
vi.mock('../../hooks/useGoBack', () => ({ useGoBack: () => goBack }))
vi.mock('../../lib/supabase-database', () => ({ supabaseDb: db }))

import { ItemDetail } from '../item-detail'
import { useInventoryStore } from '../../stores/useInventoryStore'

const baseItem: ProductItem = { id: 'WC-001', product_id: 'PRD-1', status: 'available', condition: 'good', location: '倉庫A', qr_code: 'WC-001' }
const history = (from: ItemHistory['from_status'], to: ItemHistory['to_status']): ItemHistory =>
  ({ id: `${from}-${to}`, item_id: 'WC-001', action: 'x', from_status: from, to_status: to, timestamp: '2026-11-01T00:00:00Z', performed_by: '田中' } as ItemHistory)

function setup(item: Partial<ProductItem> = {}, histories: ItemHistory[] = [], role?: 'admin') {
  authUser.current = { email: 'x@example.com', user_metadata: {}, ...(role ? { app_metadata: { role } } : {}) }
  db.getProductItemById.mockResolvedValue({ ...baseItem, ...item })
  db.getProductById.mockResolvedValue({ id: 'PRD-1', name: 'デモ車いす', category_id: 'wheelchair' })
  db.getItemHistoriesByItemId.mockResolvedValue(histories)
  useInventoryStore.setState({ items: [{ ...baseItem, ...item }], users: [] })
  render(
    <MemoryRouter initialEntries={['/item/WC-001']}>
      <Routes><Route path="item/:itemId" element={<ItemDetail />} /></Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('個体詳細の管理者操作（完全消去）', () => {
  it('管理者でなければ枠そのものが出ない', async () => {
    setup()
    await screen.findAllByText('WC-001')
    expect(screen.queryByText('管理者操作')).toBeNull()
  })

  it('管理者なら枠とボタンが出る', async () => {
    setup({}, [], 'admin')
    expect(await screen.findByRole('button', { name: 'この個体を完全に消去' })).toBeEnabled()
  })

  it('貸与中はボタンが非活性で理由が出る', async () => {
    setup({ status: 'rented' }, [], 'admin')
    expect(await screen.findByRole('button', { name: 'この個体を完全に消去' })).toBeDisabled()
    expect(screen.getByText(/貸与中のため消去できません/)).toBeInTheDocument()
  })

  it('空白を除いて一致すれば実行でき、成功したらストアから消えて元の画面へ戻る', async () => {
    db.eraseProductItem.mockResolvedValue({ histories: 2, label_queue: 0, preparation_tasks: 0 })
    setup({}, [history('unknown', 'available'), history('available', 'cleaning')], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    expect(screen.getByText('本当に完全消去しますか？')).toBeInTheDocument()
    expect(screen.getByText(/消える履歴 2 件/)).toBeInTheDocument()
    expect(screen.queryByText(/貸与の記録/)).toBeNull()

    const run = screen.getByRole('button', { name: '完全に消去する' })
    expect(run).toBeDisabled()
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: ' WC-001 ' } })
    expect(run).toBeEnabled()
    fireEvent.click(run)

    await waitFor(() => expect(db.eraseProductItem).toHaveBeenCalledWith('WC-001'))
    await waitFor(() => expect(goBack).toHaveBeenCalled())
    expect(useInventoryStore.getState().items.find(i => i.id === 'WC-001')).toBeUndefined()
    expect(window.alert).toHaveBeenCalledWith('WC-001 を消去しました（履歴 2 件）')
  })

  it('貸与の記録があれば赤字で警告するが、止めはしない', async () => {
    setup({}, [history('available', 'rented'), history('rented', 'returned'), history('returned', 'cleaning')], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    expect(screen.getByText(/貸与の記録が 2 件あります/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: 'WC-001' } })
    expect(screen.getByRole('button', { name: '完全に消去する' })).toBeEnabled()
  })

  it('失敗したらダイアログ内に理由を出し、閉じない', async () => {
    db.eraseProductItem.mockRejectedValue(new Error('この個体はすでに存在しません'))
    setup({}, [], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: 'WC-001' } })
    fireEvent.click(screen.getByRole('button', { name: '完全に消去する' }))
    expect(await screen.findByText('この個体はすでに存在しません')).toBeInTheDocument()
    expect(screen.getByText('本当に完全消去しますか？')).toBeInTheDocument()
    expect(goBack).not.toHaveBeenCalled()
  })

  it('消去中は二度押しできない', async () => {
    let resolve!: (v: unknown) => void
    db.eraseProductItem.mockReturnValue(new Promise(r => { resolve = r }))
    setup({}, [], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: 'WC-001' } })
    const run = screen.getByRole('button', { name: '完全に消去する' })
    fireEvent.click(run)
    fireEvent.click(screen.getByRole('button', { name: '消去中…' }))
    expect(db.eraseProductItem).toHaveBeenCalledTimes(1)
    resolve({ histories: 0, label_queue: 0, preparation_tasks: 0 })
    await waitFor(() => expect(goBack).toHaveBeenCalled())
  })
})
```

`item-detail.tsx` が他にも import しているモジュール（`maintenance-checklist-config`、`utils`）は実物で動く。描画で `supabase` の別メソッドに触って落ちるなら、その名前を `vi.mock('../../lib/supabase')` に足す。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/pages/__tests__/item-detail-erase.test.tsx`
Expected: 1 本目（非管理者で枠が出ない）だけ PASS、残りは FAIL

- [ ] **Step 3: カード・ダイアログ・ハンドラを実装する**

- `const isAdmin = isAdminUser(user)`、`const rentalRecordCount = histories.filter(isRentalRecord).length`、`const confirmMatches = eraseConfirmText.trim() === item.id`
- `handleErase`: `erasing` なら即 return → `setErasing(true); setEraseError(null)` → `try { const result = await supabaseDb.eraseProductItem(item.id); removeItemLocally(item.id); setShowEraseDialog(false); alert(...); goBack() } catch (e) { setEraseError(e instanceof Error ? e.message : '消去に失敗しました') } finally { setErasing(false) }`
- ダイアログを開くときは `eraseConfirmText` と `eraseError` を空に戻す
- 「完全に消去する」ボタンの `disabled` は `!confirmMatches || erasing`
- カードは `border-destructive/40` 系の枝色で他のカードと見分けがつくようにする。`Dialog` / `Button` / `Input` / `Label` は既に import 済み

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/pages/__tests__/item-detail-erase.test.tsx`
Expected: PASS（7 件）

- [ ] **Step 5: 型チェックと全テスト**

Run: `npm run type-check && npm test`
Expected: どちらも exit 0

- [ ] **Step 6: コミットはまだしない**（UI は Task 8 の撮影を田口さんに見てもらってから）

---

### Task 8: デモ撮影で管理者の画面を確認し、田口さんの OK を取ってコミット

**Files:**
- Modify: `scripts/demo-check.mjs`
  - `auth_user` に `app_metadata: { role: 'admin' }` を足す（コメント: 「個体詳細の『管理者操作』の枠を撮るため。`src/lib/admin.ts` と同じ判定」）
  - `DEFAULT_ROUTES` に `'/item/WC-001'`（利用可能・消せる）と `'/item/WC-003'`（貸与中・ボタン非活性）を足す

**Interfaces:**
- Consumes: Task 7 の画面

- [ ] **Step 1: `demo-check.mjs` を直す**

- [ ] **Step 2: デモモードで撮る**

Run（2 つの端末、または 1 つ目を `run_in_background`）:
```bash
npm run dev:demo
node scripts/demo-check.mjs /item/WC-001 /item/WC-003
```
Expected: `/tmp/demo-shots/` に 2 枚。WC-001 には「管理者操作」の枠と活性のボタン、WC-003 には非活性のボタンと「貸与中のため消去できません」が写っている。`problems` が 0

- [ ] **Step 3: ダイアログも撮る**

`node -e` か短い Playwright スクリプトで、WC-001 でボタンを押してダイアログを開き、管理番号を入れた状態を 1 枚撮る（スクラッチパッドに置く。リポジトリには入れない）。

- [ ] **Step 4: 田口さんに 3 枚を見せて OK をもらう**

`SendUserFile` で 3 枚を送り、「枠の位置・文言・ダイアログ」で直したい点を聞く。直しが出たら Task 7 Step 3 に戻る。

- [ ] **Step 5: OK が出たらコミット**

```bash
git add src/pages/item-detail.tsx src/pages/__tests__/item-detail-erase.test.tsx scripts/demo-check.mjs
git commit -m "feat(item-detail): 管理者だけに「管理者操作」を出し、個体を完全消去できるようにする"
```

---

### Task 9: 仕上げと本番への手渡し

**Files:** 変更なし（確認とやり取りだけ）

- [ ] **Step 1: 全部を通す**

Run: `npm run type-check && npm test && npm run build && (cd mcp-server && npm run build) && git status --short`
Expected: すべて exit 0。`git status` は空（生成物の差分も無い）

- [ ] **Step 2: lint が増えていないことを見る**

Run: `npx eslint $(git diff --name-only origin/main -- 'src/**/*.ts' 'src/**/*.tsx' | tr '\n' ' ')`
Expected: 自分が触った・足したファイルに新しいエラーが無い（既存ファイルの既存エラーは据え置き）

- [ ] **Step 3: 田口さんに SQL を渡す**

次の順で伝える:
1. `sql/add-erase-product-item.sql` を開き、`<田口さんのメールアドレス>` を本人のメールに置き換える（MCP 専用アカウントのメールにしないこと）
2. Supabase ダッシュボード → SQL Editor で全文を流す
3. 末尾の確認クエリ 3 つの結果: 関数が 2 行、`product_items` のポリシーが `DELETE / INSERT / SELECT / UPDATE` の 4 行、`admin` が本人だけ

- [ ] **Step 4: SQL が通ったと聞いてから push（確認が入る）**

```bash
git push origin main
```
本番で `assets/index-<hash>.js` のハッシュが変わったのを確認する。

- [ ] **Step 5: 本番での動作確認を田口さんに依頼する**

設計書 §6 の 5〜7: ログインし直す → 個体詳細に「管理者操作」が出る → テスト用に 1 台を新規登録（状態メモに「新品」を書かない。履歴 3 行が自動で付く）→ 消去 → 在庫一覧・履歴画面・ラベルキューから消えている。別スタッフのアカウントで枠が出ないことも、できれば。

- [ ] **Step 6: メモリを更新する**

`~/.claude/projects/.../memory/` に `erase-product-item-feature.md`（本番投入日、SQL 適用済みか、管理者は app_metadata 方式、MCP は専用アカウント）を Write で作り、`MEMORY.md` に 1 行足す。
