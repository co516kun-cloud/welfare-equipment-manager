import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { QRCameraScanner } from '../components/qr-camera-scanner'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useAuth } from '../hooks/useAuth'
import { supabaseDb } from '../lib/supabase-database'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Preparation() {
  const { orders, products, users, loadData, isDataInitialized, updateItemStatus } = useInventoryStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(false)
  const [selectedPreparationItem, setSelectedPreparationItem] = useState<any>(null)
  const [showManualAssignDialog, setShowManualAssignDialog] = useState(false)
  const [showQRScanDialog, setShowQRScanDialog] = useState(false)
  const [manualItemId, setManualItemId] = useState('')
  const [assignError, setAssignError] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [expandedGroups, setExpandedGroups] = useState<{[key: string]: boolean}>({})
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({})
  const [activeTab, setActiveTab] = useState<'unassigned' | 'assigned'>('unassigned')

  // モバイル検出
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  

  // 認証ユーザーから現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return 'ゲスト'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || 'ユーザー'
  }
  
  const currentUser = getCurrentUserName()
  
  // QRスキャン用の状態
  const [qrScanItem, setQrScanItem] = useState<any>(null)
  const [scanError, setScanError] = useState('')
  const [qrCodeInput, setQrCodeInput] = useState('')
  const [useCameraScanner, setUseCameraScanner] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  
  useEffect(() => {
    // データが初期化されていない場合、または基本データが空の場合のみ再読み込み
    if (!isDataInitialized && (orders.length === 0 || products.length === 0)) {
      console.log('🔄 Preparation page: Data not initialized, loading basic data...')
      loadData()
    }
  }, [orders.length, products.length, isDataInitialized, loadData])
  
  
  // QRスキャンダイアログを開く
  const handleQRScan = (item: any) => {
    setQrScanItem(item)
    setQrCodeInput('')
    setScanError('')
    setCameraError(null)
    setUseCameraScanner(false)
    setShowQRScanDialog(true)
  }

  // カメラスキャンの結果を処理
  const handleCameraScanResult = async (qrCode: string) => {
    try {
      console.log('📱 Camera scan result:', qrCode)
      setQrCodeInput(qrCode)
      setUseCameraScanner(false)
      setScanError('') // エラーをクリア
      
      // 少し待ってから自動で割り当て処理を実行
      setTimeout(async () => {
        try {
          await handleQRAssign()
        } catch (error) {
          console.error('🔥 Error in auto QR assign:', error)
          setScanError(`QR処理エラー: ${error instanceof Error ? error.message : String(error)}`)
          // 手動入力モードに切り替え
          setUseCameraScanner(false)
        }
      }, 100) // タイミングを短縮
    } catch (error) {
      console.error('🔥 Error in handleCameraScanResult:', error)
      setCameraError(`スキャン処理エラー: ${error instanceof Error ? error.message : String(error)}`)
      setUseCameraScanner(false)
    }
  }

  // カメラエラーを処理
  const handleCameraError = (error: string) => {
    console.error('📱 Camera error:', error)
    setCameraError(error)
    setUseCameraScanner(false)
  }

  // QRコードによる割り当て処理
  const handleQRAssign = async () => {
    try {
      console.log('🔧 Starting QR assignment process...')
      
      if (!qrCodeInput.trim()) {
        setScanError('QRコードを入力してください')
        return
      }

      setScanError('')
      
      if (!qrScanItem) {
        setScanError('準備対象商品が選択されていません')
        return
      }

      console.log('🔧 QR Assignment data:', {
        qrCode: qrCodeInput.trim(),
        targetItem: qrScanItem
      })
      
      // QRコードからアイテムを検索
      console.log('🔧 Fetching product items...')
      const items = await supabaseDb.getProductItems()
      console.log('🔧 Found', items.length, 'product items')
      
      const scannedItem = items.find(item => {
        const itemQR = item.qr_code?.trim()
        const inputQR = qrCodeInput.trim()
        // 大文字小文字を無視して比較
        return itemQR && itemQR.toLowerCase() === inputQR.toLowerCase()
      })
      
      if (!scannedItem) {
        setScanError('QRコードに対応するアイテムが見つかりません')
        return
      }

      // 商品IDが一致するかチェック
      const expectedProductId = qrScanItem.product_id
      const productIdMatch = scannedItem.product_id?.toLowerCase() === expectedProductId?.toLowerCase()
      
      if (!productIdMatch) {
        const scannedProduct = await supabaseDb.getProductById(scannedItem.product_id)
        const expectedProduct = await supabaseDb.getProductById(expectedProductId)
        setScanError(`商品が一致しません。期待: ${expectedProduct?.name}, スキャン: ${scannedProduct?.name}`)
        return
      }

      // アイテムが利用可能かチェック
      if (scannedItem.status !== 'available') {
        setScanError(`このアイテムは利用できません（現在のステータス: ${scannedItem.status}）`)
        return
      }

      // 既に割り当て済みかチェック
      const order = await supabaseDb.getOrderById(qrScanItem.orderId)
      if (!order) {
        setScanError('発注が見つかりません')
        return
      }

      const orderItem = order.items.find(item => item.id === qrScanItem.itemId)
      if (!orderItem) {
        setScanError('発注アイテムが見つかりません')
        return
      }

      // 既に割り当てられているかチェック
      const isAlreadyAssigned = orderItem.assigned_item_ids?.includes(scannedItem.id)
      if (isAlreadyAssigned) {
        setScanError('このアイテムは既に割り当て済みです')
        return
      }

      // 割り当て処理
      const updatedItems = order.items.map(item => {
        if (item.id === qrScanItem.itemId) {
          const newAssignedIds = [...(item.assigned_item_ids || []), scannedItem.id]
          const isFullyAssigned = newAssignedIds.filter(id => id !== null && id !== undefined).length >= item.quantity
          
          return {
            ...item,
            assigned_item_ids: newAssignedIds,
            item_processing_status: isFullyAssigned ? 'ready' as const : 'waiting' as const
          }
        }
        return item
      })

      // すべてのアイテムが準備完了したかチェック
      const allReady = updatedItems.every(item => item.item_processing_status === 'ready')
      
      const updatedOrder = {
        ...order,
        items: updatedItems,
        status: allReady ? 'ready' as const : 'approved' as const
      }

      await supabaseDb.saveOrder(updatedOrder)

      // 楽観的更新でステータスを即座に反映
      await updateItemStatus(scannedItem.id, 'ready_for_delivery')
      
      // customer_name も更新が必要な場合は追加で保存
      if (scannedItem.customer_name !== order.customer_name) {
        const updatedProductItem = {
          ...scannedItem,
          status: 'ready_for_delivery' as const,
          customer_name: order.customer_name,
        }
        await supabaseDb.saveProductItem(updatedProductItem)
      }

      // 履歴を記録（履歴のみに記録、商品データは変更しない）
      await supabaseDb.createItemHistory(
        scannedItem.id,
        '準備完了',
        scannedItem.status,
        'ready_for_delivery',
        currentUser,
        {
          location: scannedItem.location, // 元の場所を履歴に記録
          customerName: order.customer_name,
          notes: '', // 履歴のメモは空に（商品のメモは変更しない）
          metadata: {
            orderId: qrScanItem.orderId,
            orderItemId: qrScanItem.itemId,
            assignmentMethod: 'qr_scan',
            previousStatus: scannedItem.status,
            previousLocation: scannedItem.location,
            previousNotes: scannedItem.notes, // 前の状態のメモを履歴に保存
            assignedToOrder: `発注${qrScanItem.orderId}` // 発注情報はメタデータに記録
          }
        }
      )

      // データ再読み込み
      await loadData()
      
      // ダイアログを閉じる
      setShowQRScanDialog(false)
      setQrScanItem(null)
      setQrCodeInput('')
      
      alert(`アイテム ${scannedItem.id} を発注に割り当てました`)

    } catch (error) {
      console.error('🔥 QR割り当てエラー:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setScanError(`割り当て処理中にエラーが発生しました: ${errorMessage}`)
      // カメラスキャンモードの場合は手動入力に切り替える
      setUseCameraScanner(false)
    }
  }

  const handleManualAssign = (item: any) => {
    setSelectedPreparationItem(item)
    setManualItemId('')
    setAssignError('')
    setShowManualAssignDialog(true)
  }
  
  const handleManualAssignSubmit = async () => {
    if (!selectedPreparationItem || !manualItemId.trim()) {
      setAssignError('管理番号を入力してください')
      return
    }
    
    // 管理番号でアイテムを検索
    const productItem = await supabaseDb.getProductItemById(manualItemId.trim())
    if (!productItem) {
      setAssignError('指定された管理番号のアイテムが見つかりません')
      return
    }
    
    // 商品タイプが一致するかチェック
    const order = await supabaseDb.getOrderById(selectedPreparationItem.orderId)
    if (!order) {
      setAssignError('発注が見つかりません')
      return
    }
    
    const orderItem = order.items.find(item => item.id === selectedPreparationItem.itemId)
    if (!orderItem) {
      setAssignError('発注アイテムが見つかりません')
      return
    }
    
    if (productItem.product_id !== orderItem.product_id) {
      setAssignError('商品タイプが一致しません')
      return
    }
    
    // アイテムが利用可能かチェック
    if (productItem.status !== 'available') {
      const statusText = {
        'rented': '貸与中',
        'returned': '返却済み',
        'cleaning': '清掃中',
        'maintenance': 'メンテナンス中',
        'demo_cancelled': 'デモキャンセル',
        'out_of_order': '故障中',
        'unknown': '状態不明'
      }[productItem.status] || productItem.status
      
      setAssignError(`このアイテムは現在利用できません\nステータス: ${statusText}\n\n利用可能な商品を選択してください。`)
      return
    }
    
    // 既に同じ管理番号が割り当てられていないかチェック
    const currentAssignedIds = orderItem.assigned_item_ids || []
    if (currentAssignedIds.includes(productItem.id)) {
      setAssignError('この管理番号は既に割り当てられています')
      return
    }
    
    // 共通の割り当て処理を実行
    await performAssignment(productItem.id, selectedPreparationItem, order, orderItem)
  }

  // 商品削除処理
  const handleDeleteItem = (item: any) => {
    setItemToDelete(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    try {
      const order = await supabaseDb.getOrderById(itemToDelete.orderId)
      if (!order) {
        alert('発注が見つかりません')
        return
      }

      const orderItem = order.items.find(item => item.id === itemToDelete.itemId)
      if (!orderItem) {
        alert('発注アイテムが見つかりません')
        return
      }

      // 既に管理番号が割り当てられている場合は、その商品を元のステータスに戻す
      const assignedItemIds = orderItem.assigned_item_ids || []
      const assignedItemId = assignedItemIds[itemToDelete.individualIndex]
      
      if (assignedItemId) {
        const productItem = await supabaseDb.getProductItemById(assignedItemId)
        if (productItem) {
          // 履歴から前のステータスを取得
          const histories = await supabaseDb.getItemHistoriesByItemId(assignedItemId)
          const assignmentHistory = histories.find(h => 
            h.action === '発注に割り当て' && 
            h.metadata?.orderId === itemToDelete.orderId
          )
          
          const previousStatus = assignmentHistory?.fromStatus || 'available'
          const previousLocation = assignmentHistory?.metadata?.previousLocation || '倉庫'
          
          // 楽観的更新でステータスを即座に反映
          await updateItemStatus(assignedItemId, previousStatus)
          
          // location も更新が必要な場合は追加で保存
          if (productItem.location !== previousLocation) {
            const updatedProductItem = {
              ...productItem,
              status: previousStatus,
              location: previousLocation
            }
            await supabaseDb.saveProductItem(updatedProductItem)
          }
          
          // 履歴を記録
          await supabaseDb.createItemHistory(
            assignedItemId,
            'キャンセル',
            productItem.status,
            previousStatus,
            currentUser,
            {
              location: previousLocation,
              notes: `発注削除により元のステータスに復元 - 発注番号: ${itemToDelete.orderId}`,
              metadata: {
                orderId: itemToDelete.orderId,
                orderItemId: itemToDelete.itemId,
                individualIndex: itemToDelete.individualIndex,
                restoredFromStatus: productItem.status,
                restoredToStatus: previousStatus
              }
            }
          )
        }
      }

      // 発注アイテムから該当する個別商品を削除
      const updatedItems = order.items.map(item => {
        if (item.id === orderItem.id) {
          // 数量を1減らし、assigned_item_idsからも該当するインデックスを削除
          const newQuantity = item.quantity - 1
          const newAssignedIds = [...(item.assigned_item_ids || [])]
          
          // 指定されたインデックスのアイテムを削除
          newAssignedIds.splice(itemToDelete.individualIndex, 1)
          
          // 数量が0になった場合は、アイテム全体を削除
          if (newQuantity <= 0) {
            return null // この場合はアイテム全体を削除
          }
          
          // 全ての割り当てが完了しているかチェック
          const allAssigned = newAssignedIds.filter(id => id !== null && id !== undefined).length === newQuantity
          
          return {
            ...item,
            quantity: newQuantity,
            assigned_item_ids: newAssignedIds,
            item_processing_status: allAssigned ? 'ready' as const : 'waiting' as const
          }
        }
        return item
      }).filter(item => item !== null) // null（削除対象）を除外

      // アイテムが全て削除された場合は発注全体を削除
      if (updatedItems.length === 0) {
        await supabaseDb.deleteOrder(order.id)
        alert(`発注 ${order.id} を削除しました`)
      } else {
        // すべてのアイテムが準備完了したかチェック
        const allReady = updatedItems.every(item => item.item_processing_status === 'ready')
        
        const updatedOrder = {
          ...order,
          items: updatedItems,
          status: allReady ? 'ready' as const : 'approved' as const
        }
        
        await supabaseDb.saveOrder(updatedOrder)
        alert(`商品を発注から削除しました`)
      }

      setShowDeleteDialog(false)
      setItemToDelete(null)
      await loadData() // データを再読み込み
    } catch (error) {
      console.error('Error in handleDeleteConfirm:', error)
      alert('削除処理中にエラーが発生しました。もう一度お試しください。')
    }
  }


  // 実際の割り当て処理（手動入力とQRスキャン共通）
  const performAssignment = async (itemId: string, preparationItem: any, order: any, orderItem: any) => {
    const productItem = await supabaseDb.getProductItemById(itemId)
    if (!productItem) {
      alert('商品が見つかりません')
      return
    }
    
    // 発注を更新 - 該当するインデックスの位置に管理番号を割り当て
    const currentAssignedIds = orderItem.assigned_item_ids || []
    const updatedItems = order.items.map(item => {
      if (item.id === orderItem.id) {
        const newAssignedIds = [...currentAssignedIds]
        newAssignedIds[preparationItem.individualIndex] = productItem.id
        
        // 全ての数量に管理番号が割り当てられたかチェック
        const allAssigned = newAssignedIds.filter(id => id !== null && id !== undefined).length === item.quantity
        
        return {
          ...item,
          assigned_item_ids: newAssignedIds,
          item_processing_status: allAssigned ? 'ready' as const : 'waiting' as const
        }
      }
      return item
    })
      
    // すべてのアイテムが準備完了したかチェック
    const allReady = updatedItems.every(item => item.item_processing_status === 'ready')
    
    const updatedOrder = {
      ...order,
      items: updatedItems,
      status: allReady ? 'ready' as const : 'approved' as const
    }
    
    await supabaseDb.saveOrder(updatedOrder)
    
    // 楽観的更新でステータスを即座に反映
    await updateItemStatus(productItem.id, 'ready_for_delivery')
    
    // その他の属性も更新が必要な場合は追加で保存
    // 発注時の備考があれば反映、なければ空文字
    const orderNotes = order.notes ? order.notes : ''
    const updatedProductItem = {
      ...productItem,
      id: productItem.id,
      status: 'ready_for_delivery' as const,
      customer_name: order.customer_name,
      notes: orderNotes, // 発注時の備考を反映
    }
    await supabaseDb.saveProductItem(updatedProductItem)
    
    // 履歴を記録
    await supabaseDb.createItemHistory(
      productItem.id,
      '準備完了',
      productItem.status,
      'ready_for_delivery' as const,
      currentUser,
      {
        location: productItem.location,
        customerName: order.customer_name,
        notes: `発注番号: ${order.id} (${preparationItem.individualIndex + 1}/${preparationItem.totalQuantity}個目)`,
        metadata: {
          orderId: order.id,
          orderItemId: orderItem.id,
          individualIndex: preparationItem.individualIndex,
          totalQuantity: preparationItem.totalQuantity,
          assignMethod: qrScanItem ? 'qr_scan' : 'manual',
          previousNotes: productItem.notes // 前の状態のメモを履歴に保存
        }
      }
    )
    
    // ダイアログを閉じてデータを再読み込み
    setShowQRScanDialog(false)
    setShowManualAssignDialog(false)
    setQrScanItem(null)
    setSelectedPreparationItem(null)
    setManualItemId('')
    setAssignError('')
    setScanError('')
    loadData()
    
    alert(`${productItem.id} を ${order.customer_name}様の発注に割り当てました`)
  }

  // 管理番号割り当て済み商品の準備完了処理
  const handleAssignedItemComplete = async (item: any) => {
    try {
      const order = await supabaseDb.getOrderById(item.orderId)
      if (!order) {
        alert('発注が見つかりません')
        return
      }

      const orderItem = order.items.find(oi => oi.id === item.itemId)
      if (!orderItem) {
        alert('発注アイテムが見つかりません')
        return
      }

      // アイテムのstatusを'ready'に更新
      const updatedItems = order.items.map(oi => {
        if (oi.id === orderItem.id) {
          // 全ての数量が準備完了したかチェック
          const allAssigned = (oi.assigned_item_ids || []).filter(id => id !== null && id !== undefined).length === oi.quantity
          
          return {
            ...oi,
            item_processing_status: allAssigned ? 'ready' as const : 'waiting' as const
          }
        }
        return oi
      })

      // すべてのアイテムが準備完了したかチェック
      const allReady = updatedItems.every(oi => oi.item_processing_status === 'ready')
      
      const updatedOrder = {
        ...order,
        items: updatedItems,
        status: allReady ? 'ready' as const : 'approved' as const
      }
      
      await supabaseDb.saveOrder(updatedOrder)

      // 商品ステータスを準備完了に変更
      const productItem = await supabaseDb.getProductItemById(item.assignedItemId)
      if (productItem) {
        // 楽観的更新でステータスを即座に反映
        await updateItemStatus(productItem.id, 'ready_for_delivery')
        
        // customer_name も更新が必要な場合は追加で保存
        if (productItem.customer_name !== order.customer_name) {
          const updatedProductItem = {
            ...productItem,
            status: 'ready_for_delivery' as const,
            customer_name: order.customer_name
          }
          await supabaseDb.saveProductItem(updatedProductItem)
        }
      }

      // 履歴を記録
      await supabaseDb.createItemHistory(
        item.assignedItemId,
        '準備完了',
        productItem?.status || 'reserved',
        'ready_for_delivery',
        currentUser,
        {
          location: productItem?.location || '',
          condition: productItem?.condition || 'good',
          customerName: order.customer_name,
          notes: `管理番号指定発注の準備完了`,
          metadata: {
            orderId: order.id,
            orderItemId: orderItem.id,
            preparationType: 'assigned_item_completion'
          }
        }
      )

      alert(`管理番号 ${item.assignedItemId} の準備が完了しました`)
      await loadData()
      
    } catch (error) {
      console.error('Assigned item completion error:', error)
      alert(`準備完了処理中にエラーが発生しました: ${error.message}`)
    }
  }
  
  // 準備中のアイテムを取得（発注ステータスとアイテムステータスを組み合わせて判定）
  // 数量が2以上の場合は個別に展開
  
  // Orders data loaded successfully
  
  // デバッグ: データ状態を確認
  console.log('🔍 Preparation page debug:', {
    ordersCount: orders.length,
    productsCount: products.length,
    sampleOrder: orders[0],
    hasOrderItems: orders.some(o => o.items && o.items.length > 0)
  })

  const preparationItems = orders.flatMap(order => {
    if (!order.items || order.items.length === 0) {
      return []
    }
    
    return order.items
      .filter(item => {
        // 以下の条件で準備待ちと判定
        // 1. 承認済みの発注
        // 2. まだ準備中の商品（waitingからreadyまでのステータス）
        const isApproved = order.status === 'approved' || item.approval_status === 'not_required'
        const isInPreparation = ['waiting', 'preparing', 'assigned'].includes(item.item_processing_status)
        
        console.log('⚙️ Order item filter:', {
          orderId: order.id,
          itemId: item.id,
          orderStatus: order.status,
          approvalStatus: item.approval_status,
          processingStatus: item.item_processing_status,
          isApproved,
          isInPreparation,
          willInclude: isApproved && isInPreparation
        })
        
        return isApproved && isInPreparation
      })
      .flatMap(item => {
        const product = products.find(p => p.id === item.product_id)
        const isUrgent = new Date(order.required_date) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2日以内
        
        // 数量分だけ個別アイテムを生成（準備完了したものは除外）
        const individualItems = []
        for (let i = 0; i < item.quantity; i++) {
          const assignedItemId = item.assigned_item_ids ? item.assigned_item_ids[i] : null
          const isAssigned = assignedItemId !== null && assignedItemId !== undefined
          
          // 管理番号未割り当てのアイテムのみ表示（準備待ちタブ用）
          if (isAssigned) {
            continue
          }
          
          individualItems.push({
            id: `${order.id}-${item.id}-${i}`,
            orderId: order.id,
            itemId: item.id,
            product_id: item.product_id, // 追加: 商品IDを設定
            individualIndex: i,
            name: product?.name || 'Unknown Product',
            customer: order.customer_name,
            assignedTo: order.assigned_to,
            carriedBy: order.carried_by,
            status: 'waiting', // 準備待ちステータス
            priority: isUrgent ? 'high' : 'medium',
            dueDate: order.required_date,
            lastUpdated: order.order_date,
            notes: order.notes || '',
            quantity: 1, // 個別アイテムなので常に1
            totalQuantity: item.quantity,
            approvalStatus: item.approval_status,
            assignedItemId: null, // 準備中なので管理番号はまだ割り当てられていない
            isAssigned: false
          })
        }
        
        return individualItems
      })
  })
  
  // デバッグ: 準備アイテム数をログ出力
  console.log('⚙️ preparationItems count:', preparationItems.length)
  if (preparationItems.length > 0) {
    console.log('⚙️ First preparationItem:', preparationItems[0])
  }

  // 管理番号割り当て済みのアイテムを取得
  const assignedItems = orders.flatMap(order => {
    if (!order.items || order.items.length === 0) {
      return []
    }
    
    return order.items
      .filter(item => {
        // 承認済みで準備中のアイテムのみ
        const isApproved = order.status === 'approved' || item.approval_status === 'not_required'
        const isInPreparation = ['waiting', 'preparing', 'assigned'].includes(item.item_processing_status)
        
        return isApproved && isInPreparation
      })
      .flatMap(item => {
        const product = products.find(p => p.id === item.product_id)
        const isUrgent = new Date(order.required_date) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2日以内
        
        // 管理番号が割り当て済みのアイテムのみを取得
        const assignedIndividualItems = []
        for (let i = 0; i < item.quantity; i++) {
          const assignedItemId = item.assigned_item_ids ? item.assigned_item_ids[i] : null
          const isAssigned = assignedItemId !== null && assignedItemId !== undefined
          
          // 管理番号割り当て済みだが準備未完了のアイテムのみ表示
          if (!isAssigned) {
            continue
          }
          
          assignedIndividualItems.push({
            id: `${order.id}-${item.id}-${i}`,
            orderId: order.id,
            itemId: item.id,
            product_id: item.product_id,
            individualIndex: i,
            name: product?.name || 'Unknown Product',
            customer: order.customer_name,
            assignedTo: order.assigned_to,
            carriedBy: order.carried_by,
            status: 'assigned', // 割り当て済みステータス
            priority: isUrgent ? 'high' : 'medium',
            dueDate: order.required_date,
            lastUpdated: order.order_date,
            notes: order.notes || '準備完了待ち',
            quantity: 1,
            totalQuantity: item.quantity,
            approvalStatus: item.approval_status,
            assignedItemId: assignedItemId, // 割り当てられた管理番号
            isAssigned: true
          })
        }
        
        return assignedIndividualItems
      })
  })
  
  // デバッグ: 割り当て済みアイテム数をログ出力
  console.log('⚙️ assignedItems count:', assignedItems.length)
  if (assignedItems.length > 0) {
    console.log('⚙️ First assignedItem:', assignedItems[0])
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-warning text-warning-foreground'
      case 'ready': return 'bg-success text-success-foreground'
      case 'cleaning': return 'bg-info text-info-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'inspection': return 'bg-secondary text-secondary-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return '準備待ち'
      case 'ready': return '準備完了'
      case 'cleaning': return '消毒中'
      case 'maintenance': return 'メンテナンス中'
      case 'inspection': return '点検中'
      default: return status
    }
  }
  
  const getApprovalStatusText = (approvalStatus: string) => {
    switch (approvalStatus) {
      case 'not_required': return '承認不要'
      case 'approved': return '承認済み'
      case 'pending': return '承認待ち'
      case 'rejected': return '拒否済み'
      default: return approvalStatus
    }
  }
  
  const getApprovalStatusColor = (approvalStatus: string) => {
    switch (approvalStatus) {
      case 'not_required': return 'bg-secondary text-secondary-foreground'
      case 'approved': return 'bg-success text-success-foreground'
      case 'pending': return 'bg-warning text-warning-foreground'
      case 'rejected': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground'
      case 'medium': return 'bg-warning text-warning-foreground'
      case 'low': return 'bg-success text-success-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  // グループ化とアコーディオン機能
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  // 準備商品をグループ化
  const groupedItems = preparationItems.reduce((groups, item) => {
    // 優先度と顧客でグループ化
    const groupKey = `${item.priority}-${item.customer}`
    const groupLabel = `${item.customer}様 (${item.priority === 'high' ? '🚨 緊急' : item.priority === 'medium' ? '⚡ 通常' : '📝 低優先'})`
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        label: groupLabel,
        priority: item.priority,
        customer: item.customer,
        items: []
      }
    }
    groups[groupKey].items.push(item)
    return groups
  }, {} as {[key: string]: {label: string, priority: string, customer: string, items: any[]}})

  // 優先度順でソート（高→中→低）
  const sortedGroups = Object.entries(groupedItems).sort(([, a], [, b]) => {
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  // モバイル版準備リスト（グループ化＋アコーディオン表示）
  const MobilePreparationList = () => (
    <div className="space-y-3">
      {preparationItems.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="p-6 text-center">
            <p className="text-muted-foreground">準備中の商品はありません</p>
          </div>
        </div>
      ) : (
        sortedGroups.map(([groupKey, group]) => {
          const isExpanded = expandedGroups[groupKey] !== false // デフォルトで展開
          const groupPriorityColor = group.priority === 'high' ? 'border-l-red-500 bg-white' :
                                   group.priority === 'medium' ? 'border-l-yellow-500 bg-white' :
                                   'border-l-blue-500 bg-white'
          
          return (
            <div key={groupKey} className={`bg-card rounded-xl border border-border shadow-sm border-l-4 ${groupPriorityColor}`}>
              {/* グループヘッダー */}
              <div 
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-accent/30 transition-colors"
                onClick={() => toggleGroup(groupKey)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{group.customer}様</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(group.priority)}`}>
                        {group.priority === 'high' ? '🚨 緊急' :
                         group.priority === 'medium' ? '⚡ 通常' :
                         '📝 低優先'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {group.items.length}件の商品
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>

              {/* グループ内容（アコーディオン） */}
              {isExpanded && (
                <div className="border-t border-border">
                  {group.items.map((item) => {
                    const itemExpanded = expandedItems[item.id]
                    
                    return (
                      <div key={item.id} className="border-b border-border/50 last:border-b-0">
                        {/* 商品基本情報 */}
                        <div 
                          className="p-3 cursor-pointer hover:bg-accent/20 transition-colors"
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm">{itemExpanded ? '📖' : '📄'}</span>
                                <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {item.totalQuantity > 1 ? `${item.individualIndex + 1}/${item.totalQuantity}個目` : '1個'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                  {getStatusText(item.status)}
                                </span>
                              </div>
                            </div>
                            <span className={`transform transition-transform text-sm ${itemExpanded ? 'rotate-180' : ''}`}>
                              ▼
                            </span>
                          </div>
                        </div>

                        {/* 商品詳細情報（アコーディオン） */}
                        {itemExpanded && (
                          <div className="px-3 pb-3 bg-accent/10">
                            <div className="space-y-3">
                              {/* 詳細情報 */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">担当者:</p>
                                  <p className="text-foreground font-medium">{item.assignedTo}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">持出者:</p>
                                  <p className="text-foreground font-medium">{item.carriedBy}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">希望日:</p>
                                  <p className="text-foreground font-medium">{item.dueDate}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">発注日:</p>
                                  <p className="text-foreground font-medium">{item.lastUpdated}</p>
                                </div>
                              </div>

                              {/* メモ */}
                              {item.notes && (
                                <div className="p-2 bg-accent/20 rounded-lg">
                                  <p className="text-xs">
                                    <span className="font-medium text-muted-foreground">メモ:</span>
                                    <span className="text-foreground ml-1">{item.notes}</span>
                                  </p>
                                </div>
                              )}

                              {/* アクションボタン */}
                              <div className="flex gap-2 pt-2">
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="flex-1 bg-primary hover:bg-primary/90 text-xs"
                                  onClick={() => handleQRScan(item)}
                                >
                                  📱 QRスキャン
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground text-xs"
                                  onClick={() => handleManualAssign(item)}
                                >
                                  手動入力
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3"
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  削除
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )

  // デスクトップ版準備リスト（カード表示）
  const DesktopPreparationCards = () => (
    <div className="space-y-4">
      {preparationItems.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-lg">準備中の商品はありません</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {preparationItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg mb-2">{item.name}</h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-muted-foreground">
                        {item.totalQuantity > 1 ? `${item.individualIndex + 1}/${item.totalQuantity}個目` : '数量: 1'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                        {item.priority === 'high' ? '🚨 緊急' :
                         item.priority === 'medium' ? '⚡ 通常' :
                         '📝 低優先'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Status Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getApprovalStatusColor(item.approvalStatus)}`}>
                    {getApprovalStatusText(item.approvalStatus)}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex justify-between">
                    <span>顧客:</span>
                    <span className="font-medium text-foreground">{item.customer}様</span>
                  </div>
                  <div className="flex justify-between">
                    <span>希望日:</span>
                    <span className="font-medium text-foreground">
                      {new Date(item.dueDate).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>担当者:</span>
                    <span className="font-medium text-foreground">{item.assignedTo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>持出者:</span>
                    <span className="font-medium text-foreground">{item.carriedBy}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={() => handleQRScan(item)}
                  >
                    📱 QR
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleManualAssign(item)}
                  >
                    手動
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDeleteItem(item)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // 「番号あり」タブ用のモバイル版コンポーネント
  const MobileAssignedList = () => {
    // 管理番号割り当て済みアイテムをグループ化
    const groupedAssignedItems = assignedItems.reduce((groups, item) => {
      const groupKey = `${item.priority}-${item.customer}`
      const groupLabel = `${item.customer}様 (${item.priority === 'high' ? '🚨 緊急' : item.priority === 'medium' ? '⚡ 通常' : '📝 低優先'})`
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          label: groupLabel,
          priority: item.priority,
          customer: item.customer,
          items: []
        }
      }
      groups[groupKey].items.push(item)
      return groups
    }, {} as {[key: string]: {label: string, priority: string, customer: string, items: any[]}})

    const sortedAssignedGroups = Object.entries(groupedAssignedItems).sort(([, a], [, b]) => {
      const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    return (
      <div className="space-y-3">
        {assignedItems.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="p-6 text-center">
              <p className="text-muted-foreground">管理番号割り当て済みの商品はありません</p>
            </div>
          </div>
        ) : (
          sortedAssignedGroups.map(([groupKey, group]) => {
            const isExpanded = expandedGroups[groupKey] !== false
            const groupPriorityColor = group.priority === 'high' ? 'border-l-red-500 bg-white' :
                                     group.priority === 'medium' ? 'border-l-yellow-500 bg-white' :
                                     'border-l-blue-500 bg-white'
            
            return (
              <div key={groupKey} className={`bg-card rounded-xl border border-border shadow-sm border-l-4 ${groupPriorityColor}`}>
                {/* グループヘッダー */}
                <div 
                  className="p-4 cursor-pointer flex items-center justify-between hover:bg-accent/30 transition-colors"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{group.customer}様</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(group.priority)}`}>
                          {group.priority === 'high' ? '🚨 緊急' :
                           group.priority === 'medium' ? '⚡ 通常' :
                           '📝 低優先'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.items.length}件の商品
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* アイテムリスト */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {group.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-4 border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium text-foreground">{item.name}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800`}>
                                {item.assignedItemId}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>希望日: {new Date(item.dueDate).toLocaleDateString('ja-JP')}</p>
                              <p>担当者: {item.assignedTo}</p>
                              <p>持出し者: {item.carriedBy}</p>
                            </div>
                          </div>
                          <div className="flex flex-col space-y-2 ml-4">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAssignedItemComplete(item)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              準備完了
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              削除
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    )
  }

  // 「番号あり」タブ用のデスクトップ版コンポーネント
  const DesktopAssignedCards = () => (
    <div className="space-y-4">
      {assignedItems.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-lg">管理番号割り当て済みの商品はありません</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg mb-2">{item.name}</h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        {item.assignedItemId}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                        {item.priority === 'high' ? '🚨 緊急' :
                         item.priority === 'medium' ? '⚡ 通常' :
                         '📝 低優先'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex justify-between">
                    <span>顧客:</span>
                    <span className="font-medium text-foreground">{item.customer}様</span>
                  </div>
                  <div className="flex justify-between">
                    <span>希望日:</span>
                    <span className="font-medium text-foreground">
                      {new Date(item.dueDate).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>担当者:</span>
                    <span className="font-medium text-foreground">{item.assignedTo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>持出し者:</span>
                    <span className="font-medium text-foreground">{item.carriedBy}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteItem(item)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    削除
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAssignedItemComplete(item)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    準備完了
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">準備商品</h1>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card rounded-lg border border-border p-1">
        <div className="flex space-x-1">
          <Button
            variant={activeTab === 'unassigned' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('unassigned')}
            className="flex-1"
          >
            番号なし ({preparationItems.length})
          </Button>
          <Button
            variant={activeTab === 'assigned' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('assigned')}
            className="flex-1"
          >
            番号あり ({assignedItems.length})
          </Button>
        </div>
      </div>

      {/* Stats Cards - タブに応じて表示内容を切り替え */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {activeTab === 'unassigned' ? '番号なし' : '番号あり'}
              </p>
              <p className="text-lg font-bold text-foreground">
                {activeTab === 'unassigned' ? preparationItems.length : assignedItems.length}
              </p>
            </div>
            <div className="h-6 w-6 rounded-full bg-info/20 flex items-center justify-center">
              <span className="text-info text-xs">
                {activeTab === 'unassigned' ? '🔄' : '📦'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">緊急度高</p>
              <p className="text-lg font-bold text-foreground">
                {activeTab === 'unassigned' 
                  ? preparationItems.filter(item => item.priority === 'high').length
                  : assignedItems.filter(item => item.priority === 'high').length
                }
              </p>
            </div>
            <div className="h-6 w-6 rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-destructive text-xs">🚨</span>
            </div>
          </div>
        </div>
      </div>

      {/* UI分岐：タブとデバイスに応じて表示を切り替え */}
      {activeTab === 'unassigned' ? (
        isMobile ? <MobilePreparationList /> : <DesktopPreparationCards />
      ) : (
        isMobile ? <MobileAssignedList /> : <DesktopAssignedCards />
      )}

      {/* Manual Assignment Dialog */}
      <Dialog open={showManualAssignDialog} onOpenChange={setShowManualAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>管理番号を入力</DialogTitle>
            <DialogDescription>
              {selectedPreparationItem && (
                <>
                  <strong>{selectedPreparationItem.name}</strong> の準備を完了します。<br />
                  {selectedPreparationItem.totalQuantity > 1 && (
                    <span className="text-blue-600">
                      ({selectedPreparationItem.individualIndex + 1}/{selectedPreparationItem.totalQuantity}個目)
                    </span>
                  )}
                  <br />
                  割り当てる商品の管理番号を入力してください。
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="itemId">管理番号</Label>
              <Input
                id="itemId"
                value={manualItemId}
                onChange={(e) => setManualItemId(e.target.value)}
                placeholder="例: WC-001"
                className="mt-1"
              />
              {assignError && (
                <p className="text-sm text-destructive mt-1">{assignError}</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowManualAssignDialog(false)}>
                キャンセル
              </Button>
              <Button onClick={handleManualAssignSubmit}>
                割り当て実行
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>商品削除の確認</DialogTitle>
            <DialogDescription>
              {itemToDelete && (
                <>
                  <strong>{itemToDelete.name}</strong> を発注から削除しますか？<br />
                  {itemToDelete.totalQuantity > 1 && (
                    <span className="text-blue-600">
                      ({itemToDelete.individualIndex + 1}/{itemToDelete.totalQuantity}個目)
                    </span>
                  )}
                  <br />
                  <br />
                  <span className="text-destructive font-medium">
                    ⚠️ この操作により：
                  </span>
                  <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>商品が発注から削除されます</li>
                    <li>既に割り当てられた管理番号の商品は元のステータスに戻ります</li>
                    <li>この操作は取り消せません</li>
                  </ul>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              削除実行
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Scan Dialog */}
      <Dialog open={showQRScanDialog} onOpenChange={setShowQRScanDialog}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>QRコードスキャン</DialogTitle>
            <DialogDescription>
              {qrScanItem && (
                <>
                  <strong>{qrScanItem.name}</strong> の準備完了<br />
                  {qrScanItem.totalQuantity > 1 && (
                    <span className="text-blue-600">
                      ({qrScanItem.individualIndex + 1}/{qrScanItem.totalQuantity}個目)
                    </span>
                  )}
                  <br />
                  商品のQRコードをスキャンしてください
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* カメラスキャナーまたは手動入力選択 */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={useCameraScanner ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setUseCameraScanner(true)
                  setCameraError(null)
                  setScanError('')
                }}
                className="flex-1"
              >
                📷 カメラスキャン
              </Button>
              <Button
                variant={!useCameraScanner ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setUseCameraScanner(false)
                  setCameraError(null)
                  setScanError('')
                }}
                className="flex-1"
              >
                ⌨️ 手動入力
              </Button>
            </div>

            {useCameraScanner ? (
              /* カメラスキャナー */
              <div className="space-y-4">
                <div className="aspect-square bg-black rounded-lg overflow-hidden relative">
                  <QRCameraScanner
                    onScanResult={handleCameraScanResult}
                    onError={handleCameraError}
                    isActive={useCameraScanner && showQRScanDialog}
                    className="w-full h-full"
                    continuousMode={true}
                  />
                  {cameraError && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                      <div className="text-center text-white p-4">
                        <div className="text-2xl mb-2">⚠️</div>
                        <p className="text-sm mb-2">カメラエラー</p>
                        <p className="text-xs mb-4">{cameraError}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCameraError(null)
                            setUseCameraScanner(false)
                          }}
                          className="text-white border-white"
                        >
                          手動入力に切替
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    QRコードをカメラに向けてスキャンしてください
                  </p>
                </div>
              </div>
            ) : (
              /* 手動入力 */
              <div className="h-32 bg-secondary/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center">
                  <div className="text-4xl mb-2">📱</div>
                  <p className="text-sm text-muted-foreground mb-2">QRコードを入力</p>
                  <p className="text-xs text-muted-foreground">
                    手動入力モード
                  </p>
                </div>
              </div>
            )}
            
            {/* 手動入力フォーム（手動入力モード時のみ表示） */}
            {!useCameraScanner && (
              <div className="space-y-3">
                <Label htmlFor="qrInput">QRコード（管理番号）</Label>
                <Input
                  id="qrInput"
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  placeholder="例: WC-001, BED-001, WK-001"
                  className="text-center"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleQRAssign()
                    }
                  }}
                />
              
              {/* テスト用サンプルボタン - 実際に存在するQRコードを表示 */}
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const items = await supabaseDb.getProductItems()
                    const availableItems = items.filter(item => item.status === 'available' && item.qr_code)
                    if (availableItems.length > 0) {
                      setQrCodeInput(availableItems[0].qr_code)
                    } else {
                      setScanError('利用可能な商品が見つかりません')
                    }
                  }}
                  className="text-xs h-8"
                >
                  利用可能QR
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const items = await supabaseDb.getProductItems()
                    const availableItems = items.filter(item => item.status === 'available' && item.qr_code)
                    if (availableItems.length > 1) {
                      setQrCodeInput(availableItems[1].qr_code)
                    } else if (availableItems.length > 0) {
                      setQrCodeInput(availableItems[0].qr_code)
                    } else {
                      setScanError('利用可能な商品が見つかりません')
                    }
                  }}
                  className="text-xs h-8"
                >
                  利用可能QR2
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQrCodeInput('WC-001')
                  }}
                  className="text-xs h-8"
                >
                  WC-001
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQrCodeInput('BED-001')
                  }}
                  className="text-xs h-8"
                >
                  BED-001
                </Button>
              </div>
              
                <Button 
                  onClick={handleQRAssign}
                  className="w-full"
                  disabled={!qrCodeInput.trim()}
                >
                  QRコードを処理
                </Button>
              
                {scanError && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-xs text-destructive font-medium">エラー</p>
                    <p className="text-xs text-destructive">{scanError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-1 h-8 text-xs"
                      onClick={() => {
                        setScanError('')
                        setQrCodeInput('')
                      }}
                    >
                      再スキャン
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowQRScanDialog(false)}>
                キャンセル
              </Button>
              {!useCameraScanner && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowQRScanDialog(false)
                    if (qrScanItem) {
                      handleManualAssign(qrScanItem)
                    }
                  }}
                >
                  手動割り当て
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}