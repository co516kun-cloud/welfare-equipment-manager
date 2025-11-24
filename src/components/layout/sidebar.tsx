import { Link, useLocation } from 'react-router-dom'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useAuth } from '../../hooks/useAuth'
import { useEffect } from 'react'

const navigation = [
  { name: 'マイページ', href: '/', icon: '👤' },
  { name: '在庫管理', href: '/inventory', icon: '📦' },
  { name: 'QRスキャン', href: '/scan', icon: '📱' },
  { name: '発注管理', href: '/orders', icon: '📋' },
  { name: '準備待ち', href: '/preparation', icon: '⏳' },
  { name: 'ラベル印刷待ち', href: '/label-queue', icon: '🏷️' },
  { name: '発注承認', href: '/approval', icon: '✅' },
  { name: '履歴管理', href: '/history', icon: '📊' },
  { name: 'デモ機管理', href: '/demo', icon: '🛁' },
  { name: '預かり品', href: '/deposits', icon: '📦' },
  { name: '商品検索', href: '/search', icon: '🔍' },
  { name: 'AI機能', href: '/ai-features', icon: '🤖' },
  { name: 'データ取込', href: '/manual-import', icon: '📝' },
]

export function Sidebar() {
  const location = useLocation()
  const store = useInventoryStore()
  const { orders, products, items, users, loadData } = store
  const { user } = useAuth()
  
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
  
  // データはLayoutで読み込まれるため、ここでは読み込まない
  
  // 準備待ち件数を計算
  const preparationCount = (orders || []).flatMap(order => 
    (order.items || [])
      .filter(item => {
        // 準備待ちと判定する条件
        const isApproved = order.status === 'approved' || item.approval_status === 'not_required'
        const isNotReady = item.item_processing_status === 'waiting'
        return isApproved && isNotReady
      })
      .flatMap(item => {
        // 数量分だけ個別アイテムを生成（準備完了したものは除外）
        const individualItems = []
        for (let i = 0; i < item.quantity; i++) {
          const assignedItemId = item.assigned_item_ids ? item.assigned_item_ids[i] : null
          const isAssigned = assignedItemId !== null && assignedItemId !== undefined
          
          // 準備完了したアイテムは除外
          if (!isAssigned) {
            individualItems.push(1)
          }
        }
        return individualItems
      })
  ).length

  // マイページの配送準備完了件数を計算（自分の担当商品のみ）
  const myPageCount = (orders || []).flatMap(order => {
    // 自分が担当者または持出者の発注のみ
    if (order.assigned_to === currentUser || order.carried_by === currentUser) {
      return (order.items || []).flatMap(item => {
        if (item.assigned_item_ids && item.assigned_item_ids.length > 0 && order.status !== 'delivered') {
          // 割り当てられた商品アイテムの中でready_for_deliveryのもののみカウント
          return item.assigned_item_ids.map(assignedItemId => {
            if (assignedItemId) {
              const productItem = (items || []).find(pi => pi.id === assignedItemId)
              return productItem && productItem.status === 'ready_for_delivery' ? 1 : 0
            }
            return 0
          })
        }
        return []
      })
    }
    return []
  }).reduce((total, count) => total + count, 0)

  // 発注承認待ち件数を計算
  const approvalCount = (orders || []).filter(order => 
    order.status === 'pending' || order.status === 'partial_approved'
  ).length

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex items-center px-6 py-4">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">福</span>
          </div>
          <span className="text-lg font-semibold text-foreground">福祉用具管理</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          const showPreparationCount = item.href === '/preparation' && preparationCount > 0
          const showMyPageCount = item.href === '/' && myPageCount > 0
          const showApprovalCount = item.href === '/approval' && approvalCount > 0
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center">
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </div>
              {showPreparationCount && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  isActive 
                    ? "bg-primary-foreground text-primary" 
                    : "bg-destructive text-destructive-foreground"
                )}>
                  {preparationCount}
                </span>
              )}
              {showMyPageCount && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  isActive 
                    ? "bg-primary-foreground text-primary" 
                    : "bg-success text-success-foreground"
                )}>
                  {myPageCount}
                </span>
              )}
              {showApprovalCount && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  isActive 
                    ? "bg-primary-foreground text-primary" 
                    : "bg-warning text-warning-foreground"
                )}>
                  {approvalCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-secondary-foreground text-sm">田</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">田中太郎</p>
            <p className="text-xs text-muted-foreground">営業担当</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full">
          ログアウト
        </Button>
      </div>
    </div>
  )
}