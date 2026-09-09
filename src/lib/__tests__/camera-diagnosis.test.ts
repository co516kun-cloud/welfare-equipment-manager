import { describe, it, expect } from 'vitest'
import { diagnoseCamera, type CameraEnv } from '../camera-diagnosis'

/**
 * カメラが使えないとき、何が原因かを言い当てる
 *
 * 田口さん（2026-09-09）:
 *   「1人だけスキャンが効かない端末があって。だいぶ古い iPhone SE。
 *     普通のカメラアプリやと読み取れるのに、アプリ内のスキャンだけ効かない」
 *
 * 原因が分からなかったのは、qr-scanner が getUserMedia のエラーを
 * catch(){} で捨てて文字列 'Camera not found.' を投げ、
 * こちらも instanceof Error で弾いて「カメラの初期化に失敗しました」に
 * 丸めていたから。何が起きても同じ1文言だった。
 *
 * ⚠️ 端末のカメラアプリが動くことは、ブラウザがカメラを使える証明にならない。
 *    サイトごとの許可は別管理で、一度「許可しない」を押すと記憶される。
 */

const env = (over: Partial<CameraEnv> = {}): CameraEnv => ({
  isSecureContext: true,
  hasMediaDevices: true,
  isIOS: false,
  isStandalone: false,
  isInAppBrowser: false,
  videoInputCount: 1,
  ...over,
})

describe('原因の切り分け', () => {
  it('HTTPS でない場合', () => {
    const d = diagnoseCamera(null, env({ isSecureContext: false, hasMediaDevices: false }))
    expect(d.cause).toBe('insecure_context')
    expect(d.title).toContain('この接続方法')
    expect(d.actions.join()).toMatch(/https/i)
  })

  // 一番ありがちな原因。端末のカメラアプリが動くことは何の保証にもならない
  it('サイトのカメラ許可を拒否している場合', () => {
    const d = diagnoseCamera({ name: 'NotAllowedError' }, env())
    expect(d.cause).toBe('permission_denied')
    expect(d.title).toContain('許可')
    // 許可の戻し方を案内する（文言は PC / iOS で変わるので、共通する要素で見る）
    expect(d.actions.join()).toContain('許可')
    // 端末のカメラアプリが動くこととは別だ、と明示する
    expect(d.actions.join()).toContain('ブラウザの許可は別')
  })

  it('iOS なら許可の戻し方を iOS の手順で案内する', () => {
    const d = diagnoseCamera({ name: 'NotAllowedError' }, env({ isIOS: true }))
    expect(d.actions.join()).toMatch(/Safari|ぁ|設定/)
    expect(d.actions.join()).toContain('Safari')
  })

  it('カメラが他のアプリに使われている場合', () => {
    const d = diagnoseCamera({ name: 'NotReadableError' }, env())
    expect(d.cause).toBe('camera_busy')
    expect(d.actions.join()).toMatch(/閉じ|終了/)
  })

  it('カメラが見つからない場合', () => {
    const d = diagnoseCamera({ name: 'NotFoundError' }, env({ videoInputCount: 0 }))
    expect(d.cause).toBe('no_camera')
  })

  it('要求した条件のカメラが無い場合（背面カメラ指定など）', () => {
    const d = diagnoseCamera({ name: 'OverconstrainedError' }, env())
    expect(d.cause).toBe('constraints')
    expect(d.actions.join()).toMatch(/切り替え|前面/)
  })

  // LINE などのアプリ内ブラウザは iOS だとカメラが使えないことがある
  it('アプリ内ブラウザで開いている場合', () => {
    const d = diagnoseCamera({ name: 'NotAllowedError' }, env({ isIOS: true, isInAppBrowser: true }))
    expect(d.cause).toBe('in_app_browser')
    expect(d.actions.join()).toContain('Safari')
  })

  it('ホーム画面から起動している場合も切り分けを案内する', () => {
    const d = diagnoseCamera({ name: 'NotAllowedError' }, env({ isIOS: true, isStandalone: true }))
    expect(d.actions.join()).toMatch(/Safari/)
  })

  // qr-scanner は本当の原因を捨てて、この文字列だけを投げてくる
  it("ライブラリの 'Camera not found.' でも、環境から推測して案内する", () => {
    const d = diagnoseCamera('Camera not found.', env({ videoInputCount: 0 }))
    expect(d.cause).toBe('no_camera')
  })

  it("'Camera not found.' でもカメラが在るなら許可を疑う", () => {
    const d = diagnoseCamera('Camera not found.', env({ videoInputCount: 1 }))
    expect(d.cause).toBe('permission_denied')
  })

  it('原因が分からなくても、次にやることを必ず出す', () => {
    const d = diagnoseCamera(new Error('なにか未知'), env())
    expect(d.cause).toBe('unknown')
    expect(d.actions.length).toBeGreaterThan(0)
    expect(d.title).toBeTruthy()
  })
})

describe('手入力への逃げ道', () => {
  it('どの原因でも、手入力できることを必ず伝える', () => {
    const causes = [
      diagnoseCamera({ name: 'NotAllowedError' }, env()),
      diagnoseCamera({ name: 'NotReadableError' }, env()),
      diagnoseCamera(null, env({ isSecureContext: false })),
      diagnoseCamera(new Error('x'), env()),
    ]
    for (const d of causes) {
      expect(d.actions.join(), d.cause).toContain('手入力')
    }
  })
})

describe('技術的な詳細（問い合わせ用）', () => {
  it('エラーの名前をそのまま残す', () => {
    expect(diagnoseCamera({ name: 'NotAllowedError', message: 'Permission denied' }, env()).technical)
      .toContain('NotAllowedError')
  })

  it('文字列で投げられた場合も残す', () => {
    expect(diagnoseCamera('Camera not found.', env()).technical).toContain('Camera not found.')
  })

  it('エラーが無くても落ちない', () => {
    expect(diagnoseCamera(undefined, env()).technical).toBeTruthy()
  })
})
