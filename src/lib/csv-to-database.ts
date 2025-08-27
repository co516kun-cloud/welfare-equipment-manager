import { parseStatus, parseCondition } from './japanese-parser'
import { supabaseDb } from './supabase-database'
import type { ProductCategory, Product, ProductItem, User } from '../types'

// CSVデータをパースする関数（カンマ区切りとタブ区切り両方に対応）
function parseCSVLine(line: string): string[] {
  // タブ区切りかカンマ区切りかを判定
  const hasTab = line.includes('\t')
  const hasComma = line.includes(',')
  
  // タブ区切りの場合
  if (hasTab && !hasComma) {
    return line.split('\t').map(field => field.trim())
  }
  
  // カンマ区切りの場合（従来の処理）
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

// Categories.csvからカテゴリデータを作成
export function processCategories(csvData: string): ProductCategory[] {
  const lines = csvData.split('\n').filter(line => line.trim())
  const categories: ProductCategory[] = []
  
  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length >= 2 && fields[0] && fields[1]) {
      const id = fields[0].replace(/^\uFEFF/, '') // BOM除去
      const name = fields[1]
      
      // アイコンマッピング
      const iconMap: Record<string, string> = {
        'beds': '🛏️',
        'bedsaccessory': '🔧',
        'mattress': '🛏️',
        'wheelchair': '🦽',
        'walker': '🚶',
        'cane': '🦯',
        'handrail': '🤚',
        'handrailaccessory': '🔧',
        'slope': '📐'
      }
      
      categories.push({
        id,
        name,
        description: `${name}関連商品`,
        icon: iconMap[id] || '📦'
      })
    }
  }
  
  return categories
}

// Products.csvから商品データを作成
export function processProducts(csvData: string): Product[] {
  const lines = csvData.split('\n').filter(line => line.trim())
  const products: Product[] = []
  
  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length >= 4 && fields[0] && fields[1]) {
      const id = fields[0].replace(/^\uFEFF/, '') // BOM除去
      const name = fields[1]
      const categoryId = fields[2] || 'other'
      const manufacturer = fields[3] || '不明'
      
      products.push({
        id,
        name,
        category_id: categoryId,
        description: `${manufacturer}製 ${name}`,
        manufacturer,
        model: name // モデル名として商品名を使用
      })
    }
  }
  
  return products
}

// ProductItems.csvから商品アイテムデータを作成
export function processProductItems(csvData: string): ProductItem[] {
  const lines = csvData.split('\n').filter(line => line.trim())
  const productItems: ProductItem[] = []
  
  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length >= 3 && fields[0] && fields[1]) {
      const id = fields[0].replace(/^\uFEFF/, '') // BOM除去
      const productId = fields[1]
      const statusText = fields[2] || '不明'
      const conditionText = fields[3] || '不明'
      const location = fields[4] || '不明'
      const customerName = fields[5] || undefined
      const loanStartDate = fields[6] || undefined
      
      // 日本語ステータスを英語に変換
      const statusResult = parseStatus(statusText)
      const conditionResult = parseCondition(conditionText)
      
      // ステータスマッピング（独自の値に対応）
      let status: ProductItem['status'] = 'unknown'
      if (statusResult.status) {
        status = statusResult.status
      } else {
        // 独自ステータスの変換
        switch (statusText) {
          case '倉庫':
            status = 'available'
            break
          case '廃棄':
            status = 'out_of_order'
            break
          default:
            status = 'unknown'
        }
      }
      
      let condition: ProductItem['condition'] = 'unknown'
      if (conditionResult.condition) {
        condition = conditionResult.condition
      }
      
      // 場所の処理（ステータスに応じて）
      let finalLocation = location
      if (status === 'rented' && customerName) {
        finalLocation = '顧客先'
      } else if (status === 'available') {
        finalLocation = location || '倉庫'
      } else {
        finalLocation = '-'
      }
      
      // 貸与開始日の正規化
      let normalizedLoanStartDate: string | undefined
      if (loanStartDate && loanStartDate.trim()) {
        try {
          const date = new Date(loanStartDate.replace(/\//g, '-'))
          if (!isNaN(date.getTime())) {
            normalizedLoanStartDate = date.toISOString().split('T')[0]
          }
        } catch (e) {
          console.warn(`Invalid date format: ${loanStartDate}`)
        }
      }
      
      productItems.push({
        id,
        product_id: productId,
        status,
        condition,
        location: finalLocation,
        qr_code: id, // 管理番号をQRコードとして使用
        customer_name: customerName && customerName.trim() ? customerName.trim() : undefined,
        loan_start_date: normalizedLoanStartDate,
        notes: undefined
      })
    }
  }
  
  return productItems
}

// Users.csvからユーザーデータを作成
export function processUsers(csvData: string): User[] {
  const lines = csvData.split('\n').filter(line => line.trim())
  const users: User[] = []
  
  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length >= 5 && fields[0] && fields[1]) {
      const id = fields[0].replace(/^\uFEFF/, '').trim() // BOM除去
      const name = fields[1].trim()
      const email = fields[2].trim()
      const role = fields[3].trim().toLowerCase() as 'admin' | 'staff' | 'manager'
      const department = fields[4].trim()
      
      users.push({
        id,
        name,
        email,
        role: ['admin', 'staff', 'manager'].includes(role) ? role : 'staff',
        department
      })
    }
  }
  
  return users
}

// すべてのCSVデータを処理してデータベースに保存
export async function importAllCSVData(csvFiles: {
  categories: string
  products: string
  productItems: string
  users: string
}): Promise<{
  success: boolean
  message: string
  errors: string[]
  warnings: string[]
  imported: {
    categories: number
    products: number
    productItems: number
    users: number
  }
}> {
  console.log('Starting CSV import with data:', {
    categoriesLength: csvFiles.categories.length,
    productsLength: csvFiles.products.length,
    productItemsLength: csvFiles.productItems.length,
    usersLength: csvFiles.users.length
  })
  
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    // 既存データをクリア
    await supabaseDb.clearAllData()
    
    // カテゴリをインポート
    const categories = processCategories(csvFiles.categories)
    for (const category of categories) {
      await supabaseDb.saveCategory(category)
    }
    console.log('Categories imported:', categories.length)
    
    // 商品をインポート
    const products = processProducts(csvFiles.products)
    for (const product of products) {
      await supabaseDb.saveProduct(product)
    }
    console.log('Products imported:', products.length)
    
    // 商品アイテムをインポート
    const productItems = processProductItems(csvFiles.productItems)
    for (const item of productItems) {
      await supabaseDb.saveProductItem(item)
    }
    console.log('Product items imported:', productItems.length)
    
    // ユーザーをインポート
    const users = processUsers(csvFiles.users)
    for (const user of users) {
      await supabaseDb.saveUser(user)
    }
    console.log('Users imported:', users.length)
    
    return {
      success: true,
      message: `インポートが完了しました`,
      errors,
      warnings,
      imported: {
        categories: categories.length,
        products: products.length,
        productItems: productItems.length,
        users: users.length
      }
    }
  } catch (error: any) {
    console.error('Import error:', error)
    return {
      success: false,
      message: `インポート中にエラーが発生しました: ${error.message}`,
      errors: [error.message],
      warnings,
      imported: {
        categories: 0,
        products: 0,
        productItems: 0,
        users: 0
      }
    }
  }
}