# -*- coding: utf-8 -*-
"""检查CSV文件的列名"""

import pandas as pd

# 尝试不同编码
encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030']

for enc in encodings:
    try:
        df = pd.read_csv('24年3季度事件.csv', encoding=enc, nrows=1)
        print(f"\n编码: {enc}")
        print(f"列名 ({len(df.columns)} 个):")
        for i, col in enumerate(df.columns):
            print(f"  {i+1}. {col}")
        break
    except Exception as e:
        print(f"编码 {enc} 失败: {e}")
