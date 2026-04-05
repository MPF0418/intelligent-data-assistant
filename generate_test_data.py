"""
生成测试数据
- XLSX文件
- 大CSV文件（用于分页测试）
- 多类型图表数据
- 大数据文件
"""
import os
import csv
import random
from datetime import datetime, timedelta
import sys

# 添加父目录到路径以便导入openpyxl
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TEST_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_data")
os.makedirs(TEST_DATA_DIR, exist_ok=True)

def generate_large_csv(filename, row_count=500):
    """生成大CSV文件用于分页测试"""
    headers = ["日期", "产品", "类别", "销售额", "数量", "客户", "地区", "渠道"]
    
    products = ["笔记本电脑", "手机", "平板", "显示器", "键盘", "鼠标", "耳机", "充电器"]
    categories = ["电子产品", "办公设备", "配件", "周边"]
    customers = [f"客户{i}" for i in range(1, 51)]
    regions = ["华北", "华东", "华南", "华中", "西南", "西北", "东北"]
    channels = ["线上", "线下", "分销", "代理"]
    
    start_date = datetime(2024, 1, 1)
    
    with open(os.path.join(TEST_DATA_DIR, filename), 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        for i in range(row_count):
            date = (start_date + timedelta(days=i % 365)).strftime('%Y-%m-%d')
            writer.writerow([
                date,
                random.choice(products),
                random.choice(categories),
                round(random.uniform(100, 50000), 2),
                random.randint(1, 100),
                random.choice(customers),
                random.choice(regions),
                random.choice(channels)
            ])
    
    print(f"✅ 生成大CSV文件: {filename} ({row_count}行)")

def generate_xlsx_file(filename):
    """生成XLSX测试文件"""
    try:
        import openpyxl
        from openpyxl import Workbook
        
        wb = Workbook()
        ws = wb.active
        ws.title = "销售数据"
        
        # 添加数据
        headers = ["日期", "产品", "类别", "销售额", "数量", "客户", "地区", "渠道"]
        ws.append(headers)
        
        products = ["笔记本电脑", "手机", "平板", "显示器", "键盘", "鼠标"]
        categories = ["电子产品", "办公设备", "配件", "周边"]
        customers = [f"客户{i}" for i in range(1, 21)]
        regions = ["华北", "华东", "华南", "华中", "西南"]
        channels = ["线上", "线下", "分销"]
        
        start_date = datetime(2024, 1, 1)
        
        for i in range(50):
            date = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
            ws.append([
                date,
                random.choice(products),
                random.choice(categories),
                round(random.uniform(100, 50000), 2),
                random.randint(1, 100),
                random.choice(customers),
                random.choice(regions),
                random.choice(channels)
            ])
        
        # 添加第二个工作表
        ws2 = wb.create_sheet("统计汇总")
        ws2.append(["指标", "数值", "备注"])
        ws2.append(["总销售额", 1250000, "2024年上半年"])
        ws2.append(["总订单数", 3500, ""])
        ws2.append(["客户数", 150, ""])
        ws2.append(["平均客单价", 357, ""])
        
        wb.save(os.path.join(TEST_DATA_DIR, filename))
        print(f"✅ 生成XLSX文件: {filename}")
        return True
        
    except ImportError:
        print("⚠️ openpyxl未安装，尝试用pandas生成XLSX...")
        try:
            import pandas as pd
            
            data = {
                "日期": [(datetime(2024, 1, 1) + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(50)],
                "产品": [random.choice(["笔记本电脑", "手机", "平板", "显示器"]) for _ in range(50)],
                "类别": [random.choice(["电子产品", "办公设备"]) for _ in range(50)],
                "销售额": [round(random.uniform(100, 50000), 2) for _ in range(50)],
                "数量": [random.randint(1, 100) for _ in range(50)],
                "客户": [f"客户{i % 20 + 1}" for i in range(50)],
                "地区": [random.choice(["华北", "华东", "华南"]) for _ in range(50)],
                "渠道": [random.choice(["线上", "线下"]) for _ in range(50)]
            }
            
            df = pd.DataFrame(data)
            xlsx_path = os.path.join(TEST_DATA_DIR, filename)
            df.to_excel(xlsx_path, index=False, sheet_name="销售数据")
            print(f"✅ 生成XLSX文件(使用pandas): {filename}")
            return True
            
        except ImportError:
            print("❌ 无法生成XLSX: 请安装 openpyxl 或 pandas")
            return False

def generate_chart_data_csv(filename):
    """生成适合各种图表的测试数据"""
    with open(os.path.join(TEST_DATA_DIR, filename), 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        # 柱状图数据 - 月度销售额
        writer.writerow(["月份", "销售额", "去年同期", "目标"])
        for month in range(1, 13):
            writer.writerow([
                f"2024-{month:02d}",
                random.randint(80000, 150000),
                random.randint(70000, 130000),
                120000
            ])
        
        # 饼图数据 - 产品类别占比
        writer.writerow([])  # 空行分隔
        writer.writerow(["类别", "销售额"])
        categories = [("手机", 350000), ("电脑", 420000), ("平板", 180000), ("配件", 150000), ("其他", 100000)]
        for cat, val in categories:
            writer.writerow([cat, val])
        
        # 折线图数据 - 趋势数据
        writer.writerow([])  # 空行分隔
        writer.writerow(["日期", "访问量", "订单量", "转化率"])
        start_date = datetime(2024, 1, 1)
        for i in range(30):
            date = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
            writer.writerow([
                date,
                random.randint(1000, 5000),
                random.randint(50, 300),
                round(random.uniform(2, 8), 2)
            ])
    
    print(f"✅ 生成图表测试数据: {filename}")

def generate_multi_sheet_csv(filename):
    """生成多sheet CSV（模拟多sheet）"""
    # CSV不支持多sheet，这里生成一个包含多部分数据的CSV
    with open(os.path.join(TEST_DATA_DIR, filename), 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        # 第一部分：Sheet1数据
        writer.writerow(["=== Sheet1: 销售明细 ==="])
        writer.writerow(["日期", "产品", "销售额"])
        start_date = datetime(2024, 1, 1)
        for i in range(30):
            writer.writerow([
                (start_date + timedelta(days=i)).strftime('%Y-%m-%d'),
                random.choice(["产品A", "产品B", "产品C"]),
                round(random.uniform(100, 5000), 2)
            ])
        
        # 第二部分：Sheet2数据
        writer.writerow([])
        writer.writerow(["=== Sheet2: 月度汇总 ==="])
        writer.writerow(["月份", "销售额", "订单数"])
        for month in range(1, 7):
            writer.writerow([
                f"2024-{month:02d}",
                random.randint(100000, 500000),
                random.randint(500, 2000)
            ])
    
    print(f"✅ 生成多数据CSV: {filename}")

def generate_large_file_for_upload(filename, size_mb=5):
    """生成大文件用于测试上传限制"""
    row_count = int(size_mb * 1024 * 1024 / 100)  # 估算每行约100字节
    
    with open(os.path.join(TEST_DATA_DIR, filename), 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["序号", "数据", "内容"])
        
        for i in range(row_count):
            writer.writerow([
                i + 1,
                f"数据项_{i}",
                "X" * 80  # 每行约100字节
            ])
    
    print(f"✅ 生成大文件: {filename} ({size_mb}MB, {row_count}行)")

def main():
    print("=" * 50)
    print("生成测试数据")
    print("=" * 50)
    
    # 1. XLSX文件
    generate_xlsx_file("sales_data.xlsx")
    
    # 2. 大CSV文件（用于分页测试 - 500行）
    generate_large_csv("large_data.csv", 500)
    
    # 3. 图表测试数据
    generate_chart_data_csv("chart_test_data.csv")
    
    # 4. 多数据CSV
    generate_multi_sheet_csv("multi_sheet_data.csv")
    
    # 5. 大文件（5MB，用于测试上传限制）
    generate_large_file_for_upload("large_file_5mb.csv", 5)
    
    # 6. 中等大小文件（1000行）
    generate_large_csv("medium_data.csv", 1000)
    
    print("\n" + "=" * 50)
    print("测试数据生成完成！")
    print("=" * 50)
    print(f"\n生成的文件列表:")
    for f in os.listdir(TEST_DATA_DIR):
        size = os.path.getsize(os.path.join(TEST_DATA_DIR, f))
        print(f"  - {f} ({size/1024:.1f} KB)")

if __name__ == "__main__":
    # 修复Windows编码问题
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()
