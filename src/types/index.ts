export interface ProductCategory {
  id: string
  name: string
  description: string
  icon: string
}

export interface Product {
  id: string
  name: string
  category_id: string
  description: string
  manufacturer: string
  model: string
}

export interface ProductItem {
  id: string // 個別管理番号 (例: RP-001)
  product_id: string
  status: 'available' | 'reserved' | 'ready_for_delivery' | 'rented' | 'returned' | 'cleaning' | 'maintenance' | 'demo_cancelled' | 'out_of_order' | 'unknown'
  condition: 'good' | 'fair' | 'caution' | 'needs_repair' | 'unknown'
  location: string // 倉庫での管理場所
  customer_name?: string // 貸与中の場合の顧客名
  loan_start_date?: string // 貸与開始日
  qr_code: string
  // notes フィールドを削除 - メモの記録は無しとする
  condition_notes?: string // メンテナンス済み・入庫処理時の状態メモ（記録される）
  photos?: string[] // メンテナンス時の写真（Base64形式）
  current_setting?: string // 現在の設定 (例: "2M", "3M") - 楽匠プラスなどの設定変更可能商品用
  total_rental_days?: number // 累積貸与日数（返却時に加算される）
}


export interface Order {
  id: string
  customer_name: string
  assigned_to: string // 担当者
  carried_by: string // 持出者
  items: OrderItem[]
  status: 'pending' | 'partial_approved' | 'approved' | 'ready' | 'delivered' | 'cancelled'
  created_at: string
  order_date: string // 発注日
  required_date: string // 希望納期日
  notes?: string // 備考
  created_by: string // 作成者
  needs_approval?: boolean // 承認が必要かどうか
  approved_by?: string // 承認者
  approved_date?: string // 承認日
  approval_notes?: string // 承認時の備考
}

export interface OrderItem {
  id: string
  product_id: string
  quantity: number
  assigned_item_ids?: string[] // 実際にアサインされた個別商品のID
  notes?: string
  item_status?: ProductItem['status'] // 発注時の商品ステータス
  needs_approval?: boolean // この商品に承認が必要かどうか
  approval_status: 'not_required' | 'pending' | 'approved' | 'rejected' // 承認ステータス
  approved_by?: string // 承認者
  approved_date?: string // 承認日
  approval_notes?: string // 承認時の備考
  item_processing_status: 'waiting' | 'ready' | 'delivered' | 'cancelled' // 商品処理ステータス
  requested_setting?: string // 発注時に要求された設定 (例: "2M", "3M")
  cancelled_at?: string // キャンセル日時
  cancelled_by?: string // キャンセル者
  cancelled_reason?: string // キャンセル理由
}

export interface PreparationTask {
  id: string
  orderId: string
  itemId: string
  assignedTo: string
  status: 'pending' | 'cleaning' | 'maintenance' | 'inspection' | 'completed'
  startDate: string
  completedDate?: string
  notes?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff' | 'manager'
  department: string
  territory?: string
}

export interface ItemHistory {
  id: string
  item_id: string
  action: string
  from_status: ProductItem['status']
  to_status: ProductItem['status']
  timestamp: string
  performed_by: string
  location?: string
  condition?: ProductItem['condition']
  customer_name?: string
  condition_notes?: string // 状態メモ（メンテナンス済み・入庫処理時のみ記録）
  photos?: string[] // 写真データ（Base64形式、メンテナンス完了時のみ記録）
  metadata?: Record<string, any>
}

export interface DemoCategory {
  id: string
  name: string
  icon: string
}

export interface DemoEquipment {
  id: string
  name: string
  managementNumber: string
  category_id?: string // デモカテゴリーID
  status: 'available' | 'demo'
  customerName?: string
  loanDate?: string
  operator?: string // 操作者名
  operatedAt?: string // 操作日時
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface DepositItem {
  id: string
  date: string // 預かり日
  customerName: string // 顧客名
  itemName: string // 預かった商品名または部品名
  notes?: string // 備考（オプション）
  created_at?: string
  updated_at?: string
}

export interface LabelPrintQueue {
  id: string
  item_id: string // 商品アイテムID
  product_name: string // 商品名（印刷時点での値を保存）
  management_id: string // 管理番号
  condition_notes: string // 商品状態メモ
  status: 'pending' | 'printing' | 'completed' | 'failed' // 印刷ステータス
  created_by: string // 作成者
  created_at: string // 作成日時
  printed_at?: string // 印刷完了日時
  printed_by?: string // 印刷実行者
  error_message?: string // エラーメッセージ（失敗時）
}