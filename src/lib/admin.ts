// 管理者の見分け方（2026-11-18）
//
// 管理者は Supabase Auth の app_metadata.role が 'admin' の人だけ。
// app_metadata はダッシュボードか SQL からしか書けず、本人も他スタッフもアプリから変えられない。
// users テーブルの role は CSV 取り込みで誰でも書けるので、認可には使わない。
// 付与の SQL は sql/add-erase-product-item.sql の §1。付けたあとのログインで初めて効く。
//
// デモモードでは useAuth が localStorage の auth_user をそのまま User として返すので、
// そこに app_metadata: { role: 'admin' } を入れれば同じ判定で管理者になる（scripts/demo-check.mjs）。

/** ログイン中のユーザーが管理者か。useAuth() の user をそのまま渡す */
export function isAdminUser(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined
): boolean {
  return user?.app_metadata?.role === 'admin'
}
