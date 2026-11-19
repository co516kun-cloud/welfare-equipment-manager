import type { ProductItem } from '../types'

export type ItemStatus = ProductItem['status']

/**
 * ステータスの表示名。
 * 表示側の switch は各画面に散らばっているが、新しいステータスを足すときは
 * まずここに書く。迷ったらここが正。
 */
export const STATUS_LABEL: Record<ItemStatus, string> = {
  available: '利用可能',
  reserved: '予約済み',
  ready_for_delivery: '配送準備完了',
  rented: '貸与中',
  returned: '返却済み',
  cleaning: '消毒済み',
  maintenance: 'メンテナンス済み',
  demo_cancelled: 'デモキャンセル',
  out_of_order: '故障中',
  unknown: '状態不明',
  disposed: '廃棄済み',
  donated: '寄贈済み',
}

export interface ItemAction {
  key: string
  /** ボタンに出す文言。分かりやすさのために変えてよい */
  label: string
  /**
   * 履歴に残す操作名。**変えてはいけない。**
   * 🔴 履歴の action は集計の軸になっている。ラベルを変えるとここも変わってしまい、
   *    「年間で何件デモキャンセルがあったか」のような集計が、その日を境に途切れる。
   *    実際に 2026-08-21 にラベルを変えて壊しかけた。ラベルと記録名を分ける。
   *    省略時は label を使う（従来どおり）。
   */
  record?: string
  nextStatus: ItemStatus
  /** 実行前に確認を挟む（廃棄など、戻すのが面倒な操作） */
  danger?: boolean
}

export interface ActionContext {
  /** 承認済みで割り当て待ちの発注があるか */
  hasAvailableOrders?: boolean
}

/**
 * 🔴 QRスキャン時に出せる操作の一覧。**遷移表はここ1本だけ。**
 *
 * 以前は scan.tsx と scan-action-dialog.tsx が同じ switch を別々に持っていて、
 * 内容がずれていた。その結果:
 *   - status='unknown'（在庫の約半分）でボタンは出るのに、押しても無反応
 *     （ダイアログ側に default が無く空配列を返し、handleActionSubmit が
 *      alert も console も出さずに return していた）
 *   - status='ready_for_delivery' はどちらにも case が無く、QRを読んでも
 *     操作が1つも出ない＝ラインから落ちた個体を救出できない
 * 2026-08-20 にこのファイルへ集約した。**片方だけ直す事故を無くすため。**
 */
export function getAvailableActions(status: string, ctx: ActionContext = {}): ItemAction[] {
  const DISPOSE: ItemAction = { key: 'dispose', label: '廃棄', nextStatus: 'disposed', danger: true }
  const DONATE: ItemAction = { key: 'donate', label: '寄贈', nextStatus: 'donated', danger: true }

  switch (status as ItemStatus) {
    case 'rented':
      // 🔴 デモの戻しは「袋から出したか」で分ける（田口さん確定・2026-08-21）
      //   出した → 返却と同じ扱い。消毒ラインに乗せる
      //   出していない → そのまま倉庫へ（消毒不要）
      //   以前は「デモキャンセル」も消毒を通らなかったため、12ヶ月で24台が
      //   消毒の記録が無いまま次の人へ再貸与されていた。
      //   消毒記録は法令上の保存義務がある（kaizen/03_genba/CLAUDE.md）。
      return [
        { key: 'return', label: '返却', nextStatus: 'returned' },
        { key: 'demo_cancel', label: 'デモキャンセル（袋から出した→消毒へ）',
          record: 'デモキャンセル', nextStatus: 'returned' },
        { key: 'demo_cancel_storage', label: 'デモキャン入庫（未開封→そのまま倉庫）',
          record: 'デモキャン入庫', nextStatus: 'available' },
        DISPOSE,
      ]

    case 'returned':
      return [
        { key: 'clean', label: '消毒完了', nextStatus: 'cleaning' },
        DISPOSE,
      ]

    case 'cleaning':
      return [
        { key: 'maintenance', label: 'メンテナンス完了', nextStatus: 'maintenance' },
        DISPOSE,
      ]

    case 'maintenance':
      return [
        { key: 'storage', label: '入庫処理', nextStatus: 'available' },
        DISPOSE,
      ]

    case 'demo_cancelled':
      // 過去データ用。いまは demo_cancel が returned へ行くのでここに入る個体は出ない。
      // 消毒へ回す道も足しておく（袋から出していたものが紛れていた場合のため）
      return [
        { key: 'to_returned', label: '消毒へ回す', record: 'デモキャンセル', nextStatus: 'returned' },
        { key: 'storage', label: '入庫処理（未開封）', record: '入庫処理', nextStatus: 'available' },
      ]

    case 'available':
      // 在庫の棚卸しで傷みを見つけたとき、その場で廃棄に回せるようにする（2026-10-23）
      // 施設・利用者への寄贈も入庫済みの台からだけ出す（2026-11-02・田口さん依頼）
      return ctx.hasAvailableOrders
        ? [{ key: 'assign_to_order', label: '発注に割り当て', nextStatus: 'rented' }, DONATE, DISPOSE]
        : [{ key: 'rent_directly', label: '直接貸与', nextStatus: 'rented' }, DONATE, DISPOSE]

    case 'ready_for_delivery':
      // 配送待ちのまま止まった個体を救出する経路。以前はここが空だった。
      return [
        { key: 'deliver', label: '配送完了（貸与開始）', nextStatus: 'rented' },
        { key: 'cancel_preparation', label: '準備を取り消して在庫へ戻す', nextStatus: 'available' },
      ]

    case 'out_of_order':
      return [
        { key: 'repair', label: '修理完了', nextStatus: 'available' },
        DISPOSE,
      ]

    case 'unknown':
      // 🔴 在庫の約半分がここにいた。「貸与中」か「廃棄」かのどちらかなので、
      //    現物を見た人がその場で正しい状態に振り分けられるようにする。
      return [
        { key: 'set_rented', label: '貸与中にする', nextStatus: 'rented' },
        { key: 'set_returned', label: '返却済みにする（消毒へ回す）', nextStatus: 'returned' },
        { key: 'set_available', label: '利用可能にする', nextStatus: 'available' },
        { key: 'set_out_of_order', label: '故障中にする', nextStatus: 'out_of_order' },
        DISPOSE,
      ]

    case 'disposed':
      // 誤タップの取り消し用。廃棄そのものは残すが、戻す道は必ず用意する。
      return [{ key: 'undispose', label: '廃棄を取り消す（状態不明へ）', nextStatus: 'unknown' }]

    case 'donated':
      // 誤タップの取り消し用。寄贈は利用可能からしか入らないので、戻り先も利用可能
      return [{ key: 'undonate', label: '寄贈を取り消す（利用可能へ）', record: '寄贈取り消し', nextStatus: 'available' }]

    default:
      return []
  }
}

/** 履歴に残す操作名。ラベルを変えても集計が途切れないようにする */
export function recordName(action: ItemAction): string {
  return action.record || action.label
}

/**
 * 在庫から外れる行き先（廃棄・寄贈）か。
 * 「要修理なら故障中へ倒す」より優先する。壊れていても廃棄・寄贈は廃棄・寄贈のまま。
 * アプリ（scan-action-dialog）と MCP（applyStep）が同じこの判定を使う。
 */
export function leavesInventory(status: string): boolean {
  return status === 'disposed' || status === 'donated'
}

/** 廃棄など、実行前に確認を挟むべき操作か */
export function needsConfirm(action: ItemAction | undefined): boolean {
  return Boolean(action?.danger)
}

/** 廃棄理由の選択肢。履歴の conditionNotes / metadata.disposalReason に残る */
export const DISPOSAL_REASONS = [
  '破損・故障（修理不可）',
  '劣化・耐用年数',
  '衛生上の理由（汚れ・臭い・カビ）',
  '部品の欠品',
  'その他',
] as const

/**
 * 🔴 中古で新規登録した個体は、消毒→メンテ→入庫の履歴まで残す（2026-10-23・田口さん依頼）
 *
 * 返却されてきた物に後から番号を振って登録することがある（マットレスで多かった）。
 * 実際には 消毒・メンテをしているのに履歴が「新規登録」1行だけになり、
 * 消毒作業管理（work-management.tsx）の「今月の消毒」に数えられていなかった。
 *
 * 新品かどうかは状態メモに「新品」と書いてあるかだけで決める。商品の種類は問わない
 * （田口さん確定:「新品登録する際は『新品』って入れるから、そうじゃないやつは全部」）。
 * アプリの新規登録画面と MCP の create_product_item が同じこの判定を使う。
 */
export function needsUsedIntake(conditionNotes?: string | null): boolean {
  return !(conditionNotes ?? '').includes('新品')
}

/** 中古で新規登録したときに残す履歴の目印。後から普通の返却分と読み分けるため */
export const USED_INTAKE_NOTE = '新規登録（中古）'

/**
 * 中古で新規登録したときに 新規登録 の後へ足す3行。
 * 操作名は遷移表の記録名をそのまま使う（消毒作業管理はこの名前で数えている）。
 */
export function usedIntakeSteps(): { action: string; from: ItemStatus; to: ItemStatus }[] {
  const steps: [ItemStatus, string][] = [['returned', 'clean'], ['cleaning', 'maintenance'], ['maintenance', 'storage']]
  return steps.map(([from, key]) => {
    const a = getAvailableActions(from).find(x => x.key === key)!
    return { action: recordName(a), from, to: a.nextStatus }
  })
}

// ─────────────────────────────────────────────────────────────
// 個体の完全消去（管理者限定。2026-11-18・田口さん依頼）
//
// 登録ミス・重複で作った個体を、履歴・印刷キューごと DB から消す。消す処理そのものは
// Postgres 関数 erase_product_item（sql/add-erase-product-item.sql）にあり、ここは
// 画面でボタンを出すか・警告を出すかを決めるための判定だけを持つ。
// 設計書: docs/superpowers/specs/2026-11-18-erase-product-item-design.md
// ─────────────────────────────────────────────────────────────

/**
 * 完全消去を断るステータス。顧客・発注に結び付いているので「登録ミス」ではない。
 * 🔴 DB 関数 erase_product_item（sql/add-erase-product-item.sql）の手順 3 と同じ並び。
 *    片方を変えたらもう片方も。
 */
export const ERASE_BLOCKED_STATUSES: readonly ItemStatus[] = ['rented', 'reserved', 'ready_for_delivery']

/** この個体を完全消去してよいステータスか（画面のボタンの活性に使う。最終判定は DB 関数） */
export function canEraseItem(status: ItemStatus): boolean {
  return !ERASE_BLOCKED_STATUSES.includes(status)
}

/**
 * 貸与の記録か（貸与中から出た・貸与中に入った履歴）。
 * 操作名（直接貸与・貸与中にする・返却 …）ではなくステータス列で見る。操作名が増えても漏れない。
 * 完全消去の前に件数を数えて警告するのに使う。止めはしない（田口さんの決定 2026-11-18）。
 */
export function isRentalRecord(history: { from_status: ItemStatus; to_status: ItemStatus }): boolean {
  return history.from_status === 'rented' || history.to_status === 'rented'
}

/**
 * スキャン後に続けて処理できるステータス（2026-11-19・田口さん依頼）。
 * 処理ダイアログは成功後、新しいステータスがこの一覧にあるときだけ閉じずに「完了・次の工程」に切り替わる。
 * 出すのは倉庫の中で工程が残っている状態だけ。入庫で利用可能になった直後に「直接貸与」を見せると
 * 押し間違いの元になるので、利用可能・貸与中・配送準備完了・廃棄・寄贈は今までどおり閉じる。
 */
export const CONTINUABLE_STATUSES: readonly ItemStatus[] = ['returned', 'cleaning', 'maintenance', 'out_of_order', 'unknown', 'demo_cancelled']

/** 処理後にこのステータスになったら「続けて処理しますか？」を出すか */
export function canContinueAfter(status: ItemStatus): boolean {
  return CONTINUABLE_STATUSES.includes(status)
}

/**
 * 完了ビューに出す次の工程。遷移表と同じ並びから、確認が要る危険な操作（廃棄・寄贈）を除く。
 * 流れ作業の勢いで取り返しのつかない操作を押させないため。必要なら読み直せば今までどおり出る
 */
export function getContinueActions(status: ItemStatus, ctx: ActionContext = {}): ItemAction[] {
  return getAvailableActions(status, ctx).filter(a => !needsConfirm(a))
}
