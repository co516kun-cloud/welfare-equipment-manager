import { Link, useLocation } from 'react-router-dom'

/**
 * 未定義パスの受け皿
 *
 * catch-all が無かったため、未定義パスは Layout の枠だけ描画されて本文が空になっていた。
 * 2026-09-07 に /manual-import・/csv-import・/import を廃止したので、
 * それらをブックマークしている人が白い画面に当たらないよう、行き先を案内する。
 */

/**
 * 廃止したページ → 案内。
 * label / to は「代わりに行ける場所」がある場合だけ持たせる（無ければトップへ戻る導線のみ）
 */
const RETIRED: Record<string, { note: string; label?: string; to?: string }> = {
  '/manual-import': {
    label: 'データ取込',
    to: '/data-import',
    note: 'このページは廃止しました（既存データを全部消してしまう作りだったためです）。',
  },
  '/csv-import': {
    label: 'データ取込',
    to: '/data-import',
    note: 'このページは廃止しました。CSV の取込は下のページで行えます。',
  },
  '/import': {
    label: 'データ取込',
    to: '/data-import',
    note: 'このページは廃止しました。CSV の取込は下のページで行えます。',
  },
  '/ai-features': {
    note: 'このページは廃止しました。中身がすべて試作のままで、実際には動いていなかったためです。',
  },
}

export function NotFound() {
  const { pathname } = useLocation()
  const retired = RETIRED[pathname.replace(/\/+$/, '')]

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">ページが見つかりません</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono break-all">{pathname}</p>
        </div>

        {retired && <p className="text-sm">{retired.note}</p>}

        <div className="flex flex-wrap gap-3 pt-2">
          {retired?.to && retired.label && (
            <Link
              to={retired.to}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {retired.label}へ
            </Link>
          )}
          <Link
            to="/"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
