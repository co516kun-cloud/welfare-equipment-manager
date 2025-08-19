// Excel data to database converter
// This script will be used to convert Excel files to database format

const fs = require('fs');
const path = require('path');

// Excel file paths
const excelFiles = {
  categories: '/mnt/c/Users/taguchi/Desktop/DB/Categories.xlsx',
  products: '/mnt/c/Users/taguchi/Desktop/DB/Products.xlsx',
  productItems: '/mnt/c/Users/taguchi/Desktop/DB/ProductItems.xlsx',
  users: '/mnt/c/Users/taguchi/Desktop/DB/Users.xlsx'
};

// Database structure templates
const templates = {
  categories: [
    { id: 'wheelchairs', name: '車椅子', description: '手動・電動車椅子', icon: '🦽' },
    { id: 'beds', name: 'ベッド', description: '介護用ベッド', icon: '🛏️' },
    { id: 'walkers', name: '歩行器', description: '歩行補助器具', icon: '🚶' },
    { id: 'toilet', name: 'トイレ用品', description: 'ポータブルトイレ等', icon: '🚽' },
    { id: 'bath', name: '入浴用品', description: 'シャワーチェア等', icon: '🛁' }
  ],
  
  products: [
    { id: 'wc-001', name: '標準車椅子', categoryId: 'wheelchairs', description: '軽量アルミ製標準車椅子', manufacturer: 'カワムラサイクル', model: 'KV22-40SB' },
    { id: 'wc-002', name: '電動車椅子', categoryId: 'wheelchairs', description: '軽量電動車椅子', manufacturer: 'ヤマハ', model: 'JWX-1' },
    { id: 'bd-001', name: '介護用ベッド', categoryId: 'beds', description: '3モーター電動ベッド', manufacturer: 'パラマウントベッド', model: 'インタイム1000' },
    { id: 'wk-001', name: '歩行器', categoryId: 'walkers', description: '固定式歩行器', manufacturer: '星光医療器', model: 'アルコー1S' }
  ],
  
  productItems: [
    { id: 'WC-001', productId: 'wc-001', status: 'available', condition: 'excellent', location: '倉庫A-1', qrCode: 'WC-001' },
    { id: 'WC-002', productId: 'wc-001', status: 'rented', condition: 'good', location: '倉庫A-1', customerName: '田中太郎様', loanStartDate: '2024-01-15', qrCode: 'WC-002' },
    { id: 'WC-003', productId: 'wc-002', status: 'maintenance', condition: 'fair', location: 'メンテナンス室', qrCode: 'WC-003' },
    { id: 'BD-001', productId: 'bd-001', status: 'available', condition: 'excellent', location: '倉庫B-1', qrCode: 'BD-001' },
    { id: 'WK-001', productId: 'wk-001', status: 'cleaning', condition: 'good', location: '清掃室', qrCode: 'WK-001' }
  ],
  
  users: [
    { id: 'user-001', name: '田中太郎', email: 'tanaka@example.com', role: 'admin', department: '管理部' },
    { id: 'user-002', name: '佐藤花子', email: 'sato@example.com', role: 'staff', department: '営業部' },
    { id: 'user-003', name: '鈴木次郎', email: 'suzuki@example.com', role: 'staff', department: 'メンテナンス部' }
  ]
};

console.log('Excel to Database Converter');
console.log('============================');
console.log('Ready to process Excel files:');
Object.keys(excelFiles).forEach(key => {
  console.log(`- ${key}: ${excelFiles[key]}`);
});
console.log('');
console.log('Template data structures prepared.');
console.log('Use this script to convert Excel data to database format.');

// Export for use in other modules
if (typeof module !== 'undefined') {
  module.exports = { excelFiles, templates };
}