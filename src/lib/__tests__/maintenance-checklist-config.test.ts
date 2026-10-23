import { describe, it, expect } from 'vitest'
import { getChecklistConfig, maintenanceChecklistConfig } from '../maintenance-checklist-config'

describe('メンテナンスチェックリスト', () => {
  // ガートル台（商品ID 40101）は category_id='bedsaccessory' で登録されている
  it('特殊寝台付属品にガートル台の項目がある', () => {
    const sub = getChecklistConfig('bedsaccessory')?.subcategories?.find(s => s.id === 'gartle_stand')
    expect(sub?.name).toBe('ガートル台')
    expect(sub?.items.length).toBeGreaterThan(0)
  })

  // ダイヤスロープは category_id='slope' で登録されている
  it('スロープ（ダイヤスロープ）の項目がある', () => {
    const config = getChecklistConfig('slope')
    expect(config?.categoryName).toBe('スロープ')
    expect(config?.items?.length).toBeGreaterThan(0)
  })

  it('同じ一覧の中で項目IDが重複しない（履歴の checkedItems のキーになる）', () => {
    for (const config of maintenanceChecklistConfig) {
      const lists = config.subcategories?.map(s => s.items) ?? [config.items ?? []]
      for (const items of lists) {
        const ids = items.map(i => i.id)
        expect(new Set(ids).size, config.categoryId).toBe(ids.length)
      }
    }
  })
})
