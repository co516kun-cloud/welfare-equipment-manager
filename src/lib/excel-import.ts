import * as XLSX from 'xlsx'

import { parseStatus, parseCondition } from './japanese-parser'
import { db } from './database'
import type { ProductCategory, Product, ProductItem, User } from '../types'

export interface ImportResult {
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
}

export interface ImportOptions {
  clearExistingData?: boolean
  skipDuplicates?: boolean
  validateOnly?: boolean
}

// Excel読み込みの基本関数
function readExcelFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        resolve(workbook)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsBinaryString(file)
  })
}

// シートをJSONに変換
function sheetToJson(sheet: XLSX.WorkSheet): any[] {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false
  })
}

// カテゴリデータの処理
function processCategoriesData(data: any[]): { categories: ProductCategory[], errors: string[] } {
  const categories: ProductCategory[] = []
  const errors: string[] = []
  
  if (data.length < 2) {
    errors.push('カテゴリデータが不十分です（ヘッダー行 + 最低1行のデータが必要）')
    return { categories, errors }
  }
  
  const headers = data[0]
  const expectedHeaders = ['ID', 'name']
  
  // ヘッダーの検証
  for (const header of expectedHeaders) {
    if (!headers.includes(header)) {
      errors.push(`カテゴリファイルに必須列「${header}」がありません`)
    }
  }
  
  if (errors.length > 0) {
    return { categories, errors }
  }
  
  // データ行の処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const id = row[headers.indexOf('ID')]
    const name = row[headers.indexOf('name')]
    
    if (!id || !name) {
      errors.push(`行${i + 1}: IDまたはnameが空です`)
      continue
    }
    
    categories.push({
      id: id.toString(),
      name: name.toString(),
      description: '', // Excelにはないのでデフォルト値
      icon: '📦' // デフォルトアイコン
    })
  }
  
  return { categories, errors }
}

// 商品データの処理
function processProductsData(data: any[]): { products: Product[], errors: string[] } {
  const products: Product[] = []
  const errors: string[] = []
  
  if (data.length < 2) {
    errors.push('商品データが不十分です（ヘッダー行 + 最低1行のデータが必要）')
    return { products, errors }
  }
  
  const headers = data[0]
  const expectedHeaders = ['ID', 'name', 'categoryId', 'description', 'manufacturer', 'model']
  
  // ヘッダーの検証
  for (const header of expectedHeaders) {
    if (!headers.includes(header)) {
      errors.push(`商品ファイルに必須列「${header}」がありません`)
    }
  }
  
  if (errors.length > 0) {
    return { products, errors }
  }
  
  // データ行の処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const id = row[headers.indexOf('ID')]
    const name = row[headers.indexOf('name')]
    const categoryId = row[headers.indexOf('categoryId')]
    const description = row[headers.indexOf('description')]
    const manufacturer = row[headers.indexOf('manufacturer')]
    const model = row[headers.indexOf('model')]
    
    if (!id || !name || !categoryId) {
      errors.push(`行${i + 1}: ID、name、またはcategoryIdが空です`)
      continue
    }
    
    products.push({
      id: id.toString(),
      name: name.toString(),
      categoryId: categoryId.toString(),
      description: description?.toString() || '',
      manufacturer: manufacturer?.toString() || '',
      model: model?.toString() || ''
    })
  }
  
  return { products, errors }
}

// 商品アイテムデータの処理
function processProductItemsData(data: any[]): { productItems: ProductItem[], errors: string[], warnings: string[] } {
  const productItems: ProductItem[] = []
  const errors: string[] = []
  const warnings: string[] = []
  
  if (data.length < 2) {
    errors.push('商品アイテムデータが不十分です（ヘッダー行 + 最低1行のデータが必要）')
    return { productItems, errors, warnings }
  }
  
  const headers = data[0]
  const expectedHeaders = ['ID', 'productId', 'status', 'condition', 'location', 'qrCode']
  
  // ヘッダーの検証
  for (const header of expectedHeaders) {
    if (!headers.includes(header)) {
      errors.push(`商品アイテムファイルに必須列「${header}」がありません`)
    }
  }
  
  if (errors.length > 0) {
    return { productItems, errors, warnings }
  }
  
  // データ行の処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const id = row[headers.indexOf('ID')]
    const productId = row[headers.indexOf('productId')]
    const statusInput = row[headers.indexOf('status')]
    const conditionInput = row[headers.indexOf('condition')]
    const location = row[headers.indexOf('location')]
    const qrCode = row[headers.indexOf('qrCode')]
    const customerName = row[headers.indexOf('customerName')]
    const loanStartDate = row[headers.indexOf('loanStartDate')]
    
    if (!id || !productId || !statusInput || !conditionInput || !location || !qrCode) {
      errors.push(`行${i + 1}: 必須項目が空です`)
      continue
    }
    
    // 日本語パーサーでステータスを解析
    const statusResult = parseStatus(statusInput.toString())
    if (!statusResult.status) {
      errors.push(`行${i + 1}: ステータス「${statusInput}」を解析できませんでした`)
      continue
    }
    
    // 信頼度が低い場合は警告
    if (statusResult.confidence < 0.8) {
      warnings.push(`行${i + 1}: ステータス「${statusInput}」の解析信頼度が低いです（${Math.round(statusResult.confidence * 100)}%）`)
    }
    
    // 日本語パーサーで状態を解析
    const conditionResult = parseCondition(conditionInput.toString())
    if (!conditionResult.condition) {
      errors.push(`行${i + 1}: 状態「${conditionInput}」を解析できませんでした`)
      continue
    }
    
    // 信頼度が低い場合は警告
    if (conditionResult.confidence < 0.8) {
      warnings.push(`行${i + 1}: 状態「${conditionInput}」の解析信頼度が低いです（${Math.round(conditionResult.confidence * 100)}%）`)
    }
    
    const item: ProductItem = {
      id: id.toString(),
      productId: productId.toString(),
      status: statusResult.status,
      condition: conditionResult.condition,
      location: location.toString(),
      qrCode: qrCode.toString(),
      customerName: customerName?.toString() || undefined,
      loanStartDate: loanStartDate?.toString() || undefined
    }
    
    productItems.push(item)
  }
  
  return { productItems, errors, warnings }
}

// ユーザーデータの処理
function processUsersData(data: any[]): { users: User[], errors: string[] } {
  const users: User[] = []
  const errors: string[] = []
  
  if (data.length < 2) {
    errors.push('ユーザーデータが不十分です（ヘッダー行 + 最低1行のデータが必要）')
    return { users, errors }
  }
  
  const headers = data[0]
  const expectedHeaders = ['ID', 'name', 'email', 'role', 'department']
  
  // ヘッダーの検証
  for (const header of expectedHeaders) {
    if (!headers.includes(header)) {
      errors.push(`ユーザーファイルに必須列「${header}」がありません`)
    }
  }
  
  if (errors.length > 0) {
    return { users, errors }
  }
  
  // データ行の処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const id = row[headers.indexOf('ID')]
    const name = row[headers.indexOf('name')]
    const email = row[headers.indexOf('email')]
    const role = row[headers.indexOf('role')]
    const department = row[headers.indexOf('department')]
    
    if (!id || !name || !email || !role || !department) {
      errors.push(`行${i + 1}: 必須項目が空です`)
      continue
    }
    
    const roleValue = role.toString().toLowerCase()
    if (!['admin', 'staff', 'manager'].includes(roleValue)) {
      errors.push(`行${i + 1}: 無効なロール「${role}」です（admin, staff, managerのいずれかを指定してください）`)
      continue
    }
    
    users.push({
      id: id.toString(),
      name: name.toString(),
      email: email.toString(),
      role: roleValue as 'admin' | 'staff' | 'manager',
      department: department.toString()
    })
  }
  
  return { users, errors }
}

// Excelファイルから複数のシートを読み込む
export async function importFromExcelFiles(
  files: {
    categories?: File
    products?: File
    productItems?: File
    users?: File
  },
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    message: '',
    errors: [],
    warnings: [],
    imported: {
      categories: 0,
      products: 0,
      productItems: 0,
      users: 0
    }
  }
  
  try {
    let allCategories: ProductCategory[] = []
    let allProducts: Product[] = []
    let allProductItems: ProductItem[] = []
    let allUsers: User[] = []
    
    // カテゴリファイルの処理
    if (files.categories) {
      const workbook = await readExcelFile(files.categories)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = sheetToJson(sheet)
      
      const { categories, errors } = processCategoriesData(data)
      allCategories = categories
      result.errors.push(...errors)
      result.imported.categories = categories.length
    }
    
    // 商品ファイルの処理
    if (files.products) {
      const workbook = await readExcelFile(files.products)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = sheetToJson(sheet)
      
      const { products, errors } = processProductsData(data)
      allProducts = products
      result.errors.push(...errors)
      result.imported.products = products.length
    }
    
    // 商品アイテムファイルの処理
    if (files.productItems) {
      const workbook = await readExcelFile(files.productItems)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = sheetToJson(sheet)
      
      const { productItems, errors, warnings } = processProductItemsData(data)
      allProductItems = productItems
      result.errors.push(...errors)
      result.warnings.push(...warnings)
      result.imported.productItems = productItems.length
    }
    
    // ユーザーファイルの処理
    if (files.users) {
      const workbook = await readExcelFile(files.users)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = sheetToJson(sheet)
      
      const { users, errors } = processUsersData(data)
      allUsers = users
      result.errors.push(...errors)
      result.imported.users = users.length
    }
    
    // エラーがある場合はインポートを中止
    if (result.errors.length > 0) {
      result.success = false
      result.message = `インポートエラーが発生しました: ${result.errors.length}件のエラー`
      return result
    }
    
    // 検証のみモード
    if (options.validateOnly) {
      result.success = true
      result.message = '検証が完了しました。エラーはありません。'
      return result
    }
    
    // 既存データをクリア
    if (options.clearExistingData) {
      db.clearAllData()
    }
    
    // データベースに保存
    allCategories.forEach(category => db.saveCategory(category))
    allProducts.forEach(product => db.saveProduct(product))
    allProductItems.forEach(item => db.saveProductItem(item))
    allUsers.forEach(user => db.saveUser(user))
    
    result.success = true
    result.message = `インポートが完了しました。カテゴリ: ${result.imported.categories}件, 商品: ${result.imported.products}件, 商品アイテム: ${result.imported.productItems}件, ユーザー: ${result.imported.users}件`
    
    return result
    
  } catch (error) {
    result.success = false
    result.message = `インポート中にエラーが発生しました: ${error.message}`
    result.errors.push(error.message)
    return result
  }
}

// 単一のExcelファイルから複数シートを読み込む
export async function importFromSingleExcelFile(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    message: '',
    errors: [],
    warnings: [],
    imported: {
      categories: 0,
      products: 0,
      productItems: 0,
      users: 0
    }
  }
  
  try {
    const workbook = await readExcelFile(file)
    const files: { [key: string]: File } = {}
    
    // 各シートを仮想的なファイルとして処理
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = sheetToJson(sheet)
      
      // シート名でファイルタイプを判定
      const lowerSheetName = sheetName.toLowerCase()
      if (lowerSheetName.includes('categor') || lowerSheetName.includes('カテゴリ')) {
        // カテゴリシートの処理
        const { categories, errors } = processCategoriesData(data)
        result.errors.push(...errors)
        result.imported.categories = categories.length
        if (!options.validateOnly && errors.length === 0) {
          categories.forEach(category => db.saveCategory(category))
        }
      } else if (lowerSheetName.includes('product') && !lowerSheetName.includes('item') || lowerSheetName.includes('商品') && !lowerSheetName.includes('アイテム')) {
        // 商品シートの処理
        const { products, errors } = processProductsData(data)
        result.errors.push(...errors)
        result.imported.products = products.length
        if (!options.validateOnly && errors.length === 0) {
          products.forEach(product => db.saveProduct(product))
        }
      } else if (lowerSheetName.includes('item') || lowerSheetName.includes('アイテム')) {
        // 商品アイテムシートの処理
        const { productItems, errors, warnings } = processProductItemsData(data)
        result.errors.push(...errors)
        result.warnings.push(...warnings)
        result.imported.productItems = productItems.length
        if (!options.validateOnly && errors.length === 0) {
          productItems.forEach(item => db.saveProductItem(item))
        }
      } else if (lowerSheetName.includes('user') || lowerSheetName.includes('ユーザー')) {
        // ユーザーシートの処理
        const { users, errors } = processUsersData(data)
        result.errors.push(...errors)
        result.imported.users = users.length
        if (!options.validateOnly && errors.length === 0) {
          users.forEach(user => db.saveUser(user))
        }
      }
    }
    
    // エラーがある場合
    if (result.errors.length > 0) {
      result.success = false
      result.message = `インポートエラーが発生しました: ${result.errors.length}件のエラー`
      return result
    }
    
    // 検証のみモード
    if (options.validateOnly) {
      result.success = true
      result.message = '検証が完了しました。エラーはありません。'
      return result
    }
    
    // 既存データをクリア
    if (options.clearExistingData) {
      db.clearAllData()
    }
    
    result.success = true
    result.message = `インポートが完了しました。カテゴリ: ${result.imported.categories}件, 商品: ${result.imported.products}件, 商品アイテム: ${result.imported.productItems}件, ユーザー: ${result.imported.users}件`
    
    return result
    
  } catch (error) {
    result.success = false
    result.message = `インポート中にエラーが発生しました: ${error.message}`
    result.errors.push(error.message)
    return result
  }
}