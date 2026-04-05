# -*- coding: utf-8 -*-
"""测试导入"""

print("测试导入 requirement_inference...")
try:
    from requirement_inference import get_requirement_classifier
    print("导入成功")
    
    print("\n初始化分类器...")
    clf = get_requirement_classifier()
    print("分类器初始化完成")
    
    print("\n测试预测...")
    result = clf.predict("今天下雨了没")
    print(f"结果: {result}")
    
except Exception as e:
    import traceback
    print(f"错误: {e}")
    traceback.print_exc()
