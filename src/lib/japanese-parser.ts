import type { ProductItem } from '../types'

// 日本語入力対応マッピング
const STATUS_MAPPING: Record<string, ProductItem['status']> = {
  // available (利用可能)
  '利用可能': 'available',
  '利用可': 'available',
  '使用可能': 'available',
  '使用可': 'available',
  '空き': 'available',
  'あき': 'available',
  'アキ': 'available',
  '可能': 'available',
  
  // rented (貸与中)
  '貸与中': 'rented',
  '貸出中': 'rented',
  'レンタル中': 'rented',
  '貸し出し中': 'rented',
  'かしだし中': 'rented',
  'カシダシ中': 'rented',
  '出荷中': 'rented',
  '配送中': 'rented',
  
  // returned (返却済み)
  '返却済み': 'returned',
  '返却済': 'returned',
  '返済済み': 'returned',
  '返済済': 'returned',
  'へんきゃく済み': 'returned',
  'ヘンキャク済み': 'returned',
  '戻り': 'returned',
  
  // cleaning (消毒済み)
  '消毒済み': 'cleaning',
  '消毒済': 'cleaning',
  'しょうどく済み': 'cleaning',
  'ショウドク済み': 'cleaning',
  '清掃済み': 'cleaning',
  'せいそう済み': 'cleaning',
  'クリーニング済み': 'cleaning',
  
  // maintenance (メンテナンス済み)
  'メンテナンス済み': 'maintenance',
  'メンテ済み': 'maintenance',
  'めんて済み': 'maintenance',
  'メンテ': 'maintenance',
  '点検済み': 'maintenance',
  'てんけん済み': 'maintenance',
  '修理済み': 'maintenance',
  'しゅうり済み': 'maintenance',
  
  // demo_cancelled (デモキャンセル)
  'デモキャンセル': 'demo_cancelled',
  'でもきゃんせる': 'demo_cancelled',
  'デモ中止': 'demo_cancelled',
  'でも中止': 'demo_cancelled',
  '試用中止': 'demo_cancelled',
  'しよう中止': 'demo_cancelled',
  
  // out_of_order (故障中)
  '故障中': 'out_of_order',
  'こしょう中': 'out_of_order',
  'コショウ中': 'out_of_order',
  '故障': 'out_of_order',
  '破損': 'out_of_order',
  'はそん': 'out_of_order',
  'ハソン': 'out_of_order',
  '不具合': 'out_of_order',
  'ふぐあい': 'out_of_order',
  
  // unknown (不明)
  '不明': 'unknown',
  'ふめい': 'unknown',
  'フメイ': 'unknown',
  'わからない': 'unknown',
  '分からない': 'unknown',
  '？': 'unknown',
  '不明確': 'unknown',
  'ふめいかく': 'unknown'
}

const CONDITION_MAPPING: Record<string, ProductItem['condition']> = {
  // excellent (優良)
  '優良': 'excellent',
  'ゆうりょう': 'excellent',
  'ユウリョウ': 'excellent',
  '優': 'excellent',
  'とても良い': 'excellent',
  '最高': 'excellent',
  'さいこう': 'excellent',
  
  // good (良好)
  '良好': 'good',
  'りょうこう': 'good',
  'リョウコウ': 'good',
  '良い': 'good',
  'よい': 'good',
  'ヨイ': 'good',
  '普通より良い': 'good',
  
  // fair (普通)
  '普通': 'fair',
  'ふつう': 'fair',
  'フツウ': 'fair',
  'まあまあ': 'fair',
  'そこそこ': 'fair',
  '標準': 'fair',
  'ひょうじゅん': 'fair',
  
  // needs_repair (要修理)
  '要修理': 'needs_repair',
  'ようしゅうり': 'needs_repair',
  '修理必要': 'needs_repair',
  'しゅうり必要': 'needs_repair',
  '要メンテ': 'needs_repair',
  '直す必要': 'needs_repair',
  'なおす必要': 'needs_repair',
  
  // unknown (不明)
  '不明': 'unknown',
  'ふめい': 'unknown',
  'フメイ': 'unknown',
  'わからない': 'unknown',
  '分からない': 'unknown',
  '？': 'unknown',
  '確認中': 'unknown',
  'かくにん中': 'unknown'
}

// 文字列正規化関数
function normalizeString(input: string): string {
  return input
    .trim()
    .toLowerCase()
    // 全角英数字を半角に変換
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
    })
    // ひらがなをカタカナに変換
    .replace(/[ひ-ゞ]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) + 0x60)
    })
}

// レーベンシュタイン距離計算
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// ステータス解析関数
export function parseStatus(input: string): {
  status: ProductItem['status'] | null
  confidence: number
  suggestions?: string[]
} {
  if (!input || typeof input !== 'string') {
    return { status: null, confidence: 0 }
  }
  
  const normalized = normalizeString(input)
  
  // 完全一致チェック
  for (const [key, value] of Object.entries(STATUS_MAPPING)) {
    if (normalizeString(key) === normalized) {
      return { status: value, confidence: 1.0 }
    }
  }
  
  // 部分一致チェック
  for (const [key, value] of Object.entries(STATUS_MAPPING)) {
    const normalizedKey = normalizeString(key)
    if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      return { status: value, confidence: 0.8 }
    }
  }
  
  // あいまい検索
  let bestMatch: ProductItem['status'] | null = null
  let bestDistance = Infinity
  const suggestions: string[] = []
  
  for (const [key, value] of Object.entries(STATUS_MAPPING)) {
    const distance = levenshteinDistance(normalized, normalizeString(key))
    if (distance < bestDistance && distance <= 2) {
      bestMatch = value
      bestDistance = distance
    }
    if (distance <= 3) {
      suggestions.push(key)
    }
  }
  
  if (bestMatch) {
    return { 
      status: bestMatch, 
      confidence: Math.max(0.1, 1 - bestDistance / normalized.length),
      suggestions: suggestions.slice(0, 3)
    }
  }
  
  return { 
    status: null, 
    confidence: 0, 
    suggestions: suggestions.slice(0, 3)
  }
}

// 状態解析関数
export function parseCondition(input: string): {
  condition: ProductItem['condition'] | null
  confidence: number
  suggestions?: string[]
} {
  if (!input || typeof input !== 'string') {
    return { condition: null, confidence: 0 }
  }
  
  const normalized = normalizeString(input)
  
  // 完全一致チェック
  for (const [key, value] of Object.entries(CONDITION_MAPPING)) {
    if (normalizeString(key) === normalized) {
      return { condition: value, confidence: 1.0 }
    }
  }
  
  // 部分一致チェック
  for (const [key, value] of Object.entries(CONDITION_MAPPING)) {
    const normalizedKey = normalizeString(key)
    if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      return { condition: value, confidence: 0.8 }
    }
  }
  
  // あいまい検索
  let bestMatch: ProductItem['condition'] | null = null
  let bestDistance = Infinity
  const suggestions: string[] = []
  
  for (const [key, value] of Object.entries(CONDITION_MAPPING)) {
    const distance = levenshteinDistance(normalized, normalizeString(key))
    if (distance < bestDistance && distance <= 2) {
      bestMatch = value
      bestDistance = distance
    }
    if (distance <= 3) {
      suggestions.push(key)
    }
  }
  
  if (bestMatch) {
    return { 
      condition: bestMatch, 
      confidence: Math.max(0.1, 1 - bestDistance / normalized.length),
      suggestions: suggestions.slice(0, 3)
    }
  }
  
  return { 
    condition: null, 
    confidence: 0, 
    suggestions: suggestions.slice(0, 3)
  }
}

// 全ステータス・状態の日本語表示名を取得
export function getStatusDisplayName(status: ProductItem['status']): string {
  const statusNames: Record<ProductItem['status'], string> = {
    'available': '利用可能',
    'rented': '貸与中',
    'returned': '返却済み',
    'cleaning': '消毒済み',
    'maintenance': 'メンテナンス済み',
    'demo_cancelled': 'デモキャンセル',
    'out_of_order': '故障中',
    'unknown': '不明'
  }
  return statusNames[status] || status
}

export function getConditionDisplayName(condition: ProductItem['condition']): string {
  const conditionNames: Record<ProductItem['condition'], string> = {
    'good': '良好',
    'fair': '普通',
    'caution': '注意',
    'needs_repair': '要修理',
    'unknown': '不明'
  }
  return conditionNames[condition] || condition
}