import { create } from 'zustand'
import type { ProductCategory, Product, ProductItem, Order, PreparationTask, User } from '../types'
import { supabaseDb } from '../lib/supabase-database'
import { supabase } from '../lib/supabase'
import { calculateInventorySummary, getAvailableStock, calculateReservations } from '../lib/inventory-utils'
import type { InventorySummary, ReservationInfo } from '../lib/inventory-utils'

interface InventoryState {
  // Data
  categories: ProductCategory[]
  products: Product[]
  items: ProductItem[]
  orders: Order[]
  preparationTasks: PreparationTask[]
  users: User[]
  
  // Cached items by category/product
  itemsCache: {
    categories: Record<string, ProductItem[]>
    products: Record<string, ProductItem[]>
  }
  
  // UI State
  selectedCategory: string | null
  selectedProduct: string | null
  viewMode: 'category' | 'product' | 'item'
  
  // Realtime state
  isRealtimeEnabled: boolean
  lastSyncTime: string | null
  
  // Initialization state
  isDataInitialized: boolean
  
  // Full sync state (for daily refresh)
  lastFullSyncTime: string | null
  
  // Actions
  loadData: () => Promise<void>
  loadAllDataOnStartup: () => Promise<void>
  loadInitialData: () => Promise<void>
  loadIncrementalUpdates: () => Promise<void>
  loadItemsForCategory: (categoryId: string) => Promise<void>
  loadItemsForProduct: (productId: string) => Promise<void>
  clearItemsCache: () => void
  setViewMode: (mode: 'category' | 'product' | 'item') => void
  setSelectedCategory: (categoryId: string | null) => void
  setSelectedProduct: (productId: string | null) => void
  updateItemStatus: (itemId: string, status: ProductItem['status']) => Promise<void>
  createOrder: (order: Omit<Order, 'id'>) => Promise<void>
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>
  createPreparationTask: (task: Omit<PreparationTask, 'id'>) => Promise<void>
  updatePreparationTaskStatus: (taskId: string, status: PreparationTask['status']) => Promise<void>
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>
  addProductItem: (item: Omit<ProductItem, 'id'>) => Promise<void>
  addCategory: (category: Omit<ProductCategory, 'id'>) => Promise<void>
  getInventoryStats: () => any
  
  // Inventory calculation methods
  getInventorySummary: () => InventorySummary[]
  getProductAvailableStock: (productId: string) => number
  getReservations: () => Map<string, ReservationInfo>
  
  // Realtime actions
  enableRealtime: () => void
  disableRealtime: () => void
  forceSync: () => Promise<void>
  
  // Daily sync actions
  checkAndPerformDailySync: () => Promise<void>
  
  // UI reset action
  resetUIState: () => void
}

// リアルタイム接続の管理
let realtimeSubscriptions: any[] = []

export const useInventoryStore = create<InventoryState>((set, get) => ({
  // Initial data
  categories: [],
  products: [],
  items: [],
  orders: [],
  preparationTasks: [],
  users: [],
  
  // Initial cache
  itemsCache: {
    categories: {},
    products: {}
  },
  
  // Initial UI state
  selectedCategory: null,
  selectedProduct: null,
  viewMode: 'category',
  
  // Initial realtime state
  isRealtimeEnabled: false,
  lastSyncTime: null,
  
  // Initial initialization state
  isDataInitialized: false,
  
  // Initial full sync state
  lastFullSyncTime: null,
  
  // Actions
  loadData: async () => {
    try {
      // 商品個体以外の基本データのみ読み込み
      const [categories, products, users, orders] = await Promise.all([
        supabaseDb.getCategories(),
        supabaseDb.getProducts(),
        supabaseDb.getUsers(),
        supabaseDb.getOrders()
      ])
      
      // preparation_tasksは個別にロード（テーブルが存在しない可能性があるため）
      let preparationTasks: PreparationTask[] = []
      try {
        preparationTasks = await supabaseDb.getPreparationTasks()
      } catch (error) {
        console.warn('Could not load preparation tasks:', error)
      }
      
      // 現在のitemsを取得（既に読み込まれている場合は保持）
      const currentState = get()
      const currentItems = currentState.items
      
      
      set({
        categories,
        products,
        items: currentItems, // 既存のitemsを保持（空配列にしない）
        orders,
        preparationTasks,
        users
      })
    } catch (error) {
      console.error('Error loading data from Supabase:', error)
    }
  },

  loadAllDataOnStartup: async () => {
    // 新しいloadInitialDataを呼び出す
    await get().loadInitialData()
  },

  // 新しい初期読み込み関数（シンプルな一括取得）
  loadInitialData: async () => {
    try {
      console.log('🚀 Loading initial data...')
      const startTime = Date.now()
      
      // 並列で全データを一括取得（カテゴリー分けなし）
      const [categories, products, users, productItems] = await Promise.all([
        supabaseDb.getCategories(),        // マスタデータ
        supabaseDb.getProducts(),          // マスタデータ
        supabaseDb.getUsers(),             // マスタデータ
        supabaseDb.getAllProductItems()    // 全商品アイテム一括取得
      ])
      
      const elapsed = Date.now() - startTime
      console.log(`✅ Initial data loaded in ${elapsed}ms`)
      console.log(`📦 Categories: ${categories.length}, Products: ${products.length}, Items: ${productItems.length}`)
      
      const syncTime = new Date().toISOString()
      set({
        categories,
        products,
        users,
        items: productItems,  // 全アイテムを一括セット
        orders: [],          // 注文データはオンデマンド読み込み
        preparationTasks: [], // 準備タスクもオンデマンド読み込み
        lastSyncTime: syncTime,
        lastFullSyncTime: syncTime,
        isDataInitialized: true
      })
    } catch (error) {
      console.error('❌ Error loading initial data:', error)
      throw error  // エラーは呼び出し元で処理
    }
  },

  loadItemsForCategory: async (categoryId: string) => {
    try {
      const items = await supabaseDb.getProductItemsByCategoryId(categoryId)
      set({ items })
    } catch (error) {
      console.error('Error loading items for category:', error)
    }
  },

  loadItemsForProduct: async (productId: string) => {
    try {
      const items = await supabaseDb.getProductItemsByProductId(productId)
      set({ items })
    } catch (error) {
      console.error('Error loading items for product:', error)
    }
  },
  
  // 差分更新用の関数（手動更新で使用）
  loadIncrementalUpdates: async () => {
    const { lastFullSyncTime, items } = get()
    
    if (!lastFullSyncTime) {
      // 初回同期していない場合は全件取得
      console.log('⚠️ No previous sync found, loading all data...')
      return get().loadInitialData()
    }
    
    try {
      console.log(`🔄 Loading incremental updates since ${lastFullSyncTime}...`)
      
      // 最終同期時刻以降の変更のみ取得
      const updatedItems = await supabaseDb.getRecentlyUpdatedProductItems(lastFullSyncTime)
      
      if (updatedItems.length > 0) {
        // 差分をマージ
        const itemMap = new Map(items.map(item => [item.id, item]))
        
        updatedItems.forEach(item => {
          itemMap.set(item.id, item)  // 追加または更新
        })
        
        const mergedItems = Array.from(itemMap.values())
        set({ 
          items: mergedItems,
          lastFullSyncTime: new Date().toISOString()
        })
        
        console.log(`✅ Updated ${updatedItems.length} items (total: ${mergedItems.length})`)
      } else {
        console.log('✅ No changes since last sync')
        set({ lastFullSyncTime: new Date().toISOString() })
      }
    } catch (error) {
      console.error('❌ Error loading incremental updates:', error)
      throw error
    }
  },
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  setSelectedCategory: (categoryId) => set({ 
    selectedCategory: categoryId,
    selectedProduct: null 
  }),
  
  setSelectedProduct: (productId) => set({ 
    selectedProduct: productId 
  }),
  
  updateItemStatus: async (itemId, status) => {
    
    const { items } = get()
    const targetItem = items.find(i => i.id === itemId)
    
    if (!targetItem) {
      console.error('❌ Item not found in store:', itemId)
      throw new Error(`Item ${itemId} not found`)
    }
    
    const originalStatus = targetItem.status
    console.log(`🔄 Optimistic update: ${originalStatus} -> ${status}`)
    
    // 1. 楽観的更新：即座にストアを更新（ユーザーには瞬時反映）
    // ステータス変更時はnotesをリセット（一時的な備考をクリア）
    const updatedItem = { ...targetItem, status, notes: '' }
    const updatedItems = items.map(i => i.id === itemId ? updatedItem : i)
    set({ items: updatedItems })
    get().clearItemsCache()
    
    try {
      // 2. データベース保存（非同期）
      await supabaseDb.saveProductItem(updatedItem)
      console.log('✅ Item saved to database successfully')
      
      // 3. 成功時は追加処理なし（既にストア更新済み）
      
    } catch (error) {
      console.error('❌ Database save failed, rolling back...', error)
      
      // 4. エラー時：ロールバック（元のステータスとnotesに戻す）
      const rolledBackItem = { ...targetItem, status: originalStatus }
      const rolledBackItems = items.map(i => i.id === itemId ? rolledBackItem : i)
      set({ items: rolledBackItems })
      get().clearItemsCache()
      console.log('🔙 Rolled back to original status:', originalStatus)
      
      // エラーを再投げして呼び出し元に通知
      throw error
    }
  },
  
  createOrder: async (orderData) => {
    console.log('🚀 createOrder called with data:', orderData)
    try {
      const newOrder: Order = {
        ...orderData,
        id: `ORD-${Date.now()}`,
      }
      console.log('📦 Created new order object:', newOrder)
      
      await supabaseDb.saveOrder(newOrder)
      console.log('✅ Order saved to database successfully')
      
      const { orders } = get()
      const updatedOrders = [...orders, newOrder]
      set({ orders: updatedOrders })
      console.log('📊 Store updated, total orders:', updatedOrders.length)
    } catch (error) {
      console.error('❌ Error creating order:', error)
      throw error
    }
  },
  
  updateOrderStatus: async (orderId, status) => {
    try {
      const order = await supabaseDb.getOrderById(orderId)
      if (order) {
        const updatedOrder = { ...order, status }
        await supabaseDb.saveOrder(updatedOrder)
        
        const { orders } = get()
        const updatedOrders = orders.map(o => 
          o.id === orderId ? updatedOrder : o
        )
        set({ orders: updatedOrders })
      }
    } catch (error) {
      console.error('Error updating order status:', error)
    }
  },
  
  createPreparationTask: async (taskData) => {
    try {
      const newTask: PreparationTask = {
        ...taskData,
        id: `TASK-${Date.now()}`,
      }
      await supabaseDb.savePreparationTask(newTask)
      
      const { preparationTasks } = get()
      set({ preparationTasks: [...preparationTasks, newTask] })
    } catch (error) {
      console.error('Error creating preparation task:', error)
    }
  },
  
  updatePreparationTaskStatus: async (taskId, status) => {
    try {
      const completedDate = status === 'completed' ? new Date().toISOString() : undefined
      await supabaseDb.updatePreparationTaskStatus(taskId, status, completedDate)
      
      const { preparationTasks } = get()
      const updatedTasks = preparationTasks.map(task => 
        task.id === taskId 
          ? { ...task, status, completedDate } 
          : task
      )
      set({ preparationTasks: updatedTasks })
    } catch (error) {
      console.error('Error updating preparation task status:', error)
    }
  },
  
  addProduct: async (productData) => {
    try {
      const newProduct: Product = {
        ...productData,
        id: `PRD-${Date.now()}`,
      }
      await supabaseDb.saveProduct(newProduct)
      
      const { products } = get()
      set({ products: [...products, newProduct] })
    } catch (error) {
      console.error('Error adding product:', error)
    }
  },
  
  addProductItem: async (itemData) => {
    try {
      const newItem: ProductItem = {
        ...itemData,
        id: `ITM-${Date.now()}`,
      }
      await supabaseDb.saveProductItem(newItem)
      
      const { items } = get()
      set({ items: [...items, newItem] })
      // アイテムが追加されたのでキャッシュをクリア
      get().clearItemsCache()
    } catch (error) {
      console.error('Error adding product item:', error)
    }
  },
  
  addCategory: async (categoryData) => {
    try {
      const newCategory: ProductCategory = {
        ...categoryData,
        id: `CAT-${Date.now()}`,
      }
      await supabaseDb.saveCategory(newCategory)
      
      const { categories } = get()
      set({ categories: [...categories, newCategory] })
    } catch (error) {
      console.error('Error adding category:', error)
    }
  },
  
  getInventoryStats: () => {
    // Return basic stats from current store state
    const { categories, products, items } = get()
    return {
      totalCategories: categories.length,
      totalProducts: products.length,
      totalItems: items.length,
      availableItems: items.filter(item => item.status === 'available').length,
      rentedItems: items.filter(item => item.status === 'rented').length,
      maintenanceItems: items.filter(item => item.status === 'maintenance').length
    }
  },

  // Inventory calculation methods
  getInventorySummary: () => {
    const { products, items, orders } = get()
    return calculateInventorySummary(products, items, orders)
  },

  getProductAvailableStock: (productId: string) => {
    const { items, orders } = get()
    return getAvailableStock(productId, items, orders)
  },

  getReservations: () => {
    const { orders } = get()
    return calculateReservations(orders)
  },

  // Realtime functions
  enableRealtime: () => {
    // リアルタイム同期は無効化（軽量通知システムを代わりに使用）
    console.log('ℹ️ Realtime synchronization is disabled - using lightweight notification system')
  },

  disableRealtime: () => {
    console.log('🛑 Disabling realtime synchronization...')
    
    // 全ての接続を切断
    realtimeSubscriptions.forEach(sub => {
      if (sub && sub.unsubscribe) {
        sub.unsubscribe()
      }
    })
    realtimeSubscriptions = []

    set({ 
      isRealtimeEnabled: false,
      lastSyncTime: null
    })
    
    console.log('✅ Realtime synchronization disabled!')
  },

  forceSync: async () => {
    console.log('🔄 Force syncing data with category-wise approach...')
    const { loadAllDataOnStartup, clearItemsCache } = get()
    clearItemsCache() // 強制同期時はキャッシュをクリア
    await loadAllDataOnStartup()
    set({ lastSyncTime: new Date().toISOString() })
    console.log('✅ Force sync completed!')
  },

  checkAndPerformDailySync: async () => {
    const { lastFullSyncTime, loadAllDataOnStartup, clearItemsCache } = get()
    const now = new Date()
    
    // 最後の全同期から24時間経過しているかチェック
    if (!lastFullSyncTime) {
      console.log('📅 No previous full sync time found, performing initial daily sync...')
    } else {
      const lastSync = new Date(lastFullSyncTime)
      const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceLastSync < 24) {
        console.log(`📅 Last full sync was ${hoursSinceLastSync.toFixed(1)} hours ago, skipping daily sync`)
        return
      }
      
      console.log(`📅 Last full sync was ${hoursSinceLastSync.toFixed(1)} hours ago, performing daily sync...`)
    }
    
    try {
      // 全データを再読み込み
      clearItemsCache()
      await loadAllDataOnStartup()
      
      // 全同期時刻を更新
      const syncTime = now.toISOString()
      set({ 
        lastFullSyncTime: syncTime,
        lastSyncTime: syncTime
      })
      
      console.log('✅ Daily full sync completed successfully!')
    } catch (error) {
      console.error('❌ Error during daily sync:', error)
    }
  },

  clearItemsCache: () => {
    set(state => ({
      itemsCache: {
        categories: {},
        products: {}
      }
    }))
  },

  resetUIState: () => {
    set({
      selectedCategory: null,
      selectedProduct: null,
      viewMode: 'category'
    })
  },
}))

// アプリケーション起動時にリアルタイム同期を自動開始（一時的に無効化）
if (typeof window !== 'undefined') {
  // リアルタイム同期を一時的に無効化
  console.log('ℹ️ Realtime synchronization is temporarily disabled')
  // Auto-enabling realtime synchronization is disabled - using lightweight notification system instead
  
  // ページを離れる時にリアルタイム同期を停止
  window.addEventListener('beforeunload', () => {
    const store = useInventoryStore.getState()
    if (store.isRealtimeEnabled) {
      console.log('🛑 Disabling realtime due to page unload...')
      store.disableRealtime()
    }
  })
  
  // ページがフォーカスされた時に差分同期（最近更新されたアイテムのみ）
  window.addEventListener('focus', async () => {
    const store = useInventoryStore.getState()
    if (store.isRealtimeEnabled && store.lastSyncTime) {
      console.log('🔄 Page focused, performing differential sync...')
      try {
        // 最後の同期時刻以降に更新されたアイテムのみ取得
        const recentItems = await supabaseDb.getRecentlyUpdatedProductItems(store.lastSyncTime)
        
        if (recentItems.length > 0) {
          console.log(`📦 Found ${recentItems.length} updated items since last sync`)
          
          // 既存のアイテムリストを更新
          const currentItems = store.items
          const updatedItems = [...currentItems]
          
          recentItems.forEach(recentItem => {
            const existingIndex = updatedItems.findIndex(item => item.id === recentItem.id)
            if (existingIndex >= 0) {
              // 既存アイテムを更新
              updatedItems[existingIndex] = recentItem
            } else {
              // 新しいアイテムを追加
              updatedItems.push(recentItem)
            }
          })
          
          store.clearItemsCache()
          useInventoryStore.setState({ 
            items: updatedItems,
            lastSyncTime: new Date().toISOString()
          })
          console.log('✅ Differential sync completed')
        } else {
          console.log('📦 No updates found since last sync')
        }
      } catch (error) {
        console.error('❌ Error during differential sync:', error)
      }
    } else if (store.isRealtimeEnabled && !store.lastSyncTime) {
      console.log('ℹ️ No last sync time available, skipping differential sync')
    }
  })
  
  // 定期的な日次全同期チェック（6時間ごと）
  const checkDailySyncInterval = setInterval(async () => {
    try {
      const store = useInventoryStore.getState()
      if (store.isDataInitialized) {
        await store.checkAndPerformDailySync()
      }
    } catch (error) {
      console.error('❌ Error during periodic daily sync check:', error)
    }
  }, 6 * 60 * 60 * 1000) // 6時間 = 6 * 60 * 60 * 1000ms
  
  // ページを離れる時に定期チェックを停止
  window.addEventListener('beforeunload', () => {
    clearInterval(checkDailySyncInterval)
  })
}