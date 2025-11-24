/**
 * Brother QL-800 ラベルプリンター制御
 * b-PAC SDK を使用してラベルを印刷
 */

import type { IBPacDocument } from '../types/bpac'

export interface LabelData {
  managementId: string
  productName: string
  conditionNotes: string
  qrCode: string
}

export class LabelPrinter {
  /**
   * テンプレートファイルのパス
   *
   * 【重要】各PCで以下のいずれかの場所に equipment-label.lbx を配置してください：
   * 1. プロジェクトの public/templates/ フォルダ
   * 2. 共有ネットワークドライブ
   * 3. 各PCのローカルフォルダ
   *
   * 本番環境では、実際のテンプレートパスに変更してください
   */
  private static TEMPLATE_PATH = 'C:\\Users\\taguchi\\Desktop\\claude-kanri\\welfare-equipment-manager\\public\\templates\\equipment-label.lbx'

  /**
   * ラベルを印刷
   * @param data 印刷するデータ
   * @param copies 印刷部数（デフォルト: 1）
   */
  static async printLabel(data: LabelData, copies: number = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // ActiveXObjectが利用可能かチェック
        if (!this.isAvailable()) {
          throw new Error('ActiveXObjectが利用できません。Windowsブラウザで実行してください。')
        }

        // b-PAC Document オブジェクト作成
        let objDoc: IBPacDocument
        try {
          objDoc = new ActiveXObject('bpac.Document') as IBPacDocument
        } catch (err) {
          throw new Error('b-PAC SDKが見つかりません。Brother b-PAC3 SDKをインストールしてください。')
        }

        // テンプレートを開く
        const openResult = objDoc.Open(this.TEMPLATE_PATH)
        if (!openResult) {
          const errorCode = objDoc.ErrorCode
          throw new Error(
            `テンプレートを開けません: ${this.TEMPLATE_PATH}\n` +
            `エラーコード: ${errorCode}\n` +
            `テンプレートファイルが存在するか確認してください。`
          )
        }

        // データを設定
        try {
          const managementIdObj = objDoc.GetObject('ManagementID')
          if (managementIdObj) {
            managementIdObj.Text = data.managementId
          } else {
            console.warn('ManagementID オブジェクトが見つかりません')
          }

          const productNameObj = objDoc.GetObject('ProductName')
          if (productNameObj) {
            productNameObj.Text = data.productName
          } else {
            console.warn('ProductName オブジェクトが見つかりません')
          }

          const conditionNotesObj = objDoc.GetObject('ConditionNotes')
          if (conditionNotesObj) {
            conditionNotesObj.Text = data.conditionNotes
          } else {
            console.warn('ConditionNotes オブジェクトが見つかりません')
          }

          const qrCodeObj = objDoc.GetObject('QRCode')
          if (qrCodeObj) {
            qrCodeObj.Text = data.qrCode
          } else {
            console.warn('QRCode オブジェクトが見つかりません')
          }
        } catch (err) {
          objDoc.Close()
          throw new Error(`データ設定エラー: ${err instanceof Error ? err.message : String(err)}`)
        }

        // 印刷実行
        const printResult = objDoc.Print(copies, 0) // 0: 通常印刷

        if (!printResult) {
          const errorCode = objDoc.ErrorCode
          objDoc.Close()
          throw new Error(
            `印刷エラー: コード ${errorCode}\n` +
            `プリンターが接続されているか確認してください。`
          )
        }

        // クリーンアップ
        objDoc.Close()

        console.log('✅ ラベル印刷成功:', data.managementId)
        resolve()

      } catch (error) {
        console.error('❌ ラベル印刷エラー:', error)
        reject(error)
      }
    })
  }

  /**
   * b-PAC が利用可能かチェック
   */
  static isAvailable(): boolean {
    try {
      if (typeof window === 'undefined') {
        return false
      }

      // 実際にActiveXObjectを作成してみる（最も確実な方法）
      try {
        const testObj = new ActiveXObject('bpac.Document')
        if (testObj) {
          // 作成成功 → IEモードで動作中
          return true
        }
      } catch (e) {
        // ActiveXObjectが存在しない、またはbpac.Documentが利用できない
        console.warn('b-PAC SDK is not available:', e)
      }

      // フォールバック: ActiveXObjectの存在確認
      return 'ActiveXObject' in window || typeof (window as any).ActiveXObject !== 'undefined'
    } catch {
      return false
    }
  }

  /**
   * テンプレートパスを設定（動的変更用）
   * @param path テンプレートファイルのフルパス
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
