// メンテナンスチェックリストの設定

export interface ChecklistItem {
  id: string
  name: string
}

export interface ChecklistConfig {
  categoryId: string
  categoryName: string
  subcategories?: {
    id: string
    name: string
    items: ChecklistItem[]
  }[]
  items?: ChecklistItem[]
}

// メンテナンスチェックリストの設定データ
export const maintenanceChecklistConfig: ChecklistConfig[] = [
  {
    categoryId: 'beds',
    categoryName: '特殊寝台',
    items: [
      { id: 'hand_switch', name: '手元スイッチの作動' },
      { id: 'back_leg_elevation', name: '背部、脚部、の昇降動作の確認' },
      { id: 'hi_low_function', name: 'ハイロー機能の動作確認' },
      { id: 'scratches_rust', name: 'キズ、サビ等の確認' },
      { id: 'discoloration', name: '変色の有無' },
      { id: 'repair_marks', name: '補修跡の有無（目立つもの）' },
      { id: 'option_receiver_position', name: 'オプション受けの位置、方向の確認' },
      { id: 'option_receiver_scratches', name: 'オプション受けのキズの有無（目立つもの）' },
      { id: 'board_receiver', name: 'ボード受けの確認' },
      { id: 'bellows_bottom', name: 'ジャバラ、ボトムの破損確認' }
    ]
  },
  {
    categoryId: 'wheelchair',
    categoryName: '車いす',
    items: [
      { id: 'scratches_rust', name: 'キズ、サビの確認' },
      { id: 'grip_brake_footrest', name: 'グリップ・ブレーキ（両方）・フットレスト破損確認' },
      { id: 'brake_operation', name: 'ブレーキ作動確認（両方）' },
      { id: 'handle_wobble', name: 'ハンドルぐらつき確認' },
      { id: 'wheel_wear', name: '車輪磨耗・破損、走行時支障の確認' },
      { id: 'handrim_scratches', name: 'ハンドリムのキズ確認' },
      { id: 'spoke_rust', name: 'スポーク部分のサビ確認' },
      { id: 'armrest_firmness', name: 'アームレスト固さ確認' },
      { id: 'repair_marks', name: '補修跡の確認（目立つもの）' },
      { id: 'caster_rear_wheel', name: '前輪キャスターの回転、後輪のぐらつき確認' },
      { id: 'footrest_firmness', name: 'フットレストの固さ確認' },
      { id: 'brake_wire', name: 'ブレーキワイヤーの劣化（酸化）の確認' },
      { id: 'frame_wobble', name: 'フレームがたつき、ネジの緩み確認' },
      { id: 'seat_damage', name: 'シートの破損確認' }
    ]
  },
  {
    categoryId: 'cane',
    categoryName: '杖',
    items: [
      { id: 'scratches_rust', name: 'キズ、サビの確認' },
      { id: 'grip_damage', name: 'グリップ破損・変色の確認' },
      { id: 'tip_rubber', name: '先ゴムの劣化、変色の確認' },
      { id: 'frame_distortion', name: 'フレームの歪み、ぐらつきの確認' },
      { id: 'height_adjustment', name: '高さ調整のボタン、穴の広がりの確認' }
    ]
  },
  {
    categoryId: 'walker',
    categoryName: '歩行器',
    items: [
      { id: 'scratches_rust', name: 'キズ、サビの確認' },
      { id: 'grip_wear', name: 'グリップの摩耗、破損の確認' },
      { id: 'reflector', name: '反射板の破損の確認' },
      { id: 'tire_wear', name: 'タイヤの摩耗、劣化の確認' },
      { id: 'frame_distortion', name: 'フレームの歪みの確認' },
      { id: 'repair_marks', name: '補修跡の確認（目立つもの）' },
      { id: 'folding_operation', name: '開閉動作の確認' },
      { id: 'height_adjustment', name: '高さ調整の確認' },
      { id: 'height_lock', name: '高さ調整ロック部分の確認（リトルターン）' }
    ]
  },
  {
    categoryId: 'handrail',
    categoryName: '手すり',
    subcategories: [
      {
        id: 'besupoji',
        name: 'ベスポジ類',
        items: [
          { id: 'scratches_rust', name: 'キズ、サビの確認' },
          { id: 'tension_operation', name: '突っ張り動作の確認' },
          { id: 'pillar_wobble', name: '支柱のぐらつき確認' },
          { id: 'base_slip_prevention', name: 'ベースのすべり止め確認' },
          { id: 'discoloration', name: '変色確認' },
          { id: 'repair_marks', name: '補修跡の確認（目立つもの）' },
          { id: 'screw_check', name: 'ネジの確認（なめていないか）' }
        ]
      },
      {
        id: 'roots',
        name: 'ルーツ類',
        items: [
          { id: 'scratches_rust', name: 'キズ、サビの確認' },
          { id: 'odor', name: '異臭の確認' },
          { id: 'luminous_plate', name: '蓄光プレートの変色・破損確認' },
          { id: 'fixing_cap', name: '固定キャップのしまり確認' },
          { id: 'fixing_screw', name: '固定ネジの確認' }
        ]
      }
    ]
  },
  {
    categoryId: 'mattress',
    categoryName: 'マットレス',
    items: [
      { id: 'mold_inside', name: 'カビの確認（内側）' },
      { id: 'mold_cover', name: 'カビの確認（カバー）' },
      { id: 'stain_inside', name: 'シミの確認（内側）' },
      { id: 'stain_cover', name: 'シミの確認（カバー）' },
      { id: 'odor', name: '異臭の確認' },
      { id: 'cover_fraying', name: 'カバーのほつれの確認' },
      { id: 'sagging', name: 'へたりの確認' },
      { id: 'tag_condition', name: 'タグの状態確認' }
    ]
  },
  {
    categoryId: 'bedsaccessory',
    categoryName: '特殊寝台付属品',
    subcategories: [
      {
        id: 'side_rail',
        name: 'サイドレール',
        items: [
          { id: 'scratches_rust', name: 'キズ、サビの確認' },
          { id: 'discoloration', name: '変色の確認' },
          { id: 'repair_marks', name: '補修跡の有無（目立つもの）' }
        ]
      },
      {
        id: 'assist_bar',
        name: '介助バー',
        items: [
          { id: 'scratches_rust', name: 'キズ、サビの確認' },
          { id: 'discoloration', name: '変色の確認' },
          { id: 'handle_gap', name: '持ち手部分の隙間の有無' },
          { id: 'wobble', name: 'がたつきの確認' },
          { id: 'opening_closing', name: '開閉動作の確認' },
          { id: 'repair_marks', name: '補修跡の有無（目立つもの）' }
        ]
      },
      {
        id: 'side_table',
        name: 'サイドテーブル',
        items: [
          { id: 'scratches_rust', name: 'キズ、サビ等の確認' },
          { id: 'discoloration', name: '変色の有無' },
          { id: 'caster_check', name: 'キャスター部分の確認(ゴミの付着、動作など)' },
          { id: 'screw_looseness', name: 'ネジの緩み確認（緩み止め必須）' },
          { id: 'elevation_operation', name: '昇降動作の確認' },
          { id: 'rubber_deterioration', name: 'ゴム枠の劣化の確認' },
          { id: 'red_plate', name: 'プレート（赤）の差し込み確認' }
        ]
      }
    ]
  }
]

// カテゴリIDから設定を取得
export const getChecklistConfig = (categoryId: string): ChecklistConfig | undefined => {
  return maintenanceChecklistConfig.find(config => config.categoryId === categoryId)
}

// カテゴリ名からカテゴリIDを取得（商品データとの連携用）
export const getCategoryIdByName = (categoryName: string): string | undefined => {
  const config = maintenanceChecklistConfig.find(config => config.categoryName === categoryName)
  return config?.categoryId
}