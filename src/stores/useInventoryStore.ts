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
    console.log('Loading basic data from Supabase...')
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
      
      console.log('Loaded basic data from Supabase:', {
        categories: categories.length,
        products: products.length,
        users: users.length,
        orders: orders.length,
        preparationTasks: preparationTasks.length,
        itemsKept: currentItems.length // 保持されたitems数をログ出力
      })
      
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
    console.log('🚀 Loading ALL data on startup using category-wise approach...')
    try {
      // カテゴリー別読み込みで全データを取得
      const { categories, products, items, users, orders } = await supabaseDb.loadAllDataByCategory()
      
      // preparation_tasksは個別にロード（テーブルが存在しない可能性があるため）
      let preparationTasks: PreparationTask[] = []
      try {
        preparationTasks = await supabaseDb.getPreparationTasks()
      } catch (error) {
        console.warn('Could not load preparation tasks:', error)
      }
      
      console.log('🎉 Startup data loading completed:', {
        categories: categories.length,
        products: products.length,
        items: items.length,
        users: users.length,
        orders: orders.length,
        preparationTasks: preparationTasks.length
      })
      
      const syncTime = new Date().toISOString()
      set({
        categories,
        products,
        items,
        orders,
        preparationTasks,
        users,
        lastSyncTime: syncTime,
        lastFullSyncTime: syncTime, // 初回データ読み込み時に全同期時刻も設定
        isDataInitialized: true // 初期化完了フラグを設定
      })
    } catch (error) {
      console.error('❌ Error loading startup data:', error)
      // フォールバックとして基本的なloadDataを実行
      console.log('🔄 Falling back to basic loadData...')
      await get().loadData()
    }
  },

  loadItemsForCategory: async (categoryId: string) => {
    console.log(`📦 Loading items for category: ${categoryId}`)
    try {
      const items = await supabaseDb.getProductItemsByCategoryId(categoryId)
      console.log(`✅ Loaded ${items.length} items for category ${categoryId}`)
      set({ items })
    } catch (error) {
      console.error('Error loading items for category:', error)
    }
  },

  loadItemsForProduct: async (productId: string) => {
    console.log(`📦 Loading items for product: ${productId}`)
    try {
      const items = await supabaseDb.getProductItemsByProductId(productId)
      console.log(`✅ Loaded ${items.length} items for product ${productId}`)
      set({ items })
    } catch (error) {
      console.error('Error loading items for product:', error)
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
    console.log(`🚀 Optimistic updateItemStatus called: ${itemId} -> ${status}`)
    
    const { items } = get()
    const targetItem = items.find(i => i.id === itemId)
    
    if (!targetItem) {
      console.error('❌ Item not found in store:', itemId)
      throw new Error(`Item ${itemId} not found`)
    }
    
    const originalStatus = targetItem.status
    console.log(`🔄 Optimistic update: ${originalStatus} -> ${status}`)
    
    // 1. 楽観的更新：即座にストアを更新（ユーザーには瞬時反映）
    const updatedItem = { ...targetItem, status }
    const updatedItems = items.map(i => i.id === itemId ? updatedItem : i)
    set({ items: updatedItems })
    get().clearItemsCache()
    console.log('⚡ Optimistic update applied to store')
    
    try {
      // 2. データベース保存（非同期）
      await supabaseDb.saveProductItem(updatedItem)
      console.log('✅ Item saved to database successfully')
      
      // 3. 成功時は追加処理なし（既にストア更新済み）
      
    } catch (error) {
      console.error('❌ Database save failed, rolling back...', error)
      
      // 4. エラー時：ロールバック（元のステータスに戻す）
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
    const state = get()
    if (state.isRealtimeEnabled) return

    console.log('🔄 Enabling category-wise realtime synchronization...')

    // 既存の接続をクリア
    realtimeSubscriptions.forEach(sub => {
      if (sub && sub.unsubscribe) {
        sub.unsubscribe()
      }
    })
    realtimeSubscriptions = []

    // データベースの各テーブルをリアルタイム監視（存在するテーブルのみ）
    const tables = ['categories', 'products', 'product_items', 'orders', 'order_items', 'users']
    
    // 単一のチャネルで全テーブルを監視（接続効率化）
    const channel = supabase.channel('db-changes')
    
    tables.forEach(table => {
      channel.on('postgres_changes', 
        { event: '*', schema: 'public', table: table },
        async (payload) => {
          console.log(`🔄 Realtime update from ${table}:`, payload)
            
            const currentState = get()
            if (!currentState.isRealtimeEnabled) return
            
            try {
              // テーブルに応じて効率的な更新を実行
              if (table === 'product_items') {
                // 商品アイテムの変更：軽量な個別更新
                console.log('📦 Product item changed, applying lightweight update...')
                
                
                const { eventType, new: newData, old: oldData } = payload
                console.log(`🔄 ${eventType} event:`, { newData, oldData })
                
                if (eventType === 'UPDATE' && newData) {
                  // 個別アイテムの更新（他のユーザーからの変更）
                  const { items } = currentState
                  const updatedItems = items.map(item => 
                    item.id === newData.id ? newData : item
                  )
                  set({ items: updatedItems })
                  currentState.clearItemsCache()
                  console.log('⚡ Individual item updated in store:', newData.id)
                  
                } else if (eventType === 'INSERT' && newData) {
                  // 新しいアイテムの追加
                  const { items } = currentState
                  const updatedItems = [...items, newData]
                  set({ items: updatedItems })
                  currentState.clearItemsCache()
                  console.log('➕ New item added to store:', newData.id)
                  
                } else if (eventType === 'DELETE' && oldData) {
                  // アイテムの削除
                  const { items } = currentState
                  const updatedItems = items.filter(item => item.id !== oldData.id)
                  set({ items: updatedItems })
                  currentState.clearItemsCache()
                  console.log('🗑️ Item removed from store:', oldData.id)
                }
                
              } else if (table === 'orders' || table === 'order_items') {
                // オーダー関連：軽量な更新のみ（頻繁に変更されるため）
                console.log(`📊 ${table} changed, refreshing orders...`)
                try {
                  const orders = await supabaseDb.getOrders()
                  set({ orders })
                } catch (error) {
                  console.error('Error refreshing orders:', error)
                }
              } else {
                // その他のテーブル：基本的なloadDataのみ
                console.log(`📊 ${table} changed, reloading basic data...`)
                await currentState.loadData()
              }
              
              set({ lastSyncTime: new Date().toISOString() })
            } catch (error) {
              console.error('❌ Error during realtime sync:', error)
            }
          }
        )
    })
    
    // チャネルを購読
    channel.subscribe((status) => {
      console.log(`📡 Realtime channel status:`, status)
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully connected to realtime updates!')
      }
    })
    
    realtimeSubscriptions.push(channel)

    set({ 
      isRealtimeEnabled: true,
      lastSyncTime: new Date().toISOString()
    })
    
    console.log('✅ Category-wise realtime synchronization enabled!')
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
  // window.addEventListener('load', () => {
  //   setTimeout(() => {
  //     const store = useInventoryStore.getState()
  //     console.log('🚀 Auto-enabling realtime synchronization...')
  //     store.enableRealtime()
  //   }, 1000)
  // })
  
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