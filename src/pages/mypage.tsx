import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { QRCameraScanner } from '../components/qr-camera-scanner'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useAuth } from '../hooks/useAuth'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseDb } from '../lib/supabase-database'
import { useProtectedAction, ProcessType } from '../hooks/useProtectedAction'
import {
  selectableDeliveryIds,
  isAllDeliverySelected,
  pruneSelection,
  resolveBatchDeliveryTargets,
  summarizeBatchDelivery,
} from '../lib/batch-delivery'

export function MyPage() {
  const { orders, products, items, loadData, users, isDataInitialized, updateItemStatus } = useInventoryStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(false)

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
  const [selectedUser, setSelectedUser] = useState(currentUser)
  const [displayedItems, setDisplayedItems] = useState<any[]>([]) // 表示される商品
  const [availableUsers, setAvailableUsers] = useState<string[]>([]) // 利用可能な営業マンリスト
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()) // 選択された個別order_item

  // 保護されたアクション用のフック
  const deliveryProtection = useProtectedAction(
    async (callback: () => Promise<void>) => {
      await callback()
    },
    {
      processType: ProcessType.ORDER_PROCESS,
      debounceMs: 1000,
      preventConcurrent: true
    }
  )

  const qrScanProtection = useProtectedAction(
    async (callback: () => Promise<void>) => {
      await callback()
    },
    {
      processType: ProcessType.QR_SCAN,
      debounceMs: 1500,
      preventConcurrent: true
    }
  )

  const deleteProtection = useProtectedAction(
    async (callback: () => Promise<void>) => {
      await callback()
    },
    {
      processType: ProcessType.DELETE_OPERATION,
      debounceMs: 800,
      preventConcurrent: true
    }
  )

  const batchDeliveryProtection = useProtectedAction(
    async (callback: () => Promise<void>) => {
      await callback()
    },
    {
      processType: ProcessType.ORDER_PROCESS,
      debounceMs: 1200,
      preventConcurrent: true
    }
  )
  
  // サポートダイアログ用の状態
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [selectedSupportItem, setSelectedSupportItem] = useState<any>(null)
  const [supportDetails, setSupportDetails] = useState('')
  const [supportError, setSupportError] = useState('')
  
  // 削除ダイアログ用の状態
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  
  // QRスキャン用の状態
  const [showQRScanDialog, setShowQRScanDialog] = useState(false)
  const [qrScanItem, setQrScanItem] = useState<any>(null)
  const [scanError, setScanError] = useState('')
  const [manualItemId, setManualItemId] = useState('')
  const [useCameraScanner, setUseCameraScanner] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  
  // 営業マン選択モーダル用の状態（モバイル版）
  const [showUserSelectModal, setShowUserSelectModal] = useState(false)
  
  // 音声認識用の状態
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  
  // アコーディオン用の状態（モバイル版）
  const [expandedDeliveryGroups, setExpandedDeliveryGroups] = useState<{[key: string]: boolean}>({})
  const [expandedDeliveryItems, setExpandedDeliveryItems] = useState<{[key: string]: boolean}>({})
  
  // 天気予報用の状態
  const [weatherData, setWeatherData] = useState<{today: any, tomorrow: any} | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // ダイレクト貸与用の状態
  const [showDirectRentalScan, setShowDirectRentalScan] = useState(false)
  const [showDirectRentalDialog, setShowDirectRentalDialog] = useState(false)
  const [directRentalItem, setDirectRentalItem] = useState<any>(null)
  const [directRentalForm, setDirectRentalForm] = useState({
    customerName: '',
    assignedTo: '',
    carriedBy: '',
    requestedSetting: ''
  })
  const [directRentalError, setDirectRentalError] = useState('')
  const [directRentalManualId, setDirectRentalManualId] = useState('')
  const [useDirectRentalCamera, setUseDirectRentalCamera] = useState(false)

  // selectedUserを現在のユーザーで初期化（usersデータが読み込まれた後）
  useEffect(() => {
    if (users.length > 0 && user) {
      const newCurrentUser = getCurrentUserName()
      setSelectedUser(newCurrentUser)
    }
  }, [users, user])

  useEffect(() => {
    // データが初期化されていない場合、または基本データが空の場合のみ再読み込み
    if (!isDataInitialized && (orders.length === 0 || products.length === 0)) {
      loadData()
    }
  }, [orders.length, products.length, isDataInitialized, loadData])
  
  // 天気予報データの取得（モバイル版のみ）
  useEffect(() => {
    if (isMobile) {
      fetchWeatherData()
    }
  }, [isMobile])
  
  // 天気予報データを取得する関数
  const fetchWeatherData = async () => {
    setWeatherLoading(true)
    try {
      // 実際の天気APIを使用
      const apiKey = import.meta.env.VITE_WEATHER_API_KEY
      const location = import.meta.env.VITE_WEATHER_LOCATION || 'Tokyo'
      
      if (!apiKey) {
        console.warn('VITE_WEATHER_API_KEY が設定されていません。モックデータを使用します。')
        throw new Error('Weather API key not configured')
      }
      
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=2&lang=ja`
      )
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      // 天気アイコンマッピング関数
      const getWeatherIcon = (conditionCode: number) => {
        if (conditionCode === 1000) return '☀️' // 晴れ
        if (conditionCode >= 1003 && conditionCode <= 1009) return '☁️' // 曇り
        if (conditionCode >= 1030 && conditionCode <= 1087) return '🌫️' // 霧・雷
        if (conditionCode >= 1114 && conditionCode <= 1117) return '❄️' // 雪
        if (conditionCode >= 1150 && conditionCode <= 1201) return '🌧️' // 雨
        if (conditionCode >= 1204 && conditionCode <= 1237) return '🌨️' // みぞれ
        if (conditionCode >= 1240 && conditionCode <= 1246) return '🌦️' // にわか雨
        return '🌤️' // その他
      }
      
      const weatherData = {
        today: {
          temperature: Math.round(data.forecast.forecastday[0].day.maxtemp_c),
          condition: getWeatherIcon(data.forecast.forecastday[0].day.condition.code),
          description: data.forecast.forecastday[0].day.condition.text
        },
        tomorrow: {
          temperature: Math.round(data.forecast.forecastday[1].day.maxtemp_c),
          condition: getWeatherIcon(data.forecast.forecastday[1].day.condition.code),
          description: data.forecast.forecastday[1].day.condition.text
        }
      }
      
      setWeatherData(weatherData)
    } catch (error) {
      console.error('天気予報の取得に失敗しました:', error)
      // エラーの場合はモックデータを設定
      const mockWeatherData = {
        today: {
          temperature: Math.floor(Math.random() * 15) + 15, // 15-30度
          condition: ['☀️', '☁️', '🌤️', '🌦️'][Math.floor(Math.random() * 4)],
          description: ['晴れ', '曇り', '晴れ時々曇り', '小雨'][Math.floor(Math.random() * 4)]
        },
        tomorrow: {
          temperature: Math.floor(Math.random() * 15) + 15, // 15-30度  
          condition: ['☀️', '☁️', '🌤️', '🌦️'][Math.floor(Math.random() * 4)],
          description: ['晴れ', '曇り', '晴れ時々曇り', '小雨'][Math.floor(Math.random() * 4)]
        }
      }
      setWeatherData(mockWeatherData)
    } finally {
      setWeatherLoading(false)
    }
  }
  
  useEffect(() => {

    // usersまたはordersデータがある場合にupdateAvailableUsersを実行
    if (users.length > 0 || orders.length > 0) {
      updateAvailableUsers()
    }

    // 商品データの更新は従来通り
    if (orders.length > 0 && products.length > 0) {
      updateDisplayedItems()
    }
  }, [orders, products, items, users, selectedUser, currentUser])

  // 一覧が入れ替わったら、もう画面に無い選択を捨てる（2026-09-08）
  //
  // 担当者プルダウンを切り替えても selectedItems が残っていたため、
  // 前の担当者のIDが混ざったまま「全選択」や「一括配送完了」を押すことになり、
  // 件数が合わない・押しても何も起きない、が起きていた。
  useEffect(() => {
    setSelectedItems(prev => {
      if (prev.size === 0) return prev
      const next = pruneSelection(prev, displayedItems)
      return next.size === prev.size ? prev : next
    })
  }, [displayedItems])
  
  // 利用可能な営業マンリストを更新
  const updateAvailableUsers = () => {
    
    const userSet = new Set<string>()
    
    // 現在のユーザーを必ず追加
    if (currentUser && currentUser !== 'ゲスト') {
      userSet.add(currentUser)
    }
    
    // usersテーブルから全ユーザーを取得
    users.forEach(dbUser => {
      if (dbUser.name) {
        userSet.add(dbUser.name)
      }
    })
    
    // 発注データからも担当者を取得（後方互換性のため）
    orders.forEach(order => {
      if (order.assigned_to) {
        userSet.add(order.assigned_to)
      }
      if (order.carried_by) {
        userSet.add(order.carried_by)
      }
    })
    
    // 現在のユーザーを最初に、それ以外をアルファベット順でソート
    const sortedUsers = Array.from(userSet).sort()
    const usersList = [currentUser, ...sortedUsers.filter(user => user !== currentUser && user)]
    const finalUsersList = [...new Set(usersList.filter(user => user))] // 重複除去とnull/undefined除去
    
    // もしリストが空の場合、最低限currentUserを追加
    if (finalUsersList.length === 0 && currentUser && currentUser !== 'ゲスト') {
      finalUsersList.push(currentUser)
    }
    
    setAvailableUsers(finalUsersList)
  }

  // 選択された営業マンの商品を更新
  const updateDisplayedItems = () => {

    const itemsList: any[] = []

    try {
      // Zustandの items を直接使用（非同期処理不要）
      const orderResults = orders.map((order) => {
        // 選択された営業マンが担当者または持出し者の発注のみ処理
        if (order.assigned_to === selectedUser || order.carried_by === selectedUser) {
          const itemResults = order.items.map((item) => {

            // 配送準備完了の商品のみ取得（item_processing_statusがreadyのもの）
            if (item.assigned_item_ids && item.assigned_item_ids.length > 0 &&
                item.item_processing_status === 'ready') {

              const product = products.find(p => p.id === item.product_id)

              // 数量分だけ個別アイテムを生成
              const assignedItems = item.assigned_item_ids.map((assignedItemId, index) => {
                if (assignedItemId) {
                  // Zustandの items から取得（楽観的更新を即座に反映）
                  const productItem = items.find(i => i.id === assignedItemId)
                  if (productItem) {
                    // 商品固有のメモを作成（発注のメモではなく商品の状態に応じたメモ）
                    const getItemNotes = () => {
                      if (productItem.status === 'ready_for_delivery') {
                        return `発注準備完了 - ${order.customer_name}様`
                      } else if (productItem.status === 'available') {
                        return '準備完了 - 配送待ち'
                      } else {
                        return productItem.condition_notes || '準備完了'
                      }
                    }


                    const itemData = {
                      id: `${order.id}-${item.id}-${index}`,
                      orderId: order.id,
                      itemId: item.id,
                      orderItemId: item.id, // データベースの実際のorder_item ID
                      individualIndex: index,
                      name: (() => {
                        if (!product) return 'Unknown Product'
                        const baseName = product.name
                        if (baseName?.includes('楽匠プラス') && item.requested_setting) {
                          return `${baseName}（${item.requested_setting}）`
                        }
                        return baseName
                      })(),
                      customer: order.customer_name,
                      assignedTo: order.assigned_to,
                      carriedBy: order.carried_by,
                      completedDate: order.order_date,
                      readyForDelivery: productItem.status === 'ready_for_delivery',
                      requiredDate: order.required_date,
                      quantity: 1, // 個別アイテムなので常に1
                      totalQuantity: item.quantity,
                      assignedItemId: assignedItemId,
                      productItem: {
                        ...productItem,
                        product: product
                      },
                      condition_notes: item.condition_notes, // 状態メモを表示
                      orderNotes: order.notes, // 発注のメモは別プロパティとして保持
                      orderStatus: order.status,
                      supportHistories: [] // サポート履歴は後で取得
                    }

                    return itemData
                  }
                }
                return null
              }).filter(item => item !== null)

              return assignedItems
            }
            return []
          })

          return itemResults.flat()
        }
        return []
      })

      const allItems = orderResults.flat()
      
      // サポート履歴を取得（専用のlocalStorageから）
      const allSupportHistories = JSON.parse(localStorage.getItem('wem_support_histories') || '[]')
      
      // 各アイテムにサポート履歴を追加
      allItems.forEach(item => {
        if (item && item.assignedItemId) {
          const supportHistories = allSupportHistories
            .filter(history => history.itemId === item.assignedItemId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          
          item.supportHistories = supportHistories
          itemsList.push(item)
        }
      })
      

      setDisplayedItems(itemsList)
    } catch (error) {
      console.error('Error in updateDisplayedItems:', error)
      setDisplayedItems([])
    }
  }


  // データを強制的にリセットして再読み込み
  const handleForceReload = () => {
    // TODO: Implement reset with Supabase
    loadData()
  }

  // QRスキャン開始
  const handleQRScan = (item: any) => {
    console.log('📱 Opening QR scan dialog with item:', item)
    setQrScanItem(item)
    setScanError('')
    setManualItemId('')
    setCameraError(null)
    setUseCameraScanner(true) // カメラモードを初期設定に変更
    setShowQRScanDialog(true)
    console.log('📱 QR scan dialog state updated, qrScanItem set to:', item)
  }

  // カメラスキャンの結果を処理
  const handleCameraScanResult = async (qrCode: string) => {
    try {
      console.log('📱 Camera scan result:', qrCode)
      console.log('📱 Current qrScanItem:', qrScanItem)
      
      setManualItemId(qrCode)
      setUseCameraScanner(false)
      setScanError('') // エラーをクリア
      
      // qrScanItemの存在確認
      if (!qrScanItem) {
        console.error('🔥 qrScanItem is null/undefined at scan result')
        setScanError('配送対象商品が選択されていません')
        return
      }
      
      // 状態更新のタイミング問題を回避するため、QRコードを直接渡す
      console.log('📱 Calling handleQRScanResultWithCode with:', { qrCode, qrScanItem })
      await handleQRScanResultWithCode(qrCode, qrScanItem)
      
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

  // QRコードと対象アイテムを直接受け取る配送処理（状態更新タイミング問題を回避）
  const handleQRScanResultWithCode = async (qrCode: string, targetItem: any) => {
    try {
      console.log('🔧 Starting QR delivery process with direct params:', {
        qrCode,
        targetItem
      })
      
      if (!qrCode.trim()) {
        setScanError('QRコードを入力してください')
        return
      }

      if (!targetItem) {
        setScanError('配送対象商品が選択されていません')
        return
      }

      setScanError('')
      
      // QRコードから商品アイテムを検索
      console.log('🔧 Fetching product items...')
      const items = await supabaseDb.getProductItems()
      console.log('🔧 Found', items.length, 'product items')
      
      const scannedItem = items.find(item => {
        const itemQR = item.qr_code?.trim()
        const inputQR = qrCode.trim()
        // 大文字小文字を無視して比較
        return itemQR && itemQR.toLowerCase() === inputQR.toLowerCase()
      })
      
      if (!scannedItem) {
        setScanError('QRコードに対応するアイテムが見つかりません')
        return
      }

      // 配送対象アイテムと一致するかチェック
      if (scannedItem.id !== targetItem.assignedItemId) {
        setScanError(`配送対象商品と異なります。期待: ${targetItem.assignedItemId}, 実際: ${scannedItem.id}`)
        return
      }

      // 配送準備完了状態かチェック
      if (scannedItem.status !== 'ready_for_delivery') {
        setScanError(`このアイテムは配送準備未完了です (状態: ${scannedItem.status})`)
        return
      }

      console.log('🔧 Scanned item validation passed, processing delivery...')

      // 配送完了処理を実行
      await supabaseDb.updateOrderItemStatus(targetItem.orderItemId, 'delivered', currentUser)

      // 商品ステータスと属性を1回で保存
      const updatedProductItem = {
        ...scannedItem,
        status: 'rented' as const,
        customer_name: targetItem.customer,
        loan_start_date: new Date().toISOString().split('T')[0]
      }
      await supabaseDb.saveProductItem(updatedProductItem)

      // 配送完了の履歴を記録
      await supabaseDb.createItemHistory(
        scannedItem.id,
        'QR配送完了（貸与開始）',
        'ready_for_delivery',
        'rented' as const,
        currentUser,
        {
          location: `${targetItem.customer}様宅`,
          customer_name: targetItem.customer,
          metadata: {
            orderId: targetItem.orderId,
            deliveryType: 'qr_scan',
            deliverer: currentUser,
            deliveryDate: new Date().toISOString()
          }
        }
      )

      // データ再読み込み
      await loadData()
      
      // ダイアログを閉じる
      setShowQRScanDialog(false)
      setQrScanItem(null)
      setManualItemId('')
      
      alert(`アイテム ${scannedItem.id} の配送が完了しました`)

    } catch (error) {
      console.error('🔥 QR配送処理エラー (direct params):', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setScanError(`配送処理中にエラーが発生しました: ${errorMessage}`)
      setUseCameraScanner(false)
    }
  }

  // QRスキャン結果の処理
  const handleQRScanResult = (qrCode: string) => {
    
    if (!qrScanItem) {
      setScanError('商品が選択されていません')
      return
    }
    
    // QRコードが商品の管理番号と一致するかチェック
    if (qrCode === qrScanItem.assignedItemId || qrCode === `QR-${qrScanItem.assignedItemId}`) {
      // スキャン成功 - 配送処理を実行
      setShowQRScanDialog(false)
      setQrScanItem(null)
      setScanError('')
      setManualItemId('')
      
      // 自分の商品か代理かによって処理を分ける
      if (selectedUser === currentUser) {
        handleOwnDelivery(qrScanItem)
      } else {
        handleProxyDelivery(qrScanItem)
      }
    } else {
      setScanError('QRコードが商品の管理番号と一致しません')
    }
  }

  // 商品の処理（自分の商品か他の営業マンの商品かで処理を分ける）
  const handleItemProcess = (item: any, action: 'deliver' | 'support' | 'schedule' | 'qr_scan') => {
    if (selectedUser === currentUser) {
      // 自分の商品の処理
      if (action === 'deliver') {
        handleOwnDelivery(item)
      } else if (action === 'schedule') {
        handleScheduleAdjustment(item)
      } else if (action === 'qr_scan') {
        handleQRScan(item)
      }
    } else {
      // 他の営業マンの商品の代理処理
      if (action === 'deliver') {
        handleProxyDelivery(item)
      } else if (action === 'support') {
        handleSupport(item)
      } else if (action === 'qr_scan') {
        handleQRScan(item)
      }
    }
  }

  // 個別order_itemの配送完了処理
  const handleOwnDelivery = async (item: any) => {
    
    try {
      console.log('🚚 Starting individual delivery for order_item:', {
        orderItemId: item.orderItemId,
        orderId: item.orderId,
        productName: item.name,
        customer: item.customer,
        assignedItemId: item.assignedItemId
      })
      
      if (!item.orderItemId) {
        throw new Error('有効なorder_item IDが見つかりません')
      }
      
      // order_itemのステータスを配送完了に更新
      await supabaseDb.updateOrderItemStatus(item.orderItemId, 'delivered', currentUser)
      
      // 商品アイテムのステータスを貸与中に更新
      const productItem = await supabaseDb.getProductItemById(item.assignedItemId)
      if (productItem) {
        // ステータスと属性を1回で保存
        const updatedProductItem = {
          ...productItem,
          status: 'rented' as const,
          customer_name: item.customer,
          loan_start_date: new Date().toISOString().split('T')[0]
        }
        await supabaseDb.saveProductItem(updatedProductItem)
        
        // 配送完了時にサポート履歴をクリア
        const allSupportHistories = JSON.parse(localStorage.getItem('wem_support_histories') || '[]')
        const filteredHistories = allSupportHistories.filter(history => history.itemId !== item.assignedItemId)
        localStorage.setItem('wem_support_histories', JSON.stringify(filteredHistories))
        
        // 配送完了の履歴を記録
        await supabaseDb.createItemHistory(
          productItem.id,
          '配送完了（貸与開始）',
          productItem.status,
          'rented' as const,
          currentUser,
          {
            location: `${item.customer}様宅`,
            customer_name: item.customer,
            metadata: {
              orderId: item.orderId,
              deliveryType: 'own',
              deliverer: currentUser,
              deliveryDate: new Date().toISOString()
            }
          }
        )
      }
      
      loadData() // データを再読み込み
      alert(`${item.customer}様への配送が完了し、貸与が開始されました`)
    } catch (error) {
      console.error('配送完了処理でエラーが発生しました:', error)
      alert('配送完了処理でエラーが発生しました')
    }
  }

  // 代理配送の処理
  const handleProxyDelivery = async (item: any) => {
    
    try {
      console.log('🚚 Starting proxy delivery for order_item:', {
        orderItemId: item.orderItemId,
        orderId: item.orderId,
        productName: item.name,
        customer: item.customer,
        assignedItemId: item.assignedItemId
      })
      
      if (!item.orderItemId) {
        throw new Error('有効なorder_item IDが見つかりません')
      }
      
      // order_itemのステータスを配送完了に更新
      await supabaseDb.updateOrderItemStatus(item.orderItemId, 'delivered', currentUser)
      
      // 商品アイテムのステータスを貸与中に更新
      const productItem = await supabaseDb.getProductItemById(item.assignedItemId)
      if (productItem) {
        // ステータスと属性を1回で保存
        const updatedProductItem = {
          ...productItem,
          status: 'rented' as const,
          customer_name: item.customer,
          loan_start_date: new Date().toISOString().split('T')[0]
        }
        await supabaseDb.saveProductItem(updatedProductItem)
        
        // 配送完了時にサポート履歴をクリア
        const allSupportHistories = JSON.parse(localStorage.getItem('wem_support_histories') || '[]')
        const filteredHistories = allSupportHistories.filter(history => history.itemId !== item.assignedItemId)
        localStorage.setItem('wem_support_histories', JSON.stringify(filteredHistories))
        
        // 代理配送の履歴を記録
        await supabaseDb.createItemHistory(
          productItem.id,
          '代理配送完了（貸与開始）',
          productItem.status,
          'rented' as const,
          currentUser,
          {
            location: `${item.customer}様宅`,
            customer_name: item.customer,
            metadata: {
              orderId: item.orderId,
              deliveryType: 'proxy',
              originalAssignee: selectedUser,
              proxyDeliverer: currentUser,
              deliveryDate: new Date().toISOString()
            }
          }
        )
      }
      
      loadData() // データを再読み込み
      alert(`${selectedUser}さんの代理で${item.customer}様への配送が完了し、貸与が開始されました`)
    } catch (error) {
      console.error('代理配送処理でエラーが発生しました:', error)
      alert('代理配送処理でエラーが発生しました')
    }
  }

  // チェックボックス選択関連の関数
  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    const selectedItem = displayedItems.find(item => item.id === itemId)
    
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    
    setSelectedItems(newSelected)
  }

  const handleSelectAllDeliveryItems = () => {
    const allDeliveryIds = selectableDeliveryIds(displayedItems)

    // 件数ではなく中身で見る。件数比較だけだと、古いIDが残っているときに
    // 偶然一致して「全選択」を押した瞬間に全解除になっていた
    if (isAllDeliverySelected(selectedItems, allDeliveryIds)) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(allDeliveryIds))
    }
  }

  // 選択されたアイテムの一括配送完了処理
  //
  // 2026-09-08 全面的に直した。以前は
  //   ・処理できない個体を黙って飛ばしたうえで「N件配送完了しました」と出す
  //   ・1件目で失敗すると残り全部が未処理のまま「エラーが発生しました」だけ
  //   ・単体の配送完了にはあるサポート履歴のクリアが一括には無い
  // という状態で、「一括ができる場合とできない場合がある」ように見えていた。
  const handleBatchDeliveryUnsafe = async () => {
    if (selectedItems.size === 0) {
      alert('配送完了する項目を選択してください')
      return
    }

    const isProxy = selectedUser !== currentUser
    const { targets, skipped } = resolveBatchDeliveryTargets(displayedItems, selectedItems)

    if (targets.length === 0) {
      setSelectedItems(new Set())
      await loadData()
      alert(summarizeBatchDelivery({ succeeded: 0, failed: [], skipped, isProxy, proxyFor: selectedUser }))
      return
    }

    const failed: { id: string; name: string; message: string }[] = []
    const processedOrderItemIds = new Set<string>()
    let succeeded = 0

    // 1件ずつ独立して処理する。途中で失敗しても残りは進める。
    for (const item of targets) {
      try {
        // 同じ order_item は一度だけ配送完了にする（個体は下で1件ずつ更新する）
        if (!processedOrderItemIds.has(item.orderItemId as string)) {
          await supabaseDb.updateOrderItemStatus(item.orderItemId as string, 'delivered', currentUser)
          processedOrderItemIds.add(item.orderItemId as string)
        }

        const productItem = await supabaseDb.getProductItemById(item.assignedItemId as string)
        if (!productItem) {
          throw new Error(`個体 ${item.assignedItemId} が見つかりません`)
        }

        await supabaseDb.saveProductItem({
          ...productItem,
          status: 'rented' as const,
          customer_name: item.customer,
          loan_start_date: new Date().toISOString().split('T')[0]
        })

        // 単体の配送完了と揃える: 配送が済んだらサポート履歴を消す
        try {
          const allSupportHistories = JSON.parse(localStorage.getItem('wem_support_histories') || '[]')
          const filteredHistories = allSupportHistories.filter(
            (history: { itemId?: string }) => history.itemId !== item.assignedItemId
          )
          localStorage.setItem('wem_support_histories', JSON.stringify(filteredHistories))
        } catch (e) {
          console.warn('サポート履歴のクリアに失敗しました（配送自体は完了）', e)
        }

        await supabaseDb.createItemHistory(
          productItem.id,
          isProxy ? '一括代理配送完了（貸与開始）' : '一括配送完了（貸与開始）',
          productItem.status,
          'rented' as const,
          currentUser,
          {
            location: `${item.customer}様宅`,
            customer_name: item.customer as string,
            metadata: {
              orderId: item.orderId,
              deliveryType: isProxy ? 'batch_proxy' : 'batch',
              deliverer: currentUser,
              originalAssignee: isProxy ? selectedUser : currentUser,
              proxyDeliverer: isProxy ? currentUser : undefined,
              deliveryDate: new Date().toISOString()
            }
          }
        )

        succeeded++
      } catch (error) {
        console.error('一括配送: 1件失敗しました', item.id, error)
        failed.push({
          id: item.id,
          name: (item.name as string) || '不明',
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    setSelectedItems(new Set())
    await loadData()
    alert(summarizeBatchDelivery({ succeeded, failed, skipped, isProxy, proxyFor: selectedUser }))
  }

  // ダイレクト貸与: スキャンダイアログを開く
  const handleOpenDirectRentalScan = () => {
    setShowDirectRentalScan(true)
    setDirectRentalManualId('')
    setDirectRentalError('')
    setUseDirectRentalCamera(false)
  }

  // ダイレクト貸与: QRスキャン結果の処理
  const handleDirectRentalScanResult = async (scannedCode: string) => {
    setDirectRentalError('')

    // QRコードから管理番号を抽出（QR-プレフィックスを除去）
    const itemId = scannedCode.replace(/^QR-/i, '')

    // 商品を検索
    const productItem = items.find(item => item.id === itemId)

    if (!productItem) {
      setDirectRentalError(`管理番号 ${itemId} が見つかりません`)
      return
    }

    // ステータスチェック（availableのみ許可）
    if (productItem.status !== 'available') {
      const statusText: { [key: string]: string } = {
        'rented': '貸与中',
        'reserved': '予約済み',
        'ready_for_delivery': '配送準備完了',
        'returned': '返却済み',
        'cleaning': '消毒中',
        'maintenance': 'メンテナンス中',
        'demo_cancelled': 'デモキャンセル',
        'out_of_order': '故障中',
      'disposed': '廃棄済み',
        'unknown': '状態不明'
      }
      setDirectRentalError(`この商品は現在利用できません\nステータス: ${statusText[productItem.status] || productItem.status}`)
      return
    }

    // 商品情報を取得
    const product = products.find(p => p.id === productItem.product_id)

    // スキャンダイアログを閉じて、貸与入力ダイアログを表示
    setShowDirectRentalScan(false)
    setDirectRentalItem({
      productItem,
      product
    })
    setDirectRentalForm({
      customerName: '',
      assignedTo: currentUser,
      carriedBy: currentUser,
      requestedSetting: productItem.current_setting || ''
    })
    setDirectRentalError('')
    setShowDirectRentalDialog(true)
  }

  // ダイレクト貸与: 貸与処理の実行
  const handleDirectRentalSubmit = async () => {
    if (!directRentalItem) return

    // バリデーション
    if (!directRentalForm.customerName.trim()) {
      setDirectRentalError('顧客名を入力してください')
      return
    }
    if (!directRentalForm.assignedTo) {
      setDirectRentalError('担当者を選択してください')
      return
    }
    if (!directRentalForm.carriedBy) {
      setDirectRentalError('持出者を選択してください')
      return
    }

    try {
      const { productItem, product } = directRentalItem
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      // 1. 発注データを作成（即完了状態）
      const orderId = `ORD-${Date.now()}`
      const orderItemId = `OI-${Date.now()}`

      const orderItem = {
        id: orderItemId,
        product_id: productItem.product_id,
        quantity: 1,
        assigned_item_ids: [productItem.id],
        notes: 'ダイレクト貸与',
        item_status: null,
        needs_approval: false,
        approval_status: 'not_required' as const,
        item_processing_status: 'delivered' as const,
        requested_setting: directRentalForm.requestedSetting || undefined
      }

      const newOrder = {
        id: orderId,
        customer_name: directRentalForm.customerName.trim(),
        assigned_to: directRentalForm.assignedTo,
        carried_by: directRentalForm.carriedBy,
        status: 'approved' as const,  // 承認済み（配送状態はOrderItem.item_processing_statusで管理）
        order_date: today,
        required_date: today,
        notes: 'ダイレクト貸与',
        created_by: currentUser,
        needs_approval: false,
        created_at: now,
        items: [orderItem]
      }

      await supabaseDb.saveOrder(newOrder)

      // 2. 商品アイテムを更新（貸与中に変更）
      const updatedProductItem = {
        ...productItem,
        status: 'rented' as const,
        customer_name: directRentalForm.customerName.trim(),
        loan_start_date: today,
        current_setting: directRentalForm.requestedSetting || productItem.current_setting
      }

      await supabaseDb.saveProductItem(updatedProductItem)

      // Zustandストアも更新
      const updatedItems = items.map(i => i.id === updatedProductItem.id ? updatedProductItem : i)
      useInventoryStore.setState({ items: updatedItems })

      // 3. 履歴を記録
      await supabaseDb.createItemHistory(
        productItem.id,
        'ダイレクト貸与',
        'available',
        'rented',
        currentUser,
        {
          location: `${directRentalForm.customerName.trim()}様宅`,
          customer_name: directRentalForm.customerName.trim(),
          metadata: {
            orderId: orderId,
            orderItemId: orderItemId,
            orderType: 'direct_rental',
            assignedTo: directRentalForm.assignedTo,
            carriedBy: directRentalForm.carriedBy,
            requestedSetting: directRentalForm.requestedSetting
          }
        }
      )

      // 成功
      setShowDirectRentalDialog(false)
      setDirectRentalItem(null)
      loadData()
      alert(`${directRentalForm.customerName.trim()}様への貸与が開始されました\n管理番号: ${productItem.id}`)

    } catch (error) {
      console.error('ダイレクト貸与処理でエラーが発生しました:', error)
      setDirectRentalError('ダイレクト貸与処理でエラーが発生しました')
    }
  }

  // サポート機能の処理（ダイアログを表示）
  const handleSupport = (item: any) => {
    setSelectedSupportItem(item)
    setSupportDetails('')
    setSupportError('')
    setShowSupportDialog(true)
  }

  // サポート詳細の送信処理
  const handleSupportSubmit = async () => {
    if (!supportDetails.trim()) {
      setSupportError('サポート内容を入力してください')
      return
    }
    
    try {
      // サポート履歴を記録（商品ステータスは変更しない）
      // ただし、履歴管理には残さず、商品固有の履歴としてのみ記録
      if (selectedSupportItem) {
        const productItem = await supabaseDb.getProductItemById(selectedSupportItem.assignedItemId)
        if (productItem) {
          // 商品固有のサポート履歴として記録（ItemHistoryテーブルには保存しない）
          const supportRecord = {
            id: `SUPPORT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            itemId: productItem.id,
            action: 'サポート実施',
            timestamp: new Date().toISOString(),
            performedBy: currentUser,
            customer_name: selectedSupportItem.customer,
            metadata: {
              orderId: selectedSupportItem.orderId,
              supportType: 'assistance',
              supportedPerson: selectedUser,
              supporter: currentUser,
              supportDetails: supportDetails
            }
          }
          
          // 商品固有のサポート履歴をlocalStorageに保存
          const supportHistories = JSON.parse(localStorage.getItem('wem_support_histories') || '[]')
          supportHistories.push(supportRecord)
          localStorage.setItem('wem_support_histories', JSON.stringify(supportHistories))
          
          setShowSupportDialog(false)
          setSelectedSupportItem(null)
          setSupportDetails('')
          setSupportError('')
          alert(`${selectedUser}さんのサポートを記録しました`)
        }
      }
    } catch (error) {
      console.error('サポート処理でエラーが発生しました:', error)
      alert('サポート処理でエラーが発生しました')
    }
  }

  // スケジュール調整
  const handleScheduleAdjustment = (item: any) => {
    // TODO: スケジュール調整ダイアログを表示
    alert('スケジュール調整機能は今後実装予定です')
  }

  // 商品削除処理
  const handleDeleteItem = (item: any) => {
    setItemToDelete(item)
    setShowDeleteDialog(true)
  }

  // 保護されたバージョンの関数
  const handleBatchDelivery = () => {
    batchDeliveryProtection.execute(async () => {
      await handleBatchDeliveryUnsafe()
    })
  }

  const handleDeleteConfirm = () => {
    deleteProtection.execute(async () => {
      await handleDeleteConfirmUnsafe()
    })
  }

  // 音声認識開始/停止
  const toggleVoiceRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      if (isListening) {
        // 停止
        setIsListening(false)
        setVoiceError('')
      } else {
        // 開始
        setIsListening(true)
        setVoiceError('')
        
        // デモ版のため、3秒後に自動停止してメッセージを表示
        setTimeout(() => {
          setIsListening(false)
          alert('音声認識デモ：「車椅子の在庫を確認」「配送完了」「QRスキャン開始」などの音声コマンドが利用可能になります（本格運用時）')
        }, 3000)
      }
    } else {
      setVoiceError('このブラウザは音声認識に対応していません')
      alert('このブラウザは音声認識に対応していません。Chrome、Edge、Safariをご利用ください。')
    }
  }

  const handleDeleteConfirmUnsafe = async () => {
    if (!itemToDelete) return

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
            metadata: {
              orderId: itemToDelete.orderId,
              orderItemId: itemToDelete.itemId,
              individualIndex: itemToDelete.individualIndex,
              restoredFromStatus: productItem.status,
              restoredToStatus: previousStatus,
              deletedBy: currentUser
            }
          }
        )
      }
    }

    // 発注アイテムをキャンセル状態に更新（削除ではなくキャンセル）
    const updatedItems = order.items.map(item => {
      if (item.id === orderItem.id) {
        const newAssignedIds = [...(item.assigned_item_ids || [])]

        // 指定されたインデックスのアイテムをnullに設定（キャンセル扱い）
        newAssignedIds[itemToDelete.individualIndex] = null

        return {
          ...item,
          assigned_item_ids: newAssignedIds,
          item_processing_status: 'cancelled' as const,
          cancelled_at: new Date().toISOString(),
          cancelled_by: currentUser,
          cancelled_reason: '個別商品キャンセル'
        }
      }
      return item
    })

    // 発注を更新（アイテムは削除せずキャンセル状態で保持）
    const updatedOrder = {
      ...order,
      items: updatedItems
    }

    await supabaseDb.saveOrder(updatedOrder)
    alert(`商品をキャンセルしました。発注一覧に残ります。`)

    setShowDeleteDialog(false)
    setItemToDelete(null)
    loadData() // データを再読み込み
  }

  // アコーディオン操作用の関数（配送可能商品用）
  const toggleDeliveryGroup = (groupKey: string) => {
    setExpandedDeliveryGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  const toggleDeliveryItem = (itemId: string) => {
    setExpandedDeliveryItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  const renderItemCard = (item: any) => {
    const isOwnItem = selectedUser === currentUser
    const cardBgClass = isOwnItem ? '' : 'bg-orange-50/30'
    
    return (
      <div key={item.id} className={`border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors ${cardBgClass}`}>
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground truncate text-sm">{item.name}</h4>
              <div className="flex items-center space-x-2 mt-1">
                {item.totalQuantity > 1 && (
                  <span className="text-xs text-blue-600">
                    ({item.individualIndex + 1}/{item.totalQuantity}個目)
                  </span>
                )}
              </div>
            </div>
            {item.readyForDelivery ? (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-success text-success-foreground">
                配送準備完了
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-info text-info-foreground">
                準備完了
              </span>
            )}
          </div>
          
          {/* Details */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">顧客: <span className="text-foreground">{item.customer}様</span></p>
            {!isOwnItem && (
              <>
                <p className="text-xs text-muted-foreground">担当者: <span className="text-foreground font-medium text-orange-600">{item.assignedTo}</span></p>
                <p className="text-xs text-muted-foreground">持出者: <span className="text-foreground font-medium text-orange-600">{item.carriedBy}</span></p>
              </>
            )}
            <p className="text-xs text-muted-foreground">希望日: <span className="text-foreground">{item.requiredDate}</span></p>
            <p className="text-xs text-muted-foreground">管理番号: <span className="text-foreground">{item.assignedItemId}</span></p>
          </div>
          
          {/* Condition Notes */}
          {item.condition_notes && (
            <div className="bg-accent/30 p-2 rounded text-xs">
              <p className="text-foreground">{item.condition_notes}</p>
            </div>
          )}

          {/* Order Notes */}
          {item.orderNotes && (
            <div className="bg-blue-50/80 border border-blue-200 p-2 rounded text-xs">
              <p className="font-medium text-blue-800 mb-1">📋 発注メモ</p>
              <p className="text-blue-800">{item.orderNotes}</p>
            </div>
          )}

          {/* Support History */}
          {item.supportHistories && item.supportHistories.length > 0 && (
            <div className="bg-blue-50/80 border border-blue-200 p-2 rounded text-xs">
              <p className="font-medium text-blue-800 mb-1">📋 サポート履歴</p>
              {item.supportHistories.slice(0, 2).map((support, index) => (
                <div key={index} className="mb-1 last:mb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{support.performedBy}</span>
                    <span className="text-blue-600 text-xs">
                      {new Date(support.timestamp).toLocaleDateString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-blue-800">{support.metadata?.supportDetails || 'サポート実施'}</p>
                </div>
              ))}
              {item.supportHistories.length > 2 && (
                <p className="text-blue-600 text-xs mt-1">他 {item.supportHistories.length - 2} 件のサポート履歴</p>
              )}
            </div>
          )}
          
          {/* Actions */}
          {isOwnItem ? (
            // 自分の商品の場合
            <div className="space-y-2">
              {item.readyForDelivery ? (
                <>
                  {/* チェックボックス */}
                  <div className="flex items-center justify-center mb-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="w-4 h-4 mr-2"
                      id={`checkbox-${item.id}`}
                    />
                    <label htmlFor={`checkbox-${item.id}`} className="text-xs text-gray-600">
                      一括処理用
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      size="sm" 
                      className="bg-primary hover:bg-primary/90 text-xs w-full"
                      onClick={() => handleItemProcess(item, 'qr_scan')}
                    >
                      <span className="mr-1">📱</span>
                      QRスキャン
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-success hover:bg-success/90 text-success-foreground text-xs w-full"
                      onClick={() => handleItemProcess(item, 'deliver')}
                    >
                      <span className="mr-1">🚚</span>
                      配送完了
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs bg-red-50 border-red-200 hover:bg-red-100 text-red-600 px-8"
                      onClick={() => handleDeleteItem(item)}
                    >
                      削除
                    </Button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90 text-xs w-full"
                    onClick={() => handleItemProcess(item, 'qr_scan')}
                  >
                    <span className="mr-1">📱</span>
                    QRスキャン
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs w-full"
                    onClick={() => handleItemProcess(item, 'schedule')}
                  >
                    スケジュール調整
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs w-full bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                    onClick={() => handleDeleteItem(item)}
                  >
                    削除
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // 他の営業マンの商品の場合
            <div className="space-y-2">
              {item.readyForDelivery && (
                <>
                  {/* チェックボックス */}
                  <div className="flex items-center justify-center mb-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="w-4 h-4 mr-2"
                      id={`checkbox-${item.id}`}
                    />
                    <label htmlFor={`checkbox-${item.id}`} className="text-xs text-gray-600">
                      一括代理配送用
                    </label>
                  </div>
                </>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  className="text-xs bg-primary hover:bg-primary/90 w-full"
                  onClick={() => handleItemProcess(item, 'qr_scan')}
                >
                  <span className="mr-1">📱</span>
                  QRスキャン
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs w-full bg-green-50 border-green-200 hover:bg-green-100"
                  onClick={() => handleItemProcess(item, 'deliver')}
                >
                  <span className="mr-1">🚚</span>
                  代理配送
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs w-full bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                  onClick={() => handleItemProcess(item, 'support')}
                >
                  <span className="mr-1">🤝</span>
                  サポート
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs w-full bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                  onClick={() => handleDeleteItem(item)}
                >
                  削除
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // モバイル版UI
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        {/* ヘッダー */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-800">マイページ</h1>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">{selectedUser === currentUser ? '自分' : selectedUser}</span>
            </div>
          </div>
          
          {/* 天気予報カード */}
          <div className="flex space-x-3">
            {weatherLoading ? (
              <div className="flex-1 bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg p-3 border border-blue-200">
                <div className="text-center">
                  <div className="text-xl mb-1">🌤️</div>
                  <div className="text-xs text-blue-600 font-medium">天気取得中...</div>
                </div>
              </div>
            ) : weatherData ? (
              <>
                <div className="flex-1 bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-center">
                    <div className="text-xl mb-1">{weatherData.today.condition}</div>
                    <div className="text-lg font-bold text-blue-600">最高{weatherData.today.temperature}°C</div>
                    <div className="text-xs text-blue-600 font-medium">今日</div>
                  </div>
                </div>
                <div className="flex-1 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-200">
                  <div className="text-center">
                    <div className="text-xl mb-1">{weatherData.tomorrow.condition}</div>
                    <div className="text-lg font-bold text-purple-600">最高{weatherData.tomorrow.temperature}°C</div>
                    <div className="text-xs text-purple-600 font-medium">明日</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-3 border border-gray-200">
                <div className="text-center">
                  <div className="text-xl mb-1">🌤️</div>
                  <div className="text-xs text-gray-600 font-medium">天気情報なし</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 配送可能商品リスト（アコーディオン式） */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              {selectedUser === currentUser ? '配送可能' : `${selectedUser}さんの配送可能商品`}
            </h2>
            
            {/* バッチ処理ボタン */}
            {(() => {
              const readyIds = selectableDeliveryIds(displayedItems)
              const allSelected = isAllDeliverySelected(selectedItems, readyIds)
              const isProxy = selectedUser !== currentUser

              return readyIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAllDeliveryItems}
                    className="text-xs"
                  >
                    {allSelected ? '選択解除' : `全選択 (${readyIds.length}件)`}
                  </Button>
                  {selectedItems.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleBatchDelivery}
                      disabled={batchDeliveryProtection.isLoading}
                      className="bg-success hover:bg-success/90 text-success-foreground text-xs"
                    >
                      <span className="mr-1">{batchDeliveryProtection.isLoading ? '⏳' : '🚚'}</span>
                      {batchDeliveryProtection.isLoading
                        ? '配送処理中...'
                        : `${isProxy ? '一括代理配送' : '一括配送完了'} (${selectedItems.size})`}
                    </Button>
                  )}
                </div>
              )
            })()}
          </div>
          
          {(() => {
            // 配送可能商品を取得
            const deliveryItems = displayedItems.filter(item => item.readyForDelivery)
            
            // グループ化
            const groupedDeliveryItems = deliveryItems.reduce((groups, item) => {
              // 優先度を計算（希望日までの日数で判定）
              const daysUntilRequired = Math.ceil((new Date(item.requiredDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              const priority = daysUntilRequired <= 2 ? 'high' : daysUntilRequired <= 5 ? 'medium' : 'low'
              
              const groupKey = `${priority}-${item.customer}`
              const groupLabel = `${item.customer}様`
              
              if (!groups[groupKey]) {
                groups[groupKey] = {
                  label: groupLabel,
                  priority: priority,
                  customer: item.customer,
                  items: []
                }
              }
              groups[groupKey].items.push(item)
              return groups
            }, {} as {[key: string]: {label: string, priority: string, customer: string, items: any[]}})
            
            // 優先度順でソート
            const sortedDeliveryGroups = Object.entries(groupedDeliveryItems).sort(([, a], [, b]) => {
              const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 }
              return priorityOrder[a.priority] - priorityOrder[b.priority]
            })
            
            if (sortedDeliveryGroups.length === 0) {
              return (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-2">📦</div>
                  <p>配送可能な商品がありません</p>
                </div>
              )
            }
            
            return (
              <div className="space-y-3">
                {sortedDeliveryGroups.map(([groupKey, group]) => {
                  const isExpanded = expandedDeliveryGroups[groupKey] !== false // デフォルトで展開
                  const isOwnItem = selectedUser === currentUser
                  
                  return (
                    <div key={groupKey} className={`rounded-xl border border-border shadow-sm ${!isOwnItem ? 'bg-orange-50/30' : ''}`}>
                      {/* グループヘッダー */}
                      <div 
                        className="p-4 cursor-pointer flex items-center justify-between hover:bg-accent/30 transition-colors"
                        onClick={() => toggleDeliveryGroup(groupKey)}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                          <div>
                            <h3 className="font-semibold text-foreground">{group.customer}様</h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-muted-foreground">
{group.items.length}件の商品
                              </span>
                              {!isOwnItem && (
                                <span className="text-xs font-medium text-orange-600">
                                  {selectedUser}さん担当
                                </span>
                              )}
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
                            const itemExpanded = expandedDeliveryItems[item.id]
                            
                            return (
                              <div key={item.id} className="border-b border-border/50 last:border-b-0">
                                {/* 商品基本情報 */}
                                <div 
                                  className="p-3 cursor-pointer hover:bg-accent/20 transition-colors"
                                  onClick={() => toggleDeliveryItem(item.id)}
                                >
                                  <div className="flex items-start justify-between">
                                    {/* 一括処理用のチェックボックス。
                                        2026-09-08 まで「開いた中」にしか無く、モバイルで個別に選ぶには
                                        商品を1件ずつ開く必要があった。行のまま選べるように前へ出した。
                                        stopPropagation が無いと、チェックと同時にアコーディオンが開閉する */}
                                    <input
                                      type="checkbox"
                                      checked={selectedItems.has(item.id)}
                                      onChange={() => handleSelectItem(item.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-5 h-5 mt-0.5 mr-3 shrink-0"
                                      aria-label={`${item.name} を一括処理に選ぶ`}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm">{itemExpanded ? '📖' : '📄'}</span>
                                        <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                                      </div>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                          {item.totalQuantity > 1 ? `${item.individualIndex + 1}/${item.totalQuantity}個目` : '1個'}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-600">
                                          配送準備完了
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
                                          <p className="text-foreground font-medium">{item.requiredDate}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">管理番号:</p>
                                          <p className="text-foreground font-medium">{item.assignedItemId}</p>
                                        </div>
                                      </div>

                                      {/* メモ */}
                                      {item.orderNotes && (
                                        <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-lg">
                                          <p className="text-xs">
                                            <span className="font-medium text-blue-800">発注メモ:</span>
                                            <span className="text-blue-800 ml-1">{item.orderNotes}</span>
                                          </p>
                                        </div>
                                      )}

                                      {/* アクションボタン */}
                                      {isOwnItem ? (
                                        // 自分の商品の場合
                                        <div className="space-y-2">
                                          {/* チェックボックスは折りたたみ行の方に出している（重複させない） */}
                                          <div className="flex space-x-2">
                                            <Button 
                                              size="sm" 
                                              className="flex-1 bg-primary hover:bg-primary/90 text-xs"
                                              onClick={() => handleItemProcess(item, 'qr_scan')}
                                            >
                                              <span className="mr-1">📱</span>
                                              QRスキャン
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              className="flex-1 bg-success hover:bg-success/90 text-success-foreground text-xs"
                                              onClick={() => handleItemProcess(item, 'deliver')}
                                            >
                                              <span className="mr-1">🚚</span>
                                              配送完了
                                            </Button>
                                          </div>
                                          <div className="flex justify-center">
                                            <Button 
                                              size="sm" 
                                              variant="outline" 
                                              className="text-xs bg-red-50 border-red-200 hover:bg-red-100 text-red-600 px-8"
                                              onClick={() => handleDeleteItem(item)}
                                            >
                                              削除
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        // 他の営業マンの商品の場合
                                        <div className="space-y-2">
                                          {/* チェックボックスは折りたたみ行の方に出している（重複させない）。
                                              代理配送のときだけ選べない、という状態はそこで解消した */}
                                          <div className="flex space-x-2">
                                            <Button 
                                              size="sm" 
                                              className="flex-1 bg-primary hover:bg-primary/90 text-xs"
                                              onClick={() => handleItemProcess(item, 'qr_scan')}
                                            >
                                              <span className="mr-1">📱</span>
                                              QRスキャン
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                                              onClick={() => handleItemProcess(item, 'deliver')}
                                            >
                                              <span className="mr-1">🚚</span>
                                              代理配送
                                            </Button>
                                          </div>
                                          <div className="flex space-x-2">
                                            <Button 
                                              size="sm" 
                                              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs"
                                              onClick={() => handleItemProcess(item, 'support')}
                                            >
                                              <span className="mr-1">🤝</span>
                                              サポート
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="outline" 
                                              className="flex-1 text-xs bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                                              onClick={() => handleDeleteItem(item)}
                                            >
                                              削除
                                            </Button>
                                          </div>
                                        </div>
                                      )}
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
                })}
              </div>
            )
          })()}
        </div>

        {/* クイックアクション */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800 mb-3">クイックアクション</h2>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/scan')}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg p-4 text-center shadow-md active:scale-95 transition-transform"
            >
              <span className="text-2xl block mb-1">📱</span>
              <span className="text-sm font-medium">QRスキャン</span>
            </button>
            <button 
              onClick={() => navigate('/inventory')}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg p-4 text-center shadow-md active:scale-95 transition-transform"
            >
              <span className="text-2xl block mb-1">📋</span>
              <span className="text-sm font-medium">在庫確認</span>
            </button>
          </div>
        </div>

        {/* フローティングボタン */}
        <div className="fixed bottom-20 right-4 z-50 flex space-x-3">
          {/* ダイレクト貸与ボタン */}
          <Button
            className="w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
            onClick={handleOpenDirectRentalScan}
          >
            <span className="text-2xl">🔍</span>
          </Button>

          {/* 音声認識ボタン */}
          <Button
            className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
            onClick={toggleVoiceRecognition}
          >
            <span className="text-2xl">{isListening ? '🔴' : '🎤'}</span>
          </Button>

          {/* 営業マン選択ボタン */}
          <Button
            className="w-14 h-14 rounded-full shadow-lg bg-purple-500 hover:bg-purple-600 text-white"
            onClick={() => setShowUserSelectModal(true)}
          >
            <span className="text-2xl">👥</span>
          </Button>
        </div>

        {/* 営業マン選択モーダル */}
        <Dialog open={showUserSelectModal} onOpenChange={setShowUserSelectModal}>
          <DialogContent className="fixed bottom-0 left-0 right-0 top-auto max-h-[70vh] rounded-t-xl bg-white">
            <DialogHeader className="pb-3">
              <DialogTitle>営業マンを選択</DialogTitle>
              <DialogDescription>
                他の営業マンの商品を確認・サポートできます
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2 overflow-y-auto max-h-[50vh]">
              {availableUsers.map((userName) => {
                const isCurrentUser = userName === currentUser
                const isSelected = userName === selectedUser
                
                return (
                  <button
                    key={userName}
                    onClick={() => {
                      setSelectedUser(userName)
                      setShowUserSelectModal(false)
                    }}
                    className={`w-full p-4 rounded-lg text-left transition-colors ${
                      isSelected 
                        ? 'bg-purple-100 border-2 border-purple-500' 
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {isCurrentUser ? `👤 ${userName} (自分)` : userName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {displayedItems.filter(item => 
                            (item.assignedTo === userName || item.carriedBy === userName) && 
                            item.readyForDelivery
                          ).length} 件の配送可能商品
                        </p>
                      </div>
                      {isSelected && (
                        <div className="text-purple-500">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* サポートダイアログ */}
        <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>サポート内容を入力</DialogTitle>
              <DialogDescription>
                {selectedSupportItem && (
                  <>
                    <strong>{selectedSupportItem.name}</strong> の業務サポートを実施します。<br />
                    顧客: <strong>{selectedSupportItem.customer}様</strong><br />
                    担当者: <strong>{selectedUser}さん</strong><br />
                    実施したサポート内容を入力してください。
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="supportDetails">サポート内容</Label>
                <Input
                  id="supportDetails"
                  value={supportDetails}
                  onChange={(e) => setSupportDetails(e.target.value)}
                  placeholder="例: 設置補助、操作説明、トラブル対応など"
                  className="mt-1"
                />
                {supportError && (
                  <p className="text-sm text-destructive mt-1">{supportError}</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSupportDialog(false)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleSupportSubmit}>
                  サポート記録
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 削除確認ダイアログ */}
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
                disabled={deleteProtection.isLoading}
              >
                {deleteProtection.isLoading ? '削除中...' : '削除実行'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* QRスキャンダイアログ */}
        <Dialog open={showQRScanDialog} onOpenChange={setShowQRScanDialog}>
          <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>QRコードスキャン - 配送確認</DialogTitle>
              <DialogDescription>
                {qrScanItem && (
                  <>
                    <strong>{qrScanItem.name}</strong> の配送確認<br />
                    顧客: <strong>{qrScanItem.customer}様</strong><br />
                    管理番号: <strong>{qrScanItem.assignedItemId}</strong><br />
                    {qrScanItem.totalQuantity > 1 && (
                      <span className="text-blue-600">
                        ({qrScanItem.individualIndex + 1}/{qrScanItem.totalQuantity}個目)
                      </span>
                    )}
                    <br />
                    商品のQRコードをスキャンして配送を確認してください
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
                // カメラスキャナー
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
                      配送商品のQRコードをカメラに向けてスキャンしてください
                    </p>
                  </div>
                </div>
              ) : (
                /* 手動入力 */
                <div className="aspect-square bg-secondary/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📱</div>
                    <p className="text-muted-foreground mb-4">QRコードを手動で入力してください</p>
                    <p className="text-xs text-muted-foreground">
                      手動入力モード
                    </p>
                  </div>
                </div>
              )}
              
              {/* 手動入力フォーム */}
              <div className="space-y-3">
                <Label htmlFor="qrInput">QRコード（管理番号）</Label>
                <Input
                  id="qrInput"
                  value={manualItemId}
                  onChange={(e) => setManualItemId(e.target.value)}
                  placeholder={`例: ${qrScanItem?.assignedItemId || 'WC-001'}, QR-${qrScanItem?.assignedItemId || 'WC-001'}`}
                  className="text-center"
                />
                
                {/* テスト用サンプルボタン */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-WC-001')}
                    className="text-xs"
                  >
                    QR-WC-001
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-WC-002')}
                    className="text-xs"
                  >
                    QR-WC-002
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-BD-001')}
                    className="text-xs"
                  >
                    QR-BD-001
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-WK-001')}
                    className="text-xs"
                  >
                    QR-WK-001
                  </Button>
                </div>
                
                <Button 
                  onClick={() => {
                    if (manualItemId.trim()) {
                      handleQRScanResult(manualItemId.trim())
                    }
                  }}
                  className="w-full"
                  disabled={!manualItemId.trim()}
                >
                  QRコードを処理
                </Button>
                
                {/* 商品の管理番号でも試行 */}
                {qrScanItem && (
                  <Button 
                    variant="outline"
                    onClick={() => handleQRScanResult(qrScanItem.assignedItemId)}
                    className="w-full"
                  >
                    この商品のQRコードでテスト ({qrScanItem.assignedItemId})
                  </Button>
                )}
              </div>

              {scanError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">エラー</p>
                  <p className="text-sm text-destructive">{scanError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      setScanError('')
                      setManualItemId('')
                    }}
                  >
                    再スキャン
                  </Button>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowQRScanDialog(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ダイレクト貸与: QRスキャンダイアログ */}
        <Dialog open={showDirectRentalScan} onOpenChange={setShowDirectRentalScan}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ダイレクト貸与</DialogTitle>
              <DialogDescription>
                貸与する商品のQRコードをスキャンしてください。
                <br />
                <span className="text-amber-600 font-medium">※ 利用可能な商品のみ対象です</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* カメラ/手動入力切り替え */}
              <div className="flex space-x-2">
                <Button
                  variant={useDirectRentalCamera ? 'default' : 'outline'}
                  onClick={() => setUseDirectRentalCamera(true)}
                  className="flex-1"
                >
                  📷 カメラ
                </Button>
                <Button
                  variant={!useDirectRentalCamera ? 'default' : 'outline'}
                  onClick={() => setUseDirectRentalCamera(false)}
                  className="flex-1"
                >
                  ⌨️ 手動入力
                </Button>
              </div>

              {useDirectRentalCamera ? (
                <div className="space-y-2">
                  <QRCameraScanner
                    onScanResult={handleDirectRentalScanResult}
                    onError={(error) => setDirectRentalError(error)}
                    isActive={showDirectRentalScan && useDirectRentalCamera}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label htmlFor="directRentalInputMobile">管理番号を入力</Label>
                  <Input
                    id="directRentalInputMobile"
                    value={directRentalManualId}
                    onChange={(e) => setDirectRentalManualId(e.target.value)}
                    placeholder="例: WC-001, QR-WC-001"
                    className="text-center"
                  />
                  <Button
                    onClick={() => {
                      if (directRentalManualId.trim()) {
                        handleDirectRentalScanResult(directRentalManualId.trim())
                      }
                    }}
                    className="w-full"
                    disabled={!directRentalManualId.trim()}
                  >
                    確認
                  </Button>
                </div>
              )}

              {directRentalError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">エラー</p>
                  <p className="text-sm text-destructive whitespace-pre-line">{directRentalError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setDirectRentalError('')
                      setDirectRentalManualId('')
                    }}
                  >
                    再入力
                  </Button>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowDirectRentalScan(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ダイレクト貸与: 貸与情報入力ダイアログ */}
        <Dialog open={showDirectRentalDialog} onOpenChange={setShowDirectRentalDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ダイレクト貸与</DialogTitle>
              <DialogDescription>
                {directRentalItem && (
                  <>
                    管理番号: <strong>{directRentalItem.productItem.id}</strong>
                    <br />
                    商品: <strong>{directRentalItem.product?.name || '不明'}</strong>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="directCustomerNameMobile">顧客名 <span className="text-destructive">*</span></Label>
                <Input
                  id="directCustomerNameMobile"
                  value={directRentalForm.customerName}
                  onChange={(e) => setDirectRentalForm(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="例: 山田太郎"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="directAssignedToMobile">担当者 <span className="text-destructive">*</span></Label>
                <Select
                  id="directAssignedToMobile"
                  value={directRentalForm.assignedTo}
                  onChange={(e) => setDirectRentalForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="mt-1"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="directCarriedByMobile">持出者 <span className="text-destructive">*</span></Label>
                <Select
                  id="directCarriedByMobile"
                  value={directRentalForm.carriedBy}
                  onChange={(e) => setDirectRentalForm(prev => ({ ...prev, carriedBy: e.target.value }))}
                  className="mt-1"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </Select>
              </div>

              {/* 希望設定（楽匠プラスなど） */}
              {directRentalItem?.product?.name?.includes('楽匠') && (
                <div>
                  <Label htmlFor="directRequestedSettingMobile">希望設定</Label>
                  <Select
                    id="directRequestedSettingMobile"
                    value={directRentalForm.requestedSetting}
                    onChange={(e) => setDirectRentalForm(prev => ({ ...prev, requestedSetting: e.target.value }))}
                    className="mt-1"
                  >
                    <option value="">設定なし</option>
                    <option value="2M">2M</option>
                    <option value="3M">3M</option>
                  </Select>
                </div>
              )}

              {directRentalError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{directRentalError}</p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDirectRentalDialog(false)
                    setDirectRentalItem(null)
                  }}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleDirectRentalSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  貸与開始
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // デスクトップ版UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-lg md:text-2xl font-bold text-white">
          {selectedUser === currentUser ? `マイページ - ${currentUser}` : `${selectedUser}さんの商品管理`}
        </h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleForceReload} className="flex-1 sm:flex-none bg-red-50 border-red-200 hover:bg-red-100">
            <span className="mr-2">🔄</span>
            データリセット
          </Button>
        </div>
      </div>

      {/* 営業マン選択 */}
      <div className="bg-card rounded-xl border border-border p-3 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-purple-300">👥</span>
            営業マン選択
          </h3>
          <div className="flex-1 max-w-xs">
            <Select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              placeholder="営業マンを選択してください"
            >
              {availableUsers.map((user) => (
                <option key={user} value={user}>
                  {user === currentUser ? `👤 ${user} (自分)` : user}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* 選択された営業マンの商品 */}
      <div className={`bg-card rounded-xl border p-3 md:p-6 shadow-sm ${selectedUser === currentUser ? 'border-border' : 'border-orange-200'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
          <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            {selectedUser === currentUser ? (
              <>
                <span className="text-blue-300">👤</span>
                自分の担当商品
              </>
            ) : (
              <>
                <span className="text-orange-300">🤝</span>
                {selectedUser}さんの商品（サポート可能）
              </>
            )}
          </h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs md:text-sm">
            <span className="text-white/70">
              配送準備完了: <span className="font-semibold text-white">{displayedItems.filter(item => item.readyForDelivery).length}</span>
            </span>
            <span className="text-white/70">
              総数: <span className="font-semibold text-white">{displayedItems.length}</span>
            </span>
          </div>
        </div>
        
        {/* デスクトップ版一括処理ボタン */}
        {(() => {
          const readyIds = selectableDeliveryIds(displayedItems)
          const allSelected = isAllDeliverySelected(selectedItems, readyIds)

          return readyIds.length > 0 && (
            <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-white/10 rounded-lg border border-white/20">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAllDeliveryItems}
                className="text-xs bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                {allSelected ? '選択解除' : '全選択'} ({readyIds.length}件)
              </Button>
              {selectedItems.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleBatchDelivery}
                  disabled={batchDeliveryProtection.isLoading}
                  className="bg-success hover:bg-success/90 text-success-foreground text-xs"
                >
                  <span className="mr-1">{batchDeliveryProtection.isLoading ? '⏳' : '🚚'}</span>
                  {batchDeliveryProtection.isLoading ? '配送処理中...' : `${selectedUser === currentUser ? '一括配送完了' : '一括代理配送'} (${selectedItems.size})`}
                </Button>
              )}
            </div>
          )
        })()}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {displayedItems.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-white/70">
                {selectedUser === currentUser ? '担当商品はありません' : `${selectedUser}さんの商品はありません`}
              </p>
            </div>
          ) : (
            displayedItems.map(renderItemCard)
          )}
        </div>
      </div>


      {/* サポート内容入力ダイアログ */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>サポート内容を入力</DialogTitle>
            <DialogDescription>
              {selectedSupportItem && (
                <>
                  <strong>{selectedSupportItem.name}</strong> の業務サポートを実施します。<br />
                  顧客: <strong>{selectedSupportItem.customer}様</strong><br />
                  担当者: <strong>{selectedUser}さん</strong><br />
                  実施したサポート内容を入力してください。
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="supportDetails">サポート内容</Label>
              <Input
                id="supportDetails"
                value={supportDetails}
                onChange={(e) => setSupportDetails(e.target.value)}
                placeholder="例: 設置補助、操作説明、トラブル対応など"
                className="mt-1"
              />
              {supportError && (
                <p className="text-sm text-destructive mt-1">{supportError}</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowSupportDialog(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleSupportSubmit}>
                サポート記録
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
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
              disabled={deleteProtection.isLoading}
            >
              {deleteProtection.isLoading ? '削除中...' : '削除実行'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QRスキャンダイアログ */}
      <Dialog open={showQRScanDialog} onOpenChange={setShowQRScanDialog}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>QRコードスキャン - 配送確認</DialogTitle>
            <DialogDescription>
              {qrScanItem && (
                <>
                  <strong>{qrScanItem.name}</strong> の配送確認<br />
                  顧客: <strong>{qrScanItem.customer}様</strong><br />
                  管理番号: <strong>{qrScanItem.assignedItemId}</strong><br />
                  {qrScanItem.totalQuantity > 1 && (
                    <span className="text-blue-600">
                      ({qrScanItem.individualIndex + 1}/{qrScanItem.totalQuantity}個目)
                    </span>
                  )}
                  <br />
                  商品のQRコードをスキャンして配送を確認してください
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* カメラスキャナーまたは手動入力選択 */}
            <div className="flex items-center justify-center space-x-4 mb-4">
              <Button
                variant={useCameraScanner ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCameraScanner(true)}
              >
                📷 カメラ
              </Button>
              <Button
                variant={!useCameraScanner ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCameraScanner(false)}
              >
                ✏️ 手動入力
              </Button>
            </div>
            
            {useCameraScanner ? (
              <div className="aspect-square bg-secondary/20 rounded-lg overflow-hidden">
                <QRCameraScanner
                  onScanResult={handleCameraScanResult}
                  onError={handleCameraError}
                  isActive={showQRScanDialog}
                  className="w-full h-full"
                  continuousMode={false}
                />
              </div>
            ) : (
              <div className="aspect-square bg-secondary/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center">
                  <div className="text-6xl mb-4">📱</div>
                  <p className="text-muted-foreground mb-4">QRコードを手動で入力してください</p>
                  <p className="text-xs text-muted-foreground">
                    手動入力モード
                  </p>
                </div>
              </div>
            )}
            
            {cameraError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">カメラエラー</p>
                <p className="text-sm text-destructive">{cameraError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setCameraError(null)
                    setUseCameraScanner(false)
                  }}
                >
                  手動入力に切り替え
                </Button>
              </div>
            )}
            
            {/* 手動入力フォーム */}
            {!useCameraScanner && (
              <div className="space-y-3">
                <Label htmlFor="qrInput">QRコード（管理番号）</Label>
                <Input
                  id="qrInput"
                  value={manualItemId}
                  onChange={(e) => setManualItemId(e.target.value)}
                  placeholder={`例: ${qrScanItem?.assignedItemId || 'WC-001'}, QR-${qrScanItem?.assignedItemId || 'WC-001'}`}
                  className="text-center"
                />
                
                {/* テスト用サンプルボタン */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-WC-001')}
                    className="text-xs"
                  >
                    QR-WC-001
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-WC-002')}
                    className="text-xs"
                  >
                    QR-WC-002
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-BD-001')}
                    className="text-xs"
                  >
                    QR-BD-001
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQRScanResult('QR-WK-001')}
                    className="text-xs"
                  >
                    QR-WK-001
                  </Button>
                </div>
                
                <Button 
                  onClick={() => {
                    if (manualItemId.trim()) {
                      handleQRScanResult(manualItemId.trim())
                    }
                  }}
                  className="w-full"
                  disabled={!manualItemId.trim()}
                >
                  QRコードを処理
                </Button>
                
                {/* 商品の管理番号でも試行 */}
                {qrScanItem && (
                  <Button 
                    variant="outline"
                    onClick={() => handleQRScanResult(qrScanItem.assignedItemId)}
                    className="w-full"
                  >
                    この商品のQRコードでテスト ({qrScanItem.assignedItemId})
                  </Button>
                )}
              </div>
            )}

            {scanError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">エラー</p>
                <p className="text-sm text-destructive">{scanError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setScanError('')
                    setManualItemId('')
                  }}
                >
                  再スキャン
                </Button>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowQRScanDialog(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ダイレクト貸与: QRスキャンダイアログ */}
      <Dialog open={showDirectRentalScan} onOpenChange={setShowDirectRentalScan}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ダイレクト貸与</DialogTitle>
            <DialogDescription>
              貸与する商品のQRコードをスキャンしてください。
              <br />
              <span className="text-amber-600 font-medium">※ 利用可能な商品のみ対象です</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* カメラ/手動入力切り替え */}
            <div className="flex space-x-2">
              <Button
                variant={useDirectRentalCamera ? 'default' : 'outline'}
                onClick={() => setUseDirectRentalCamera(true)}
                className="flex-1"
              >
                📷 カメラ
              </Button>
              <Button
                variant={!useDirectRentalCamera ? 'default' : 'outline'}
                onClick={() => setUseDirectRentalCamera(false)}
                className="flex-1"
              >
                ⌨️ 手動入力
              </Button>
            </div>

            {useDirectRentalCamera ? (
              <div className="space-y-2">
                <QRCameraScanner
                  onScanResult={handleDirectRentalScanResult}
                  onError={(error) => setDirectRentalError(error)}
                  isActive={showDirectRentalScan && useDirectRentalCamera}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="directRentalInput">管理番号を入力</Label>
                <Input
                  id="directRentalInput"
                  value={directRentalManualId}
                  onChange={(e) => setDirectRentalManualId(e.target.value)}
                  placeholder="例: WC-001, QR-WC-001"
                  className="text-center"
                />
                <Button
                  onClick={() => {
                    if (directRentalManualId.trim()) {
                      handleDirectRentalScanResult(directRentalManualId.trim())
                    }
                  }}
                  className="w-full"
                  disabled={!directRentalManualId.trim()}
                >
                  確認
                </Button>
              </div>
            )}

            {directRentalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">エラー</p>
                <p className="text-sm text-destructive whitespace-pre-line">{directRentalError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setDirectRentalError('')
                    setDirectRentalManualId('')
                  }}
                >
                  再入力
                </Button>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowDirectRentalScan(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ダイレクト貸与: 貸与情報入力ダイアログ */}
      <Dialog open={showDirectRentalDialog} onOpenChange={setShowDirectRentalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ダイレクト貸与</DialogTitle>
            <DialogDescription>
              {directRentalItem && (
                <>
                  管理番号: <strong>{directRentalItem.productItem.id}</strong>
                  <br />
                  商品: <strong>{directRentalItem.product?.name || '不明'}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="directCustomerName">顧客名 <span className="text-destructive">*</span></Label>
              <Input
                id="directCustomerName"
                value={directRentalForm.customerName}
                onChange={(e) => setDirectRentalForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="例: 山田太郎"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="directAssignedTo">担当者 <span className="text-destructive">*</span></Label>
              <Select
                id="directAssignedTo"
                value={directRentalForm.assignedTo}
                onChange={(e) => setDirectRentalForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="mt-1"
              >
                {users.map(u => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="directCarriedBy">持出者 <span className="text-destructive">*</span></Label>
              <Select
                id="directCarriedBy"
                value={directRentalForm.carriedBy}
                onChange={(e) => setDirectRentalForm(prev => ({ ...prev, carriedBy: e.target.value }))}
                className="mt-1"
              >
                {users.map(u => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </Select>
            </div>

            {/* 希望設定（楽匠プラスなど） */}
            {directRentalItem?.product?.name?.includes('楽匠') && (
              <div>
                <Label htmlFor="directRequestedSetting">希望設定</Label>
                <Select
                  id="directRequestedSetting"
                  value={directRentalForm.requestedSetting}
                  onChange={(e) => setDirectRentalForm(prev => ({ ...prev, requestedSetting: e.target.value }))}
                  className="mt-1"
                >
                  <option value="">設定なし</option>
                  <option value="2M">2M</option>
                  <option value="3M">3M</option>
                </Select>
              </div>
            )}

            {directRentalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{directRentalError}</p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDirectRentalDialog(false)
                  setDirectRentalItem(null)
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleDirectRentalSubmit}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                貸与開始
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  )
}