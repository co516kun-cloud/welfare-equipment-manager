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
  
  // Actions
  loadData: () => Promise<void>
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
      
      console.log('Loaded basic data from Supabase:', {
        categories: categories.length,
        products: products.length,
        users: users.length,
        orders: orders.length,
        preparationTasks: preparationTasks.length
      })
      
      set({
        categories,
        products,
        items: [], // 商品個体は動的に読み込み
        orders,
        preparationTasks,
        users
      })
    } catch (error) {
      console.error('Error loading data from Supabase:', error)
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
    console.log(`🏷️ updateItemStatus called: ${itemId} -> ${status}`)
    try {
      const item = await supabaseDb.getProductItemById(itemId)
      console.log('📦 Found item:', item)
      
      if (item) {
        const updatedItem = { ...item, status }
        console.log('🔄 Updating item:', updatedItem)
        
        await supabaseDb.saveProductItem(updatedItem)
        console.log('✅ Item saved to database')
        
        const { items } = get()
        const updatedItems = items.map(i => 
          i.id === itemId ? updatedItem : i
        )
        set({ items: updatedItems })
        // アイテムが更新されたのでキャッシュをクリア
        get().clearItemsCache()
        console.log('📊 Store updated')
      } else {
        console.log('❌ Item not found:', itemId)
      }
    } catch (error) {
      console.error('❌ Error updating item status:', error)
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

    console.log('🔄 Enabling realtime synchronization...')

    // 既存の接続をクリア
    realtimeSubscriptions.forEach(sub => {
      if (sub && sub.unsubscribe) {
        sub.unsubscribe()
      }
    })
    realtimeSubscriptions = []

    // データベースの各テーブルをリアルタイム監視（存在するテーブルのみ）
    const tables = ['categories', 'products', 'product_items', 'orders', 'order_items', 'users']
    
    tables.forEach(table => {
      const subscription = supabase
        .channel(`public:${table}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: table },
          (payload) => {
            console.log(`🔄 Realtime update from ${table}:`, payload)
            
            // データの変更を検知したら全データを再読み込み
            // より効率的にするには、変更された特定のデータのみを更新することも可能
            const currentState = get()
            if (currentState.isRealtimeEnabled) {
              currentState.loadData()
              set({ lastSyncTime: new Date().toISOString() })
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 Realtime status for ${table}:`, status)
        })

      realtimeSubscriptions.push(subscription)
    })

    set({ 
      isRealtimeEnabled: true,
      lastSyncTime: new Date().toISOString()
    })
    
    console.log('✅ Realtime synchronization enabled!')
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
    console.log('🔄 Force syncing data...')
    const { loadData, clearItemsCache } = get()
    clearItemsCache() // 強制同期時はキャッシュをクリア
    await loadData()
    set({ lastSyncTime: new Date().toISOString() })
    console.log('✅ Force sync completed!')
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
  
  // ページがフォーカスされた時に再同期
  window.addEventListener('focus', () => {
    const store = useInventoryStore.getState()
    if (store.isRealtimeEnabled) {
      console.log('🔄 Page focused, force syncing...')
      store.forceSync()
    }
  })
}