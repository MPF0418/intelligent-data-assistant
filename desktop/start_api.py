# -*- coding: utf-8 -*-
"""启动API服务 - 确保加载最新代码"""

import importlib
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 清理缓存
for mod_name in list(sys.modules.keys()):
    if 'intent_api' in mod_name or 'requirement_inference' in mod_name:
        del sys.modules[mod_name]

print("Python路径:", sys.executable)
print("\n导入模块...")

# 重新导入
import intent_api

print("\n检查路由...")
routes = list(intent_api.app.url_map.iter_rules())
print(f"共 {len(routes)} 个路由")
for rule in routes:
    if 'classify' in rule.rule or 'generate' in rule.rule:
        print(f"  找到: {rule.rule}")

print("\n启动服务...")
print("API地址: http://localhost:5001")
print("按 Ctrl+C 停止服务")
print("=" * 60)

intent_api.app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
