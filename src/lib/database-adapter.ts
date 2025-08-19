// Database adapter to switch between LocalDatabase and SupabaseDatabase
import { supabaseDb } from './supabase-database'
import { db as localDb } from './database'

// Check if we should use Supabase
const useSupabase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && key && !url.includes('dummy') && !key.includes('dummy')
}

// Database adapter that automatically chooses the right implementation
export const dbAdapter = {
  // Categories
  async getCategories() {
    if (useSupabase()) {
      console.log('🗄️ Using Supabase for categories')
      return await supabaseDb.getCategories()
    } else {
      console.log('💾 Using LocalStorage for categories')
      return localDb.getCategories()
    }
  },

  async saveCategory(category: any) {
    if (useSupabase()) {
      return await supabaseDb.saveCategory(category)
    } else {
      return localDb.saveCategory(category)
    }
  },

  async deleteCategory(id: string) {
    if (useSupabase()) {
      return await supabaseDb.deleteCategory(id)
    } else {
      return localDb.deleteCategory(id)
    }
  },

  // Products
  async getProducts() {
    if (useSupabase()) {
      console.log('🗄️ Using Supabase for products')
      return await supabaseDb.getProducts()
    } else {
      console.log('💾 Using LocalStorage for products')
      return localDb.getProducts()
    }
  },

  async getProductById(id: string) {
    if (useSupabase()) {
      return await supabaseDb.getProductById(id)
    } else {
      return localDb.getProductById(id)
    }
  },

  async saveProduct(product: any) {
    if (useSupabase()) {
      return await supabaseDb.saveProduct(product)
    } else {
      return localDb.saveProduct(product)
    }
  },

  async deleteProduct(id: string) {
    if (useSupabase()) {
      return await supabaseDb.deleteProduct(id)
    } else {
      return localDb.deleteProduct(id)
    }
  },

  // Product Items
  async getProductItems() {
    if (useSupabase()) {
      console.log('🗄️ Using Supabase for product items')
      return await supabaseDb.getProductItems()
    } else {
      console.log('💾 Using LocalStorage for product items')
      return localDb.getProductItems()
    }
  },

  async getProductItemById(id: string) {
    if (useSupabase()) {
      return await supabaseDb.getProductItemById(id)
    } else {
      return localDb.getProductItemById(id)
    }
  },

  async getProductItemsByProductId(productId: string) {
    if (useSupabase()) {
      return await supabaseDb.getProductItemsByProductId(productId)
    } else {
      return localDb.getProductItemsByProductId(productId)
    }
  },

  async getProductItemsByStatus(status: any) {
    if (useSupabase()) {
      return await supabaseDb.getProductItemsByStatus(status)
    } else {
      return localDb.getProductItemsByStatus(status)
    }
  },

  async saveProductItem(item: any) {
    if (useSupabase()) {
      return await supabaseDb.saveProductItem(item)
    } else {
      return localDb.saveProductItem(item)
    }
  },

  async deleteProductItem(id: string) {
    if (useSupabase()) {
      return await supabaseDb.deleteProductItem(id)
    } else {
      return localDb.deleteProductItem(id)
    }
  },

  // Users
  async getUsers() {
    if (useSupabase()) {
      console.log('🗄️ Using Supabase for users')
      return await supabaseDb.getUsers()
    } else {
      console.log('💾 Using LocalStorage for users')
      return localDb.getUsers()
    }
  },

  async getUserById(id: string) {
    if (useSupabase()) {
      return await supabaseDb.getUserById(id)
    } else {
      return localDb.getUserById(id)
    }
  },

  async saveUser(user: any) {
    if (useSupabase()) {
      return await supabaseDb.saveUser(user)
    } else {
      return localDb.saveUser(user)
    }
  },

  async deleteUser(id: string) {
    if (useSupabase()) {
      return await supabaseDb.deleteUser(id)
    } else {
      return localDb.deleteUser(id)
    }
  },

  // Orders
  async getOrders() {
    if (useSupabase()) {
      console.log('🗄️ Using Supabase for orders')
      return await supabaseDb.getOrders()
    } else {
      console.log('💾 Using LocalStorage for orders')
      return localDb.getOrders()
    }
  },

  async getOrderById(id: string) {
    if (useSupabase()) {
      return await supabaseDb.getOrderById(id)
    } else {
      return localDb.getOrderById(id)
    }
  },

  async getOrdersByStatus(status: any) {
    if (useSupabase()) {
      // SupabaseDatabase doesn't have this method, so we'll filter manually
      const orders = await supabaseDb.getOrders()
      return orders.filter(order => order.status === status)
    } else {
      return localDb.getOrdersByStatus(status)
    }
  },

  async saveOrder(order: any) {
    if (useSupabase()) {
      return await supabaseDb.saveOrder(order)
    } else {
      return localDb.saveOrder(order)
    }
  },

  async deleteOrder(id: string) {
    if (useSupabase()) {
      return await supabaseDb.deleteOrder(id)
    } else {
      return localDb.deleteOrder(id)
    }
  },

  // Statistics
  getInventoryStats() {
    // For now, always use local database for stats
    return localDb.getInventoryStats()
  },

  getOrderStats() {
    // For now, always use local database for stats
    return localDb.getOrderStats()
  },

  // Utility methods
  isUsingSupabase() {
    return useSupabase()
  },

  async initializeSampleData() {
    if (!useSupabase()) {
      return localDb.initializeSampleData()
    }
    // Supabase already has sample data from SQL script
    console.log('📝 Supabase already initialized with sample data')
  }
}