#!/usr/bin/env python3
# Excel file reader and converter

import os
import sys

def check_file_exists(filepath):
    """Check if file exists"""
    return os.path.exists(filepath)

def try_read_excel():
    """Try to read Excel files with different methods"""
    excel_files = {
        'Categories': '/mnt/c/Users/taguchi/Desktop/DB/Categories.xlsx',
        'Products': '/mnt/c/Users/taguchi/Desktop/DB/Products.xlsx', 
        'ProductItems': '/mnt/c/Users/taguchi/Desktop/DB/ProductItems.xlsx',
        'Users': '/mnt/c/Users/taguchi/Desktop/DB/Users.xlsx'
    }
    
    print("Excel File Analysis")
    print("=" * 50)
    
    for name, filepath in excel_files.items():
        print(f"\n{name}:")
        print(f"  Path: {filepath}")
        print(f"  Exists: {check_file_exists(filepath)}")
        
        if check_file_exists(filepath):
            # Get file size
            try:
                size = os.path.getsize(filepath)
                print(f"  Size: {size} bytes")
            except:
                print("  Size: Could not determine")
        else:
            print("  Status: File not found")
    
    # Try to import pandas and openpyxl
    print("\n" + "=" * 50)
    print("Python Library Availability:")
    
    try:
        import pandas as pd
        print("✓ pandas available")
        
        # Try to read one of the files
        categories_path = '/mnt/c/Users/taguchi/Desktop/DB/Categories.xlsx'
        if check_file_exists(categories_path):
            try:
                df = pd.read_excel(categories_path)
                print("✓ Successfully read Categories.xlsx")
                print("  Columns:", list(df.columns))
                print("  Shape:", df.shape)
                print("  Preview:")
                print(df.head().to_string())
                return df
            except Exception as e:
                print(f"✗ Error reading Excel: {e}")
    except ImportError:
        print("✗ pandas not available")
    
    try:
        import openpyxl
        print("✓ openpyxl available")
    except ImportError:
        print("✗ openpyxl not available")
    
    return None

if __name__ == "__main__":
    result = try_read_excel()
    if result is None:
        print("\nTo install required libraries:")
        print("pip install pandas openpyxl")