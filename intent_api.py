# -*- coding: utf-8 -*-
"""
智能数据洞察助手 - 意图识别API服务
功能：提供HTTP接口供前端调用意图识别功能
V3.0新增：基于BERT语义匹配的配置生成
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from inference import IntentClassifier
from requirement_inference import get_requirement_classifier
from column_matcher import get_column_matcher
import logging
import re

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

classifier = None

def get_classifier():
    """获取分类器实例（懒加载）"""
    global classifier
    if classifier is None:
        classifier = IntentClassifier()
    return classifier

# 配置模板定义（支持语义匹配）
# V3.3新增：高级统计、数据透视表、数据清洗等
CONFIG_TEMPLATES = {
    'QUERY_FIND': {
        'find_max': {
            'keywords': ['最大', '最高', '最多', '第一', 'top', '最大值'],
            'config': lambda col, cols: {
                'queryType': 'find_max',
                'valueColumn': col,
                'title': f'{col}最大值查询',
                'description': f'查找{col}最大的记录'
            }
        },
        'find_min': {
            'keywords': ['最小', '最低', '最少', '最后', 'bottom', '最小值'],
            'config': lambda col, cols: {
                'queryType': 'find_min',
                'valueColumn': col,
                'title': f'{col}最小值查询',
                'description': f'查找{col}最小的记录'
            }
        },
        'find_top': {
            'keywords': ['前', '排名', 'top', '前几'],
            'config': lambda col, cols, limit=5: {
                'queryType': 'find_top',
                'valueColumn': col,
                'limit': limit,
                'order': 'desc',
                'title': f'{col}前{limit}名',
                'description': f'查找{col}最大的前{limit}条记录'
            }
        }
    },
    'QUERY_AGGREGATE': {
        'avg': {
            'keywords': ['平均', '均值', '平均值', 'avg', 'average'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'avg',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}平均值',
                'description': f'统计{col}的平均值'
            }
        },
        'sum': {
            'keywords': ['总和', '合计', '总计', '求和', 'sum', 'total'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'sum',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}总和',
                'description': f'统计{col}的总和'
            }
        },
        'count': {
            'keywords': ['数量', '个数', '计数', 'count', '多少'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'count',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}数量',
                'description': f'统计{col}的数量'
            }
        },
        # V3.3新增：高级统计函数
        'median': {
            'keywords': ['中位数', '中值', 'median'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'median',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}中位数',
                'description': f'统计{col}的中位数'
            }
        },
        'mode': {
            'keywords': ['众数', '出现最多', 'mode'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'mode',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}众数',
                'description': f'统计{col}的众数'
            }
        },
        'stddev': {
            'keywords': ['标准差', '波动程度', '离散程度', 'stddev', 'stdev'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'stdDev',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}标准差',
                'description': f'统计{col}的标准差'
            }
        },
        'variance': {
            'keywords': ['方差', 'variance', 'var'],
            'config': lambda col, cols, group_col=None: {
                'aggregateFunction': 'variance',
                'valueColumn': col,
                'groupColumn': group_col,
                'title': f'{"各" + group_col if group_col else ""}{col}方差',
                'description': f'统计{col}的方差'
            }
        },
        'percentile': {
            'keywords': ['百分位', '分位数', 'percentile'],
            'config': lambda col, cols, group_col=None, p=50: {
                'aggregateFunction': 'percentile',
                'valueColumn': col,
                'groupColumn': group_col,
                'percentile': p,
                'title': f'{col}第{p}百分位数',
                'description': f'统计{col}的第{p}百分位数'
            }
        }
    },
    # V3.3新增：数据透视表
    'PIVOT_TABLE': {
        'pivot': {
            'keywords': ['透视表', '交叉分析', '交叉统计', 'pivot'],
            'config': lambda row_col, col_col, value_col, agg_func='sum': {
                'queryType': 'pivot_table',
                'rowColumn': row_col,
                'colColumn': col_col,
                'valueColumn': value_col,
                'aggregateFunction': agg_func,
                'title': f'{row_col}与{col_col}交叉分析',
                'description': f'按{row_col}和{col_col}交叉统计{value_col}'
            }
        }
    },
    # V3.3新增：数据清洗
    'DATA_CLEAN': {
        'dedup': {
            'keywords': ['去重', '删除重复', '去除重复', 'dedup'],
            'config': lambda cols=None: {
                'operationType': 'remove_duplicates',
                'columns': cols,
                'title': '数据去重',
                'description': '删除重复的数据行'
            }
        },
        'fillna': {
            'keywords': ['填充空值', '填充缺失', '补全数据', 'fillna'],
            'config': lambda col, strategy='mean': {
                'operationType': 'fill_missing',
                'column': col,
                'strategy': strategy,
                'title': f'{col}空值填充',
                'description': f'使用{strategy}策略填充{col}的空值'
            }
        },
        'clean': {
            'keywords': ['数据清洗', '清洗数据', 'data clean'],
            'config': lambda: {
                'operationType': 'data_cleaning',
                'title': '数据清洗',
                'description': '执行数据清洗操作'
            }
        }
    },
    'CHART_BAR': {
        'bar': {
            'keywords': ['柱状图', '柱形图', '条形图', 'bar', '柱图'],
            'config': lambda x_col, y_col, cols: {
                'chartType': 'bar',
                'xAxisColumn': x_col,
                'yAxisColumn': y_col,
                'title': f'{x_col}与{y_col}柱状图',
                'description': f'按{x_col}统计{y_col}的柱状图'
            }
        }
    },
    'CHART_LINE': {
        'line': {
            'keywords': ['折线图', '线图', '趋势图', 'line', '走势'],
            'config': lambda x_col, y_col, cols: {
                'chartType': 'line',
                'xAxisColumn': x_col,
                'yAxisColumn': y_col,
                'title': f'{x_col}与{y_col}折线图',
                'description': f'按{x_col}统计{y_col}的折线图'
            }
        }
    },
    'CHART_PIE': {
        'pie': {
            'keywords': ['饼图', '占比图', 'pie', '分布图'],
            'config': lambda label_col, value_col, cols: {
                'chartType': 'pie',
                'labelColumn': label_col,
                'valueColumn': value_col,
                'title': f'{label_col}分布饼图',
                'description': f'按{label_col}分布的饼图'
            }
        }
    },
    # V3.3新增：高级图表
    'CHART_COMBO': {
        'combo': {
            'keywords': ['组合图', '双轴图', 'combo', '混合图'],
            'config': lambda x_col, y_cols, types: {
                'chartType': 'combo',
                'xAxisColumn': x_col,
                'yAxisColumns': y_cols,
                'chartTypes': types,
                'title': '组合图表',
                'description': '多系列组合图表'
            }
        }
    },
    'CHART_RADAR': {
        'radar': {
            'keywords': ['雷达图', '蛛网图', 'radar'],
            'config': lambda dims, metrics: {
                'chartType': 'radar',
                'dimensions': dims,
                'metrics': metrics,
                'title': '雷达图',
                'description': '多维度对比雷达图'
            }
        }
    },
    'CHART_FUNNEL': {
        'funnel': {
            'keywords': ['漏斗图', '转化图', 'funnel'],
            'config': lambda label_col, value_col: {
                'chartType': 'funnel',
                'labelColumn': label_col,
                'valueColumn': value_col,
                'title': '漏斗图',
                'description': '转化分析漏斗图'
            }
        }
    },
    'CHART_HEATMAP': {
        'heatmap': {
            'keywords': ['热力图', '热图', 'heatmap'],
            'config': lambda row_col, col_col, value_col: {
                'chartType': 'heatmap',
                'rowColumn': row_col,
                'colColumn': col_col,
                'valueColumn': value_col,
                'title': '热力图',
                'description': f'{row_col}与{col_col}热力图'
            }
        }
    },
    # V3.3新增：数据导出
    'DATA_EXPORT': {
        'export_excel': {
            'keywords': ['导出excel', '导出xlsx', '保存excel', 'export excel'],
            'config': lambda filename='data.xlsx': {
                'operationType': 'export_excel',
                'filename': filename,
                'title': '导出Excel',
                'description': '将数据导出为Excel文件'
            }
        },
        'export_csv': {
            'keywords': ['导出csv', '保存csv', 'export csv'],
            'config': lambda filename='data.csv': {
                'operationType': 'export_csv',
                'filename': filename,
                'title': '导出CSV',
                'description': '将数据导出为CSV文件'
            }
        }
    }
}

def find_best_column(text, columns):
    """使用语义匹配找到最佳列名 - V3.0修复版"""
    if not columns:
        logger.warning("[find_best_column] 列列表为空")
        return None
    
    # 过滤掉空字符串和无效列名
    columns = [col for col in columns if col and col.strip()]
    if not columns:
        logger.warning("[find_best_column] 过滤后列列表为空")
        return None
    
    text_lower = text.lower().strip()
    logger.info(f"[find_best_column] 输入文本: '{text_lower}'")
    logger.info(f"[find_best_column] 可用列: {columns[:10]}...")  # 只显示前10个
    
    # 1. 直接包含匹配（最准确）- 检查列名是否在文本中
    for col in columns:
        col_lower = col.lower().strip()
        if not col_lower:  # 跳过空字符串
            continue
        if col_lower in text_lower:
            logger.info(f"[find_best_column] 直接匹配成功: '{col}'")
            return col
    
    # 2. 提取文本中的关键词（2-8个字的词组）
    import re
    # 提取2-8个连续中文字符作为关键词
    keywords = re.findall(r'[\u4e00-\u9fa5]{2,8}', text_lower)
    logger.info(f"[find_best_column] 提取的关键词: {keywords}")
    
    # 3. 对每个列名计算匹配分数
    best_match = None
    best_score = 0
    
    for col in columns:
        col_lower = col.lower()
        score = 0
        match_details = []
        
        # 3.1 检查关键词是否在列名中
        for keyword in keywords:
            if keyword in col_lower:
                score += len(keyword) * 2  # 关键词匹配权重高
                match_details.append(f"'{keyword}' in '{col}'")
        
        # 3.2 检查列名中的关键词是否在文本中
        col_keywords = re.findall(r'[\u4e00-\u9fa5]{2,4}', col_lower)
        for col_kw in col_keywords:
            if col_kw in text_lower:
                score += len(col_kw)
                match_details.append(f"'{col_kw}' match")
        
        # 3.3 字符重叠度
        common_chars = len(set(text_lower) & set(col_lower))
        score += common_chars * 0.3
        
        if score > best_score:
            best_score = score
            best_match = col
            logger.debug(f"[find_best_column] 当前最佳: '{col}', 分数: {score}, 匹配: {match_details}")
    
    logger.info(f"[find_best_column] 关键词匹配最佳: '{best_match}', 分数: {best_score}")
    
    # 4. 如果分数太低，尝试找包含常见后缀的列
    if best_score < 3:
        common_suffixes = ['时长', '时间', '金额', '数量', '次数', '日期', '名称', '公司', '状态']
        for suffix in common_suffixes:
            if suffix in text_lower:
                for col in columns:
                    if suffix in col.lower():
                        logger.info(f"[find_best_column] 通过后缀匹配: '{col}' (后缀: {suffix})")
                        return col
    
    # 5. 兜底：返回第一个数值类型的列
    if best_match is None and columns:
        numeric_keywords = ['时长', '时间', '金额', '数量', '次数', '值', '数', '额']
        for col in columns:
            if any(kw in col.lower() for kw in numeric_keywords):
                logger.info(f"[find_best_column] 兜底匹配数值列: '{col}'")
                return col
        # 最终兜底：返回第一个列
        logger.info(f"[find_best_column] 最终兜底返回第一列: '{columns[0]}'")
        return columns[0]
    
    return best_match

def detect_operation_type(text, intent):
    """检测操作类型（如最大、最小、平均等）"""
    text_lower = text.lower()
    
    # 重要：如果文本包含"平均值"，则不应该匹配 find_max/find_min
    # 因为"平均值最高"是聚合查询，不是查找最大值
    if '平均值' in text_lower or '平均' in text_lower:
        # 如果意图是 QUERY_FIND，但包含平均值，应该改为 QUERY_AGGREGATE
        if intent == 'QUERY_FIND':
            logger.info(f"[detect_operation_type] 检测到'平均值'，将意图从 QUERY_FIND 改为 QUERY_AGGREGATE")
            return 'avg'  # 返回 avg 操作类型，让调用者知道应该使用 QUERY_AGGREGATE
    
    templates = CONFIG_TEMPLATES.get(intent, {})
    
    best_match = None
    best_score = 0
    
    for op_type, template in templates.items():
        for keyword in template['keywords']:
            if keyword in text_lower:
                # 关键词匹配度
                score = len(keyword) / len(text)
                if score > best_score:
                    best_score = score
                    best_match = op_type
    
    return best_match

def detect_unit_conversion(text):
    """检测单位转换需求"""
    conversions = []
    
    # 秒转分钟
    if '秒' in text and ('分钟' in text or '分' in text):
        conversions.append({
            'formula': 'value / 60',
            'from': '秒',
            'to': '分钟',
            'decimalPlaces': 2
        })
    
    # 分钟转小时
    if '分钟' in text and '小时' in text:
        conversions.append({
            'formula': 'value / 60',
            'from': '分钟',
            'to': '小时',
            'decimalPlaces': 2
        })
    
    # 元转万元
    if '元' in text and '万元' in text:
        conversions.append({
            'formula': 'value / 10000',
            'from': '元',
            'to': '万元',
            'decimalPlaces': 2
        })
    
    return conversions

def generate_config_bert(text, intent, columns):
    """基于BERT语义匹配生成配置"""
    logger.info(f"生成配置: intent={intent}, text={text}")
    
    if not columns:
        return None
    
    # V4.0增强：检测复合查询模式（哪个XX的YY最多/最少）
    # 支持：哪个地区的销售额最多、哪个省份的数量最大等
    
    # 模式1：哪个XX的YY最多/最少（指定了分组列和数值列）
    compound_match = re.search(r'哪个(.+?)的(.+?)(最多|最大|最少|最小)', text)
    if compound_match:
        group_desc = compound_match.group(1).strip()
        value_desc = compound_match.group(2).strip()
        order = 'desc' if '最多' in compound_match.group(3) or '最大' in compound_match.group(3) else 'asc'
        
        group_col = find_best_column(group_desc, columns)
        value_col = find_best_column(value_desc, columns)
        
        if group_col and value_col:
            logger.info(f"[generate_config_bert] V4.0检测到复合查询：按{group_col}分组求和{value_col}，找{'最多' if order == 'desc' else '最少'}")
            return {
                'queryType': 'group_aggregate_find',
                'groupColumn': group_col,
                'valueColumn': value_col,
                'aggregateFunction': 'sum',
                'order': order,
                'limit': 1,
                'title': f'{group_col}的{value_col}{"最多" if order == "desc" else "最少"}',
                'description': f'按{group_col}分组，求和{value_col}，找出{"最多" if order == "desc" else "最少"}的',
                'intentType': 'QUERY_AGGREGATE',
                'userInput': text
            }
        elif group_col:
            # 只有分组列，数值列可能是"数量"
            if '数量' in columns:
                logger.info(f"[generate_config_bert] 表格有'数量'列，按{group_col}分组求和'数量'列")
                return {
                    'queryType': 'group_aggregate_find',
                    'groupColumn': group_col,
                    'valueColumn': '数量',
                    'aggregateFunction': 'sum',
                    'order': order,
                    'limit': 1,
                    'title': f'{group_col}的"数量"{"最多" if order == "desc" else "最少"}',
                    'description': f'按{group_col}分组，求和"数量"列，找出{"最多" if order == "desc" else "最少"}的',
                    'intentType': 'QUERY_AGGREGATE',
                    'userInput': text
                }
            else:
                # 没有"数量"列，按分组计数
                logger.info(f"[generate_config_bert] 检测到复合查询：分组计数后找极值，分组列={group_col}")
                return {
                    'queryType': 'group_count_find',
                    'groupColumn': group_col,
                    'aggregateFunction': 'count',
                    'order': order,
                    'limit': 1,
                    'title': f'{group_col}数量{"最多" if order == "desc" else "最少"}的记录',
                    'description': f'统计各{group_col}的数量，找出数量{"最多" if order == "desc" else "最少"}的',
                    'intentType': 'QUERY_FIND',
                    'userInput': text
                }
    
    # V4.2修复：检测筛选聚合模式（XX地区的YY是多少）
    # 支持：华东地区的销售额、广东省的数量、北京的平均值、上海的销售额等
    # 关键改进：根据筛选值智能匹配列（上海→省份，华东→地区）
    
    # 模式：XX地区?的YY(是多少|多少|总和|合计|平均值)
    filter_aggregate_match = re.search(r'(华东|华南|华北|华中|西南|西北|东北|.+?)(?:地区)?的(.+?)(?:是)?(?:多少|总和|合计|平均值|有多少)', text)
    if filter_aggregate_match:
        region = filter_aggregate_match.group(1).strip()
        value_desc = filter_aggregate_match.group(2).strip()
        
        # 找到数值列
        value_col = find_best_column(value_desc, columns)
        
        # V4.2改进：根据筛选值智能匹配列
        # 定义列类型和对应的值模式
        column_type_patterns = {
            '地区': ['华东', '华南', '华北', '华中', '西南', '西北', '东北'],
            '省份': ['上海', '北京', '广东', '浙江', '江苏', '山东', '河南', '河北', '湖南', '湖北', '四川', '福建', '安徽', '陕西', '辽宁', '江西', '云南', '贵州', '山西', '广西', '吉林', '甘肃', '海南', '青海', '宁夏', '西藏', '新疆', '内蒙古', '黑龙江', '天津', '重庆'],
            '省': ['上海', '北京', '广东', '浙江', '江苏', '山东', '河南', '河北', '湖南', '湖北', '四川', '福建', '安徽', '陕西', '辽宁', '江西', '云南', '贵州', '山西', '广西', '吉林', '甘肃', '海南', '青海', '宁夏', '西藏', '新疆', '内蒙古', '黑龙江', '天津', '重庆'],
            '城市': ['上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '武汉', '西安', '天津', '重庆'],
            '市': ['上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '武汉', '西安', '天津', '重庆']
        }
        
        # 智能匹配：根据筛选值找到最合适的列
        region_col = None
        for col_name, patterns in column_type_patterns.items():
            if col_name in columns and region in patterns:
                region_col = col_name
                logger.info(f"[generate_config_bert] V4.2智能匹配：'{region}' 匹配到列 '{col_name}'")
                break
        
        # 如果没匹配到，按原来的逻辑查找
        if not region_col:
            region_col_candidates = ['地区', '省份', '省', '城市', '市', '区域', '大区']
            for candidate in region_col_candidates:
                if candidate in columns:
                    region_col = candidate
                    logger.info(f"[generate_config_bert] V4.2默认匹配：使用列 '{candidate}'")
                    break
        
        # 如果没找到地区列，尝试语义匹配
        if not region_col:
            region_col = find_best_column('地区', columns)
        
        if value_col and region_col:
            # 检测聚合函数类型
            agg_func = 'sum'  # 默认求和
            if '平均' in text or '均值' in text:
                agg_func = 'avg'
            elif '数量' in text or '个数' in text or '多少' in text:
                agg_func = 'count'
            
            logger.info(f"[generate_config_bert] V4.2检测到筛选聚合查询：筛选{region_col}={region}，计算{value_col}的{agg_func}")
            return {
                'queryType': 'filter_aggregate',
                'filterColumn': region_col,
                'filterValue': region,
                'valueColumn': value_col,
                'aggregateFunction': agg_func,
                'title': f'{region}的{value_col}{"总和" if agg_func == "sum" else ("平均值" if agg_func == "avg" else "数量")}',
                'description': f'筛选{region_col}包含"{region}"的数据，计算{value_col}的{agg_func}',
                'intentType': 'QUERY_AGGREGATE',
                'userInput': text
            }
    
    # V3.3保留：检测"哪个XX的数量最多/最少"（兼容旧模式）
    has_quantity_column = '数量' in columns
    compound_match_old = re.search(r'哪个(.+?)的?数量(最多|最大|最少|最小)', text)
    if compound_match_old:
        group_desc = compound_match_old.group(1).strip()
        order = 'desc' if '最多' in compound_match_old.group(2) or '最大' in compound_match_old.group(2) else 'asc'
        group_col = find_best_column(group_desc, columns)
        
        if group_col:
            if has_quantity_column:
                logger.info(f"[generate_config_bert] 表格有'数量'列，按{group_col}分组求和'数量'列")
                return {
                    'queryType': 'group_aggregate_find',
                    'groupColumn': group_col,
                    'valueColumn': '数量',
                    'aggregateFunction': 'sum',
                    'order': order,
                    'limit': 1,
                    'title': f'{group_col}的"数量"{"最多" if order == "desc" else "最少"}',
                    'description': f'按{group_col}分组，求和"数量"列，找出{"最多" if order == "desc" else "最少"}的',
                    'intentType': 'QUERY_AGGREGATE',
                    'userInput': text
                }
            else:
                logger.info(f"[generate_config_bert] 检测到复合查询：分组计数后找极值，分组列={group_col}")
                return {
                    'queryType': 'group_count_find',
                    'groupColumn': group_col,
                    'aggregateFunction': 'count',
                    'order': order,
                    'limit': 1,
                    'title': f'{group_col}数量{"最多" if order == "desc" else "最少"}的记录',
                    'description': f'统计各{group_col}的数量，找出数量{"最多" if order == "desc" else "最少"}的',
                    'intentType': 'QUERY_FIND',
                    'userInput': text
                }
    
    # 1. 检测操作类型
    op_type = detect_operation_type(text, intent)
    
    # 重要：如果 detect_operation_type 返回 'avg' 但意图是 QUERY_FIND，
    # 说明检测到"平均值"关键词，应该切换到 QUERY_AGGREGATE 意图
    if op_type == 'avg' and intent == 'QUERY_FIND':
        logger.info(f"[generate_config_bert] 检测到平均值查询，切换意图从 QUERY_FIND 到 QUERY_AGGREGATE")
        intent = 'QUERY_AGGREGATE'
    
    if not op_type:
        # 默认操作类型
        if intent == 'QUERY_FIND':
            op_type = 'find_max'
        elif intent == 'QUERY_AGGREGATE':
            op_type = 'avg'
        elif intent == 'CHART_BAR':
            op_type = 'bar'
        else:
            op_type = list(CONFIG_TEMPLATES.get(intent, {}).keys())[0] if CONFIG_TEMPLATES.get(intent) else None
    
    if not op_type:
        return None
    
    # 2. 找到对应的模板
    template = CONFIG_TEMPLATES.get(intent, {}).get(op_type)
    if not template:
        return None
    
    # 3. 提取列名
    value_col = find_best_column(text, columns)
    
    # 4. 检测分组列（支持多种模式）
    group_col = None
    
    # 模式1：按XX统计/的（如：按省公司统计平均值）
    group_match = re.search(r'按[照]?(.+?)(统计|的)', text)
    if group_match:
        group_desc = group_match.group(1).strip()
        group_col = find_best_column(group_desc, columns)
    
    # 模式2：哪个XX的YY（如：哪个省公司的险情确认时长平均值最高）
    if not group_col:
        group_match = re.search(r'哪个(.+?)的(.+?)(平均值|总和|数量)', text)
        if group_match:
            group_desc = group_match.group(1).strip()
            group_col = find_best_column(group_desc, columns)
    
    # 模式3：各XX的YY（如：各省公司的险情确认时长平均值）
    if not group_col:
        group_match = re.search(r'各(.+?)的(.+?)(平均值|总和|数量)', text)
        if group_match:
            group_desc = group_match.group(1).strip()
            group_col = find_best_column(group_desc, columns)
    
    # 5. 检测单位转换
    conversions = detect_unit_conversion(text)
    
    # 6. 生成配置
    try:
        if intent in ['CHART_BAR', 'CHART_LINE']:
            config = template['config'](group_col or columns[0], value_col, columns)
        elif intent == 'CHART_PIE':
            config = template['config'](group_col or columns[0], value_col, columns)
        elif intent == 'QUERY_AGGREGATE':
            config = template['config'](value_col, columns, group_col)
        else:
            config = template['config'](value_col, columns)
        
        # 添加单位转换
        if conversions:
            config['dataTransform'] = {
                'unitConversion': conversions[0],
                'decimalPlaces': conversions[0].get('decimalPlaces', 2)
            }
        
        config['intentType'] = intent
        config['userInput'] = text
        
        logger.info(f"生成配置成功: {config}")
        return config
    
    except Exception as e:
        logger.error(f"配置生成失败: {e}")
        return None

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'service': 'intent-recognition',
        'version': '1.0.0'
    })

@app.route('/api/identify-intent', methods=['POST'])
def api_identify_intent():
    """
    意图识别接口
    
    请求体:
        {
            "text": "用户输入文本"
        }
    
    返回:
        {
            "intent": "意图标签",
            "confidence": 置信度,
            "description": "意图描述",
            "need_confirmation": 是否需要确认,
            "all_probabilities": {"意图": 概率}
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': '缺少text参数'
            }), 400
        
        text = data['text'].strip()
        
        if not text:
            return jsonify({
                'error': 'text不能为空'
            }), 400
        
        # 获取分类器并预测
        clf = get_classifier()
        result = clf.predict(text)
        
        logger.info(f"输入: {text}, 意图: {result['intent']}, 置信度: {result['confidence']:.2%}")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"意图识别失败: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/generate-config', methods=['POST'])
def api_generate_config():
    """
    V3.0新增：基于BERT语义匹配的配置生成接口
    
    请求体:
        {
            "text": "用户输入文本",
            "intent": "意图类型（可选，不传则自动识别）",
            "columns": ["列名1", "列名2", ...]
        }
    
    返回:
        {
            "success": true/false,
            "config": {...配置对象...},
            "intent": "意图类型",
            "method": "bert_semantic"
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': '缺少text参数'
            }), 400
        
        text = data['text'].strip()
        columns = data.get('columns', [])
        intent = data.get('intent')
        
        if not text:
            return jsonify({
                'error': 'text不能为空'
            }), 400
        
        # 如果没有传入意图，使用BERT模型识别
        if not intent:
            clf = get_classifier()
            intent_result = clf.predict(text)
            intent = intent_result['intent']
            logger.info(f"自动识别意图: {intent}, 置信度: {intent_result['confidence']:.2%}")
        
        # 使用语义匹配生成配置
        config = generate_config_bert(text, intent, columns)
        
        if config:
            return jsonify({
                'success': True,
                'config': config,
                'intent': intent,
                'method': 'bert_semantic'
            })
        else:
            return jsonify({
                'success': False,
                'error': '无法生成配置',
                'intent': intent
            })
    
    except Exception as e:
        logger.error(f"配置生成失败: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/batch-identify', methods=['POST'])
def api_batch_identify():
    """批量意图识别接口"""
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                'error': '缺少texts参数'
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list):
            return jsonify({
                'error': 'texts必须是数组'
            }), 400
        
        clf = get_classifier()
        results = clf.batch_predict(texts)
        
        return jsonify({
            'results': results
        })
    
    except Exception as e:
        logger.error(f"批量意图识别失败: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/intent-types', methods=['GET'])
def api_intent_types():
    """获取所有意图类型"""
    return jsonify({
        'intent_types': {
            'QUERY_FIND': '查找特定数据（最大值、最小值、排名等）',
            'QUERY_AGGREGATE': '统计汇总（求和、计数、平均值等）',
            'QUERY_FILTER': '筛选过滤（按条件筛选数据）',
            'QUERY_SORT': '排序（升序、降序排列）',
            'CHART_BAR': '柱状图可视化',
            'CHART_LINE': '折线图可视化',
            'CHART_PIE': '饼图可视化',
            'CHART_GENERAL': '通用图表可视化'
        }
    })

@app.route('/api/classify-requirement', methods=['POST'])
def api_classify_requirement():
    """
    V3.0新增：基于BERT的需求分类接口
    判断用户输入是否为数据分析需求
    
    请求体:
        {
            "text": "用户输入文本"
        }
    
    返回:
        {
            "label": "DATA_ANALYSIS" 或 "IRRELEVANT",
            "confidence": 置信度,
            "is_data_analysis": true/false,
            "probabilities": {"DATA_ANALYSIS": 0.xx, "IRRELEVANT": 0.xx}
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': '缺少text参数'
            }), 400
        
        text = data['text'].strip()
        
        if not text:
            return jsonify({
                'error': 'text不能为空'
            }), 400
        
        # 获取需求分类器并预测
        clf = get_requirement_classifier()
        result = clf.predict(text)
        
        logger.info(f"需求分类: '{text}' -> {result['label']} (置信度: {result['confidence']:.2%})")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"需求分类失败: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/match-column', methods=['POST'])
def api_match_column():
    """
    V3.0新增：列名语义匹配接口
    使用分层策略匹配用户描述与数据列名
    
    请求体:
        {
            "text": "用户输入文本",
            "columns": ["列名1", "列名2", ...],
            "use_llm_fallback": true  // 可选，是否使用大模型兜底
        }
    
    返回:
        {
            "column": "匹配的列名" 或 null,
            "confidence": 置信度,
            "method": "literal" | "semantic" | "none",
            "reason": "匹配说明",
            "entities": ["提取的实体词列表"]
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data or 'columns' not in data:
            return jsonify({
                'error': '缺少text或columns参数'
            }), 400
        
        text = data['text'].strip()
        columns = data['columns']
        use_llm = data.get('use_llm_fallback', True)
        
        if not text:
            return jsonify({
                'error': 'text不能为空'
            }), 400
        
        if not columns or not isinstance(columns, list):
            return jsonify({
                'error': 'columns必须是非空数组'
            }), 400
        
        # 获取列名匹配器并执行匹配
        matcher = get_column_matcher()
        result = matcher.match(text, columns, use_llm_fallback=use_llm)
        
        logger.info(f"列名匹配: '{text}' -> '{result['column']}' ({result['method']}, {result['confidence']:.2f})")
        logger.info(f"  提取实体: {result['entities']}")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"列名匹配失败: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/analyze-elements', methods=['POST'])
def api_analyze_elements():
    """
    V4.0新增：分析要素识别接口
    识别用户输入中的聚合函数和输出目标
    
    请求体:
        {
            "text": "用户输入文本"
        }
    
    返回:
        {
            "text": "用户输入",
            "aggregate_function": "sum/avg/max/min/count/...",
            "aggregate_confidence": 0.95,
            "output_type": "chart_bar/chart_line/value/table/...",
            "output_confidence": 0.98,
            "probabilities": {...}
        }
    """
    try:
        from analysis_inference import get_analysis_classifier
        
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': '缺少text参数'
            }), 400
        
        text = data['text'].strip()
        
        if not text:
            return jsonify({
                'error': 'text不能为空'
            }), 400
        
        clf = get_analysis_classifier()
        result = clf.predict(text)
        
        logger.info(f"分析要素识别: '{text}' -> 聚合={result['aggregate_function']} ({result['aggregate_confidence']:.2%}), 输出={result['output_type']} ({result['output_confidence']:.2%})")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"分析要素识别失败: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/aggregate-types', methods=['GET'])
def api_aggregate_types():
    """V4.0新增：获取所有聚合函数类型"""
    return jsonify({
        'aggregate_types': {
            'sum': '求和，计算总和、合计、总计',
            'avg': '求平均，计算平均值、均值、人均',
            'max': '求最大值，找出最高值、峰值',
            'min': '求最小值，找出最低值、谷值',
            'count': '计数，统计数量、个数、频次',
            'median': '中位数，计算中间值',
            'std': '标准差，计算波动、离散程度',
            'distinct_count': '去重计数，统计不同值的数量',
            'ratio': '占比，计算百分比、比例',
            'growth_rate': '增长率，计算增幅、涨幅',
            'yoy': '同比，与去年同期比较',
            'mom': '环比，与上月比较',
            'rank': '排名，计算名次、排行',
            'none': '未指定聚合方式'
        }
    })

@app.route('/api/output-types', methods=['GET'])
def api_output_types():
    """V4.0新增：获取所有输出目标类型"""
    return jsonify({
        'output_types': {
            'chart_bar': '柱状图，用于对比分析',
            'chart_line': '折线图，用于趋势分析',
            'chart_pie': '饼图，用于占比分析',
            'chart_scatter': '散点图，用于相关性分析',
            'chart_radar': '雷达图，用于多维度对比',
            'chart_area': '面积图，用于累计趋势分析',
            'value': '数值输出，直接返回计算结果',
            'table': '表格输出，以表格形式展示数据',
            'none': '未指定输出方式'
        }
    })

@app.route('/', methods=['GET'])
def root():
    """根路径 - 返回API信息"""
    return jsonify({
        'service': '智能数据洞察助手 - 意图识别API',
        'version': '4.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/api/health',
            'identify_intent': '/api/identify-intent',
            'batch_identify': '/api/batch-identify',
            'intent_types': '/api/intent-types',
            'generate_config': '/api/generate-config (V3.0新增)',
            'classify_requirement': '/api/classify-requirement (V3.0新增)',
            'match_column': '/api/match-column (V3.0新增)',
            'analyze_elements': '/api/analyze-elements (V4.0新增)',
            'aggregate_types': '/api/aggregate-types (V4.0新增)',
            'output_types': '/api/output-types (V4.0新增)'
        }
    })

if __name__ == '__main__':
    print("=" * 60)
    print("智能数据洞察助手 - 意图识别API服务")
    print("=" * 60)
    print("\n启动服务...")
    print("API地址: http://localhost:5001")
    print("\n接口列表:")
    print("  GET  /api/health          - 健康检查")
    print("  POST /api/identify-intent - 意图识别")
    print("  POST /api/batch-identify  - 批量识别")
    print("  GET  /api/intent-types    - 获取意图类型")
    print("\n按 Ctrl+C 停止服务")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=False)
