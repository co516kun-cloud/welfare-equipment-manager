# 改善バッチ1 設計書（2026-09-07）

田口さんの指示（2026-09-07）を受けて、**どう直すか**だけをまとめたもの。実装はこの設計書を読んだ別セッションが行う。

対象リポジトリ: `welfare-equipment-manager`（main `7af3021` 時点）。読む前提: `scripts/print-agent/README.md`、`.vuln-scan/report-20260904-0843.md`、全体マップ（Claude Artifact「福祉用具管理アプリ 全体マップ」）。

---

## 0. 決定事項と未決事項

### 田口さんが決めたこと

| # | 項目 | 決定 |
|---|---|---|
| 1 | ステータス表記 | 統一する。**消毒 → 「消毒済み」**、**貸出 → 「貸与中」** |
| 2 | 件数バッジ | 正しく直す |
| 3 | 予約済み（reserved）の個体 | きちんとした形に直す |
| 4 | リアルタイム同期 | 以前うまくいかなかった。今できるか確認して進める |
| 5 | 消毒記録の月次出力 | 機能として追加 |
| 6 | 管理番号の自動採番 | 機能として追加 |
| 7 | 準備リマインダー通知 | **保留**。もう少し深掘ってから（§11 に調査メモ） |
| 8 | 写真の保存先 | DB（Base64）→ Supabase Storage へ移行 |
| 9 | AI機能ページ | 削除 |
| 10 | 初回読み込み | 常に軽くする。軽くできる所はどんどん軽く |

### 確認事項 A〜E（2026-09-07 田口さん回答済み → すべて確定）

| # | 確認 | 決定 |
|---|---|---|
| A | **在庫の数え方**: 承認待ちの発注も在庫から引くか（§3 で説明） | **引く**（在庫一覧の方式に統一） |
| B | 「メンテナンス中」→「メンテナンス済み」、「不明」→「状態不明」、「準備完了」→「配送準備完了」も揃える | **揃える**（`STATUS_LABEL` が正） |
| C | 承認バナーの件数に `partial_approved`（一部承認）を含める | **含める**（承認画面と同じ） |
| D | 写真バケットは非公開（署名付きURL） | **非公開** |
| E | 管理番号の接頭辞を商品ごとに持つ（`products.id_prefix`。無ければ既存個体から推定し、初回だけ保存を確認） | **持つ** |

未決事項は無い。§13 は記録として残す。

---

## 1. ステータス表記の統一

### 現状
`getStatusText` が **9ファイル**に別々に定義され、同じ個体が画面によって別の言葉で出る。

| DB値 | 正（`src/lib/item-status.ts` の `STATUS_LABEL`） | 今出ている別表記 |
|---|---|---|
| cleaning | 消毒済み | 清掃中（history/search/preparation）、消毒中（mypage/preparation） |
| rented | 貸与中 | 貸出中（inventory/preparation） |
| maintenance | メンテナンス済み | メンテナンス中（history/search/mypage/preparation）、メンテナンス（inventory） |
| unknown | 状態不明 | 不明（inventory/item-detail/search） |
| ready_for_delivery | 配送準備完了 | 準備完了（preparation）、他は case 無しで英語のまま |

### 変更
- 表示名の関数を **1つ**にする: `src/lib/item-status.ts` に `getStatusText(status): string` を追加（中身は `STATUS_LABEL[status] ?? status`）。色も同様に `getStatusColor(status)` を同ファイルに集約（現状の色は画面ごとに違うので、在庫一覧の配色を正とする）。
- 9ファイルのローカル定義を削除して import に置き換える:
  `approval.tsx:191` / `inventory.tsx:43,156` / `item-detail.tsx:250` / `preparation.tsx:239,499,999` / `history.tsx:192` / `scan.tsx:193` / `search.tsx:488` / `orders.tsx:327` / `mypage.tsx:876`
- ステータス変更ダイアログの選択肢（`inventory.tsx:1269`、`item-detail.tsx:831`、`search.tsx:947`、`history.tsx:556`）は `Object.entries(STATUS_LABEL)` から生成し、抜け（reserved / ready_for_delivery / disposed）を無くす。
- **注意**: `orders.tsx:327` の `getStatusText` は `Order.status`（pending/approved…）と `OrderItem.item_processing_status`（waiting/ready/delivered…）も一緒に扱っている。これは別の列挙なので、`ORDER_STATUS_LABEL` / `PROCESSING_STATUS_LABEL` として `src/lib/order-status.ts` に分離する。「準備完了」は order item の `ready` に残し、個体の `ready_for_delivery` は「配送準備完了」にして区別する。
- `japanese-parser.ts:17` の `'貸出中': 'rented'` は取込用の**入力**辞書なので残す（旧表記の CSV を読めるように）。

### 触るファイル
`src/lib/item-status.ts`（+ `mcp-server/scripts/sync-shared.mjs` が生成する `mcp-server/src/shared/item-status.ts` にも自動で反映される。生成スクリプトが `STATUS_LABEL` ブロックの書式に依存しているので、**ブロックの形を変えない**）、上記9ページ、`src/lib/order-status.ts`（新規）。

### テスト
- `item-status.test.ts` に「`getStatusText` は全11値で `STATUS_LABEL` と一致」「未知の値は素通し」を追加。
- 既存テスト `item-status.test.ts:116-121` は各ページのソース文字列に `'disposed'` があることを `readFileSync` で検査している。ローカル定義を消すと `'disposed'` の文字列が消えて落ちる可能性がある → **そのテストを「各ページが `getStatusText` を import している」に書き換える**（意図は同じ「全画面で廃棄を扱えること」）。

### リスク
文言が変わるので、現場で「清掃中」と呼んでいた人は一瞬戸惑う。田口さんが決めた方向なので進める。

---

## 2. 件数バッジの統一

### 現状
「準備待ち」の数え方が4通り、「マイページ」の数え方が4通り。バッジの数字と画面の件数が一致しないことがある。

| 場所 | 準備待ちの数え方 | マイページの数え方 |
|---|---|---|
| preparation.tsx:838（画面本体） | waiting/preparing/assigned かつ **未割当の枠のみ** | — |
| mypage.tsx:287（画面本体） | — | 担当一致 かつ `item_processing_status='ready'` かつ割当あり、**個体ごと** |
| mobile-bottom-nav.tsx:35 | waiting のみ、**quantity 全部**（割当済みも数える） | ready かつ割当あり、枠ごと |
| menu.tsx:157 | waiting/preparing/assigned、quantity 全部 | ready かつ個体が ready_for_delivery、**発注アイテム単位** |
| sidebar.tsx | （削除済み） | （削除済み） |

### 変更
`src/lib/order-counts.ts` を新設し、**画面本体と同じ定義**を関数にして全バッジから呼ぶ:

```ts
// 準備待ち = 準備画面「番号なし」タブに出る枠の数
export function countPreparationPending(orders: Order[]): number
// マイページ = マイページ本体に出るカードの数
export function countMyDeliveries(orders: Order[], items: ProductItem[], userName: string): number
// 承認待ち = 承認画面に出る発注の数（pending + partial_approved）
export function countPendingApprovals(orders: Order[]): number
```

- `preparation.tsx:838` と `mypage.tsx:287` の抽出ロジックを、それぞれ `listPreparationSlots()` / `listMyDeliveries()` として同じファイルへ切り出し、画面本体もそれを使う（＝バッジは「画面に出る件数」と定義上一致する）。
- `mobile-bottom-nav.tsx` / `menu.tsx` / `approval-banner.tsx` はこの関数に置き換え。
- `['waiting','preparing','assigned']` の `preparing` / `assigned` は型に無い値（`remove-preparing-status.sql` で廃止済み）。`waiting` のみにする。

### テスト
`order-counts.test.ts`: 「割当済みの枠は準備待ちに数えない」「一部承認の発注は承認待ちに数える」「マイページは個体が ready_for_delivery のものだけ」を固定。

---

## 3. 在庫の数え方の統一

### まず説明（田口さんへ）

「在庫が何台あるか」を計算する式が、アプリの中に **3つ**あります。

**式1: 在庫一覧が使っている式**（`inventory.tsx:195`）
```
実質在庫 = 利用可能な個体の数 − 「承認待ち」と「承認済み」の発注のうち、まだ個体を割り当てていない数
```

**式2: 発注画面の「在庫不足」チェックが使っている式**（`inventory-utils.ts:33`）
```
実質在庫 = 利用可能な個体の数 − 「承認済み」の発注のうち、まだ個体を割り当てていない数
```
→ 式1との違いは **承認待ち（pending）の発注を引くかどうか**だけ。

**式3: 在庫アラート画面が使っている式**（`stock-alert.tsx:51`）
```
在庫 = 利用可能な個体の数（発注は一切見ない）
```

具体例: 車いすAが倉庫に **1台**、承認待ちの発注が **1件**あるとき

| 画面 | 表示 |
|---|---|
| 在庫一覧 | **実質 0台**（承認待ちを引くので）|
| 発注画面 | **1台ある**（承認待ちは引かないので、もう1件発注できてしまう）|
| 在庫アラート | **1台**（発注を見ない）|

つまり、**在庫一覧で「0台」と出ているのに発注画面では発注が通る**。承認が2件とも降りたら1台を2人に約束したことになる。

### どちらに揃えるか → **式1（承認待ちも引く）で確定**（2026-09-07 田口さん）

| 選択肢 | 意味 | 結果 |
|---|---|---|
| **式1に揃える（確定）** | 承認待ちも「押さえた」扱い | 誰かが申請中の1台を、別の人が発注できなくなる。却下されれば戻る。二重予約が起きない |
| 式2に揃える | 承認されるまで在庫は空いている扱い | 発注は通りやすいが、承認が両方降りたときに1台足りなくなる |

### 変更
- `src/lib/inventory-utils.ts` の `calculateReservations()` を「pending + approved」に変更（1行）。
- `inventory.tsx:195-232` の `getEffectiveStock` を削除し、`getProductAvailableStock()`（ストア経由で inventory-utils）に置き換える。**「assigned_item_ids があるものは引かない」ガードは inventory-utils 側に元からあるので維持される**（2026-08-18 の二重控除事故の再発防止。`inventory-mobile-stock.test.tsx` が固定している）。
- `stock-alert.tsx` も同じ関数を使い、閾値判定を「実質在庫 ≤ 2」にする。あわせて「個体が0台の商品が一覧に出ない」バグ（`allItems` から `product_id` でグループ化しているため）を、`products` を起点に回す形で直す。
- 在庫の判定を直書きしている `menu.tsx:158` / `orders.tsx:101,347` / `approval.tsx:168` / `preparation.tsx:1850` / `useInventoryStore.ts:506-508` も同じ関数へ。

### テスト
`inventory-utils.test.ts`: 「pending の未割当は引く」「assigned_item_ids があれば引かない」「0台の商品もアラート対象に出る」。既存の `inventory-mobile-stock.test.tsx` 5件はそのまま通ること。

---

## 4. 予約済み（reserved）の個体

### 現状
管理番号を指定した発注（`inventory.tsx:403` / `search.tsx:343`）は、個体を `reserved` にして発注の `assigned_item_ids` に入れる。しかし `getAvailableActions` に `reserved` の case が無く、**QR を読んでも操作が1つも出ない**。準備画面の「番号あり」タブから「準備完了」を押す以外に前へ進む道が無く、予約を取り消す道も無い。

### 変更
`src/lib/item-status.ts` の遷移表に追加:

```ts
case 'reserved':
  return [
    { key: 'ready',              label: '配送準備完了にする',       nextStatus: 'ready_for_delivery' },
    { key: 'cancel_reservation', label: '予約を取り消して在庫へ戻す', record: '予約取消', nextStatus: 'available' },
    DISPOSE,
  ]
```

- `cancel_reservation` は個体のステータスを戻すだけでは不十分。**発注側の `assigned_item_ids` からこの個体を外す**必要がある（外さないと、発注は「この個体が割り当て済み」のままで準備画面に出続ける）。`scan-action-dialog.tsx` の `handleActionSubmit` に、`cancel_reservation` のとき「この個体を含む発注を探し、該当スロットを `null` に戻して `saveOrder`」を追加。スロットが `null` に戻ると準備画面「番号なし」タブに再び出る（既存の仕組みどおり）。
- `ready` は `assigned_item_ids` はそのまま、`item_processing_status` を `ready` に更新（準備画面の `handleAssignedItemComplete` と同じことを QR からできるようにする）。
- 履歴の `record` は `'予約取消'` を新設。`item-status.test.ts:185-191` の「実データに存在する action 名」リストに追加する。
- MCP 側は `sync-shared.mjs` で自動反映される。`scan_action` ツールは `cancel_reservation` の発注側処理を持たないので、**MCP からは `ready` のみ許可し、`cancel_reservation` は「アプリから行ってください」と返す**（発注の書き換えを MCP に持ち込まない）。

### テスト
`item-status.test.ts`: 「reserved から 2 つの遷移がある」。`scan-action-dialog` の発注側処理は、`saveOrder` をモックして「該当スロットが null になる」「他のスロットは触らない」を固定。

---

## 5. リアルタイム同期

### 経緯（git 履歴から）

| 日付 | コミット | 何をしたか | 結果 |
|---|---|---|---|
| 2025-08-19 | `cd36776` | 楽観的更新 + 軽量な Realtime | — |
| 2025-08-19 | `e4d36da` | **「WebSocket 認証エラーの無限ループを停止」で無効化** | 当時は anon で購読していた可能性が高い |
| 2025-08-20 | `b21597d` `8a1fcc6` | orders / order_items も購読。イベントごとに**全件リロード** | 重すぎて性能問題 |
| 2025-08-26 | `6a18f45` | Realtime 関連の通知を撤去 | 事実上の撤退 |
| 2026-04-30 | `1ebef4d` | `product_items` の UPDATE だけ購読する現行版 | **これは動いている** |

### 「今ならうまくいくか」→ **いく**。根拠は3つ

1. **認証**: 現行版は `App.tsx:74` でログイン後・データ初期化後に購読している。2025-08 の「認証エラーの無限ループ」は、購読開始のタイミング（`window.load` の1秒後、ログイン前）が原因だった可能性が高い。今は起きていない。
2. **配信対象（publication）**: 2026-09-04 の印刷エージェントで実測した。**テーブルが `supabase_realtime` の publication に入っていないと、購読は SUBSCRIBED になるのにイベントが1つも来ない**。`label_print_queue` はこれで15秒 polling に落ちていた（田口さんが SQL を流して解消）。`orders` / `order_items` も同じ状態の可能性が高い。「うまくいかなかった」の正体はおそらくこれ。
3. **負荷**: 2025-08 版が重かったのは、イベントのたびに `getOrders()` 全件を取り直していたから。今回はペイロードの1行だけをマージする（`product_items` の現行版と同じ方式）。

### 変更

**SQL（田口さんが流す）**
```sql
-- いま何が配信対象か
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- 足りなければ追加
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
-- product_items で INSERT / DELETE も拾う場合、テーブル単位の設定なので追加作業は不要
```

**アプリ側**（`useInventoryStore.ts:650` の `enableRealtimeSync` を拡張）
- `product_items`: UPDATE に加えて **INSERT / DELETE** も購読（他端末での新規登録・削除が反映されない問題の解消）。
- `orders`: INSERT / UPDATE / DELETE を購読。UPDATE は `payload.new` を既存の Order にマージ（`items` は order_items 側のイベントで更新するので触らない）。
- `order_items`: INSERT / UPDATE / DELETE を購読。`order_id` で親を探して `items` 配列の該当要素を差し替え。
- 楽観的更新との競合: `updateItemStatus` のロールバック（`useInventoryStore.ts:369`）が「開始時点の全件」で書き戻すため、間に来た Realtime 更新まで巻き戻す。**ロールバックは該当 id の1件だけ**に変える。
- チャンネル参照を `window.__realtimeChannel` からストア内の変数へ。
- `CHANNEL_ERROR` 時の再接続は現行の5秒後リトライを維持。`TIMED_OUT` も同じ扱いに。

**検証手順（実装後、田口さんが2台で）**
1. PC で発注を作る → スマホの承認バナーが**更新ボタンなしで**出る
2. PC で承認 → スマホの準備画面に出る
3. スマホで入庫処理 → PC の在庫一覧が即座に変わる
4. `label_print_queue` と同じく、Realtime が届いていないときは `forceSync`（更新ボタン）が保険として残る

### テスト
Realtime 自体はモック困難なので、**マージ関数を純粋関数に切り出して**テストする: `applyRealtimeEvent(state, table, eventType, row)` → 「UPDATE で1件だけ差し替わる」「INSERT で末尾に追加」「DELETE で消える」「order_items の UPDATE で親の items が差し替わる」。

---

## 6. 消毒記録の月次出力

### 現状
`work-management.tsx` が年/月/日で `item_histories` を絞って表示するだけ。**出力機能が無い**。消毒記録は法令上の保存義務がある（`item-status.ts:68`）が、監査で「出してください」と言われたときに出せない。日付境界が UTC（`supabase-database.ts:1072-1089`）なので、日本時間 9:00 より前の作業が前日扱いになる。

### 変更
- `work-management.tsx` に「**月次出力**」ボタンを追加（年・月を選んで実行）。出力は2形式:
  - **CSV**（`src/lib/csv-export.ts` の `toCsv` を使う。Excel で開ける）
  - **印刷用ページ**（`/work-management/print?year=&month=` を新設。A4 縦・ヘッダに事業所名と期間・1行1作業。ブラウザの「印刷」で PDF 保存）
- 列: 日付 / 時刻 / 管理番号 / 商品名 / カテゴリ / 作業（消毒完了・メンテナンス完了・入庫処理）/ 実施者 / 状態メモ / 備考。並びは日付昇順、同日は管理番号順。
- 月末に「その月の全件」を出すため、`getWorkHistories` は **ページネーション無しで全件**を取る（`.range()` を回す。PostgREST の既定上限 1000 行に切られないよう `count: 'exact'` で総数を見て繰り返す）。
- 日付境界を **JST** にする: `getWorkHistories` の期間計算を `Asia/Tokyo` 基準に（`new Date(Date.UTC(y, m-1, 1) - 9h)` の形。`getHistoriesForAnalysis` も同じ問題を持つので一緒に直す）。
- 集計軸は `action` 文字列（`'消毒完了'` `'メンテナンス完了'` `'入庫処理'`）。これは `item-status.ts` の `record` 名で、**変えてはいけない**（集計が途切れる）。

### 前提（別作業だが明記）
出力した記録の信頼性は、`item_histories` が**追記専用**であることに依存する。今は誰でも物理削除できる（セキュリティレポート H2）。ロール認可の作業で RLS から DELETE を外すのが本筋。この機能はそれを待たずに作ってよい。

### テスト
`work-histories-export.test.ts`: 「JST の月境界で絞る（8/31 23:30 JST は8月、9/1 0:30 JST は9月）」「CSV の列順」「1000件超でも全件取れる（`range` を2回以上呼ぶ）」。

---

## 7. 管理番号の自動採番

### 現状
新規登録（`new-item-dialog.tsx`）で管理番号を**手入力**。重複チェックはストアの `items` 配列に対する `find` だけ（`new-item-dialog.tsx:90`）で、DB のユニーク制約に頼っていない。既存の番号は `WC-001` `BED-001` `KF-016` `RM-057` `AU-003` `SL-117` のように **`<英字接頭辞>-<3桁>`** の形が主だが、`BD_001` `WK_001` のようにアンダースコアのものも混じる。

### 変更

**接頭辞の持ち方（E: 「持つ」で確定）**
- `products` に `id_prefix TEXT` を追加（SQL は田口さんが流す）。
- `id_prefix` が空の商品は、**その商品の既存個体の id から推定**する（`-` または `_` より前の英字部分で最頻のもの）。推定できたら次回のために `id_prefix` へ保存してよいか、登録ダイアログで「この商品の接頭辞を `WC` にしますか」と1回だけ聞く。
- 個体が1つも無い新商品は、ダイアログで接頭辞を入力してもらい `id_prefix` に保存。

**採番ロジック**（純粋関数、`src/lib/management-id.ts`）
```ts
suggestNextManagementId(prefix: string, existingIds: string[], opts?: { width?: number; sep?: '-' | '_' })
// 例: prefix 'WC', existing ['WC-001','WC-002','WC-010'] → 'WC-011'
// 桁数は既存の最大桁に合わせる（既定3）。区切りは既存の多数派に合わせる（既定 '-'）
inferPrefix(productItemIds: string[]): { prefix: string; sep: string; width: number } | null
```
- 「最大 +1」方式。欠番（WC-005 が廃棄で消えた等）は埋めない（過去の記録と番号が衝突しないため）。
- `existingIds` は**ストアではなく DB から**取る（`supabaseDb.getProductItemsByProductId` で該当商品の個体を取り直す）。ストアが部分集合のときに重複を見逃す既存の穴も同時に塞ぐ。

**UI**
- 登録ダイアログを開いた時点で管理番号欄に提案値を入れる（編集可）。商品を切り替えたら提案し直す。
- 送信時に DB へ `getProductItemById(id)` で存在確認 → あれば「既に使われています。次の候補: WC-012」と出して提案し直す。

**MCP 側**
- `create_product_item` は今は id 必須。音声取り込み側が「最新の番号で登録」を自前でやっているので、**`id` を省略したら同じ採番関数で決める**オプションを足す。`management-id.ts` を `sync-shared.mjs` の同期対象に加える（`item-status.ts` と同じ仕組み）。

### テスト
`management-id.test.ts`: 「最大+1」「桁揃え（`WC-099` → `WC-100`）」「区切りは多数派に合わせる」「接頭辞の推定（`BD_001`,`BD_002` → `BD`/`_`）」「既存ゼロなら `-001`」「英字以外の接頭辞は拒否」。

---

## 8. 写真の Storage 移行

### 現状
- メンテナンス完了時に撮った写真を **Base64 文字列**で `product_items.photos`（TEXT[]）と `item_histories.photos` に保存（`scan-action-dialog.tsx:218,279`）。
- 表示は `item-detail.tsx:548-` のギャラリー（`<img src={base64}>`）。
- 初回ロードの `getAllProductItems()` は `select('*')` なので、**全個体の写真が毎回まとめて落ちてくる**。写真1枚 200KB〜1MB × 枚数 × 個体数。初回読み込みが重い最有力候補。

### 変更

**バケット（SQL / ダッシュボード。田口さんが実行）**
```sql
-- Storage > New bucket: item-photos（Public: OFF）
-- ポリシー（authenticated のみ読み書き。ロール認可が入るまではこれで）
create policy "item-photos read"   on storage.objects for select to authenticated using (bucket_id = 'item-photos');
create policy "item-photos insert" on storage.objects for insert to authenticated with check (bucket_id = 'item-photos');
create policy "item-photos delete" on storage.objects for delete to authenticated using (bucket_id = 'item-photos');
```
非公開バケット（D: 確定）。表示時に**署名付き URL（有効1時間）**を発行する。

**パス規約**
```
item-photos/product_items/<item_id>/<yyyyMMdd-HHmmss>-<n>.jpg
```
`photos` 列にはこの**パス**を保存する（URL ではない。署名付き URL は期限切れになるため）。`photos: string[]` の型はそのまま使える（中身が Base64 からパスに変わるだけ）。

**アップロード**（`src/lib/photo-storage.ts` 新設）
- `uploadItemPhoto(itemId, file|dataUrl): Promise<path>` — 送る前に**クライアントで縮小**（長辺 1280px・JPEG 品質 0.8。canvas で）。原寸の Base64 を送っていた現状より 5〜10 分の1 になる。
- `getPhotoUrl(path): Promise<signedUrl>` — 1時間キャッシュ。
- `scan-action-dialog.tsx` の撮影フローは、撮った時点でアップロードしパスを `actionForm.photos` に積む（送信時にまとめて送らない。途中で閉じたら孤児ファイルが残るが、後述の掃除で回収）。
- `item_histories.photos` にも同じパスを入れる（個体とその時点の履歴で同じファイルを指す。コピーしない）。

**表示**
- `item-detail.tsx` のギャラリーは、`photos` の各パスに対して `getPhotoUrl` を呼んで `<img>` に入れる。Base64 のまま残っている古い値（`data:` で始まる）はそのまま表示できるようにフォールバックを残す（移行途中でも壊れない）。

**既存データの移行**（`scripts/migrate-photos-to-storage.mjs`、田口さんの PC で1回実行）
1. `product_items` から `photos` が `data:` で始まる行を取る
2. 1枚ずつデコード → 縮小 → アップロード → パスに置換 → 1行ずつ `update`
3. `item_histories.photos` も同様
4. 失敗した行はスキップしてログに残し、再実行で続きから（パスに置換済みのものは飛ばす）
5. 実行前に **Supabase のバックアップ**（ダッシュボード）を取る。移行は「Base64 → パス」の一方向なので、バックアップ以外に戻す手段が無い

**孤児ファイルの掃除**（任意・後回し可）
`photos` 列に登場しないパスを月1回消すスクリプト。ダイアログを途中で閉じたときのファイルが対象。

### 初回ロードへの効果
移行後、`getAllProductItems()` は `photos` 列を**選ばない**（§10）。写真は詳細画面を開いたときだけ取る。

### テスト
`photo-storage.test.ts`: 「パス規約どおり」「縮小後の長辺が 1280 以下」「`data:` で始まる古い値は署名 URL を発行せずそのまま返す」。移行スクリプトは「置換済みの行はスキップ」「失敗行を飛ばして続行」をモックで固定。

---

## 9. AI機能ページの削除

### 現状
`ai-features-simple.tsx`（1100行）は外部 AI を一切呼ばず、FAQ 辞書と `alert('開発中です')` だけ。FAQ の内容が実装と4箇所食い違っている（「ログイン機能は無い」「データはブラウザ保存」など、今の本番では嘘）。`ai-services.ts` と `ai-photo-analyzer.tsx` はどこからも参照されていない。

### 変更
削除するもの:
- `src/pages/ai-features-simple.tsx` / `src/lib/ai-services.ts` / `src/components/ui/ai-photo-analyzer.tsx`
- `App.tsx:16,132` の import と Route、`debug-app.tsx:11,34`
- `header.tsx:69` のドロワー項目「AI機能」
- `menu.tsx:113` のタイル、`menu.tsx:547,565,583` の PC 版3カード（「AIアシスタント」「レポート生成」「AI分析」。全部 `/ai-features` へ飛ぶだけ）
- `not-found.tsx` の `RETIRED` に `/ai-features` を足し、「このページは廃止しました」で トップへ案内

`menu.tsx` の 3×3 グリッドは `slice(0,3)/(3,6)/(6,9)` で切っている（`menu.tsx:424,460,496`）。AI を抜くと 8 → 7 項目になり 3 行目が 1 枚になる。**グリッドを `menuItems.map` で自然に折り返す形に直す**（slice の3連コピペも解消）。

### テスト
`unknown-route.test.tsx` に `/ai-features` のケースを追加。既存の `item-status.test.ts` は AI ページを見ていないので影響なし。

---

## 10. 初回読み込みの軽量化

### まず計測（実装の最初にやる）
ブラウザの Network パネルで、ログイン直後の以下を記録して設計書に追記する:
- `product_items` の応答サイズと時間（`select('*')` の現状）
- `index-*.js` のサイズと解析時間
- 「商品データを読み込んでいます」が消えるまでの秒数

数字が無いと「軽くなった」と言えない。目標: **初回表示 3秒以内（4G）、JS 初回 500KB 以下**。

### 施策（効く順）

**① 写真を初回ロードから外す**（§8 の移行後）
`getProductItems()` の `select('*')` を **列指定**に変え、`photos` を含めない。`item-detail.tsx` の `loadItemData` だけ `photos` を取る。写真が Base64 のままの間は、これだけで初回の転送量が劇的に減る可能性が高い（計測で確認）。

**② ルート単位のコード分割**
`App.tsx` の 21 ページを `React.lazy(() => import('./pages/...'))` にして `<Suspense>` で包む。特に `mypage.tsx`（2963行）`preparation.tsx`（2001行）`product-analysis.tsx`（recharts 依存。`node_modules/recharts` は 7.3MB）は初回に不要。`vite.config.ts` の `build.rollupOptions.output.manualChunks` で `recharts` を別チャンクに。現状 1.22MB の単一バンドルを、初回 500KB 以下＋ページごとの遅延読み込みに。

**③ 全ページが store を丸ごと購読している問題**
`useInventoryStore()` をセレクタなしで呼ぶと、`items` の1件が変わるたびに全画面が再レンダーする。**`useInventoryStore(s => s.items)`** のように必要な state だけ取る形に、ページを触るついでに直す（一気にやらなくてよい）。

**④ 在庫集計のメモ化**
`inventory.tsx:547-548` の `getInventorySummary()` / `getReservations()` は毎レンダー全商品×全個体を走査し、しかも結果を使っていない（`summary` / `reservation` / `totalCount` が JSX に無い）。**削除**。`getEffectiveStock` は §3 で共通関数に寄せた上で `useMemo`。

**⑤ Realtime が入ったら `loadData()` の連発をやめる**
`mypage.tsx` は配送1件ごとに `loadData()`（全件再取得）を呼ぶ。§5 で orders / order_items が Realtime で届くようになれば不要。Realtime の検証が済んでから外す。

**⑥ 小さいもの**
- `index.html` の `<title>` が `Vite + React + TS` のまま → アプリ名に
- `vite.config.ts` の `base: './'` は `/item/RP-001` を直接開いたときにアセットの相対解決を壊す → `'/'` に（vercel.json の rewrite があるので問題ない）
- `caniuse-lite` が 15ヶ月古い（ビルド警告）→ `npx update-browserslist-db@latest`

### 継続ルール（CLAUDE.md に追記）
「ページや DB 読み込みを追加するときは、①列を指定する ②初回に要らないものは遅延させる ③計測して数字を残す」

### テスト
数値目標は手動計測。コード分割は「`npm run build` の出力で `index-*.js` が 500KB 未満」を CI で確認する簡単なスクリプトを足す（`scripts/check-bundle-size.mjs`）。

---

## 11. 準備リマインダー通知（保留・調査メモ）

田口さんの「うまく回っていない気がする」は正しい。**一度も動いたことがない**。

- `notification-generator.ts:20` が `process.env.VITE_SUPABASE_PROJECT_REF` を読む。Vite のブラウザバンドルに `process.env` は存在しない（`import.meta.env` が正）ので、ここで例外 → catch で `isAdmin = false` → 管理者向けの準備リマインダーは**常にスキップ**。
- そもそも `supabase.ts:21` が `persistSession: false` なので、読もうとしている localStorage のトークン自体が存在しない。
- 通知はメモリ（zustand、persist なし）にしか無く、リロードで消える。重複抑止の Map も消えるので、リロードのたびに同じ通知が再生成される。
- 生成タイミングは `header.tsx:23` の 5分タイマー（画面を開いている端末でしか走らない）。

**直すとしたら**の選択肢（次に議論）:
- (a) 今の作りのまま最小修正: `isAdmin` を `useAuth` の user + `users` テーブルで判定し、通知を `notifications` テーブルに保存。5分タイマーは残す
- (b) サーバ側で生成: Supabase の `pg_cron` で毎朝「明日配送分で準備未完了」を `notifications` に INSERT し、アプリは表示するだけ。端末を開いていなくても溜まる。Slack にも流せる（L4 リスナーがある）
- 深掘りの論点: 誰に（管理者だけか担当者にもか）、いつ（前日何時か）、どこに（アプリ内か Slack か）

---

## 12. 実装の進め方

### 順序（依存関係と効果の順）
1. **§9 AI削除**（小さく独立。準備運動）
2. **§1 表記統一 → §2 バッジ統一 → §3 在庫統一**（同じファイル群を触るのでまとめて。`item-status.test.ts` の書き換えが要）
3. **§4 予約済み**（§1 の遷移表に足す）
4. **§5 Realtime**（SQL を先に田口さんへ。publication の確認結果を見てから実装）
5. **§8 写真 Storage**（SQL・バケットを先に。移行スクリプト → アプリ → 移行実行、の順）
6. **§10 軽量化**（§8 の後に計測 → ①②④⑥）
7. **§6 月次出力**、**§7 自動採番**（独立。並行可）

### 各ステップ共通
- TDD（`superpowers:test-driven-development`）。純粋関数に切り出してからテスト → 実装 → 画面に配線。
- `npm run type-check`（新規エラーを止めるゲート）・`npm test`・`npm run build` を通す。lint は「増やさない」。
- UI 変更は田口さんの動作確認 → コミット → `main` → push（Vercel）。push は ask のまま。
- 田口さんが流す SQL は `sql/` にファイルとして置き、コミットする（実行は手動）。

### 田口さんが流す SQL（まとめ）
| 節 | ファイル | 内容 |
|---|---|---|
| §5 | `sql/enable-realtime-orders.sql` | orders / order_items を publication に追加 |
| §7 | `sql/add-product-id-prefix.sql` | `products.id_prefix TEXT` |
| §8 | `sql/create-item-photos-bucket.sql` | バケットのポリシー（バケット作成はダッシュボード） |

### ロールバック
すべて `main` へのコミット単位で戻せる。例外は **§8 の写真移行**（Base64 → パスは一方向）。実行前にバックアップを取り、移行スクリプトは「置換済みはスキップ」で再実行可能にする。

---

## 13. 確認事項（2026-09-07 回答済み・記録）

- **A** 在庫: 承認待ちも引く → **引く**
- **B** 「メンテナンス済み」「状態不明」「配送準備完了」への統一 → **揃える**
- **C** 承認バナーに一部承認を含める → **含める**
- **D** 写真バケット → **非公開**
- **E** 管理番号の接頭辞を商品ごとに持つ → **持つ**

すべて確定。実装者が判断で迷う点は残っていない。
