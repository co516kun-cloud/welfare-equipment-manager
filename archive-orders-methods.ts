  // アーカイブされた発注を含む全発注を取得（履歴表示用）
  async getAllOrdersIncludingArchived(): Promise<Order[]> {
    if (useMockDatabase()) {
      return await mockDb.getOrders()
    }
    
    try {
      // アーカイブ状態に関係なく全ての注文を取得
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (ordersError) {
        console.error('Error fetching all orders:', ordersError)
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
          console.error(`Error fetching items for order ${orderData.id}:`, itemsError)
          continue
        }

        const order: Order = {
          ...orderData,
          items: itemsData || []
        }

        ordersWithItems.push(order)
      }
      
      console.log(`📋 Loaded ${ordersWithItems.length} orders (including archived)`)
      return ordersWithItems
    } catch (error) {
      console.error('Error in getAllOrdersIncludingArchived:', error)
      return []
    }
  }

  // 完了した発注をアーカイブする
  async archiveCompletedOrders(daysOld: number = 30): Promise<number> {
    if (useMockDatabase()) {
      console.log('Archive function not available in mock mode')
      return 0
    }
    
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)
      
      const { data, error } = await supabase
        .from('orders')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('is_archived', false)
        .in('status', ['completed', 'cancelled', 'rejected'])
        .lt('updated_at', cutoffDate.toISOString())
        .select('id')
      
      if (error) {
        console.error('Error archiving orders:', error)
        throw error
      }
      
      const archivedCount = data?.length || 0
      console.log(`📦 Archived ${archivedCount} completed orders older than ${daysOld} days`)
      return archivedCount
    } catch (error) {
      console.error('Error in archiveCompletedOrders:', error)
      return 0
    }
  }