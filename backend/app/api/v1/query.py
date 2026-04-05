# -*- coding: utf-8 -*-
"""
查询配置生成API
产品意义：基于LangChain提供智能查询配置生成服务
"""

from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import json
import re

query_bp = Blueprint('query', __name__)

@query_bp.route('/generate-config', methods=['POST', 'OPTIONS'])
@cross_origin(origins='*', methods=['POST', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization', 'Accept'], supports_credentials=True)
def generate_query_config():
    """
    生成查询配置
    产品意义：将自然语言转换为结构化查询配置
    """
    try:
        data = request.json
        user_input = data.get('user_input', '')
        columns = data.get('columns', [])
        data_preview = data.get('data_preview', [])
        
        if not user_input or not columns:
            return jsonify({
                "error": "用户输入和列名不能为空"
            }), 400
        
        # 本地规则匹配生成查询配置
        query_configs = []
        
        # 分析用户输入
        input_lower = user_input.lower()
        
        # 首先检测图表需求，优先处理绘图请求
        # 直接使用原始输入检测图表关键词，因为中文关键词不受大小写影响
        print(f"[DEBUG] 开始检测图表需求")
        print(f"[DEBUG] user_input: {user_input}")
        print(f"[DEBUG] columns: {columns}")
        chart_config = detect_chart_requirements(user_input, columns, user_input, [])
        print(f"[DEBUG] 图表配置结果: {chart_config}")
        if chart_config:
            print(f"[DEBUG] 添加图表配置: {chart_config}")
            query_configs.append(chart_config)
        else:
            print(f"[DEBUG] 未检测到图表需求，尝试其他查询类型")
            # 尝试检测筛选+聚合组合查询（如"广东省的销售额是多少"）
            filter_aggregate_config = detect_filter_aggregate(input_lower, columns, user_input)
            if filter_aggregate_config:
                print(f"[DEBUG] 添加筛选聚合配置: {filter_aggregate_config}")
                query_configs.append(filter_aggregate_config)
            
            # 如果没有检测到筛选+聚合，尝试检测其他类型的查询
            if not query_configs:
                print(f"[DEBUG] 未检测到筛选聚合，尝试其他查询类型")
                # 检测聚合操作
                aggregate_config = detect_aggregate_operations(input_lower, columns, user_input)
                if aggregate_config:
                    print(f"[DEBUG] 添加聚合配置: {aggregate_config}")
                    query_configs.append(aggregate_config)
                
                # 检测筛选条件
                filter_config = detect_filter_conditions(input_lower, columns, user_input)
                if filter_config:
                    print(f"[DEBUG] 添加筛选配置: {filter_config}")
                    query_configs.append(filter_config)
                
                # 检测排序操作
                sort_config = detect_sort_operations(input_lower, columns)
                if sort_config:
                    print(f"[DEBUG] 添加排序配置: {sort_config}")
                    query_configs.append(sort_config)
        
        # 如果仍然没有生成配置，创建一个默认配置
        if not query_configs:
            # 尝试找到数值列
            value_col = find_column_by_keyword(columns, ['销售额', '金额', '数值', '数量', '增长'])
            if not value_col and columns:
                value_col = columns[-1]
            
            # 尝试找到地区或分组列
            group_col = find_column_by_keyword(columns, ['地区', '区域', '省份', '城市', '产品', '类别'])
            if not group_col and columns:
                group_col = columns[0]
            
            # 创建默认聚合配置
            default_config = {
                "type": "aggregate",
                "description": "默认聚合查询",
                "aggregations": [
                    {
                        "column": value_col or columns[0] if columns else "value",
                        "operation": "sum",
                        "group_by": group_col
                    }
                ],
                "title": "查询结果"
            }
            query_configs.append(default_config)
        
        return jsonify({
            "status": "success",
            "configs": query_configs,
            "method": "local_rules"
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "configs": []
        }), 500

def detect_filter_conditions(text, columns, original_input):
    """
    检测筛选条件
    产品意义：从用户输入中提取筛选逻辑
    """
    conditions = []
    
    # ========== V5.0修复：增强地区筛选检测 ==========
    # 检测地区筛选（支持"华南地区"、"华南"等）
    region_match = re.search(r'(华南|华北|华东|华中|西南|西北|东北)地区?', text)
    if region_match:
        region = region_match.group(1)
        # 查找地区列
        region_col = find_column_by_keyword(columns, ['地区', '区域', '省份', '城市'])
        if region_col:
            conditions.append({
                "column": region_col,
                "operator": "equals",
                "value": region
            })
    
    # 检测产品筛选
    product_match = re.search(r'(产品[ABC]|产品\s*[ABC])', text)
    if product_match:
        product = product_match.group(1).replace(' ', '')
        product_col = find_column_by_keyword(columns, ['产品', '商品', '名称'])
        if product_col:
            conditions.append({
                "column": product_col,
                "operator": "equals",
                "value": product
            })
    
    # 检测数值比较
    comparison_match = re.search(r'(大于|小于|超过|低于|等于)\s*(\d+)', text)
    if comparison_match:
        operator_map = {
            '大于': 'greater_than',
            '超过': 'greater_than',
            '小于': 'less_than',
            '低于': 'less_than',
            '等于': 'equals'
        }
        operator_text = comparison_match.group(1)
        value = int(comparison_match.group(2))
        
        # 查找数值列
        num_col = find_column_by_keyword(columns, ['销售额', '数量', '金额', '数值'])
        if num_col:
            conditions.append({
                "column": num_col,
                "operator": operator_map.get(operator_text, 'equals'),
                "value": value
            })
    
    # ========== V5.0新增：检测"XX的YY"模式（如"华南地区的产品销售额"）==========
    # 这种模式表示筛选+聚合的组合查询
    if '的' in original_input:
        parts = original_input.split('的')
        if len(parts) >= 2:
            filter_part = parts[0].strip()  # 如"华南地区"
            value_part = parts[1].strip()   # 如"产品销售额"
            
            # 检查filter_part是否包含地区
            for region in ['华南', '华北', '华东', '华中', '西南', '西北', '东北']:
                if region in filter_part:
                    region_col = find_column_by_keyword(columns, ['地区', '区域', '省份', '城市'])
                    if region_col:
                        conditions.append({
                            "column": region_col,
                            "operator": "equals",
                            "value": region
                        })
                    break
    
    if conditions:
        return {
            "type": "filter",
            "description": f"筛选条件: {len(conditions)}个",
            "conditions": conditions
        }
    
    return None

def detect_aggregate_operations(text, columns, original_input):
    """
    检测聚合操作
    产品意义：识别统计汇总需求
    """
    aggregate_types = []
    
    # 检测求和
    if re.search(r'(总和|总计|合计|求和|总共|多少|销售额)', text):
        aggregate_types.append('sum')
    
    # 检测平均
    if re.search(r'(平均|均值|平均值)', text):
        aggregate_types.append('avg')
    
    # 检测最大
    if re.search(r'(最大|最高|最多)', text):
        aggregate_types.append('max')
    
    # 检测最小
    if re.search(r'(最小|最低|最少)', text):
        aggregate_types.append('min')
    
    # 检测计数
    if re.search(r'(数量|个数|计数|多少条|几条)', text):
        aggregate_types.append('count')
    
    if aggregate_types:
        # 查找数值列 - 优先匹配"销售额"等常见列
        value_col = find_column_by_keyword(columns, ['销售额', '金额', '数值', '数量', '增长'])
        group_col = find_column_by_keyword(columns, ['地区', '产品', '省份', '类别'])
        
        # ========== V5.0修复：如果输入包含"XX的YY"模式，使用filter_aggregate类型 ==========
        if '的' in original_input:
            parts = original_input.split('的')
            if len(parts) >= 2:
                filter_part = parts[0].strip()
                # 检查是否包含地区筛选
                for region in ['华南', '华北', '华东', '华中', '西南', '西北', '东北']:
                    if region in filter_part:
                        return {
                            "type": "filter_aggregate",
                            "description": f"筛选聚合: {region}的{value_col or '数值'}统计",
                            "filterColumn": group_col or '地区',
                            "filterValue": region,
                            "filterValues": [region],
                            "valueColumn": value_col or columns[-1],
                            "aggregateFunction": aggregate_types[0],
                            "title": f"{region}的{value_col or '数值'}统计"
                        }
        
        return {
            "type": "aggregate",
            "description": f"统计: {', '.join(aggregate_types)}",
            "aggregations": [
                {
                    "column": value_col or columns[-1],
                    "operation": aggregate_types[0],
                    "group_by": group_col
                }
            ]
        }
    
    return None

def detect_filter_aggregate(text, columns, original_input):
    """
    检测筛选+聚合组合查询（如"华东地区的销售额"）
    产品意义：识别"XX的YY"模式，返回filter_aggregate类型配置
    """
    print(f"[DEBUG] detect_filter_aggregate被调用:")
    print(f"[DEBUG] original_input: {original_input}")
    print(f"[DEBUG] columns: {columns}")
    
    # 检测是否为"XX的YY"模式
    if '的' not in original_input:
        print(f"[DEBUG] 没有找到'的'字")
        return None
    
    parts = original_input.split('的')
    if len(parts) < 2:
        print(f"[DEBUG] 分割后部分不足2个")
        return None
    
    filter_part = parts[0].strip()  # 如"华东地区"或"江苏区域"
    value_part = parts[1].strip()   # 如"销售额是多少"
    print(f"[DEBUG] filter_part: {filter_part}")
    print(f"[DEBUG] value_part: {value_part}")
    
    # 直接使用整个filter_part作为筛选值
    filter_value = filter_part
    
    # 检测是否包含聚合操作
    aggregate_type = None
    if '平均' in value_part or '平均值' in value_part:
        aggregate_type = 'avg'
        print(f"[DEBUG] 检测到平均值聚合")
    elif '总和' in value_part or '总计' in value_part or '合计' in value_part:
        aggregate_type = 'sum'
        print(f"[DEBUG] 检测到总和聚合")
    elif '最大' in value_part or '最高' in value_part:
        aggregate_type = 'max'
        print(f"[DEBUG] 检测到最大值聚合")
    elif '最小' in value_part or '最低' in value_part:
        aggregate_type = 'min'
        print(f"[DEBUG] 检测到最小值聚合")
    elif '数量' in value_part or '个数' in value_part or '多少' in value_part:
        aggregate_type = 'sum'
        print(f"[DEBUG] 检测到计数聚合")
    
    if not aggregate_type:
        print(f"[DEBUG] 未检测到聚合操作")
        return None
    
    # 智能选择filterColumn：根据filter_value的内容选择最合适的列
    region_col = None
    
    # 1. 如果filter_value包含"省"，优先选择"省份"列
    if '省' in filter_value:
        province_col = find_column_by_keyword(columns, ['省份', '省'])
        if province_col:
            region_col = province_col
            print(f"[DEBUG] 选择省份列: {region_col}")
    
    # 2. 如果filter_value包含"地区"或"区"，优先选择"地区"列
    if not region_col and ('地区' in filter_value or '区' in filter_value):
        area_col = find_column_by_keyword(columns, ['地区', '区域'])
        if area_col:
            region_col = area_col
            print(f"[DEBUG] 选择地区列: {region_col}")
    
    # 3. 如果没有找到，尝试其他可能的列
    if not region_col:
        region_col = find_column_by_keyword(columns, ['省份', '地区', '区域', '城市', '省公司', '地区公司'])
        print(f"[DEBUG] 选择其他列: {region_col}")
    
    # 4. 如果仍然没有找到，使用第一列
    if not region_col and columns:
        region_col = columns[0]
        print(f"[DEBUG] 使用第一列: {region_col}")
    
    print(f"[DEBUG] 最终region_col: {region_col}")
    
    # 优先匹配包含销售额、金额、数值等的列
    value_col = find_column_by_keyword(columns, ['销售额', '金额', '数值', '数量', '增长', '时长'])
    # 如果没有找到，使用第二列
    if not value_col and len(columns) > 1:
        value_col = columns[1]
    elif not value_col and columns:
        value_col = columns[0]
    print(f"[DEBUG] value_col: {value_col}")
    
    if not region_col or not value_col:
        print(f"[DEBUG] 列匹配失败")
        return None
    
    # 强制返回filter_aggregate配置
    print(f"[DEBUG] 返回filter_aggregate配置")
    return {
        "type": "filter_aggregate",
        "description": f"筛选聚合: {filter_value}的{value_col}{aggregate_type}",
        "filterColumn": region_col,
        "filterValue": filter_value,
        "filterValues": [filter_value],
        "valueColumn": value_col,
        "aggregateFunction": aggregate_type,
        "title": f"{filter_value}的{value_col}统计"
    }

def detect_sort_operations(text, columns):
    """
    检测排序操作
    产品意义：识别排序需求
    """
    sort_order = None
    
    # 检测降序
    if re.search(r'(从高到低|从大到小|降序|倒序|最多|最高|最大|前\d+)', text):
        sort_order = 'desc'
    # 检测升序
    elif re.search(r'(从低到高|从小到大|升序|正序|最少|最低|最小)', text):
        sort_order = 'asc'
    
    if sort_order:
        # 查找排序列
        sort_col = find_column_by_keyword(columns, ['销售额', '数量', '金额', '数值', '增长'])
        
        return {
            "type": "sort",
            "description": f"排序: {'降序' if sort_order == 'desc' else '升序'}",
            "column": sort_col or columns[0],
            "order": sort_order
        }
    
    return None

def detect_chart_requirements(text, columns, original_input, existing_configs):
    """
    检测图表需求并生成图表配置
    产品意义：识别用户绘图需求（如"绘制柱状图"、"显示饼图"）
    """
    print(f"[DEBUG] detect_chart_requirements被调用:")
    print(f"[DEBUG] text: {text}")
    print(f"[DEBUG] original_input: {original_input}")
    print(f"[DEBUG] columns: {columns}")
    
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
            print(f"[DEBUG] 检测关键词: {keyword}")
            if keyword in text:
                chart_type = ctype
                print(f"[DEBUG] 检测到图表类型: {ctype}, 关键词: {keyword}")
                break
        if chart_type:
            break
    
    # 如果没有检测到图表关键词，返回None
    if not chart_type:
        print(f"[DEBUG] 未检测到图表关键词")
        return None
    
    # 优先从用户输入中提取明确提到的列名
    mentioned_columns = []
    # 检查用户输入中是否明确提到了列名
    for col in columns:
        if col in original_input:
            mentioned_columns.append(col)
            print(f"[DEBUG] 从用户输入中提取到列: {col}")
    
    print(f"[DEBUG] mentioned_columns: {mentioned_columns}")
    
    # 处理提到的列
    x_axis_col = None
    y_axis_col = None
    
    if len(mentioned_columns) == 1:
        # 只提到了一个列，通常是度量值，作为Y轴列
        y_axis_col = mentioned_columns[0]
        
        # V5.0修复：当只提到一个列时，返回需要追问的标志
        # 不再自动选择默认维度，而是让前端追问用户
        print(f"[DEBUG] 只提到一个列: {y_axis_col}，需要追问用户选择分组维度")
        
        # 获取所有可能的维度列（供用户选择）
        dimension_keywords = ['省份', '地区', '区域', '城市', '产品', '类别', '类型', '名称', '日期', '时间', '月份', '年份']
        available_dimensions = []
        for col in columns:
            if col != y_axis_col and any(kw in col for kw in dimension_keywords):
                available_dimensions.append(col)
        
        # 如果没有找到维度列，使用所有非度量列
        if not available_dimensions:
            for col in columns:
                if col != y_axis_col:
                    available_dimensions.append(col)
        
        print(f"[DEBUG] 可用的维度列: {available_dimensions}")
        
        # 返回需要追问的配置
        return {
            "type": "chart",
            "chartType": chart_type,
            "needsClarification": True,
            "clarificationType": "missing_dimension",
            "mentionedColumn": y_axis_col,
            "availableDimensions": available_dimensions[:5],  # 最多返回5个选项
            "message": f"您想按哪一列来分组显示{y_axis_col}？",
            "description": f"需要选择分组维度来绘制{y_axis_col}的{chart_type}图表"
        }
    elif len(mentioned_columns) >= 2:
        # 提到了多个列，第一个作为X轴列（维度），第二个作为Y轴列（度量值）
        # 智能判断哪个是维度，哪个是度量
        # 维度关键词
        dimension_keywords = ['省份', '地区', '区域', '城市', '产品', '类别', '类型', '名称', '日期', '时间', '月份', '年份']
        # 度量关键词
        measure_keywords = ['销售额', '金额', '数值', '数量', '总数', '总计', '增长', '增长率', '占比']
        
        # 检查每个提到的列，确定哪个是维度，哪个是度量
        dim_cols = []
        meas_cols = []
        for col in mentioned_columns:
            if any(kw in col for kw in dimension_keywords):
                dim_cols.append(col)
            elif any(kw in col for kw in measure_keywords):
                meas_cols.append(col)
        
        # 如果找到了维度和度量，使用它们
        if dim_cols and meas_cols:
            x_axis_col = dim_cols[0]
            y_axis_col = meas_cols[0]
        else:
            # 否则，按顺序使用
            x_axis_col = mentioned_columns[0]
            y_axis_col = mentioned_columns[1]
        print(f"[DEBUG] 多个列情况 - X轴: {x_axis_col}, Y轴: {y_axis_col}")
    else:
        # 没有提到列名，分别查找X轴和Y轴列
        # 查找X轴列（通常是分组维度，如省份、地区、产品等）
        x_axis_keywords = ['省份', '地区', '区域', '城市', '产品', '类别', '类型', '名称', '日期', '时间', '月份', '年份']
        x_axis_col = find_column_by_keyword(columns, x_axis_keywords)
        
        # 如果没有找到X轴列，使用第一个非数值列
        if not x_axis_col:
            for col in columns:
                # 直接检查列名是否包含维度关键词（不使用lower()，因为中文没有大小写）
                if any(kw in col for kw in x_axis_keywords):
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
                if any(kw in col for kw in y_axis_keywords):
                    y_axis_col = col
                    break
            if not y_axis_col and len(columns) > 1:
                y_axis_col = columns[1]  # 默认使用第二列
            elif not y_axis_col:
                y_axis_col = columns[0]
        print(f"[DEBUG] 没有提到列名情况 - X轴: {x_axis_col}, Y轴: {y_axis_col}")
    
    # 确保X轴和Y轴不是同一列
    if x_axis_col == y_axis_col and len(columns) > 1:
        # 如果只有一列，使用同一列
        # 如果有多个列，为X轴选择另一列（因为Y轴应该是用户明确提到的度量值）
        original_y_axis = y_axis_col
        for col in columns:
            if col != y_axis_col:
                x_axis_col = col
                break
        print(f"[DEBUG] 确保X轴和Y轴不同 - X轴: {x_axis_col}, Y轴: {original_y_axis}")
        # 确保Y轴仍然是用户提到的列（如果有的话）
        if len(mentioned_columns) == 1:
            y_axis_col = mentioned_columns[0]
    
    # 生成图表标题
    title = f"各{x_axis_col}的{y_axis_col}"
    if chart_type == 'pie':
        title = f"{x_axis_col}占比分布"
    elif chart_type == 'line':
        title = f"{y_axis_col}趋势"
    
    print(f"[DEBUG] 生成图表配置 - X轴: {x_axis_col}, Y轴: {y_axis_col}, 图表类型: {chart_type}")
    
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
    # 首先，检查columns是否为空
    if not columns:
        return None
    
    # 优先查找完全匹配的列
    for col in columns:
        col_lower = col.lower()
        for keyword in keywords:
            keyword_lower = keyword.lower()
            if keyword_lower == col_lower:
                return col
    
    # 然后查找包含关键词的列，优先匹配更具体的关键词（长度更长的关键词）
    # 按关键词长度排序，长的关键词优先
    sorted_keywords = sorted(keywords, key=len, reverse=True)
    
    for col in columns:
        col_lower = col.lower()
        for keyword in sorted_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in col_lower:
                return col
    
    # 最后，如果没有找到，返回None
    return None

@query_bp.route('/health', methods=['GET'])
def query_health():
    """
    查询服务健康检查
    产品意义：供前端检测服务可用性
    """
    return jsonify({
        "status": "healthy",
        "service": "query_config_generator",
        "version": "1.0.0"
    })
