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
}

export interface ItemAction {
  key: string
  label: string
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
        { key: 'demo_cancel', label: 'デモキャンセル（袋から出した→消毒へ）', nextStatus: 'returned' },
        { key: 'demo_cancel_storage', label: 'デモキャン入庫（未開封→そのまま倉庫）', nextStatus: 'available' },
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
        { key: 'to_returned', label: '消毒へ回す', nextStatus: 'returned' },
        { key: 'storage', label: '入庫処理（未開封）', nextStatus: 'available' },
      ]

    case 'available':
      return ctx.hasAvailableOrders
        ? [{ key: 'assign_to_order', label: '発注に割り当て', nextStatus: 'rented' }]
        : [{ key: 'rent_directly', label: '直接貸与', nextStatus: 'rented' }]

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

    default:
      return []
  }
}

/** 廃棄など、実行前に確認を挟むべき操作か */
export function needsConfirm(action: ItemAction | undefined): boolean {
  return Boolean(action?.danger)
}
