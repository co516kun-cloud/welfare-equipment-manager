/**
 * Brother QL-800 ラベルプリンター制御
 * Brother公式 b-PAC Browser Extension を使用
 * IEモード不要 - Chrome/Edge拡張機能経由で直接印刷
 */

import { IDocument, IsExtensionInstalled } from './bpac-sdk.js'

export interface LabelData {
  managementId: string
  productName: string
  conditionNotes: string
  qrCode: string
}

// Chrome拡張機能URL
const CHROME_EXTENSION_URL = 'https://chromewebstore.google.com/detail/ilpghlfadkjifilabejhhijpfphfcfhb'
// Edge拡張機能URL
const EDGE_EXTENSION_URL = 'https://microsoftedge.microsoft.com/addons/detail/kmopihekhjobijiipnloimfdgjddbnhg'

export class LabelPrinter {
  /**
   * テンプレートファイルのパス
   */
  private static TEMPLATE_PATH = 'C:\\Users\\taguchi\\Desktop\\claude-kanri\\welfare-equipment-manager\\public\\templates\\equipment-label.lbx'

  /**
   * ラベルを印刷（b-PAC Browser Extension使用）
   */
  static async printLabel(data: LabelData, copies: number = 1): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error(
        'b-PAC拡張機能が検出されません。\n' +
        'Brother b-PAC Extension をブラウザにインストールしてください。'
      )
    }

    try {
      // テンプレートを開く
      const ret = await IDocument.Open(this.TEMPLATE_PATH)
      if (!ret) {
        const errorCode = await IDocument.ErrorCode
        throw new Error(
          `テンプレートを開けません: ${this.TEMPLATE_PATH}\n` +
          `エラーコード: ${errorCode}`
        )
      }

      // データを設定
      const mgmtObj = await IDocument.GetObject('ManagementID')
      if (mgmtObj) mgmtObj.Text = data.managementId

      const nameObj = await IDocument.GetObject('ProductName')
      if (nameObj) nameObj.Text = data.productName

      const condObj = await IDocument.GetObject('ConditionNotes')
      if (condObj) condObj.Text = data.conditionNotes

      const qrObj = await IDocument.GetObject('QRCode')
      if (qrObj) qrObj.Text = data.qrCode

      // 印刷実行
      await IDocument.StartPrint('', 0)
      await IDocument.PrintOut(copies, 0)
      await IDocument.EndPrint()

      // 閉じる
      await IDocument.Close()

      console.log('ラベル印刷成功:', data.managementId)
    } catch (error) {
      // エラー時もドキュメントを閉じる
      try { await IDocument.Close() } catch {}
      throw error
    }
  }

  /**
   * b-PAC Browser Extension が利用可能かチェック
   */
  static isAvailable(): boolean {
    return IsExtensionInstalled()
  }

  /**
   * 拡張機能のインストールページを開く
   */
  static openExtensionInstallPage(): void {
    const isEdge = navigator.userAgent.includes('Edg/')
    const url = isEdge ? EDGE_EXTENSION_URL : CHROME_EXTENSION_URL
    window.open(url, '_blank')
  }

  /**
   * テンプレートパスを設定
   */
  static setTemplatePath(path: string): void {
    this.TEMPLATE_PATH = path
  }

  /**
   * 現在のテンプレートパスを取得
   */
  static getTemplatePath(): string {
    return this.TEMPLATE_PATH
  }
}
