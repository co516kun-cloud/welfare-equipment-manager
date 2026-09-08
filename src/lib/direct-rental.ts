/**
 * ダイレクト貸与（発注を通さず、その場で貸与を開始する）の判定（2026-09-08）
 *
 * 田口さん:
 *   「ダイレクト対応は今までほとんど使ってこなかったのでバグに気づかなかった。
 *     でも、これから使いたいから一応修正しておいてほしい」
 *
 * 使われていなかったぶん、個体の探し方がアプリの他の場所と食い違っていた。
 *   scan.tsx   … qr_code のみ・大文字小文字を無視
 *   search.tsx … id か qr_code・大文字小文字は区別
 *   ここ（旧） … id のみ・大文字小文字は区別・QR- を外す
 * 一番広く拾える形に揃える。ここは手入力も受け付けるので特に緩くしておきたい。
 */
import type { ProductItem } from '../types'
// ステータスの日本語は item-status.ts のものを使う。
// ここで2つ目を作ると、田口さんが統一した文言（消毒済み／メンテナンス済み）が
// 片方だけ古いまま残る。実際に一度そうしかけた。
import { STATUS_LABEL } from './item-status'

/** ラベルの値には QR- が付くことがあるので、比較前に落とす */
function normalize(code: string): string {
  return code.trim().replace(/^QR-/i, '').toLowerCase()
}

/**
 * 読み取った（あるいは手入力された）文字列から個体を探す。
 * 管理番号でも QRコードの値でも拾い、大文字小文字と前後の空白は無視する。
 */
export function resolveScannedItem(
  items: ProductItem[],
  scannedCode: string
): ProductItem | null {
  const code = normalize(scannedCode ?? '')
  if (!code) return null

  // 管理番号の一致を優先する。別の個体の qr_code とたまたま一致した場合に、
  // 管理番号で指したつもりの個体を取り違えないため
  const byId = items.find(i => normalize(i.id ?? '') === code)
  if (byId) return byId

  return items.find(i => normalize(i.qr_code ?? '') === code) ?? null
}

/**
 * その個体をいま貸し出せるか。
 * 貸せない場合は、画面にそのまま出せる日本語の理由を返す。
 */
export function checkRentable(item: ProductItem | null | undefined): {
  ok: boolean
  reason?: string
} {
  if (!item) return { ok: false, reason: '個体が見つかりません' }
  if (item.status === 'available') return { ok: true }

  const label = STATUS_LABEL[item.status as keyof typeof STATUS_LABEL] ?? item.status
  const who = item.status === 'rented' && item.customer_name
    ? `（${item.customer_name}様）`
    : ''
  return { ok: false, reason: `この商品は現在「${label}」${who}のため貸し出せません` }
}
