/**
 * カメラが使えないとき、何が原因かを言い当てる（2026-09-09）
 *
 * 田口さん:
 *   「1人だけスキャンが効かない端末があって。だいぶ古い iPhone SE。
 *     普通のカメラアプリやと読み取れるのに、アプリ内のスキャンだけ効かない」
 *
 * 原因が分からなかった理由:
 *   qr-scanner は _getCameraStream で getUserMedia のエラーを catch(){} で捨て、
 *   文字列 'Camera not found.' だけを投げる。呼び出し側も instanceof Error で
 *   弾いていたため、何が起きても「カメラの初期化に失敗しました」の1文言になっていた。
 *
 * ⚠️ 端末のカメラアプリが動くことは、ブラウザがカメラを使える証明にならない。
 *    サイトごとの許可は別管理で、一度「許可しない」を押すと記憶される。
 *    今回の「カメラアプリでは読めるのにアプリ内では駄目」はこれの典型。
 */

export type CameraCause =
  | 'insecure_context'
  | 'permission_denied'
  | 'in_app_browser'
  | 'camera_busy'
  | 'no_camera'
  | 'constraints'
  | 'unknown'

export interface CameraEnv {
  /** HTTPS か localhost か */
  isSecureContext: boolean
  /** navigator.mediaDevices が存在するか */
  hasMediaDevices: boolean
  isIOS: boolean
  /** ホーム画面から起動しているか */
  isStandalone: boolean
  /** LINE などのアプリ内ブラウザか */
  isInAppBrowser: boolean
  /** enumerateDevices で見えたカメラの数 */
  videoInputCount: number
}

export interface CameraDiagnosis {
  cause: CameraCause
  title: string
  /** ユーザーが順にやればよいこと。必ず1つ以上返す */
  actions: string[]
  /** 問い合わせ用。元のエラーをそのまま残す */
  technical: string
}

/** 手入力の逃げ道は、どの原因でも必ず伝える */
const FALLBACK = '手入力に切り替えて管理番号を打てば、カメラなしでも同じ処理ができます'

function errorName(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  const e = error as { name?: unknown; message?: unknown }
  if (typeof e.name === 'string') return e.name
  if (typeof e.message === 'string') return e.message
  return ''
}

function describe(error: unknown): string {
  if (error === undefined || error === null) return '(エラー情報なし)'
  if (typeof error === 'string') return error
  const e = error as { name?: unknown; message?: unknown }
  const parts = [e.name, e.message].filter(v => typeof v === 'string' && v)
  return parts.length ? parts.join(': ') : String(error)
}

export function diagnoseCamera(error: unknown, env: CameraEnv): CameraDiagnosis {
  const technical = describe(error)
  const name = errorName(error)

  // 1) そもそもブラウザがカメラAPIを出していない
  if (!env.isSecureContext || !env.hasMediaDevices) {
    return {
      cause: 'insecure_context',
      title: 'この接続方法ではカメラを使えません',
      actions: [
        'https:// で始まるアドレス（本番のURL）から開いてください',
        'ブラウザの決まりで、http:// の IPアドレスからはカメラを使えません',
        FALLBACK,
      ],
      technical,
    }
  }

  // 2) アプリ内ブラウザ（iOS ではカメラが使えないことがある）
  if (env.isInAppBrowser && (name === 'NotAllowedError' || name === 'Camera not found.' || !name)) {
    return {
      cause: 'in_app_browser',
      title: 'アプリ内のブラウザではカメラを使えないことがあります',
      actions: [
        '画面右下などの「Safari で開く」からブラウザで開き直してください',
        'LINE やメールの中のブラウザは、カメラを使えない場合があります',
        FALLBACK,
      ],
      technical,
    }
  }

  const permissionSteps = env.isIOS
    ? [
        '「設定」→「Safari」→「カメラ」を開き、「確認」または「許可」にしてください',
        'そのうえでこのページを開き直すと、カメラの許可を聞かれます',
        'ホーム画面のアイコンから開いている場合は、一度 Safari で開いて試してください',
      ]
    : [
        'アドレスバーの左にある鍵マークからカメラを「許可」にしてください',
        'そのうえでページを再読み込みしてください',
      ]

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        cause: 'permission_denied',
        title: 'このサイトにカメラの使用が許可されていません',
        actions: [
          ...permissionSteps,
          '※ 端末のカメラアプリが使えても、ブラウザの許可は別に必要です',
          FALLBACK,
        ],
        technical,
      }

    case 'NotReadableError':
    case 'TrackStartError':
      return {
        cause: 'camera_busy',
        title: 'カメラを他のアプリが使っています',
        actions: [
          'カメラを使うアプリ（カメラ、ビデオ通話など）を終了してください',
          '端末を再起動すると直ることがあります',
          FALLBACK,
        ],
        technical,
      }

    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        cause: 'no_camera',
        title: 'カメラが見つかりません',
        actions: ['この端末で使えるカメラが見つかりませんでした', FALLBACK],
        technical,
      }

    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        cause: 'constraints',
        title: '背面カメラを起動できませんでした',
        actions: [
          '画面の切り替えボタンで前面カメラに変えて試してください',
          FALLBACK,
        ],
        technical,
      }
  }

  // 3) qr-scanner が本当の原因を捨てて投げてくる文字列。環境から推測する
  if (name === 'Camera not found.') {
    if (env.videoInputCount === 0) {
      return {
        cause: 'no_camera',
        title: 'カメラが見つかりません',
        actions: [
          'この端末で使えるカメラが見つかりませんでした',
          'ブラウザの許可が無いと、カメラが1台も見えない状態になります',
          ...permissionSteps,
          FALLBACK,
        ],
        technical,
      }
    }
    return {
      cause: 'permission_denied',
      title: 'カメラを起動できませんでした（許可されていない可能性が高いです）',
      actions: [
        ...permissionSteps,
        '※ 端末のカメラアプリが使えても、ブラウザの許可は別に必要です',
        FALLBACK,
      ],
      technical,
    }
  }

  return {
    cause: 'unknown',
    title: 'カメラを起動できませんでした',
    actions: [
      'ページを再読み込みしてから、もう一度お試しください',
      'それでも直らない場合は、下の技術情報を控えてお知らせください',
      FALLBACK,
    ],
    technical,
  }
}

/** いま動いている環境を調べる（ブラウザでのみ意味がある） */
export function readCameraEnv(videoInputCount = -1): CameraEnv {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : undefined
  return {
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext === true : false,
    hasMediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
    // iPadOS は Macintosh を名乗るので、タッチの有無も見る
    isIOS: /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document),
    isStandalone: nav?.standalone === true ||
      (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches === true),
    isInAppBrowser: /Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger/i.test(ua),
    videoInputCount,
  }
}
