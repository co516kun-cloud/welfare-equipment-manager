# スキャン後に続けて処理する 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1 回のスキャンで、返却済み → 消毒完了 → メンテナンス完了 → 入庫処理 のように工程を続けて進められるようにする。ダイアログは 1 枚のまま、処理中は見て分かる。

**Architecture:** 処理ダイアログ `ScanActionDialog` が成功後に閉じる代わりに、中身を「完了・次の工程」ビューに切り替える。次の工程ボタンは親 `scan.tsx` の `handleActionSelect` をそのまま呼び、同じダイアログがその工程のフォームになる。成功のたびに最新の個体を親へ返して選択中の台を最新化し、店舗データの全件再読込は閉じたときの `onSuccess` だけで行う。判定（続けられるステータス・危険な操作の除外）は遷移表 `item-status.ts` に置く。

**Tech Stack:** React 18 + TypeScript、Radix Dialog（`./ui/dialog`）、zustand、vitest + @testing-library/react、Playwright（デモ撮影）

**Spec:** `docs/superpowers/specs/2026-11-19-scan-continue-design.md`

## Global Constraints

- ステータスの文字列リテラル（`'returned'` など）を新しいファイルに書かない。定数は `src/lib/item-status.ts` に置き、テストは `Object.keys(STATUS_LABEL)` か定数から取る（CLAUDE.md「型チェックゲートの誤判定」）
- `mcp-server/src/shared/item-status.ts` は直接編集しない。`cd mcp-server && npm run build` で再生成してコミットに含める
- 文言（仕様 §6.1 / §6.3 固定）: 見出し「処理が完了しました」、問い「続けて処理しますか？」、終了ボタン「続けない（次の台をスキャン）」、処理中の実行ボタン「処理中…」、遷移の表示は `{STATUS_LABEL[前]} → {STATUS_LABEL[後]}`
- 完了ビューを出すステータスは 6 つだけ: returned / cleaning / maintenance / out_of_order / unknown / demo_cancelled（仕様 §6.2）
- 完了ビューの次の工程ボタンに `danger`（廃棄・寄贈）は出さない
- DB・SQL・MCP のツールは変えない。`src/` を触ったらコミット前に `npm run type-check` と `npm test`
- UI はデモ画面の画像を田口さんに見せてからマージ・デプロイ（CLAUDE.md）。ブランチ `feat/scan-continue` 上ではタスクごとにコミットしてよい
- コミットは `type(scope): 何をどうしたか`、日本語

## Review Focus

1. 処理中に「処理実行」を二度押しする → 保存も履歴も 1 回だけ（Task 2 のテスト）
2. 完了ビューを出す前の最新取り直しがネットワークで失敗する → 失敗を見せず、保存した値で完了ビューを出す（Task 3 のテスト）
3. 完了ビューを見ている間にカメラが別の台を読んで `selectedItem` が差し替わる → 「続ける」は完了した台で続く（Task 3 のテスト: 続ける前に `onItemUpdated(完了した台)` を呼ぶ）
4. 完了ビューを外側クリック・Esc で閉じる → 「続けない」と同じ片付け（`onSuccess` が 1 回呼ばれる）（Task 3 のテスト）
5. メンテナンス完了で「要修理」を選ぶと `finalStatus` は故障中になる → 完了ビューは「→ 故障中」と出し、次の工程は「修理完了」だけ（Task 1 のテスト `getContinueActions('out_of_order')`。Task 3 は `action.nextStatus` ではなく `finalStatus` を使う）

---

### Task 1: 遷移表に「続けられるステータス」と「続ける操作」を足す

**Files:**
- Modify: `src/lib/item-status.ts`（末尾、`isRentalRecord` の後）
- Test: `src/lib/__tests__/scan-continue.test.ts`（新規）
- Regenerate: `mcp-server/src/shared/item-status.ts`

**Interfaces:**
- Consumes: 既存の `ItemStatus`, `ItemAction`, `ActionContext`, `getAvailableActions`, `needsConfirm`, `STATUS_LABEL`
- Produces:
  - `export const CONTINUABLE_STATUSES: readonly ItemStatus[]`
  - `export function canContinueAfter(status: ItemStatus): boolean`
  - `export function getContinueActions(status: ItemStatus, ctx?: ActionContext): ItemAction[]` — `getAvailableActions` から `needsConfirm` が真の操作を除いたもの

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/__tests__/scan-continue.test.ts
import { describe, it, expect } from 'vitest'
import { STATUS_LABEL, CONTINUABLE_STATUSES, canContinueAfter, getContinueActions, needsConfirm, type ItemStatus } from '../item-status'

const ALL = Object.keys(STATUS_LABEL) as ItemStatus[]

describe('スキャン後に続けられるステータス', () => {
  it('倉庫の中で工程が残っている 6 つだけ続けられる', () => {
    expect([...CONTINUABLE_STATUSES]).toEqual(['returned', 'cleaning', 'maintenance', 'out_of_order', 'unknown', 'demo_cancelled'])
    for (const s of ALL) expect(canContinueAfter(s), s).toBe(CONTINUABLE_STATUSES.includes(s))
  })
})

describe('続ける操作', () => {
  it('どのステータスでも危険な操作（廃棄・寄贈）は含まない', () => {
    for (const s of ALL) {
      for (const a of getContinueActions(s)) expect(needsConfirm(a), `${s}:${a.key}`).toBe(false)
    }
  })
  it('消毒済みの次はメンテナンス完了だけ、故障中の次は修理完了だけ', () => {
    expect(getContinueActions('cleaning').map(a => a.key)).toEqual(['maintenance'])
    expect(getContinueActions('out_of_order').map(a => a.key)).toEqual(['repair'])
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/__tests__/scan-continue.test.ts > <workspace>/t1-red.log 2>&1; grep -E "FAIL|✓|×|Tests " <workspace>/t1-red.log`
Expected: FAIL。`CONTINUABLE_STATUSES` / `canContinueAfter` / `getContinueActions` が export されていない旨

- [ ] **Step 3: `item-status.ts` 末尾に 3 つを実装する**

JSDoc に「スキャン後に続けて処理する（2026-11-19・田口さん依頼）。出すのは倉庫の中で工程が残っている状態だけ。入庫で利用可能になった直後に『直接貸与』を見せると押し間違いの元になる」と書く。`getContinueActions` は `getAvailableActions(status, ctx).filter(a => !needsConfirm(a))`。

- [ ] **Step 4: 通ることを確認する**

Run: `npx vitest run src/lib/__tests__/scan-continue.test.ts > <workspace>/t1-green.log 2>&1; grep -E "Tests " <workspace>/t1-green.log`
Expected: `Tests  3 passed (3)`

- [ ] **Step 5: MCP 側の写しを再生成し、型チェックを通す**

Run: `(cd mcp-server && npm run build) > <workspace>/t1-mcp.log 2>&1; echo $?; git status --short mcp-server/src/shared/; npm run type-check 2>&1 | tail -2`
Expected: exit 0、`mcp-server/src/shared/item-status.ts` が変更として出る、型チェック「新規エラーなし」。「解消 N 件・新規 N 件」が同数で exit 1 になったら CLAUDE.md「罠」のとおり定数の置き場所を見直す

- [ ] **Step 6: コミット**

```bash
git add src/lib/item-status.ts src/lib/__tests__/scan-continue.test.ts mcp-server/src/shared/item-status.ts
git commit -m "feat(item-status): スキャン後に続けられるステータスと、続ける操作の一覧を遷移表に足す"
```

---

### Task 2: 処理ダイアログに「処理中」を入れる

**Files:**
- Modify: `src/components/scan-action-dialog.tsx`（state 宣言部、`handleActionSubmit`、`Dialog onOpenChange`、フッターのボタン）
- Test: `src/components/__tests__/scan-continue-dialog.test.tsx`（新規。Task 3 も同じファイルに足す）

**Interfaces:**
- Consumes: 既存の `ScanActionDialogProps`
- Produces: 画面上の状態のみ（実行ボタンの文言「処理中…」と `disabled`、キャンセルの `disabled`、処理中は `onOpenChange(false)` を無視）

- [ ] **Step 1: 失敗するテストを書く**

モックは `src/components/__tests__/label-print-after-storage.test.tsx` と同じ形（`supabase-database` / `supabase` / `useInventoryStore`）。`getProductItemById` と `saveProductItem` は `vi.fn()` を外に出して各テストで差し替える。

```tsx
// src/components/__tests__/scan-continue-dialog.test.tsx
const returnedItem = {
  id: 'WC-004', product_id: 'PRD-1', status: 'returned', condition: 'good',
  location: '倉庫', qr_code: 'WC-004',
  product: { id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair' },
}
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
// renderDialog(props) は label-print テストと同じ形で、actionType / onSuccess / onOpenChange / onContinue / onItemUpdated を上書きできるようにする

describe('処理中の表示', () => {
  it('処理実行を押すと「処理中…」になり、終わるまで実行もキャンセルも押せない', async () => {
    const pending = deferred<unknown>()
    getProductItemById.mockReturnValueOnce(pending.promise)
    renderDialog({ selectedItem: returnedItem, actionType: 'clean' })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    const busy = await screen.findByRole('button', { name: '処理中…' })
    expect(busy).toBeDisabled()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
    pending.resolve(returnedItem)
    await waitFor(() => expect(saveProductItem).toHaveBeenCalledTimes(1))
  })
  it('処理中に二度押ししても保存は 1 回', async () => {
    const pending = deferred<unknown>()
    getProductItemById.mockReturnValueOnce(pending.promise)
    renderDialog({ selectedItem: returnedItem, actionType: 'clean' })
    const btn = screen.getByRole('button', { name: '処理実行' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    pending.resolve(returnedItem)
    await waitFor(() => expect(saveProductItem).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/components/__tests__/scan-continue-dialog.test.tsx > <workspace>/t2-red.log 2>&1; grep -E "FAIL|✓|×|Tests " <workspace>/t2-red.log`
Expected: 1 本目は「処理中…」ボタンが見つからず FAIL、2 本目は `saveProductItem` が 2 回で FAIL

- [ ] **Step 3: `isProcessing` を実装する**

- `const [isProcessing, setIsProcessing] = useState(false)`
- `handleActionSubmit`: 先頭に `if (isProcessing) return`。同期の入力チェック（既存の `alert` で return する部分）の後、サーバー確認の `try` の直前で `setIsProcessing(true)`。既存の `try { ... } catch { ... }` を `try { ... } catch { ... } finally { setIsProcessing(false) }` にし、サーバー確認の `try/catch` も同じ `try` の中に入れる（途中の `return` でも必ず戻る）
- 実行ボタン: `disabled={isProcessing}`、文言は `isProcessing ? '処理中…' : 従来の文言`
- キャンセル: `disabled={isProcessing}`
- `Dialog onOpenChange`: `if (!open && isProcessing) return` を先頭に

- [ ] **Step 4: 通ることを確認する（既存のダイアログテストも）**

Run: `npx vitest run src/components/__tests__/ > <workspace>/t2-green.log 2>&1; grep -E "Tests |FAIL" <workspace>/t2-green.log`
Expected: 新規 2 本を含め全部 passed、FAIL なし

- [ ] **Step 5: コミット**

```bash
git add src/components/scan-action-dialog.tsx src/components/__tests__/scan-continue-dialog.test.tsx
git commit -m "feat(scan-dialog): 処理中は「処理中…」にして二度押しと途中で閉じるのを防ぐ"
```

---

### Task 3: 処理ダイアログの中身を「完了・次の工程」に切り替える

**Files:**
- Modify: `src/components/scan-action-dialog.tsx`（props、state、成功パス、`Dialog onOpenChange`、描画）
- Test: `src/components/__tests__/scan-continue-dialog.test.tsx`（Task 2 のファイルに追記）

**Interfaces:**
- Consumes: Task 1 の `canContinueAfter`, `getContinueActions`、既存の `STATUS_LABEL`, `ItemAction`
- Produces: `ScanActionDialogProps` に 2 つ追加
  - `onContinue?: (action: ItemAction) => void` — 次の工程ボタンで呼ぶ。親は `handleActionSelect` を渡す
  - `onItemUpdated?: (item: ProductItem) => void` — 成功のたびに 1 回、手元で最も新しい個体を渡す

- [ ] **Step 1: 失敗するテストを書く**

```tsx
describe('完了ビュー', () => {
  it('消毒完了の成功後、同じダイアログが完了ビューになり次の工程だけが出る', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce({ ...returnedItem, status: 'cleaning' })
    const onSuccess = vi.fn(), onItemUpdated = vi.fn()
    renderDialog({ selectedItem: returnedItem, actionType: 'clean', onSuccess, onItemUpdated })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    expect(screen.getByText('返却済み → 消毒済み')).toBeInTheDocument()
    expect(screen.getByText('続けて処理しますか？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メンテナンス完了' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '廃棄' })).toBeNull()
    expect(screen.queryByRole('button', { name: '処理実行' })).toBeNull()
    expect(onItemUpdated).toHaveBeenCalledTimes(1)
    expect(onItemUpdated.mock.calls[0][0]).toMatchObject({ id: 'WC-004', status: 'cleaning' })
    expect(onSuccess).not.toHaveBeenCalled()
  })
  it('次の工程を押すと、完了した台で onContinue が呼ばれる', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce({ ...returnedItem, status: 'cleaning' })
    const onContinue = vi.fn(), onItemUpdated = vi.fn()
    const { rerender } = renderDialog({ selectedItem: returnedItem, actionType: 'clean', onContinue, onItemUpdated })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    // カメラが別の台を読んで selectedItem が差し替わった状況（Review Focus 3）
    rerender(dialogElement({ selectedItem: { ...returnedItem, id: 'WC-009', qr_code: 'WC-009' }, actionType: 'clean', onContinue, onItemUpdated }))
    fireEvent.click(screen.getByRole('button', { name: 'メンテナンス完了' }))
    expect(onItemUpdated).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'WC-004', status: 'cleaning' }))
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ key: 'maintenance' }))
    expect(screen.queryByText('処理が完了しました')).toBeNull()
  })
  it('「続けない」で閉じて onSuccess が 1 回呼ばれる', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce({ ...returnedItem, status: 'cleaning' })
    const onSuccess = vi.fn(), onOpenChange = vi.fn()
    renderDialog({ selectedItem: returnedItem, actionType: 'clean', onSuccess, onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    fireEvent.click(screen.getByRole('button', { name: '続けない（次の台をスキャン）' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
  it('完了ビューを Esc で閉じても「続けない」と同じ片付けになる', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce({ ...returnedItem, status: 'cleaning' })
    const onSuccess = vi.fn()
    renderDialog({ selectedItem: returnedItem, actionType: 'clean', onSuccess })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
  it('最新の取り直しに失敗しても、保存した値で完了ビューを出す', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockRejectedValueOnce(new Error('network down'))
    const onItemUpdated = vi.fn()
    renderDialog({ selectedItem: returnedItem, actionType: 'clean', onItemUpdated })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    expect(screen.getByText('返却済み → 消毒済み')).toBeInTheDocument()
    expect(onItemUpdated.mock.calls[0][0]).toMatchObject({ id: 'WC-004', status: 'cleaning' })
  })
  it('入庫処理は利用可能になるので完了ビューを出さず、今までどおり印刷確認に進む', async () => {
    const maintenanceItem = { ...returnedItem, id: 'BD-003', qr_code: 'BD-003', status: 'maintenance' }
    getProductItemById.mockResolvedValue(maintenanceItem)
    renderDialog({ selectedItem: maintenanceItem, actionType: 'storage' })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByRole('button', { name: 'ラベルを印刷する' })
    expect(screen.queryByText('処理が完了しました')).toBeNull()
  })
})
```

`dialogElement(props)` は `renderDialog` が描く JSX を返すヘルパ（rerender 用）。Esc のテストで Radix の keydown が jsdom に届かず `onSuccess` が呼ばれない場合は、`fireEvent.keyDown(screen.getByRole('dialog'), ...)` に変えて再確認する。それでも届かなければ、その 1 本だけ外して台帳に `Ruling` を書き、残りを通す。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/components/__tests__/scan-continue-dialog.test.tsx > <workspace>/t3-red.log 2>&1; grep -E "FAIL|✓|×|Tests " <workspace>/t3-red.log`
Expected: 完了ビューの 6 本が「処理が完了しました」が見つからず FAIL（入庫の 1 本は `queryByText` が null で通ってもよい。通るならその旨を台帳に書く）。Task 2 の 2 本は通ったまま

- [ ] **Step 3: 完了ビューを実装する**

- import に `canContinueAfter`, `getContinueActions`, `type ItemAction`（item-status）と `useEffect`（react）を足す
- props に `onContinue?`, `onItemUpdated?` を足す
- state: `const [completed, setCompleted] = useState<{ from: ItemStatus; to: ItemStatus; item: SelectedItem } | null>(null)`。`useEffect(() => { if (!open) setCompleted(null) }, [open])`
- 成功パス（`if (actionType === 'storage') { ... } else { resetForm(); onOpenChange(false); onSuccess() }`）を次の 3 分岐にする:
  1. `storage` → 従来どおり印刷確認。その前に `onItemUpdated?.(updatedItem)`
  2. `canContinueAfter(finalStatus)` → `const latest = (await supabaseDb.getProductItemById(selectedItem.id).catch(() => null)) ?? updatedItem` → `onItemUpdated?.(latest)` → `resetForm()` → `setCompleted({ from: selectedItem.status, to: latest.status, item: { ...latest, product: selectedItem.product } })`。判定も表示も **`action.nextStatus` ではなく保存した `finalStatus`（= `latest.status`）** を使う（要修理 → 故障中）
  3. それ以外 → `onItemUpdated?.(updatedItem)` → 従来どおり `resetForm(); onOpenChange(false); onSuccess()`
- `continueWith(action: ItemAction)`: `onItemUpdated?.(completed.item)` → `setCompleted(null)` → `onContinue?.(action)`
- `stopHere()`: `setCompleted(null); resetForm(); onOpenChange(false); onSuccess()`
- `Dialog onOpenChange`: 閉じる向きで `completed` が非 null なら `stopHere()` を呼んで return（Esc・外側クリック）
- 描画: `completed` が非 null のときは `DialogHeader`（`DialogTitle` 「処理が完了しました」、`DialogDescription` `{item.product?.name} #{item.id}`）、`<p>{STATUS_LABEL[from]} → {STATUS_LABEL[to]}</p>`、`<p>続けて処理しますか？</p>`、`getContinueActions(to).map(a => <Button key={a.key} onClick={() => continueWith(a)}>{a.label}</Button>)`、`<Button variant="outline" onClick={stopHere}>続けない（次の台をスキャン）</Button>` を出し、従来のフォームは出さない。見た目は既存のダイアログの流儀（`space-y-4`、ボタンは `w-full` で縦に並べる）

- [ ] **Step 4: 通ることを確認する（ダイアログのテスト全部）**

Run: `npx vitest run src/components/__tests__/ > <workspace>/t3-green.log 2>&1; grep -E "Tests |FAIL" <workspace>/t3-green.log`
Expected: 全部 passed、FAIL なし

- [ ] **Step 5: コミット**

```bash
git add src/components/scan-action-dialog.tsx src/components/__tests__/scan-continue-dialog.test.tsx
git commit -m "feat(scan-dialog): 成功後に閉じずに完了ビューへ切り替え、同じ台の次の工程を続けられるようにする"
```

---

### Task 4: スキャン画面に配線する（PC・スマホ）

**Files:**
- Modify: `src/pages/scan.tsx`（`handleActionSelect` の下にハンドラ追加、末尾の `MobileScanUI` と `ScanActionDialog` に props 追加）
- Modify: `src/components/mobile-scan-ui.tsx`（props 2 つを通す）
- Test: `src/pages/__tests__/scan-continue-flow.test.tsx`（新規）

**Interfaces:**
- Consumes: Task 3 の `onContinue(action: ItemAction)`, `onItemUpdated(item: ProductItem)`
- Produces: `scan.tsx` 内 `handleItemUpdated(latest: ProductItem): void` — `setSelectedItem(prev => ({ ...latest, product: prev?.product ?? products.find(p => p.id === latest.product_id) }))` と、店舗の `items` への 1 行マージ `useInventoryStore.setState(s => ({ items: s.items.map(i => i.id === latest.id ? { ...i, ...latest } : i) }))`

- [ ] **Step 1: 失敗するテストを書く**

`src/pages/__tests__/scan-dialog-single.test.tsx` のモックをそのまま使い、`storeState` に `setState: vi.fn()` を、`useInventoryStore` のモックに `setState` を足す。個体は `WC-004`（`status: 'returned'`）。`getProductItemById` は `vi.fn()` を外に出し、`mockResolvedValueOnce(返却済みの行).mockResolvedValueOnce(消毒済みの行)`。

```tsx
describe('QRスキャン画面: 続けて処理する', () => {
  it('消毒完了のあと、同じダイアログでメンテナンス完了のフォームに進める', async () => {
    render(<MemoryRouter><Scan /></MemoryRouter>)
    const input = screen.getByPlaceholderText(/QRコードを入力/)
    fireEvent.change(input, { target: { value: 'WC-004' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })
    fireEvent.click(await screen.findByRole('button', { name: '消毒完了' }))
    fireEvent.click(await screen.findByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    fireEvent.click(screen.getByRole('button', { name: 'メンテナンス完了' }))
    expect(await screen.findByText('メンテナンス完了処理')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '処理実行' })).toHaveLength(1)
    expect(storeState.loadData).not.toHaveBeenCalled()
    // 個体カードのステータスも最新になっている
    expect(screen.getAllByText('消毒済み').length).toBeGreaterThanOrEqual(1)
  })
  it('「続けない」で閉じると店舗データの再読込が 1 回走る', async () => {
    render(<MemoryRouter><Scan /></MemoryRouter>)
    const input = screen.getByPlaceholderText(/QRコードを入力/)
    fireEvent.change(input, { target: { value: 'WC-004' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })
    fireEvent.click(await screen.findByRole('button', { name: '消毒完了' }))
    fireEvent.click(await screen.findByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    fireEvent.click(screen.getByRole('button', { name: '続けない（次の台をスキャン）' }))
    await waitFor(() => expect(screen.queryByText('処理が完了しました')).toBeNull())
    expect(storeState.loadData).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/pages/__tests__/scan-continue-flow.test.tsx > <workspace>/t4-red.log 2>&1; grep -E "FAIL|✓|×|Tests " <workspace>/t4-red.log`
Expected: 1 本目は「メンテナンス完了」を押しても `onContinue` が配線されていないので「メンテナンス完了処理」が出ず FAIL。2 本目は配線前でも通りうる（通ったら台帳に書く）

- [ ] **Step 3: 配線する**

- `scan.tsx`: `handleItemUpdated` を `useCallback` で追加（Interfaces のとおり）。`ScanActionDialog`（PC）と `MobileScanUI` に `onContinue={handleActionSelect}` と `onItemUpdated={handleItemUpdated}` を渡す
- `mobile-scan-ui.tsx`: `MobileScanUIProps` に `onContinue?: (action: ItemAction) => void` と `onItemUpdated?: (item: ProductItem) => void` を足し、中の `ScanActionDialog` へそのまま渡す（`ItemAction` は `../lib/item-status` から import）

- [ ] **Step 4: 通ることを確認する（スキャン関連のテスト全部）**

Run: `npx vitest run src/pages/__tests__/scan-continue-flow.test.tsx src/pages/__tests__/scan-dialog-single.test.tsx src/pages/__tests__/scan-scroll.test.tsx src/components/__tests__/ > <workspace>/t4-green.log 2>&1; grep -E "Tests |FAIL" <workspace>/t4-green.log`
Expected: 全部 passed、FAIL なし

- [ ] **Step 5: 型チェックとコミット**

Run: `npm run type-check 2>&1 | tail -2`
Expected: 「新規エラーなし」

```bash
git add src/pages/scan.tsx src/components/mobile-scan-ui.tsx src/pages/__tests__/scan-continue-flow.test.tsx
git commit -m "feat(scan): 処理の完了ビューから同じ台の次の工程へ進めるようにし、選択中の台を最新化する"
```

---

### Task 5: デモ画面を撮って田口さんに見せ、全体を検証する

**Files:**
- Create（リポジトリ外）: `<scratchpad>/scan-continue-shot.mjs` — 前回の `erase-dialog-shot.mjs` と同じ Playwright の起こし方（`resolvePlaywright`、`addInitScript` で `auth_user` を入れる。管理者は不要）
- 出力: `<workspace>/shots/` に png

**Interfaces:**
- Consumes: Task 1〜4 の全部。`npm run dev:demo`（http://localhost:5199）

- [ ] **Step 1: dev:demo を起こして 2 枚撮る**

スクリプトの流れ: `/scan` を開く → `getByPlaceholder(/QRコードを入力/)` に `WC-004`（デモの種データで返却済み）を入れて Enter → 「消毒完了」を押す → 「処理実行」を押す → `getByText('処理が完了しました')` を待って **1 枚目**（完了ビュー: 「返却済み → 消毒済み」「メンテナンス完了」「続けない（次の台をスキャン）」）→ 「メンテナンス完了」を押す → 見出し「メンテナンス完了処理」を待って **2 枚目**（同じダイアログがフォームになった）。「処理中…」はデモのモックが即応答するので画像にならない。Task 2 のテストで固定済みと田口さんに伝える。

Run: `npm run dev:demo > <workspace>/dev-demo.log 2>&1 &` → 起動を待って `node <scratchpad>/scan-continue-shot.mjs <workspace>/shots`
Expected: 2 枚の png。撮影後に dev:demo を止める（`pkill -f "vite --config vite.config.demo.ts"`。自分のシェルも一致して exit 144 になるが止まっている）

- [ ] **Step 2: 画像を見せる**

Windows の `explorer.exe` でフォルダを開き、Windows パスを伝える（前回と同じ。SendUserFile のカードは見えないことがあった）。「確認 OK」が来るまでマージに進まない。直しが出たら該当タスクの流儀（テスト → 実装 → コミット）で直す

- [ ] **Step 3: 全体検証**

Run: `npm test > <workspace>/final-test.log 2>&1; grep -E "Test Files|Tests " <workspace>/final-test.log; npm run type-check 2>&1 | tail -1; npm run build > <workspace>/final-build.log 2>&1; echo build=$?; npm run lint 2>&1 | grep -cE "^\s+[0-9]+:[0-9]+\s+error" `
Expected: Test Files 全部 passed（着手前 48 ファイル 419 件 + 新規 3 ファイル）、型チェック「新規エラーなし」、build=0、lint の error 件数が着手前（17）から増えていない

- [ ] **Step 4: ここで superpowers:finishing-a-development-branch へ**

（コミットはタスクごとに済んでいる。マージ・push は田口さんの「確認 OK」の後）
