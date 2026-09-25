/**
 * 新しいパスワードのルール（2026-09-25 追加）
 *
 * パスワード変更画面（/account）と、再設定リンクから入る設定画面の両方で使う。
 * Supabase 側の最短は既定で6文字。ここではもう少し厳しく8文字にしている。
 */
export const PASSWORD_MIN_LENGTH = 8

/** 新しいパスワードと確認用をチェックする。問題があれば画面に出す文言を返す */
export function checkNewPassword(next: string, confirm: string): string | null {
  if (!next || !confirm) return '新しいパスワードを2回入力してください'
  if (next.length < PASSWORD_MIN_LENGTH) return `新しいパスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`
  if (next !== confirm) return '確認用のパスワードが一致しません'
  return null
}
