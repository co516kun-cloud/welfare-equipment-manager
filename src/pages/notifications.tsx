import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import { Button } from '../components/ui/button'
import { useNotificationStore } from '../stores/useNotificationStore'
import { generateNotifications } from '../lib/notification-generator'

export default function NotificationsPage() {
  const navigate = useNavigate()
  // 通知はプッシュやブックマークから直接開かれる。戻り先が無ければメニューへ
  const goBack = useGoBack('/menu')
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    removeNotification,
    clearAll 
  } = useNotificationStore()
  const [selectedType, setSelectedType] = useState<'all' | 'unread'>('all')

  // ページ表示時に通知を生成
  useEffect(() => {
    generateNotifications()
  }, [])

  // 通知をクリックした時の処理
  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id)
    if (notification.actionUrl) {
      navigate(notification.actionUrl)
    }
  }

  // フィルタリング
  const filteredNotifications = selectedType === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications

  // 優先度に応じた色を取得
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50'
      case 'medium': return 'border-l-yellow-500 bg-yellow-50'
      case 'low': return 'border-l-blue-500 bg-blue-50'
      default: return 'border-l-gray-500 bg-gray-50'
    }
  }

  // タイプに応じたアイコンを取得
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'preparation': return '📦'
      case 'status_anomaly': return '⚠️'
      case 'system': return '🔧'
      default: return 'ℹ️'
    }
  }

  // 時間の表示形式
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}日前`
    if (hours > 0) return `${hours}時間前`
    const minutes = Math.floor(diff / (1000 * 60))
    if (minutes > 0) return `${minutes}分前`
    return 'たった今'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>🔔</span>
              通知センター
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm">
                  {unreadCount}
                </span>
              )}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="text-gray-600"
            >
              ✕ 閉じる
            </Button>
          </div>

          {/* フィルターとアクション */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
              >
                すべて ({notifications.length})
              </Button>
              <Button
                variant={selectedType === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('unread')}
              >
                未読 ({unreadCount})
              </Button>
            </div>
            
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                >
                  すべて既読にする
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  className="text-red-600 hover:bg-red-50"
                >
                  すべて削除
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 通知リスト */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">
                {selectedType === 'unread' ? '未読の通知はありません' : '通知はありません'}
              </p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${
                  getPriorityColor(notification.priority)
                } ${!notification.read ? 'ring-2 ring-blue-500 ring-opacity-50' : ''} 
                hover:shadow-md transition-all cursor-pointer`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* アイコン */}
                    <div className="text-2xl flex-shrink-0">
                      {getTypeIcon(notification.type)}
                    </div>
                    
                    {/* コンテンツ */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">
                            {notification.title}
                            {!notification.read && (
                              <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </h3>
                          <p className="text-gray-600 mt-1">{notification.message}</p>
                          
                          {notification.actionLabel && (
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0 mt-2 text-blue-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNotificationClick(notification)
                              }}
                            >
                              {notification.actionLabel} →
                            </Button>
                          )}
                        </div>
                        
                        {/* 時間と削除ボタン */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400">
                            {formatTime(notification.timestamp)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeNotification(notification.id)
                            }}
                          >
                            <span className="text-red-500 text-sm">✕</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* テスト用ボタン（開発中のみ） */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">開発用：テスト通知生成</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              generateNotifications()
              window.location.reload()
            }}
          >
            通知を再生成
          </Button>
        </div>
      </div>
    </div>
  )
}