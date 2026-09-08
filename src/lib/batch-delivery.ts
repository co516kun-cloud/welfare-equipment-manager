/**
 * 一括配送（代理配送を含む）の選択ロジック
 *
 * 田口さんの指摘（2026-09-08）:
 *   「配送完了を押すときの一括処理ができる場合とできない場合がある。
 *     他の人の処理をするときの代理配送の場合も、全部一括処理が効くようにしてほしい」
 *
 * mypage.tsx に散らばっていた判定をここへ集約した。画面から切り離したのは、
 * 「できたりできなかったり」の原因が全部この判定の中にあったから。
 *
 * 直した穴:
 *  1. 担当者を切り替えても選択が残り、前の担当者のIDが混ざっていた（pruneSelection）
 *  2. 「全選択」の判定が件数比較だけで、中身が違っても全選択とみなしていた（isAllDeliverySelected）
 *  3. 処理できない個体を黙って飛ばし、それでも「N件完了」と表示していた（resolveBatchDeliveryTargets / summarizeBatchDelivery）
 */

export type SkipReason =
  | 'not_displayed'
  | 'not_ready'
  | 'missing_order_item'
  | 'missing_assigned_item'

export interface DeliveryCandidate {
  id: string
  orderItemId?: string | null
  assignedItemId?: string | null
  readyForDelivery?: boolean
  name?: string
  customer?: string
  [key: string]: unknown
}

export interface SkippedItem {
  id: string
  name: string
  reason: SkipReason
}

export interface FailedItem {
  id: string
  name: string
  message: string
}

/** 一括処理の対象になれる個体のID。配送準備完了のものだけ */
export function selectableDeliveryIds(items: DeliveryCandidate[]): string[] {
  return items.filter(i => i.readyForDelivery && i.id).map(i => i.id)
}

/**
 * 「全選択」状態かどうか。
 * 件数ではなく中身で見る。件数だけで見ると、担当者を切り替えて古いIDが残ったときに
 * 偶然一致して「全選択」を押すと全解除になる。
 */
export function isAllDeliverySelected(
  selectedIds: Set<string>,
  selectableIds: string[]
): boolean {
  if (selectableIds.length === 0) return false
  if (selectedIds.size !== selectableIds.length) return false
  return selectableIds.every(id => selectedIds.has(id))
}

/**
 * いま画面に出ていない選択を捨てる。
 * 担当者プルダウンを切り替えたときや、再読み込みで一覧が変わったときに呼ぶ。
 */
export function pruneSelection(
  selectedIds: Set<string>,
  items: DeliveryCandidate[]
): Set<string> {
  const alive = new Set(selectableDeliveryIds(items))
  return new Set([...selectedIds].filter(id => alive.has(id)))
}

/**
 * 選択されたIDを「実行できるもの」と「できないもの（理由つき）」に分ける。
 * できないものを黙って捨てないのがここの主眼。
 */
export function resolveBatchDeliveryTargets(
  items: DeliveryCandidate[],
  selectedIds: Set<string>
): { targets: DeliveryCandidate[]; skipped: SkippedItem[] } {
  const byId = new Map(items.map(i => [i.id, i]))
  const targets: DeliveryCandidate[] = []
  const skipped: SkippedItem[] = []

  for (const id of selectedIds) {
    const item = byId.get(id)
    if (!item) {
      skipped.push({ id, name: '不明', reason: 'not_displayed' })
      continue
    }
    const name = item.name || '不明'
    if (!item.readyForDelivery) {
      skipped.push({ id, name, reason: 'not_ready' })
    } else if (!item.orderItemId) {
      skipped.push({ id, name, reason: 'missing_order_item' })
    } else if (!item.assignedItemId) {
      skipped.push({ id, name, reason: 'missing_assigned_item' })
    } else {
      targets.push(item)
    }
  }

  return { targets, skipped }
}

const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  not_displayed: '一覧から外れたため処理していません',
  not_ready: '配送準備が完了していないため処理していません',
  missing_order_item: '発注データが不完全なため処理していません',
  missing_assigned_item: '個体が割り当てられていないため処理していません',
}

/**
 * 実行結果の文言。
 * 成功件数だけを出すと「一括が効いていない」ことに気づけないので、
 * 処理できなかったものは必ず品名つきで出す。
 */
export function summarizeBatchDelivery(result: {
  succeeded: number
  failed: FailedItem[]
  skipped: SkippedItem[]
  isProxy: boolean
  proxyFor: string
}): string {
  const lines: string[] = []

  if (result.succeeded > 0) {
    lines.push(
      result.isProxy
        ? `${result.proxyFor}さんの代理で${result.succeeded}件の配送が完了しました`
        : `${result.succeeded}件の配送が完了しました`
    )
  }

  if (result.failed.length > 0) {
    lines.push('', `処理できなかったもの（${result.failed.length}件）:`)
    for (const f of result.failed) lines.push(`・${f.name}: ${f.message}`)
  }

  if (result.skipped.length > 0) {
    lines.push('', `対象外だったもの（${result.skipped.length}件）:`)
    for (const s of result.skipped) lines.push(`・${s.name}: ${SKIP_REASON_TEXT[s.reason]}`)
  }

  if (lines.length === 0) return '処理する項目がありませんでした'
  return lines.join('\n')
}
