import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useAuth } from '../../hooks/useAuth'
import { useEffect } from 'react'

const mainNavigation = [
  { name: 'マイページ', href: '/mypage', icon: '👤', showMyPageCount: true },
  { name: 'スキャン', href: '/scan', icon: '📱' },
  { name: '在庫', href: '/inventory', icon: '📋' },
  { name: '発注', href: '/orders', icon: '📋' },
  { name: '準備', href: '/preparation', icon: '⚡', showCount: true }
]

export function MobileBottomNav() {
  const location = useLocation()
  const { orders, users, items } = useInventoryStore()
  const { user } = useAuth()

  // 認証ユーザーから現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return '管理者'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || '管理者'
  }
  
  // データはLayoutで読み込まれるため、ここでは読み込まない
  
  // 準備待ち件数を計算
  const preparationCount = orders.flatMap(order => 
    order.items
      .filter(item => {
        return (
          (item.approval_status === 'not_required' && item.item_processing_status === 'waiting') ||
          (item.approval_status === 'approved' && item.item_processing_status === 'waiting') ||
          (order.status === 'approved' && item.item_processing_status !== 'ready')
        )
      })
      .flatMap(item => {
        const individualItems = []
        for (let i = 0; i < item.quantity; i++) {
          const assignedItemId = item.assigned_item_ids ? item.assigned_item_ids[i] : null
          const isAssigned = assignedItemId !== null && assignedItemId !== undefined
          
          if (!isAssigned) {
            individualItems.push(1)
          }
        }
        return individualItems
      })
  ).length

  // マイページの配送準備完了件数を計算
  const currentUser = getCurrentUserName()
  const myPageCount = orders.flatMap(order => 
    order.items
      .filter(item => {
        // 準備完了かつ配送可能な状態の商品のみ
        return (
          (order.assigned_to === currentUser || order.carried_by === currentUser) &&
          item.item_processing_status === 'ready' &&
          item.assigned_item_ids && 
          item.assigned_item_ids.length > 0 &&
          order.status !== 'delivered'
        )
      })
      .flatMap(item => {
        // 数量分だけ個別アイテムを生成
        const individualItems = []
        for (let i = 0; i < item.quantity; i++) {
          const assignedItemId = item.assigned_item_ids ? item.assigned_item_ids[i] : null
          if (assignedItemId !== null && assignedItemId !== undefined) {
            individualItems.push(1)
          }
        }
        return individualItems
      })
  ).length


  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/50 shadow-lg z-50">
      <div className="flex justify-around items-center py-2">
        {mainNavigation.map((item) => {
          const isActive = location.pathname === item.href
          let badge = null
          
          if (item.showCount && preparationCount > 0) {
            badge = preparationCount
          } else if (item.showMyPageCount && myPageCount > 0) {
            badge = myPageCount
          }
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`relative flex flex-col items-center p-2 rounded-lg transition-all duration-200 min-w-[60px] ${
                isActive 
                  ? 'text-blue-600 scale-105' 
                  : 'text-slate-600 hover:text-blue-500'
              }`}
            >
              {/* バッジ */}
              {badge && (
                <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md">
                  {badge > 99 ? '99+' : badge}
                </div>
              )}
              
              {/* アイコン */}
              <span className={`text-xl mb-1 transition-transform ${
                isActive ? 'scale-110' : 'hover:scale-105'
              }`}>
                {item.icon}
              </span>
              
              {/* ラベル */}
              <span className={`text-xs font-medium ${
                isActive ? 'font-bold' : ''
              }`}>
                {item.name}
              </span>
              
              {/* アクティブインジケーター */}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></div>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}