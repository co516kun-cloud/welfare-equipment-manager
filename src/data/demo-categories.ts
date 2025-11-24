import type { DemoCategory } from '../types'

export const demoCategories: DemoCategory[] = [
  {
    id: 'shower-chair',
    name: 'シャワーチェア',
    icon: '🚿'
  },
  {
    id: 'bath-table',
    name: '浴槽台',
    icon: '🛁'
  },
  {
    id: 'bath-grip',
    name: '浴槽グリップ',
    icon: '🤲'
  },
  {
    id: 'bath-board',
    name: 'バスボード',
    icon: '📋'
  }
]

export const getDemoCategoryById = (categoryId: string): DemoCategory | undefined => {
  return demoCategories.find(category => category.id === categoryId)
}

export const getDemoCategoryName = (categoryId?: string): string => {
  if (!categoryId) return '未分類'
  const category = getDemoCategoryById(categoryId)
  return category ? category.name : '未分類'
}

export const getDemoCategoryIcon = (categoryId?: string): string => {
  if (!categoryId) return '📦'
  const category = getDemoCategoryById(categoryId)
  return category ? category.icon : '📦'
}