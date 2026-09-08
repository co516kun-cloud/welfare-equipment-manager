// デモモード用のモックDB（localStorage 上で完結する作り物）
//
// VITE_SUPABASE_URL に 'dummy' が含まれるとき supabase-database.ts がこちらへ委譲する
// （supabase-database.ts:18 の isDemoMode）。本番の Supabase には一切つながらない。
//
// 用途は「本番データに触らずに UI と業務フローを確認する」こと。
// scripts/demo-check.mjs と scripts/demo-e2e.mjs がこの上で動く。
//
// 🔴 初期データは業務フローを最後まで流せるように作ってある:
//    - 個体は available / rented / returned / cleaning / maintenance が揃っている
//      （返却→消毒→メンテ→入庫 を各段から試せる）
//    - カテゴリIDは maintenance-checklist-config.ts と同じ体系（beds / wheelchair …）。
//      'CAT-1' のような独自IDだとメンテ点検のチェックリストが引けない
//    - 発注は「承認待ち」「承認済み・未割当」「準備完了」を用意
//    - condition に 'excellent'、個体に notes は入れない（どちらも型から削除済み）
import type {
  Product,
  ProductItem,
  ProductCategory,
  Order,
  User,
  ItemHistory,
  DemoEquipment,
  DepositItem,
  LabelPrintQueue,
} from '../types'

const STORAGE_KEYS = {
  CATEGORIES: 'mock_categories',
  PRODUCTS: 'mock_products',
  PRODUCT_ITEMS: 'mock_product_items',
  USERS: 'mock_users',
  ORDERS: 'mock_orders',
  ITEM_HISTORIES: 'mock_item_histories',
  LABEL_QUEUE: 'mock_label_print_queue',
  DEMO_EQUIPMENT: 'wem_demo_equipment',
  DEPOSIT_ITEMS: 'wem_deposit_items',
} as const

// --- 初期データ ---------------------------------------------------------

const mockCategories: ProductCategory[] = [
  { id: 'wheelchair', name: '車いす', description: '手動・電動車いす各種', icon: '♿' },
  { id: 'beds', name: '特殊寝台', description: '介護用ベッド', icon: '🛏️' },
  { id: 'walker', name: '歩行器', description: '歩行補助具', icon: '🚶' },
]

const mockProducts: Product[] = [
  { id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair', description: '軽量アルミフレーム', manufacturer: 'メーカーA', model: 'Model-X1' },
  { id: 'PRD-2', name: '電動ベッド', category_id: 'beds', description: '3モーター電動', manufacturer: 'メーカーB', model: 'Model-Y2' },
  { id: 'PRD-3', name: '四輪歩行器', category_id: 'walker', description: 'ブレーキ付き', manufacturer: 'メーカーC', model: 'Model-Z3' },
]

/** 各ステータスの個体を用意して、どの段からでもフローを試せるようにする */
const mockProductItems: ProductItem[] = [
  { id: 'WC-001', product_id: 'PRD-1', status: 'available', condition: 'good', location: '倉庫A-1', qr_code: 'WC-001' },
  { id: 'WC-002', product_id: 'PRD-1', status: 'available', condition: 'fair', location: '倉庫A-2', qr_code: 'WC-002' },
  { id: 'WC-003', product_id: 'PRD-1', status: 'rented', condition: 'good', location: '顧客先', qr_code: 'WC-003', customer_name: 'デモ利用者A', loan_start_date: '2026-08-01', total_rental_days: 0 },
  { id: 'WC-004', product_id: 'PRD-1', status: 'returned', condition: 'good', location: '倉庫', qr_code: 'WC-004' },
  { id: 'BD-001', product_id: 'PRD-2', status: 'available', condition: 'good', location: '倉庫B-1', qr_code: 'BD-001' },
  { id: 'BD-002', product_id: 'PRD-2', status: 'cleaning', condition: 'good', location: '倉庫', qr_code: 'BD-002' },
  { id: 'BD-003', product_id: 'PRD-2', status: 'maintenance', condition: 'good', location: '倉庫', qr_code: 'BD-003', condition_notes: '左ブレーキ調整済み' },
  { id: 'WK-001', product_id: 'PRD-3', status: 'available', condition: 'good', location: '倉庫C-1', qr_code: 'WK-001' },
  { id: 'WK-002', product_id: 'PRD-3', status: 'ready_for_delivery', condition: 'good', location: '倉庫', qr_code: 'WK-002', customer_name: 'デモ利用者B' },
  { id: 'WK-003', product_id: 'PRD-3', status: 'unknown', condition: 'unknown', location: '不明', qr_code: 'WK-003' },
  // 一括配送を複数件で試すための2台目（田中太郎の担当）
  { id: 'WC-005', product_id: 'PRD-1', status: 'ready_for_delivery', condition: 'good', location: '倉庫', qr_code: 'WC-005', customer_name: 'デモ利用者B' },
  // 代理配送（他の担当者の商品を自分が配送する）を試すための2台
  { id: 'BD-004', product_id: 'PRD-2', status: 'ready_for_delivery', condition: 'good', location: '倉庫', qr_code: 'BD-004', customer_name: 'デモ利用者E' },
  { id: 'WK-004', product_id: 'PRD-3', status: 'ready_for_delivery', condition: 'good', location: '倉庫', qr_code: 'WK-004', customer_name: 'デモ利用者E' },
]

const mockUsers: User[] = [
  { id: 'USER-1', name: '田中太郎', email: 'tanaka@example.com', role: 'staff', department: '営業部' },
  { id: 'USER-2', name: '佐藤花子', email: 'sato@example.com', role: 'manager', department: '管理部' },
  { id: 'USER-3', name: '鈴木次郎', email: 'suzuki@example.com', role: 'staff', department: '配送部' },
]

const today = '2026-09-07'
const soon = '2026-09-09'

/** 承認待ち / 承認済み未割当 / 準備完了 の3本。担当は田中太郎（デモのログインユーザー） */
const mockOrders: Order[] = [
  {
    id: 'ORD-DEMO-1',
    customer_name: 'デモ利用者C',
    order_date: today,
    required_date: soon,
    assigned_to: '田中太郎',
    carried_by: '',
    status: 'pending',
    notes: '承認待ちのデモ発注',
    created_by: '田中太郎',
    needs_approval: true,
    items: [
      {
        id: 'OI-DEMO-1', product_id: 'PRD-1', quantity: 1, assigned_item_ids: [],
        approval_status: 'pending', item_processing_status: 'waiting', needs_approval: true,
      },
    ],
  } as Order,
  {
    id: 'ORD-DEMO-2',
    customer_name: 'デモ利用者D',
    order_date: today,
    required_date: soon,
    assigned_to: '田中太郎',
    carried_by: '',
    status: 'approved',
    notes: '準備待ちのデモ発注',
    created_by: '田中太郎',
    needs_approval: false,
    items: [
      {
        id: 'OI-DEMO-2', product_id: 'PRD-2', quantity: 1, assigned_item_ids: [],
        approval_status: 'not_required', item_processing_status: 'waiting', needs_approval: false,
      },
    ],
  } as Order,
  {
    id: 'ORD-DEMO-3',
    customer_name: 'デモ利用者B',
    order_date: today,
    required_date: soon,
    assigned_to: '田中太郎',
    carried_by: '',
    status: 'approved',
    notes: '配送待ちのデモ発注',
    created_by: '田中太郎',
    needs_approval: false,
    items: [
      {
        id: 'OI-DEMO-3', product_id: 'PRD-3', quantity: 1, assigned_item_ids: ['WK-002'],
        approval_status: 'not_required', item_processing_status: 'ready', needs_approval: false,
      },
      {
        id: 'OI-DEMO-3B', product_id: 'PRD-1', quantity: 1, assigned_item_ids: ['WC-005'],
        approval_status: 'not_required', item_processing_status: 'ready', needs_approval: false,
      },
    ],
  } as Order,
  // 代理配送の確認用。担当は佐藤花子なので、田中太郎でログインすると
  // マイページの担当者プルダウンから「佐藤花子」を選んだときだけ出る
  {
    id: 'ORD-DEMO-4',
    customer_name: 'デモ利用者E',
    order_date: today,
    required_date: soon,
    assigned_to: '佐藤花子',
    carried_by: '',
    status: 'approved',
    notes: '代理配送のデモ発注（担当は佐藤花子）',
    created_by: '佐藤花子',
    needs_approval: false,
    items: [
      {
        id: 'OI-DEMO-4', product_id: 'PRD-2', quantity: 1, assigned_item_ids: ['BD-004'],
        approval_status: 'not_required', item_processing_status: 'ready', needs_approval: false,
      },
      {
        id: 'OI-DEMO-4B', product_id: 'PRD-3', quantity: 1, assigned_item_ids: ['WK-004'],
        approval_status: 'not_required', item_processing_status: 'ready', needs_approval: false,
      },
    ],
  } as Order,
]

// --- 本体 ---------------------------------------------------------------

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** 配列の中の該当IDを差し替える。無ければ末尾に足す */
function upsertById<T extends { id: string }>(list: T[], entity: T): T[] {
  const i = list.findIndex(e => e.id === entity.id)
  if (i >= 0) {
    const next = [...list]
    next[i] = entity
    return next
  }
  return [...list, entity]
}

export class MockDatabase {
  private static instance: MockDatabase

  private constructor() {
    this.initializeData()
  }

  static getInstance(): MockDatabase {
    if (!MockDatabase.instance) MockDatabase.instance = new MockDatabase()
    return MockDatabase.instance
  }

  private initializeData(): void {
    const seed: [string, unknown][] = [
      [STORAGE_KEYS.CATEGORIES, mockCategories],
      [STORAGE_KEYS.PRODUCTS, mockProducts],
      [STORAGE_KEYS.PRODUCT_ITEMS, mockProductItems],
      [STORAGE_KEYS.USERS, mockUsers],
      [STORAGE_KEYS.ORDERS, mockOrders],
      [STORAGE_KEYS.ITEM_HISTORIES, []],
      [STORAGE_KEYS.LABEL_QUEUE, []],
    ]
    for (const [key, value] of seed) {
      if (localStorage.getItem(key) === null) write(key, value)
    }
  }

  /** テストとデモの繰り返し実行用。localStorage を消してから初期データに戻す */
  resetForTest(): void {
    for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key)
    this.initializeData()
  }

  // --- カテゴリ ---
  async getCategories(): Promise<ProductCategory[]> {
    return read<ProductCategory[]>(STORAGE_KEYS.CATEGORIES, [])
  }

  async saveCategory(category: ProductCategory): Promise<void> {
    write(STORAGE_KEYS.CATEGORIES, upsertById(await this.getCategories(), category))
  }

  async deleteCategory(id: string): Promise<void> {
    write(STORAGE_KEYS.CATEGORIES, (await this.getCategories()).filter(c => c.id !== id))
  }

  // --- 商品 ---
  async getProducts(): Promise<Product[]> {
    return read<Product[]>(STORAGE_KEYS.PRODUCTS, [])
  }

  async getProductById(id: string): Promise<Product | null> {
    return (await this.getProducts()).find(p => p.id === id) ?? null
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return (await this.getProducts()).filter(p => p.category_id === categoryId)
  }

  async saveProduct(product: Product): Promise<void> {
    write(STORAGE_KEYS.PRODUCTS, upsertById(await this.getProducts(), product))
  }

  async deleteProduct(id: string): Promise<void> {
    write(STORAGE_KEYS.PRODUCTS, (await this.getProducts()).filter(p => p.id !== id))
  }

  // --- 個体 ---
  async getProductItems(): Promise<ProductItem[]> {
    return read<ProductItem[]>(STORAGE_KEYS.PRODUCT_ITEMS, [])
  }

  async getAllProductItems(): Promise<ProductItem[]> {
    return this.getProductItems()
  }

  async getProductItemById(id: string): Promise<ProductItem | null> {
    return (await this.getProductItems()).find(i => i.id === id) ?? null
  }

  async getProductItemsByProductId(productId: string): Promise<ProductItem[]> {
    return (await this.getProductItems()).filter(i => i.product_id === productId)
  }

  async getProductItemsByCategoryId(categoryId: string): Promise<ProductItem[]> {
    const products = await this.getProductsByCategory(categoryId)
    const ids = new Set(products.map(p => p.id))
    return (await this.getProductItems()).filter(i => ids.has(i.product_id))
  }

  async getProductItemsByStatus(status: ProductItem['status']): Promise<ProductItem[]> {
    return (await this.getProductItems()).filter(i => i.status === status)
  }

  async saveProductItem(item: ProductItem): Promise<void> {
    write(STORAGE_KEYS.PRODUCT_ITEMS, upsertById(await this.getProductItems(), item))
  }

  async deleteProductItem(id: string): Promise<void> {
    write(STORAGE_KEYS.PRODUCT_ITEMS, (await this.getProductItems()).filter(i => i.id !== id))
  }

  /** 差分同期用。モックでは全件返す（更新時刻を持たないため） */
  async getRecentlyUpdatedProductItems(): Promise<ProductItem[]> {
    return this.getProductItems()
  }

  // --- ユーザー ---
  async getUsers(): Promise<User[]> {
    return read<User[]>(STORAGE_KEYS.USERS, [])
  }

  async getUserById(id: string): Promise<User | null> {
    return (await this.getUsers()).find(u => u.id === id) ?? null
  }

  async saveUser(user: User): Promise<void> {
    write(STORAGE_KEYS.USERS, upsertById(await this.getUsers(), user))
  }

  async deleteUser(id: string): Promise<void> {
    write(STORAGE_KEYS.USERS, (await this.getUsers()).filter(u => u.id !== id))
  }

  /** デモモードではログイン中のユーザー名を固定で返す（localStorage の auth_user に合わせる） */
  async getCurrentUserName(): Promise<string> {
    try {
      const raw = localStorage.getItem('auth_user')
      if (raw) {
        const u = JSON.parse(raw)
        const dbUser = (await this.getUsers()).find(x => x.email === u.email)
        return dbUser?.name ?? u.user_metadata?.name ?? u.email ?? 'デモユーザー'
      }
    } catch {
      // 壊れていたら既定値
    }
    return 'デモユーザー'
  }

  // --- 発注 ---
  async getOrders(): Promise<Order[]> {
    return read<Order[]>(STORAGE_KEYS.ORDERS, [])
  }

  async getOrderById(id: string): Promise<Order | null> {
    return (await this.getOrders()).find(o => o.id === id) ?? null
  }

  async saveOrder(order: Order): Promise<void> {
    write(STORAGE_KEYS.ORDERS, upsertById(await this.getOrders(), order))
  }

  async deleteOrder(id: string): Promise<void> {
    write(STORAGE_KEYS.ORDERS, (await this.getOrders()).filter(o => o.id !== id))
  }

  async getRecentlyUpdatedOrders(): Promise<Order[]> {
    return this.getOrders()
  }

  async updateOrderItemStatus(
    orderItemId: string,
    status: string,
    _updatedBy?: string
  ): Promise<void> {
    const orders = await this.getOrders()
    const next = orders.map(order => ({
      ...order,
      items: (order.items ?? []).map(item =>
        item.id === orderItemId
          ? { ...item, item_processing_status: status as typeof item.item_processing_status }
          : item
      ),
    }))
    write(STORAGE_KEYS.ORDERS, next)
  }

  // --- 履歴 ---
  async getItemHistories(): Promise<ItemHistory[]> {
    return read<ItemHistory[]>(STORAGE_KEYS.ITEM_HISTORIES, [])
  }

  async getItemHistoriesByItemId(itemId: string): Promise<ItemHistory[]> {
    return (await this.getItemHistories())
      .filter(h => h.item_id === itemId)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  }

  async createItemHistory(
    itemId: string,
    action: string,
    fromStatus: string,
    toStatus: string,
    userName: string,
    details?: {
      location?: string
      condition?: string
      notes?: string
      conditionNotes?: string
      customerName?: string
      photos?: string[]
      metadata?: unknown
    }
  ): Promise<void> {
    const histories = await this.getItemHistories()
    const entry = {
      id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item_id: itemId,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      performed_by: userName,
      timestamp: new Date().toISOString(),
      location: details?.location,
      condition: details?.condition,
      notes: details?.notes,
      condition_notes: details?.conditionNotes,
      customer_name: details?.customerName,
      photos: details?.photos,
      metadata: details?.metadata,
    } as unknown as ItemHistory
    write(STORAGE_KEYS.ITEM_HISTORIES, [...histories, entry])
  }

  /** 戻り値の形は supabase-database.ts:getItemHistoriesPaginated に合わせる（data / totalCount / totalPages / currentPage） */
  async getItemHistoriesPaginated(
    page = 1,
    limit = 50,
    filters?: { itemId?: string; action?: string; fromStatus?: string }
  ): Promise<{ data: ItemHistory[]; totalCount: number; totalPages: number; currentPage: number }> {
    let all = (await this.getItemHistories()).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    if (filters?.itemId) all = all.filter(h => h.item_id.includes(filters.itemId!))
    if (filters?.action) all = all.filter(h => h.action.includes(filters.action!))
    // 本番側は fromStatus を to_status に対する一致として使っている（既存の挙動に合わせる）
    if (filters?.fromStatus) all = all.filter(h => h.to_status === filters.fromStatus)

    const start = (page - 1) * limit
    return {
      data: all.slice(start, start + limit),
      totalCount: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
      currentPage: page,
    }
  }

  async deleteItemHistory(historyId: string): Promise<void> {
    write(
      STORAGE_KEYS.ITEM_HISTORIES,
      (await this.getItemHistories()).filter(h => h.id !== historyId)
    )
  }

  async getWorkHistories(): Promise<ItemHistory[]> {
    return (await this.getItemHistories()).filter(h =>
      ['cleaning', 'maintenance'].includes(h.to_status) ||
      (h.to_status === 'available' && h.action === '入庫処理')
    )
  }

  async getHistoriesForAnalysis(): Promise<ItemHistory[]> {
    return (await this.getItemHistories()).filter(h => ['rented', 'returned'].includes(h.to_status))
  }

  // --- ラベル印刷キュー ---
  async getLabelPrintQueue(): Promise<LabelPrintQueue[]> {
    return read<LabelPrintQueue[]>(STORAGE_KEYS.LABEL_QUEUE, []).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    )
  }

  async getLabelPrintQueueByStatus(status: LabelPrintQueue['status']): Promise<LabelPrintQueue[]> {
    return (await this.getLabelPrintQueue()).filter(q => q.status === status)
  }

  async addLabelPrintQueue(
    queueItem: Omit<LabelPrintQueue, 'id' | 'created_at'>
  ): Promise<LabelPrintQueue> {
    const row: LabelPrintQueue = {
      ...queueItem,
      id: `LQ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    }
    write(STORAGE_KEYS.LABEL_QUEUE, [...(await this.getLabelPrintQueue()), row])
    return row
  }

  async updateLabelPrintQueueStatus(
    id: string,
    status: LabelPrintQueue['status'],
    printedBy?: string,
    errorMessage?: string
  ): Promise<void> {
    const rows = await this.getLabelPrintQueue()
    write(
      STORAGE_KEYS.LABEL_QUEUE,
      rows.map(r =>
        r.id === id
          ? {
              ...r,
              status,
              ...(status === 'completed' && printedBy
                ? { printed_at: new Date().toISOString(), printed_by: printedBy }
                : {}),
              ...(status === 'failed' && errorMessage ? { error_message: errorMessage } : {}),
            }
          : r
      )
    )
  }

  async requeueLabelPrint(id: string): Promise<void> {
    const rows = await this.getLabelPrintQueue()
    write(
      STORAGE_KEYS.LABEL_QUEUE,
      rows.map(r =>
        r.id === id
          ? { ...r, status: 'pending' as const, error_message: undefined, printed_at: undefined, printed_by: undefined }
          : r
      )
    )
  }

  async deleteLabelPrintQueue(id: string): Promise<void> {
    write(STORAGE_KEYS.LABEL_QUEUE, (await this.getLabelPrintQueue()).filter(r => r.id !== id))
  }

  // --- デモ機 ---
  async getDemoEquipment(): Promise<DemoEquipment[]> {
    return read<DemoEquipment[]>(STORAGE_KEYS.DEMO_EQUIPMENT, [])
  }

  async saveDemoEquipment(equipment: DemoEquipment): Promise<void> {
    write(STORAGE_KEYS.DEMO_EQUIPMENT, upsertById(await this.getDemoEquipment(), equipment))
  }

  async deleteDemoEquipment(id: string): Promise<void> {
    write(STORAGE_KEYS.DEMO_EQUIPMENT, (await this.getDemoEquipment()).filter(e => e.id !== id))
  }

  // --- 預かり品 ---
  async getDepositItems(): Promise<DepositItem[]> {
    return read<DepositItem[]>(STORAGE_KEYS.DEPOSIT_ITEMS, [])
  }

  async saveDepositItem(item: DepositItem): Promise<void> {
    write(STORAGE_KEYS.DEPOSIT_ITEMS, upsertById(await this.getDepositItems(), item))
  }

  async deleteDepositItem(id: string): Promise<void> {
    write(STORAGE_KEYS.DEPOSIT_ITEMS, (await this.getDepositItems()).filter(i => i.id !== id))
  }

  // --- 準備タスク（UI から未使用。空を返す） ---
  async getPreparationTasks(): Promise<unknown[]> {
    return []
  }
}

export const mockDb = MockDatabase.getInstance()
