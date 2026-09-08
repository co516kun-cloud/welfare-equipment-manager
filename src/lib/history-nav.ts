/**
 * 「戻る」の行き先を決める（2026-09-08）
 *
 * 田口さんの指摘:
 *   「戻るを押した時にちゃんと一つ前に戻るようにしてほしい。
 *     変なとこへ飛んだり、戻りすぎたりが結構ある」
 *
 * 直前まで各画面がやっていたこと:
 *   ・item-detail  … 何があっても /inventory へ（商品検索から来ても在庫一覧に飛ぶ）
 *   ・ヘッダーの ← … 何があっても /mypage へ
 *   ・label-queue ほか … navigate(-1) 直打ち（直接開いた場合はアプリの外へ出る）
 *
 * ここでは「アプリ内に戻り先があるなら一つ前へ、無ければ決めた場所へ」に統一する。
 */

/**
 * react-router が積んだ履歴の中に、戻れる画面があるか。
 *
 * react-router は history.state を { usr, key, idx } の形で持つ。
 * idx はこのタブでアプリが積んだ履歴の位置なので、0 なら後ろにアプリの画面は無い。
 */
export function canGoBackInApp(historyState: unknown): boolean {
  if (!historyState || typeof historyState !== 'object') return false
  const idx = (historyState as { idx?: unknown }).idx
  return typeof idx === 'number' && idx > 0
}
