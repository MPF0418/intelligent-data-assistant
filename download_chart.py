import urllib.request
import os

url = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
output_path = "e:\\开发项目\\20260226\\js\\chart.min.js"

print(f"正在下载 Chart.js...")
print(f"来源: {url}")
print(f"目标: {output_path}")

try:
    # 下载文件
    urllib.request.urlretrieve(url, output_path)
    
    # 检查文件大小
    file_size = os.path.getsize(output_path)
    print(f"下载完成！文件大小: {file_size} 字节")
    
    # 读取前100个字符和后100个字符验证完整性
    with open(output_path, 'r', encoding='utf-8') as f:
        content = f.read()
        print(f"文件总字符数: {len(content)}")
        print(f"文件开头: {content[:100]}")
        print(f"文件结尾: {content[-100:]}")
        
        # 检查文件是否以正确的字符结尾
        if content.strip().endswith('}'):
            print("✓ 文件完整性检查通过")
        else:
            print("✗ 文件可能不完整")
            
except Exception as e:
    print(f"下载失败: {e}")
