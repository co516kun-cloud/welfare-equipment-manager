import type { ProductItem } from '../types'

/**
 * product_items の列（ProductItem のキー）。
 * types/index.ts:17-32 と 1:1 で対応させること。型を足したらここにも足す。
 */
const PRODUCT_ITEM_COLUMNS = [
  'id',
  'product_id',
  'status',
  'condition',
  'location',
  'customer_name',
  'loan_start_date',
  'qr_code',
  'condition_notes',
  'photos',
  'current_setting',
  'total_rental_days',
] as const

/**
 * 個体を部分更新するための ProductItem を組み立てる。
 *
 * なぜ要るか:
 *  supabaseDb.saveProductItem は渡されたオブジェクトをそのまま upsert し、
 *  customer_name / loan_start_date / condition_notes が undefined なら null で上書きする。
 *  呼び出し側が「必要な列だけ」の部分オブジェクトを作ると、書かなかった列が黙って消える。
 *
 * この関数は:
 *  - source から ProductItem の列だけを拾う（product / category / 削除済みの notes などを落とす）
 *  - source が持っていない任意フィールドはキーごと作らない（upsert で既存値が残る）
 *  - patch に入れたキーだけを上書きする。undefined を明示的に渡せばクリアできる
 *    （返却時に貸与先を消す用途。キーは残すので saveProductItem が null に変換する）
 *  - source を書き換えない
 *
 * @param source 元の個体。ProductItem の上に余分なプロパティが乗っていてもよい
 * @param patch  変更したい列だけ。undefined を明示すると「クリアする」意味になる
 */
export function buildProductItemUpdate(
  source: ProductItem,
  patch: Partial<ProductItem> = {}
): ProductItem {
  const result = {} as Record<string, unknown>

  for (const key of PRODUCT_ITEM_COLUMNS) {
    if (key in patch) {
      // patch にキーがあれば、値が undefined でも採用する（＝クリアの意思表示）
      result[key] = patch[key]
    } else if (source[key] !== undefined) {
      result[key] = source[key]
    }
    // source にも patch にも無い任意フィールドは、キーごと作らない
  }

  return result as unknown as ProductItem
}
