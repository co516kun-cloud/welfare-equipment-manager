# Excel Import Setup Guide

## Installation

1. Install the xlsx library:
```bash
npm install xlsx
```

2. The application should now support Excel import functionality.

## Features

### 1. Excel Import Functionality
- **File Path**: `/src/lib/excel-import.ts`
- **Page**: `/src/pages/import.tsx`
- **Route**: `/import`

### 2. Supported Import Methods
- **Individual Files**: Separate Excel files for each data type
- **Single File**: One Excel file with multiple sheets

### 3. Japanese Input Support
- Automatic parsing of Japanese status and condition values
- Supports hiragana, katakana, kanji, and mixed input
- Fuzzy matching with confidence scoring

### 4. File Structure

#### Categories.xlsx
```
| ID          | name   |
|-------------|--------|
| wheelchairs | 車椅子 |
| beds        | ベッド |
```

#### Products.xlsx
```
| ID     | name       | categoryId  | description    | manufacturer      | model      |
|--------|------------|-------------|----------------|-------------------|------------|
| wc-001 | 標準車椅子 | wheelchairs | 軽量アルミ製   | カワムラサイクル  | KV22-40SB  |
```

#### ProductItems.xlsx
```
| ID     | productId | status   | condition | location | qrCode    | customerName | loanStartDate |
|--------|-----------|----------|-----------|----------|-----------|--------------|---------------|
| WC-001 | wc-001    | 利用可能 | 優良      | 倉庫A-1  | QR-WC-001 |              |               |
| WC-002 | wc-001    | 貸与中   | 良好      | 倉庫A-1  | QR-WC-002 | 田中太郎様   | 2024-01-15    |
```

#### Users.xlsx
```
| ID       | name     | email                 | role  | department |
|----------|----------|-----------------------|-------|------------|
| user-001 | 田中太郎 | tanaka@example.com    | admin | 管理部     |
```

### 5. Japanese Status Values

#### Status (ステータス)
- **利用可能**: 利用可能, 利用可, 使用可能, 使用可, 空き, あき, アキ, 可能
- **貸与中**: 貸与中, 貸出中, レンタル中, 貸し出し中, かしだし中, カシダシ中, 出荷中, 配送中
- **返却済み**: 返却済み, 返却済, 返済済み, 返済済, へんきゃく済み, ヘンキャク済み, 戻り
- **消毒済み**: 消毒済み, 消毒済, しょうどく済み, ショウドク済み, 清掃済み, せいそう済み, クリーニング済み
- **メンテナンス済み**: メンテナンス済み, メンテ済み, めんて済み, メンテ, 点検済み, てんけん済み, 修理済み, しゅうり済み
- **デモキャンセル**: デモキャンセル, でもきゃんせる, デモ中止, でも中止, 試用中止, しよう中止
- **故障中**: 故障中, こしょう中, コショウ中, 故障, 破損, はそん, ハソン, 不具合, ふぐあい
- **不明**: 不明, ふめい, フメイ, わからない, 分からない, ？, 不明確, ふめいかく

#### Condition (状態)
- **優良**: 優良, ゆうりょう, ユウリョウ, 優, とても良い, 最高, さいこう
- **良好**: 良好, りょうこう, リョウコウ, 良い, よい, ヨイ, 普通より良い
- **普通**: 普通, ふつう, フツウ, まあまあ, そこそこ, 標準, ひょうじゅん
- **要修理**: 要修理, ようしゅうり, 修理必要, しゅうり必要, 要メンテ, 直す必要, なおす必要
- **不明**: 不明, ふめい, フメイ, わからない, 分からない, ？, 確認中, かくにん中

### 6. Usage Instructions

1. Navigate to `/import` in the application
2. Choose import method:
   - **Individual Files**: Upload separate Excel files for each data type
   - **Single File**: Upload one Excel file with multiple sheets
3. Configure import options:
   - **Clear Existing Data**: Remove all existing data before import
   - **Skip Duplicates**: Skip records that already exist
4. Click "検証のみ" to validate without importing
5. Click "インポート実行" to perform the actual import

### 7. Error Handling

- **Validation**: Pre-import validation with detailed error messages
- **Japanese Parsing**: Confidence scoring for Japanese input recognition
- **Progress Tracking**: Real-time feedback on import progress
- **Error Recovery**: Detailed error messages with line numbers

### 8. Navigation

The import feature is accessible from:
- **Sidebar**: "データ取込" menu item
- **Direct URL**: `http://localhost:5173/import`

### 9. Testing

To test the import functionality:
1. Create Excel files with the structure above
2. Use various Japanese input formats for status and condition
3. Test both individual files and single file methods
4. Verify error handling with invalid data

### 10. Dependencies

- `xlsx`: ^0.18.5 (for Excel file parsing)
- Existing Japanese parser: `/src/lib/japanese-parser.ts`
- Database integration: `/src/lib/database.ts`

The Excel import feature is now fully integrated into the application and ready for use.