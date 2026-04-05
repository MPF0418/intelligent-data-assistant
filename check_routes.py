# -*- coding: utf-8 -*-
"""检查intent_api模块的路由"""

import intent_api

print("=" * 60)
print("Flask应用路由列表")
print("=" * 60)

# 获取所有路由
for rule in intent_api.app.url_map.iter_rules():
    print(f"{rule.methods} {rule.rule} -> {rule.endpoint}")

print("\n" + "=" * 60)
print("检查classify-requirement路由")
print("=" * 60)

# 检查是否有classify-requirement路由
has_classify = any('classify-requirement' in rule.rule for rule in intent_api.app.url_map.iter_rules())
print(f"包含 classify-requirement 路由: {has_classify}")
