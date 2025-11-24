/**
 * Brother b-PAC SDK 型定義
 * Brother QL-800 ラベルプリンター制御用
 */

declare global {
  interface Window {
    ActiveXObject: any
  }
}

/**
 * b-PAC Document インターフェース
 */
export interface IBPacDocument {
  /**
   * テンプレートファイルを開く
   * @param templatePath テンプレートファイルのフルパス (.lbx)
   * @returns 成功時 true
   */
  Open(templatePath: string): boolean

  /**
   * オブジェクトを取得
   * @param name オブジェクト名
   * @returns オブジェクト（存在しない場合は null）
   */
  GetObject(name: string): IBPacObject | null

  /**
   * 印刷を実行
   * @param copies 印刷部数
   * @param option オプション（0: 通常印刷）
   * @returns 成功時 true
   */
  Print(copies: number, option: number): boolean

  /**
   * ドキュメントを閉じる
   */
  Close(): void

  /**
   * エラーコード
   */
  ErrorCode: number

  /**
   * エラーメッセージ取得
   */
  GetErrorMessage(): string
}

/**
 * b-PAC オブジェクト（テキスト、QRコードなど）
 */
export interface IBPacObject {
  /**
   * テキスト内容
   */
  Text: string
}

/**
 * ActiveXObject コンストラクタ型定義
 */
declare class ActiveXObject {
  constructor(progId: string)
}

export {}
