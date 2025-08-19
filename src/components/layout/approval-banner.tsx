import { Link } from 'react-router-dom'
import { useInventoryStore } from '../../stores/useInventoryStore'

export function ApprovalBanner() {
  const { orders } = useInventoryStore()
  
  // 承認待ちの件数を計算
  const pendingCount = orders.filter(o => o.status === 'pending').length
  
  // 承認待ちがない場合は表示しない
  if (pendingCount === 0) {
    return null
  }
  
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-rose-500 text-white shadow-lg">
      <Link 
        to="/approval" 
        className="block w-full hover:bg-rose-600 transition-colors"
      >
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-xs font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-medium">承認が必要な発注があります</p>
              <p className="text-xs opacity-90">{pendingCount}件の発注が承認待ちです</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
              {pendingCount}
            </div>
            <span className="text-white/80 text-sm">→</span>
          </div>
        </div>
      </Link>
    </div>
  )
}