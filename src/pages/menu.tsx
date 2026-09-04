import { Link, useNavigate } from 'react-router-dom'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useAuth } from '../hooks/useAuth'
import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'

const menuItems = [
  {
    category: '📊 ダッシュボード',
    gradient: 'from-blue-500 to-indigo-600',
    items: [
      { 
        name: 'マイページ', 
        href: '/mypage', 
        icon: '👤', 
        systemIcon: '🏠',
        description: '個人担当商品の確認',
        shortcut: 'H',
        badge: 'mypage'
      },
    ]
  },
  { 
    category: '📦 在庫管理システム',
    gradient: 'from-emerald-500 to-teal-600',
    items: [
      { 
        name: '在庫一覧', 
        href: '/inventory', 
        icon: '📋', 
        systemIcon: '📊',
        description: '全商品の在庫状況管理',
        shortcut: 'I',
        badge: null
      },
      { 
        name: 'QRスキャン', 
        href: '/scan', 
        icon: '📱', 
        systemIcon: '🔍',
        description: 'リアルタイム状態変更',
        shortcut: 'S',
        badge: null
      },
    ]
  },
  {
    category: '🛒 発注管理システム',
    gradient: 'from-orange-500 to-red-500',
    items: [
      { 
        name: '発注管理', 
        href: '/orders', 
        icon: '📋', 
        systemIcon: '📄',
        description: '発注作成・管理',
        shortcut: 'O',
        badge: null
      },
      { 
        name: '承認', 
        href: '/approval', 
        icon: '✓', 
        systemIcon: '✅',
        description: '承認待ち発注処理',
        shortcut: 'A',
        badge: 'pending'
      },
      { 
        name: '準備商品', 
        href: '/preparation', 
        icon: '⚡', 
        systemIcon: '⏳',
        description: '商品準備・割当',
        shortcut: 'P',
        badge: 'ready'
      },
    ]
  },
  {
    category: '🔧 運用管理',
    gradient: 'from-purple-500 to-indigo-600',
    items: [
      { 
        name: '履歴管理', 
        href: '/history', 
        icon: '📈', 
        systemIcon: '📊',
        description: '取引履歴・分析',
        shortcut: 'H',
        badge: null
      },
      { 
        name: 'デモ管理', 
        href: '/demo', 
        icon: '🎯', 
        systemIcon: '📋',
        description: 'デモ商品管理',
        shortcut: 'D',
        badge: null
      },
      { 
        name: '預かり物', 
        href: '/deposits', 
        icon: '📦', 
        systemIcon: '🏪',
        description: '預かり物管理',
        shortcut: 'Dep',
        badge: null
      },
      { 
        name: 'AI機能', 
        href: '/ai-features', 
        icon: '🤖', 
        systemIcon: '🧠',
        description: 'AI支援ツール',
        shortcut: 'AI',
        badge: 'beta'
      },
    ]
  }
]

export function Menu() {
  const { orders, items, users, loadData } = useInventoryStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    // 初回データロードはApp.tsxで処理されるため、ここでは時刻更新のみ
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

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
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || 'ユーザー'
  }

  // 統計情報を計算
  const stats = {
    items: items.filter(i => i.status === 'available').length,
    orders: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    ready: orders.flatMap(order => {
      if (!order.items || order.items.length === 0) return []
      
      return order.items
        .filter(item => {
          // 承認済みで準備中のアイテムをカウント
          const isApproved = order.status === 'approved' || item.approval_status === 'not_required'
          const isInPreparation = ['waiting', 'preparing', 'assigned'].includes(item.item_processing_status)
          return isApproved && isInPreparation
        })
        .flatMap(item => {
          // 数量分だけ個別アイテムを生成
          const individualItems = []
          for (let i = 0; i < item.quantity; i++) {
            individualItems.push(1)
          }
          return individualItems
        })
    }).length,
  }
  
  // デバッグログを削除（無限ループを防ぐため）

  // 認証ユーザーから現在のユーザー名を取得（バッジ用）
  const currentUser = getCurrentUserName()
  
  // マイページの配送準備完了件数を計算（PC版用）
  // 発注アイテムベースでカウント（個別商品ではなく発注単位）
  const myPageCount = orders.reduce((total, order) => {
    // 自分が担当者または持出者の発注のみ
    if (order.assigned_to === currentUser || order.carried_by === currentUser) {
      return total + order.items.reduce((itemTotal, item) => {
        if (item.assigned_item_ids && item.assigned_item_ids.length > 0 &&
            item.item_processing_status === 'ready') {
          
          // この発注アイテムが配送準備完了かチェック
          const hasReadyForDeliveryItems = item.assigned_item_ids.some(assignedItemId => {
            if (assignedItemId) {
              const productItem = items.find(pi => pi.id === assignedItemId)
              return productItem && productItem.status === 'ready_for_delivery'
            }
            return false
          })
          
          
          return itemTotal + (hasReadyForDeliveryItems ? 1 : 0)
        }
        return itemTotal
      }, 0)
    }
    return total
  }, 0)

  // バッジの値を取得
  const getBadgeValue = (badgeType: string) => {
    switch (badgeType) {
      case 'mypage': return myPageCount > 0 ? myPageCount : null
      case 'pending': return stats.pending > 0 ? stats.pending : null
      case 'ready': return stats.ready > 0 ? stats.ready : null
      case 'beta': return 'β'
      default: return null
    }
  }

  // モバイル版では専用のタブナビゲーションを使用するため、マイページにリダイレクト
  if (isMobile) {
    useEffect(() => {
      navigate('/mypage')
    }, [navigate])
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/80">リダイレクト中...</p>
        </div>
      </div>
    )
  }

  // デスクトップ版レイアウト
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      {/* ヘッダー - システム情報バー */}
      <div className="bg-gradient-to-r from-slate-900/95 via-cyan-900/90 to-indigo-900/95 backdrop-blur-xl border-b border-cyan-400/40 sticky top-0 z-10 shadow-2xl shadow-cyan-500/30">
        <div className="max-w-7xl mx-auto px-6 py-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-white">システム稼働中</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-sm text-white/90">
                {currentTime.toLocaleString('ja-JP')}
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {getCurrentUserName().charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-white">
                  {getCurrentUserName()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex">
        {/* 左サイドバー */}
        <div className="w-40 bg-gradient-to-b from-slate-800/80 via-slate-900/70 to-indigo-900/80 backdrop-blur-xl min-h-screen sticky top-0 border-r border-slate-700/50 shadow-2xl shadow-indigo-500/20 p-4">
            <div className="space-y-4">
              {/* 商品検索 */}
              <Link
                to="/search"
                className="group block relative"
                title="商品検索"
              >
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 backdrop-blur-xl px-4 py-3 border border-blue-300/40 hover:border-blue-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">🔍 商品検索</span>
                </div>
              </Link>
              
              {/* 新規発注 */}
              <Link
                to="/orders?action=new"
                className="group block relative"
                title="新規発注"
              >
                <div className="bg-gradient-to-r from-orange-500 to-red-500 backdrop-blur-xl px-4 py-3 border border-orange-300/40 hover:border-orange-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">➕ 新規発注</span>
                </div>
              </Link>
              
              {/* 音声認識 */}
              <button
                onClick={() => alert('音声認識機能は現在デモ版です。\n将来的には在庫確認や発注も音声で可能になります。')}
                className="group block relative w-full text-left"
                title="音声認識"
              >
                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 backdrop-blur-xl px-4 py-3 border border-teal-300/40 hover:border-teal-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">🎤 音声認識</span>
                </div>
              </button>
              
              {/* 在庫アラート */}
              <Link
                to="/stock-alert"
                className="group block relative"
                title="在庫アラート"
              >
                <div className="bg-gradient-to-r from-rose-500 to-pink-500 backdrop-blur-xl px-4 py-3 border border-rose-300/40 hover:border-rose-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">🚨 在庫アラート</span>
                </div>
              </Link>

              {/* ラベル印刷状況（印刷自体は PC の印刷エージェントが自動で行う） */}
              <Link
                to="/label-queue"
                className="group block relative"
                title="ラベル印刷状況"
              >
                <div className="bg-gradient-to-r from-purple-500 to-violet-500 backdrop-blur-xl px-4 py-3 border border-purple-300/40 hover:border-purple-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">🏷️ ラベル印刷</span>
                </div>
              </Link>

              {/* 貸与分析 */}
              <Link
                to="/product-analysis"
                className="group block relative"
                title="貸与分析"
              >
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 backdrop-blur-xl px-4 py-3 border border-amber-300/40 hover:border-amber-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">📊 貸与分析</span>
                </div>
              </Link>

              {/* 消毒作業管理 */}
              <Link
                to="/work-management"
                className="group block relative"
                title="消毒作業管理"
              >
                <div className="bg-gradient-to-r from-cyan-500 to-teal-500 backdrop-blur-xl px-4 py-3 border border-cyan-300/40 hover:border-cyan-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">🧴 消毒管理</span>
                </div>
              </Link>

              {/* セパレーター */}
              <div className="border-t border-slate-600/50"></div>

              {/* データインポート */}
              <Link
                to="/data-import"
                className="group block relative"
                title="データインポート"
              >
                <div className="bg-gradient-to-r from-indigo-500 to-blue-500 backdrop-blur-xl px-4 py-3 border border-indigo-300/40 hover:border-indigo-400/60 transition-all duration-300 hover:shadow-xl rounded-lg flex items-center">
                  <span className="text-sm font-medium text-white">📥 インポート</span>
                </div>
              </Link>
              
              {/* 追加アイテム用のプレースホルダー */}
              <div className="space-y-4">
                {/* 今後追加されるアイテム用のスペース */}
              </div>
            </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 px-4 py-4">
          {/* タイトル */}
          <div className="text-left mb-2 ml-24 mt-8">
            <h1 className="text-4xl font-bold text-white">
              福祉用具管理システム
            </h1>
          </div>

          <div className="flex gap-4">
            {/* 左：統計カード */}
            <div className="w-72 space-y-4 flex flex-col justify-center ml-24">
            {[
              { label: '準備商品', value: stats.ready, color: 'from-blue-400 to-indigo-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: '⚡', description: '準備商品数' },
              { label: '承認待ち', value: stats.pending, color: 'from-amber-400 to-orange-500', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: '⏳', description: '承認待機中' },
            ].map((stat, index) => {
              const isFirstCard = index === 0
              const cardClasses = 'bg-white/95 dark:bg-white/90 border-slate-200/80 shadow-lg hover:shadow-xl'
              const iconClasses = isFirstCard
                ? 'bg-gradient-to-r from-teal-500 to-emerald-400 shadow-teal-500/40'
                : 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-amber-500/40'
              const textClasses = isFirstCard ? 'text-teal-600' : 'text-amber-600'
              
              return (
                <div key={index} className={cardClasses + ' backdrop-blur-xl rounded-2xl p-6 border shadow-2xl transition-all duration-300'}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={iconClasses + ' w-16 h-16 rounded-xl flex items-center justify-center shadow-xl'}>
                      <span className="text-3xl">{stat.icon}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-slate-800">{stat.value}</div>
                      <div className={'text-base font-semibold ' + textClasses}>{stat.label}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 font-medium">{stat.description}</div>
                </div>
              )
            })}
            </div>

            {/* 中央：3x3グリッド */}
            <div className="flex-1 self-start">
              <div className="space-y-4 max-w-md mr-24 ml-auto -mt-16">
              {/* 1行目 */}
              <div className="bg-gradient-to-r from-emerald-800/80 via-teal-800/70 to-cyan-800/80 backdrop-blur-xl rounded-2xl border border-teal-400/40 p-4 shadow-2xl shadow-teal-500/30 hover:shadow-teal-400/40 transition-all duration-300 hover:border-teal-300/60">
                <div className="grid grid-cols-3 gap-4">
                  {menuItems.flatMap(category => 
                    category.items.filter(item => item.name !== 'AI機能')
                  ).slice(0, 3).map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="group relative bg-white/90 dark:bg-slate-800/80 backdrop-blur-md rounded-lg border-2 border-slate-200/80 dark:border-slate-600/60 hover:border-blue-300 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-white dark:hover:bg-slate-700/90 hover:border-blue-400 aspect-square flex flex-col items-center justify-center p-2"
                    >
                      {/* バッジ */}
                      {item.badge && getBadgeValue(item.badge) && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-400 to-pink-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md">
                          {getBadgeValue(item.badge)}
                        </div>
                      )}

                      {/* アイコンエリア */}
                      <div className="relative">
                        <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 text-base opacity-60">{item.systemIcon}</span>
                      </div>

                      {/* コンテンツ */}
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-3">
                        {item.name}
                      </h3>

                      {/* ホバーエフェクト */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* 2行目 */}
              <div className="bg-gradient-to-r from-orange-800/80 via-amber-800/70 to-yellow-800/80 backdrop-blur-xl rounded-2xl border border-amber-400/40 p-4 shadow-2xl shadow-amber-500/30 hover:shadow-amber-400/40 transition-all duration-300 hover:border-amber-300/60">
                <div className="grid grid-cols-3 gap-4">
                  {menuItems.flatMap(category => 
                    category.items.filter(item => item.name !== 'AI機能')
                  ).slice(3, 6).map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="group relative bg-white/90 dark:bg-slate-800/80 backdrop-blur-md rounded-lg border-2 border-slate-200/80 dark:border-slate-600/60 hover:border-blue-300 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-white dark:hover:bg-slate-700/90 hover:border-blue-400 aspect-square flex flex-col items-center justify-center p-2"
                    >
                      {/* バッジ */}
                      {item.badge && getBadgeValue(item.badge) && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-400 to-pink-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md">
                          {getBadgeValue(item.badge)}
                        </div>
                      )}

                      {/* アイコンエリア */}
                      <div className="relative">
                        <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 text-base opacity-60">{item.systemIcon}</span>
                      </div>

                      {/* コンテンツ */}
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-3">
                        {item.name}
                      </h3>

                      {/* ホバーエフェクト */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* 3行目 */}
              <div className="bg-gradient-to-r from-rose-800/80 via-pink-800/70 to-fuchsia-800/80 backdrop-blur-xl rounded-2xl border border-pink-400/40 p-4 shadow-2xl shadow-pink-500/30 hover:shadow-pink-400/40 transition-all duration-300 hover:border-pink-300/60">
                <div className="grid grid-cols-3 gap-4">
                  {menuItems.flatMap(category => 
                    category.items.filter(item => item.name !== 'AI機能')
                  ).slice(6, 9).map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="group relative bg-white/90 dark:bg-slate-800/80 backdrop-blur-md rounded-lg border-2 border-slate-200/80 dark:border-slate-600/60 hover:border-blue-300 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-white dark:hover:bg-slate-700/90 hover:border-blue-400 aspect-square flex flex-col items-center justify-center p-2"
                    >
                      {/* バッジ */}
                      {item.badge && getBadgeValue(item.badge) && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-400 to-pink-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md">
                          {getBadgeValue(item.badge)}
                        </div>
                      )}

                      {/* アイコンエリア */}
                      <div className="relative">
                        <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 text-base opacity-60">{item.systemIcon}</span>
                      </div>

                      {/* コンテンツ */}
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-3">
                        {item.name}
                      </h3>

                      {/* ホバーエフェクト */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </Link>
                  ))}
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* AI機能セクション */}
          <div className="mt-8 mb-6">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">AI機能</h2>
            <div className="grid grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* AIアシスタント */}
              <div className="bg-white/95 dark:bg-white/90 backdrop-blur-xl rounded-2xl border-2 border-slate-200/80 p-8 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex flex-col items-center mb-6">
                  <div className="h-16 w-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                    <span className="text-orange-500 text-3xl">💬</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">AIアシスタント</h3>
                </div>
                <p className="text-base text-slate-600 mb-6 text-center">
                  アプリの使い方についてAIがお答えします
                </p>
                <Link to="/ai-features">
                  <Button className="w-full text-lg py-6">
                    質問する
                  </Button>
                </Link>
              </div>

              {/* レポート生成 */}
              <div className="bg-white/95 dark:bg-white/90 backdrop-blur-xl rounded-2xl border-2 border-slate-200/80 p-8 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex flex-col items-center mb-6">
                  <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                    <span className="text-purple-500 text-3xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">レポート生成</h3>
                </div>
                <p className="text-base text-slate-600 mb-6 text-center">
                  業務データから詳細なレポートを自動生成
                </p>
                <Link to="/ai-features">
                  <Button className="w-full text-lg py-6">
                    生成開始
                  </Button>
                </Link>
              </div>

              {/* AI分析 */}
              <div className="bg-white/95 dark:bg-white/90 backdrop-blur-xl rounded-2xl border-2 border-slate-200/80 p-8 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex flex-col items-center mb-6">
                  <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <span className="text-red-500 text-3xl">📈</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">AI分析</h3>
                </div>
                <p className="text-base text-slate-600 mb-6 text-center">
                  利用パターンを分析し最適化提案
                </p>
                <Link to="/ai-features">
                  <Button className="w-full text-lg py-6">
                    分析開始
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* コンパクトフッター */}
          <div className="mt-3 text-center">
          <div className="bg-white/90 dark:bg-slate-800/80 backdrop-blur-md rounded-xl p-2 border-2 border-slate-200/80 dark:border-slate-600/60 shadow-md">
            <div className="flex items-center justify-center space-x-3 mb-1">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-sm">🏥</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">福祉用具管理システム v2.0</h3>
                <p className="text-xs text-slate-700 dark:text-slate-300">Powered by Modern Web Technology</p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-gradient-to-r from-rose-400 to-pink-400 text-white font-semibold rounded-lg hover:from-rose-500 hover:to-pink-500 transition-all duration-300 hover:shadow-md border border-rose-300 text-sm">
              <span className="mr-1">🚪</span>
              ログアウト
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}