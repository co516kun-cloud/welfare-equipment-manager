// Mock database for debug mode
import type { Product, ProductItem, ProductCategory, Order, User, DemoEquipment, DepositItem } from '../types'

// Sample data
const mockCategories: ProductCategory[] = [
  { id: 'CAT-1', name: '車椅子', description: '手動・電動車椅子各種', icon: '♿' },
  { id: 'CAT-2', name: 'ベッド', description: '介護用ベッド・マットレス', icon: '🛏️' },
  { id: 'CAT-3', name: '歩行器', description: '歩行補助具', icon: '🚶' }
]

const mockProducts: Product[] = [
  { id: 'PRD-1', name: '標準車椅子', category_id: 'CAT-1', description: '軽量アルミフレーム車椅子', manufacturer: 'メーカーA', model: 'Model-X1' },
  { id: 'PRD-2', name: '電動ベッド', category_id: 'CAT-2', description: '3モーター電動ベッド', manufacturer: 'メーカーB', model: 'Model-Y2' },
  { id: 'PRD-3', name: '四輪歩行器', category_id: 'CAT-3', description: 'ブレーキ付き四輪歩行器', manufacturer: 'メーカーC', model: 'Model-Z3' }
]

const mockProductItems: ProductItem[] = [
  { id: 'WC-001', product_id: 'PRD-1', status: 'available', condition: 'excellent', location: '倉庫A-1', qr_code: 'WC-001', notes: '' },
  { id: 'WC-002', product_id: 'PRD-1', status: 'available', condition: 'good', location: '倉庫A-2', qr_code: 'WC-002', notes: '' },
  { id: 'BED-001', product_id: 'PRD-2', status: 'available', condition: 'excellent', location: '倉庫B-1', qr_code: 'BED-001', notes: '' },
  { id: 'WK-001', product_id: 'PRD-3', status: 'available', condition: 'good', location: '倉庫C-1', qr_code: 'WK-001', notes: '' }
]

const mockUsers: User[] = [
  { id: 'USER-1', name: '田中太郎', email: 'tanaka@example.com', role: 'staff', department: '営業部' },
  { id: 'USER-2', name: '佐藤花子', email: 'sato@example.com', role: 'manager', department: '管理部' },
  { id: 'USER-3', name: '鈴木次郎', email: 'suzuki@example.com', role: 'staff', department: '配送部' }
]

// Local storage keys
const STORAGE_KEYS = {
  CATEGORIES: 'mock_categories',
  PRODUCTS: 'mock_products',
  PRODUCT_ITEMS: 'mock_product_items',
  USERS: 'mock_users',
  ORDERS: 'mock_orders'
}

export class MockDatabase {
  private static instance: MockDatabase
  
  private constructor() {
    this.initializeData()
  }
  
  static getInstance(): MockDatabase {
    if (!MockDatabase.instance) {
      MockDatabase.instance = new MockDatabase()
    }
    return MockDatabase.instance
  }

  private initializeData() {
    // Initialize with sample data if not exists
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(mockCategories))
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mockProducts))
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCT_ITEMS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCT_ITEMS, JSON.stringify(mockProductItems))
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(mockUsers))
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]))
    }
  }

  // Categories
  async getCategories(): Promise<ProductCategory[]> {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
    return data ? JSON.parse(data) : []
  }

  async saveCategory(category: ProductCategory): Promise<void> {
    const categories = await this.getCategories()
    const index = categories.findIndex(c => c.id === category.id)
    if (index >= 0) {
      categories[index] = category
    } else {
      categories.push(category)
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories))
  }

  // Products
  async getProducts(): Promise<Product[]> {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS)
    return data ? JSON.parse(data) : []
  }

  async getProductById(id: string): Promise<Product | null> {
    const products = await this.getProducts()
    return products.find(p => p.id === id) || null
  }

  async saveProduct(product: Product): Promise<void> {
    const products = await this.getProducts()
    const index = products.findIndex(p => p.id === product.id)
    if (index >= 0) {
      products[index] = product
    } else {
      products.push(product)
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products))
  }

  // Product Items
  async getProductItems(): Promise<ProductItem[]> {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCT_ITEMS)
    return data ? JSON.parse(data) : []
  }

  async getProductItemById(id: string): Promise<ProductItem | null> {
    const items = await this.getProductItems()
    return items.find(i => i.id === id) || null
  }

  async saveProductItem(item: ProductItem): Promise<void> {
    const items = await this.getProductItems()
    const index = items.findIndex(i => i.id === item.id)
    if (index >= 0) {
      items[index] = item
    } else {
      items.push(item)
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCT_ITEMS, JSON.stringify(items))
  }

  // Users
  async getUsers(): Promise<User[]> {
    const data = localStorage.getItem(STORAGE_KEYS.USERS)
    return data ? JSON.parse(data) : []
  }

  async getUserById(id: string): Promise<User | null> {
    const users = await this.getUsers()
    return users.find(u => u.id === id) || null
  }

  async saveUser(user: User): Promise<void> {
    const users = await this.getUsers()
    const index = users.findIndex(u => u.id === user.id)
    if (index >= 0) {
      users[index] = user
    } else {
      users.push(user)
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS)
    const orders = data ? JSON.parse(data) : []
    console.log('📋 Mock DB getOrders returning:', orders)
    return orders
  }

  async getOrderById(id: string): Promise<Order | null> {
    const orders = await this.getOrders()
    return orders.find(o => o.id === id) || null
  }

  async saveOrder(order: Order): Promise<void> {
    console.log('💾 Mock DB saveOrder called with:', order)
    const orders = await this.getOrders()
    const index = orders.findIndex(o => o.id === order.id)
    if (index >= 0) {
      orders[index] = order
      console.log('✏️ Updated existing order')
    } else {
      orders.push(order)
      console.log('➕ Added new order')
    }
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders))
    console.log('📊 Total orders now:', orders.length)
  }

  async deleteOrder(id: string): Promise<void> {
    const orders = await this.getOrders()
    const filtered = orders.filter(o => o.id !== id)
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(filtered))
  }

  // Delete item history
  async deleteItemHistory(historyId: string): Promise<void> {
    console.log('🗑️ Mock DB deleteItemHistory called with:', historyId)
    const histories = await this.getItemHistories()
    const filtered = histories.filter(h => h.id !== historyId)
    localStorage.setItem(STORAGE_KEYS.ITEM_HISTORIES, JSON.stringify(filtered))
    console.log('📊 Total histories now:', filtered.length)
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    this.initializeData()
  }

  // Demo Equipment Management
  async getDemoEquipment(): Promise<DemoEquipment[]> {
    const stored = localStorage.getItem('wem_demo_equipment')
    if (stored) {
      return JSON.parse(stored)
    }
    
    // 初期データ
    const initialData: DemoEquipment[] = [
      { id: 'DEMO-001', name: 'シャワーチェア', managementNumber: '①', status: 'available' },
      { id: 'DEMO-002', name: '入浴台', managementNumber: '②', status: 'available' },
      { id: 'DEMO-003', name: '浴槽手すり', managementNumber: '③', status: 'available' },
      { id: 'DEMO-004', name: 'バスボード', managementNumber: '④', status: 'available' },
      { id: 'DEMO-005', name: 'シャワーキャリー', managementNumber: '⑤', status: 'available' }
    ]
    
    localStorage.setItem('wem_demo_equipment', JSON.stringify(initialData))
    return initialData
  }

  async saveDemoEquipment(equipment: DemoEquipment): Promise<void> {
    const current = await this.getDemoEquipment()
    const index = current.findIndex(item => item.id === equipment.id)
    
    if (index >= 0) {
      current[index] = equipment
    } else {
      current.push(equipment)
    }
    
    localStorage.setItem('wem_demo_equipment', JSON.stringify(current))
  }

  async deleteDemoEquipment(id: string): Promise<void> {
    const current = await this.getDemoEquipment()
    const filtered = current.filter(item => item.id !== id)
    localStorage.setItem('wem_demo_equipment', JSON.stringify(filtered))
  }

  // Deposit Items Management
  async getDepositItems(): Promise<DepositItem[]> {
    const stored = localStorage.getItem('wem_deposit_items')
    if (stored) {
      return JSON.parse(stored)
    }
    
    // 初期データ
    const initialData: DepositItem[] = [
      {
        id: 'DEP-001',
        date: '2024-01-15',
        customerName: '山田太郎',
        itemName: '車椅子クッション',
        notes: '修理のため一時預かり'
      },
      {
        id: 'DEP-002',
        date: '2024-01-20',
        customerName: '佐藤花子',
        itemName: 'シャワーチェア部品',
        notes: '交換部品到着まで預かり'
      },
      {
        id: 'DEP-003',
        date: '2024-01-22',
        customerName: '田中次郎',
        itemName: '歩行器グリップ',
        notes: '清掃・消毒のため'
      }
    ]
    
    localStorage.setItem('wem_deposit_items', JSON.stringify(initialData))
    return initialData
  }

  async saveDepositItem(item: DepositItem): Promise<void> {
    const current = await this.getDepositItems()
    const index = current.findIndex(existingItem => existingItem.id === item.id)
    
    if (index >= 0) {
      current[index] = item
    } else {
      current.push(item)
    }
    
    // 預かり日順（新しい順）でソート
    const sorted = current.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    localStorage.setItem('wem_deposit_items', JSON.stringify(sorted))
  }

  async deleteDepositItem(id: string): Promise<void> {
    const current = await this.getDepositItems()
    const filtered = current.filter(item => item.id !== id)
    localStorage.setItem('wem_deposit_items', JSON.stringify(filtered))
  }
}

export const mockDb = MockDatabase.getInstance()