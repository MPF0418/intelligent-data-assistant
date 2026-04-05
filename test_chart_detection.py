# 测试图表检测功能

import re

def detect_chart_requirements(text, columns, original_input, existing_configs):
    """
    检测图表需求并生成图表配置
    产品意义：识别用户绘图需求（如"绘制柱状图"、"显示饼图"）
    """
    # 图表类型关键词
    chart_patterns = {
        'bar': ['柱状图', '条形图', '柱形图', 'bar', 'histogram'],
        'line': ['折线图', '曲线图', '趋势图', 'line', '趋势线'],
        'pie': ['饼图', '饼状图', '环形图', 'pie', '占比'],
        'scatter': ['散点图', 'scatter', '分布图'],
        'area': ['面积图', 'area', '区域图']
    }
    
    # 检测图表类型
    chart_type = None
    for ctype, keywords in chart_patterns.items():
        for keyword in keywords:
            if keyword in text:
                chart_type = ctype
                print(f"检测到图表类型: {ctype}, 关键词: {keyword}")
                break
        if chart_type:
            break
    
    # 如果没有检测到图表关键词，返回None
    if not chart_type:
        print("未检测到图表关键词")
        return None
    
    # 查找X轴列（通常是分组维度，如省份、地区、产品等）
    x_axis_keywords = ['省份', '地区', '区域', '城市', '产品', '类别', '类型', '名称', '日期', '时间', '月份', '年份']
    x_axis_col = find_column_by_keyword(columns, x_axis_keywords)
    
    # 如果没有找到X轴列，使用第一个非数值列
    if not x_axis_col:
        for col in columns:
            # 假设列名包含这些关键词的是维度列
            if any(kw in col.lower() for kw in x_axis_keywords):
                x_axis_col = col
                break
        if not x_axis_col:
            x_axis_col = columns[0] if columns else None
    
    # 查找Y轴列（通常是度量值，如销售额、数量等）
    y_axis_keywords = ['销售额', '金额', '数值', '数量', '总数', '总计', '增长', '增长率', '占比']
    y_axis_col = find_column_by_keyword(columns, y_axis_keywords)
    
    # 如果没有找到Y轴列，使用第一个数值列
    if not y_axis_col:
        for col in columns:
            if any(kw in col.lower() for kw in y_axis_keywords):
                y_axis_col = col
                break
        if not y_axis_col and len(columns) > 1:
            y_axis_col = columns[1]  # 默认使用第二列
        elif not y_axis_col:
            y_axis_col = columns[0]
    
    # 确保X轴和Y轴不是同一列
    if x_axis_col == y_axis_col and len(columns) > 1:
        # 如果只有一列，使用同一列
        # 如果有多个列，为Y轴选择另一列
        for col in columns:
            if col != x_axis_col:
                y_axis_col = col
                break
    
    # 生成图表标题
    title = f"各{x_axis_col}的{y_axis_col}"
    if chart_type == 'pie':
        title = f"{x_axis_col}占比分布"
    elif chart_type == 'line':
        title = f"{y_axis_col}趋势"
    
    return {
        "type": "chart",
        "chartType": chart_type,
        "xAxisColumn": x_axis_col,
        "yAxisColumn": y_axis_col,
        "labelColumn": x_axis_col,
        "valueColumn": y_axis_col,
        "title": title,
        "description": f"{chart_type}图表: 显示{x_axis_col}的{y_axis_col}分布",
        "aggregateFunction": "sum"  # 默认聚合函数
    }

def find_column_by_keyword(columns, keywords):
    """
    根据关键词查找列名
    产品意义：模糊匹配列名
    """
    for col in columns:
        col_lower = col.lower()
        for keyword in keywords:
            if keyword in col_lower:
                return col
    return None

# 测试
user_input = "绘制地区和销售额的柱状图"
columns = ["地区", "销售额"]

result = detect_chart_requirements(user_input.lower(), columns, user_input, [])
print("测试结果:", result)
