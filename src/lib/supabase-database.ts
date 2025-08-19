import { supabase } from './supabase'
import { mockDb } from './mock-database'
import type { 
  Product, 
  ProductItem, 
  ProductCategory, 
  Order, 
  OrderItem,
  User,
  ItemHistory,
  PreparationTask,
  DemoEquipment,
  DepositItem
} from '../types'

// Check if we should use mock database (when Supabase is not properly configured)
const useMockDatabase = () => {
  // 一時的にモックデータベースを強制使用（接続問題回避のため）
  console.log('🔧 Force using mock database due to connection issues')
  return true
  
  // const url = import.meta.env.VITE_SUPABASE_URL
  // const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  // return !url || !key || url.includes('dummy') || key.includes('dummy')
}

export class SupabaseDatabase {
  private static instance: SupabaseDatabase
  
  private constructor() {}
  
  static getInstance(): SupabaseDatabase {
    if (!SupabaseDatabase.instance) {
      SupabaseDatabase.instance = new SupabaseDatabase()
    }
    return SupabaseDatabase.instance
  }

  // Categories
  async getCategories(): Promise<ProductCategory[]> {
    if (useMockDatabase()) {
      console.log('📂 Using mock database for categories')
      return await mockDb.getCategories()
    }
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }
    
    return data || []
  }

  async saveCategory(category: ProductCategory): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .upsert(category)
    
    if (error) {
      console.error('Error saving category:', error)
      throw error
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  }

  // Products
  async getProducts(): Promise<Product[]> {
    if (useMockDatabase()) {
      console.log('📦 Using mock database for products')
      return await mockDb.getProducts()
    }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching products:', error)
      return []
    }
    
    return data || []
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .order('name')
    
    if (error) {
      console.error('Error fetching products by category:', error)
      return []
    }
    
    return data || []
  }

  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching product:', error)
      return null
    }
    
    return data
  }

  async saveProduct(product: Product): Promise<void> {
    const { error } = await supabase
      .from('products')
      .upsert(product)
    
    if (error) {
      console.error('Error saving product:', error)
      throw error
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }

  // Product Items
  async getProductItems(): Promise<ProductItem[]> {
    if (useMockDatabase()) {
      console.log('🏷️ Using mock database for product items')
      return await mockDb.getProductItems()
    }
    
    // Supabaseのデフォルト制限を回避するため、範囲指定で取得
    const { data, error, count } = await supabase
      .from('product_items')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 9999) // 最大10000件まで取得
    
    if (error) {
      console.error('Error fetching product items:', error)
      return []
    }
    
    console.log(`📦 Fetched ${data?.length || 0} product items (total: ${count})`)
    
    return data || []
  }

  async getProductItemsByProductId(productId: string): Promise<ProductItem[]> {
    if (useMockDatabase()) {
      console.log('🏷️ Using mock database for product items by product')
      const items = await mockDb.getProductItems()
      return items.filter(item => item.product_id === productId)
    }
    
    const { data, error } = await supabase
      .from('product_items')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching product items by product:', error)
      return []
    }
    
    return data || []
  }

  async getProductItemsByCategoryId(categoryId: string): Promise<ProductItem[]> {
    if (useMockDatabase()) {
      console.log('🏷️ Using mock database for product items by category')
      const items = await mockDb.getProductItems()
      const products = await mockDb.getProducts()
      const categoryProducts = products.filter(p => p.category_id === categoryId)
      const categoryProductIds = categoryProducts.map(p => p.id)
      return items.filter(item => categoryProductIds.includes(item.product_id))
    }
    
    // カテゴリに属する商品のIDを取得
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', categoryId)
    
    if (productsError) {
      console.error('Error fetching products for category:', productsError)
      return []
    }
    
    if (!products || products.length === 0) {
      return []
    }
    
    const productIds = products.map(p => p.id)
    
    // それらの商品に属する商品個体を取得
    const { data, error } = await supabase
      .from('product_items')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching product items by category:', error)
      return []
    }
    
    return data || []
  }

  async getProductItemsByStatus(status: ProductItem['status']): Promise<ProductItem[]> {
    const { data, error } = await supabase
      .from('product_items')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching product items by status:', error)
      return []
    }
    
    return data || []
  }

  async getProductItemById(id: string): Promise<ProductItem | null> {
    const { data, error } = await supabase
      .from('product_items')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching product item:', error)
      return null
    }
    
    return data
  }

  async saveProductItem(item: ProductItem): Promise<void> {
    const { error } = await supabase
      .from('product_items')
      .upsert(item)
    
    if (error) {
      console.error('Error saving product item:', error)
      throw error
    }
  }

  async deleteProductItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('product_items')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting product item:', error)
      throw error
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    if (useMockDatabase()) {
      console.log('👥 Using mock database for users')
      return await mockDb.getUsers()
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching users:', error)
      return []
    }
    
    return data || []
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching user:', error)
      return null
    }
    
    return data
  }

  async saveUser(user: User): Promise<void> {
    const { error } = await supabase
      .from('users')
      .upsert(user)
    
    if (error) {
      console.error('Error saving user:', error)
      throw error
    }
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  }

  // Orders (完全実装)
  async getOrders(): Promise<Order[]> {
    if (useMockDatabase()) {
      console.log('📋 Using mock database for orders')
      return await mockDb.getOrders()
    }
    
    try {
      // まず注文の基本情報を取得
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (ordersError) {
        console.error('Error fetching orders:', ordersError)
        return []
      }

      if (!ordersData || ordersData.length === 0) {
        return []
      }

      // 各注文の詳細項目を取得
      const ordersWithItems: Order[] = []
      for (const orderData of ordersData) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderData.id)
        
        if (itemsError) {
          console.error('Error fetching order items:', itemsError)
          continue
        }

        const order: Order = {
          id: orderData.id,
          customer_name: orderData.customer_name,
          order_date: orderData.order_date,
          required_date: orderData.required_date,
          assigned_to: orderData.assigned_to,
          carried_by: orderData.carried_by,
          status: orderData.status,
          notes: orderData.notes,
          created_by: orderData.created_by,
          needs_approval: orderData.needs_approval,
          approved_by: orderData.approved_by,
          approved_date: orderData.approved_date,
          approval_notes: orderData.approval_notes,
          items: itemsData || []
        }
        
        ordersWithItems.push(order)
      }
      
      return ordersWithItems
    } catch (error) {
      console.error('Error in getOrders:', error)
      return []
    }
  }

  async getOrderById(id: string): Promise<Order | null> {
    try {
      // 注文の基本情報を取得
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()
      
      if (orderError || !orderData) {
        console.error('Error fetching order:', orderError)
        return null
      }

      // 注文項目を取得
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)
      
      if (itemsError) {
        console.error('Error fetching order items:', itemsError)
        return null
      }

      const order: Order = {
        id: orderData.id,
        customer_name: orderData.customer_name,
        order_date: orderData.order_date,
        required_date: orderData.required_date,
        assigned_to: orderData.assigned_to,
        carried_by: orderData.carried_by,
        status: orderData.status,
        notes: orderData.notes,
        approved_by: orderData.approved_by,
        approved_date: orderData.approved_date,
        approval_notes: orderData.approval_notes,
        items: itemsData || []
      }
      
      return order
    } catch (error) {
      console.error('Error in getOrderById:', error)
      return null
    }
  }

  async saveOrder(order: Order): Promise<void> {
    console.log('💾 saveOrder called with:', order)
    
    if (useMockDatabase()) {
      console.log('🔄 Using mock database for saving order')
      return await mockDb.saveOrder(order)
    }
    
    try {
      // 注文の基本情報を保存
      const orderData = {
        id: order.id,
        customer_name: order.customer_name,
        assigned_to: order.assigned_to,
        carried_by: order.carried_by,
        status: order.status,
        order_date: order.order_date,
        required_date: order.required_date,
        notes: order.notes,
        created_by: order.created_by,
        needs_approval: order.needs_approval,
        approved_by: order.approved_by,
        approved_date: order.approved_date,
        approval_notes: order.approval_notes
      }
      console.log('📝 Order data to save:', orderData)

      const { error: orderError } = await supabase
        .from('orders')
        .upsert(orderData)
      
      if (orderError) {
        console.error('❌ Error saving order to database:', orderError)
        throw orderError
      }
      console.log('✅ Order base data saved successfully')

      // 既存の注文項目を削除
      console.log('🗑️ Deleting existing order items for order:', order.id)
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id)
      
      if (deleteError) {
        console.error('❌ Error deleting existing order items:', deleteError)
        throw deleteError
      }
      console.log('✅ Existing order items deleted')

      // 新しい注文項目を挿入
      if (order.items && order.items.length > 0) {
        const itemsData = order.items.map(item => ({
          ...item,
          order_id: order.id
        }))
        console.log('📦 Order items to save:', itemsData)

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsData)
        
        if (itemsError) {
          console.error('❌ Error saving order items to database:', itemsError)
          throw itemsError
        }
        console.log('✅ Order items saved successfully')
      } else {
        console.log('⚠️ No order items to save')
      }
    } catch (error) {
      console.error('Error in saveOrder:', error)
      throw error
    }
  }

  // Order Items
  async saveOrderItem(orderItem: OrderItem & { order_id: string }): Promise<void> {
    if (useMockDatabase()) {
      console.log('📝 Using mock database for order item')
      // Mock database doesn't have separate order items handling
      return
    }

    try {
      console.log('💾 saveOrderItem called with:', orderItem)
      
      // OrderItemをorder_itemsテーブル用にマッピング
      const orderItemData = {
        id: orderItem.id,
        order_id: orderItem.order_id,
        product_id: orderItem.product_id,
        quantity: orderItem.quantity,
        assigned_item_ids: orderItem.assigned_item_ids || [],
        notes: orderItem.notes || null,
        item_status: orderItem.item_status || null,
        needs_approval: orderItem.needs_approval || false,
        approval_status: orderItem.approval_status,
        approved_by: orderItem.approved_by || null,
        approved_date: orderItem.approved_date || null,
        approval_notes: orderItem.approval_notes || null,
        item_processing_status: orderItem.item_processing_status
      }

      const { error } = await supabase
        .from('order_items')
        .upsert(orderItemData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })

      if (error) {
        console.error('Error saving order item:', error)
        throw error
      }
      
      console.log('✅ Order item saved successfully')
    } catch (error) {
      console.error('Error in saveOrderItem:', error)
      throw error
    }
  }

  // Item Histories
  async getItemHistories(): Promise<ItemHistory[]> {
    const { data, error } = await supabase
      .from('item_histories')
      .select('*')
      .order('timestamp', { ascending: false })
    
    if (error) {
      // テーブルが存在しない場合は空配列を返す
      if (error.code === '42P01') {
        console.warn('item_histories table does not exist. Please run create-item-histories-table.sql')
        return []
      }
      console.error('Error fetching item histories:', error)
      return []
    }
    
    return data || []
  }

  async getItemHistoriesByItemId(itemId: string): Promise<ItemHistory[]> {
    const { data, error } = await supabase
      .from('item_histories')
      .select('*')
      .eq('item_id', itemId)
      .order('timestamp', { ascending: false })
    
    if (error) {
      console.error('Error fetching item histories by item ID:', error)
      return []
    }
    
    return data || []
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
      conditionNotes?: string
      customerName?: string
      photos?: string[]
      metadata?: any
    }
  ): Promise<void> {
    const history: Omit<ItemHistory, 'id'> = {
      item_id: itemId,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      performed_by: userName,
      timestamp: new Date().toISOString(),
      location: details?.location,
      condition: details?.condition,
      customer_name: details?.customerName,
      condition_notes: details?.conditionNotes,
      photos: details?.photos,
      metadata: details?.metadata
    }

    const { error } = await supabase
      .from('item_histories')
      .insert(history)
    
    if (error) {
      console.error('Error creating item history:', error)
      throw error
    }
  }

  // Preparation Tasks
  async getPreparationTasks(): Promise<PreparationTask[]> {
    const { data, error } = await supabase
      .from('preparation_tasks')
      .select('*')
      .order('start_date', { ascending: false })
    
    if (error) {
      // テーブルが存在しない場合は空配列を返す
      if (error.code === '42P01') {
        console.warn('preparation_tasks table does not exist. Please run create-preparation-tasks-table.sql')
        return []
      }
      console.error('Error fetching preparation tasks:', error)
      return []
    }
    
    return data?.map(task => ({
      id: task.id,
      orderId: task.order_id,
      itemId: task.item_id,
      assignedTo: task.assigned_to,
      status: task.status,
      startDate: task.start_date,
      completedDate: task.completed_date,
      notes: task.notes
    })) || []
  }

  async savePreparationTask(task: PreparationTask): Promise<void> {
    const taskData = {
      id: task.id,
      order_id: task.orderId,
      item_id: task.itemId,
      assigned_to: task.assignedTo,
      status: task.status,
      start_date: task.startDate,
      completed_date: task.completedDate,
      notes: task.notes
    }

    const { error } = await supabase
      .from('preparation_tasks')
      .upsert(taskData)
    
    if (error) {
      console.error('Error saving preparation task:', error)
      throw error
    }
  }

  async updatePreparationTaskStatus(taskId: string, status: PreparationTask['status'], completedDate?: string): Promise<void> {
    const updateData: any = { status }
    if (status === 'completed' && completedDate) {
      updateData.completed_date = completedDate
    }

    const { error } = await supabase
      .from('preparation_tasks')
      .update(updateData)
      .eq('id', taskId)
    
    if (error) {
      console.error('Error updating preparation task status:', error)
      throw error
    }
  }

  async deletePreparationTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('preparation_tasks')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting preparation task:', error)
      throw error
    }
  }

  // Batch upsert methods for import
  async upsertCategories(categories: ProductCategory[]): Promise<void> {
    if (useMockDatabase()) {
      console.log('📂 Using mock database for batch categories upsert')
      for (const category of categories) {
        await mockDb.saveCategory(category)
      }
      return
    }
    
    const { error } = await supabase
      .from('categories')
      .upsert(categories, { onConflict: 'id' })
    
    if (error) {
      console.error('Error batch upserting categories:', error)
      throw error
    }
  }

  async upsertProducts(products: Product[]): Promise<void> {
    if (useMockDatabase()) {
      console.log('📦 Using mock database for batch products upsert')
      for (const product of products) {
        await mockDb.saveProduct(product)
      }
      return
    }
    
    const { error } = await supabase
      .from('products')
      .upsert(products, { onConflict: 'id' })
    
    if (error) {
      console.error('Error batch upserting products:', error)
      throw error
    }
  }

  async upsertProductItems(items: ProductItem[]): Promise<void> {
    if (useMockDatabase()) {
      console.log('🏷️ Using mock database for batch product items upsert')
      for (const item of items) {
        await mockDb.saveProductItem(item)
      }
      return
    }
    
    const { error } = await supabase
      .from('product_items')
      .upsert(items, { onConflict: 'id' })
    
    if (error) {
      console.error('Error batch upserting product items:', error)
      throw error
    }
  }

  async upsertUsers(users: User[]): Promise<void> {
    if (useMockDatabase()) {
      console.log('👥 Using mock database for batch users upsert')
      for (const user of users) {
        await mockDb.saveUser(user)
      }
      return
    }
    
    const { error } = await supabase
      .from('users')
      .upsert(users, { onConflict: 'id' })
    
    if (error) {
      console.error('Error batch upserting users:', error)
      throw error
    }
  }

  // Delete item history
  async deleteItemHistory(historyId: string): Promise<void> {
    if (useMockDatabase()) {
      console.log('🗑️ Using mock database for deleteItemHistory')
      return await mockDb.deleteItemHistory(historyId)
    }
    
    const { error } = await supabase
      .from('item_histories')
      .delete()
      .eq('id', historyId)
    
    if (error) {
      console.error('Error deleting item history:', error)
      throw error
    }
  }

  // Delete order and its items
  async deleteOrder(orderId: string): Promise<void> {
    if (useMockDatabase()) {
      console.log('🗑️ Using mock database for deleteOrder')
      return await mockDb.deleteOrder(orderId)
    }
    
    try {
      // First delete order items (foreign key constraint)
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)
      
      if (itemsError) {
        console.error('Error deleting order items:', itemsError)
        throw itemsError
      }
      
      // Then delete the order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
      
      if (orderError) {
        console.error('Error deleting order:', orderError)
        throw orderError
      }
    } catch (error) {
      console.error('Error in deleteOrder:', error)
      throw error
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      // Delete in correct order due to foreign key constraints
      // preparation_tasksとitem_historiesは存在しない可能性があるため個別処理
      try {
        await supabase.from('preparation_tasks').delete().neq('id', '')
      } catch (error) {
        console.warn('preparation_tasks table does not exist, skipping deletion')
      }
      
      try {
        await supabase.from('item_histories').delete().neq('id', '')
      } catch (error) {
        console.warn('item_histories table does not exist, skipping deletion')
      }
      
      await supabase.from('order_items').delete().neq('id', '')
      await supabase.from('orders').delete().neq('id', '')
      await supabase.from('product_items').delete().neq('id', '')
      await supabase.from('products').delete().neq('id', '')
      await supabase.from('categories').delete().neq('id', '')
      await supabase.from('users').delete().neq('id', '')
      
      console.log('All data cleared from Supabase')
    } catch (error) {
      console.error('Error clearing data:', error)
      throw error
    }
  }

  // Demo Equipment Management
  async getDemoEquipment(): Promise<DemoEquipment[]> {
    if (useMockDatabase()) {
      console.log('📂 Using mock database for demo equipment')
      return await mockDb.getDemoEquipment()
    }
    
    const { data, error } = await supabase
      .from('demo_equipment')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      // テーブルが存在しない場合は空配列を返す
      if (error.code === '42P01') {
        console.warn('demo_equipment table does not exist. Please create the table.')
        return []
      }
      console.error('Error fetching demo equipment:', error)
      return []
    }
    
    return data?.map(item => ({
      id: item.id,
      name: item.name,
      managementNumber: item.management_number,
      status: item.status,
      customerName: item.customer_name,
      loanDate: item.loan_date,
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at
    })) || []
  }

  async saveDemoEquipment(equipment: DemoEquipment): Promise<void> {
    if (useMockDatabase()) {
      console.log('💾 Using mock database for demo equipment')
      return await mockDb.saveDemoEquipment(equipment)
    }
    
    const equipmentData = {
      id: equipment.id,
      name: equipment.name,
      management_number: equipment.managementNumber,
      status: equipment.status,
      customer_name: equipment.customerName,
      loan_date: equipment.loanDate,
      notes: equipment.notes,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('demo_equipment')
      .upsert(equipmentData)
    
    if (error) {
      console.error('Error saving demo equipment:', error)
      throw error
    }
  }

  async deleteDemoEquipment(id: string): Promise<void> {
    if (useMockDatabase()) {
      console.log('🗑️ Using mock database for demo equipment deletion')
      return await mockDb.deleteDemoEquipment(id)
    }
    
    const { error } = await supabase
      .from('demo_equipment')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting demo equipment:', error)
      throw error
    }
  }

  // Deposit Items Management
  async getDepositItems(): Promise<DepositItem[]> {
    if (useMockDatabase()) {
      console.log('📂 Using mock database for deposit items')
      return await mockDb.getDepositItems()
    }
    
    const { data, error } = await supabase
      .from('deposit_items')
      .select('*')
      .order('date', { ascending: false })
    
    if (error) {
      // テーブルが存在しない場合は空配列を返す
      if (error.code === '42P01') {
        console.warn('deposit_items table does not exist. Please create the table.')
        return []
      }
      console.error('Error fetching deposit items:', error)
      return []
    }
    
    return data?.map(item => ({
      id: item.id,
      date: item.date,
      customerName: item.customer_name,
      itemName: item.item_name,
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at
    })) || []
  }

  async saveDepositItem(item: DepositItem): Promise<void> {
    if (useMockDatabase()) {
      console.log('💾 Using mock database for deposit item')
      return await mockDb.saveDepositItem(item)
    }
    
    const itemData = {
      id: item.id,
      date: item.date,
      customer_name: item.customerName,
      item_name: item.itemName,
      notes: item.notes,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('deposit_items')
      .upsert(itemData)
    
    if (error) {
      console.error('Error saving deposit item:', error)
      throw error
    }
  }

  async deleteDepositItem(id: string): Promise<void> {
    if (useMockDatabase()) {
      console.log('🗑️ Using mock database for deposit item deletion')
      return await mockDb.deleteDepositItem(id)
    }
    
    const { error } = await supabase
      .from('deposit_items')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting deposit item:', error)
      throw error
    }
  }
}

export const supabaseDb = SupabaseDatabase.getInstance()