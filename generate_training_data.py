# -*- coding: utf-8 -*-
"""
智能数据洞察助手 - 大规模训练数据生成脚本
功能：生成1000+条多样化的训练样本
"""

import json
import random
from itertools import product

# 定义列名模板（用于生成多样化的列名）
COLUMN_TEMPLATES = {
    'time': ['险情确认时长', '处理时长', '响应时长', '持续时间', '耗时', '时间', '周期', '间隔'],
    'amount': ['金额', '费用', '成本', '支出', '收入', '预算', '花费', '资金'],
    'count': ['数量', '个数', '次数', '频次', '计数', '总量', '合计', '总计'],
    'location': ['省公司', '市公司', '县公司', '区域', '地区', '省份', '城市', '分公司'],
    'status': ['状态', '进度', '阶段', '情况', '结果', '类型', '类别', '等级'],
    'person': ['负责人', '处理人', '经办人', '联系人', '操作人', '审核人', '申请人'],
    'date': ['日期', '时间', '月份', '季度', '年份', '周期', '时段']
}

# 定义动作词模板
ACTION_TEMPLATES = {
    'find': ['查找', '找出', '查询', '搜索', '查看', '看看', '瞅瞅', '找一下', '搜一下'],
    'aggregate': ['统计', '计算', '汇总', '求', '算一下', '统计一下', '算一算'],
    'filter': ['筛选', '过滤', '只看', '只要', '选出', '挑出', '排除', '剔除'],
    'sort': ['排序', '排列', '按', '按照', '根据', '依据', '以'],
    'chart': ['绘制', '画', '生成', '做', '创建', '制作', '展示', '呈现', '可视化']
}

# 定义程度词模板
DEGREE_TEMPLATES = {
    'max': ['最大', '最高', '最多', '第一', 'top', '首位', '最强', '最优', '最佳'],
    'min': ['最小', '最低', '最少', '最后', 'bottom', '末尾', '最弱', '最差'],
    'avg': ['平均', '均值', '中等', '一般', '普通'],
    'sum': ['总和', '合计', '总计', '累计', '总共', '一共'],
    'count': ['数量', '个数', '条数', '笔数', '次数']
}

# 定义图表类型模板
CHART_TEMPLATES = {
    'bar': ['柱状图', '柱形图', '条形图', 'bar', '柱图', '长条图', '直方图'],
    'line': ['折线图', '线图', '趋势图', 'line', '曲线图', '走势图', '变化图'],
    'pie': ['饼图', '占比图', 'pie', '圆形图', '扇形图', '分布图', '比例图'],
    'scatter': ['散点图', 'scatter', '点图', '分布散点'],
    'general': ['图表', '图', '图形', '可视化', '展示图', '分析图']
}

# 定义连接词模板
CONNECTOR_TEMPLATES = {
    'by': ['按', '按照', '根据', '依据', '以', '通过'],
    'and': ['并', '并且', '同时', '然后', '再', '接着'],
    'of': ['的', '之', '属于', '关于'],
    'for': ['对于', '针对', '对', '给']
}

def generate_find_samples():
    """生成QUERY_FIND意图的样本（查找最大/最小值）"""
    samples = []
    
    # 模板1: 查找最大的XX
    templates_1 = [
        "{action}{degree}的{column}",
        "{action}{degree}{column}",
        "{action}{column}{degree}的",
        "{action}{column}{degree}"
    ]
    
    # 模板2: 谁的XX最大
    templates_2 = [
        "谁的{column}{degree}",
        "哪个{column}{degree}",
        "{column}{degree}的是谁",
        "{column}{degree}的是哪个"
    ]
    
    # 模板3: 找出前N名
    templates_3 = [
        "{action}前{num}名",
        "{action}前{num}个",
        "{action}第{num}名",
        "排名前{num}的"
    ]
    
    # 生成样本
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns:
            # 最大/最小值查询
            for degree_type, degrees in DEGREE_TEMPLATES.items():
                if degree_type not in ['max', 'min']:
                    continue
                    
                for degree in degrees:
                    for action in ACTION_TEMPLATES['find']:
                        # 模板1
                        for template in templates_1:
                            text = template.format(
                                action=action,
                                degree=degree,
                                column=col
                            )
                            samples.append({
                                'text': text,
                                'label': 'QUERY_FIND',
                                'sub_type': f'find_{degree_type}'
                            })
                        
                        # 模板2
                        for template in templates_2:
                            text = template.format(
                                column=col,
                                degree=degree
                            )
                            samples.append({
                                'text': text,
                                'label': 'QUERY_FIND',
                                'sub_type': f'find_{degree_type}'
                            })
            
            # 前N名查询
            for num in [3, 5, 10, 20]:
                for action in ACTION_TEMPLATES['find']:
                    for template in templates_3:
                        text = template.format(action=action, num=num)
                        samples.append({
                            'text': text,
                            'label': 'QUERY_FIND',
                            'sub_type': 'find_top'
                        })
    
    return samples

def generate_aggregate_samples():
    """生成QUERY_AGGREGATE意图的样本（统计汇总）"""
    samples = []
    
    # 模板1: 统计平均值
    templates_1 = [
        "{action}{column}的{degree}",
        "{action}{degree}{column}",
        "{column}的{degree}是多少",
        "{column}的{degree}"
    ]
    
    # 模板2: 按XX统计
    templates_2 = [
        "{action}{group}统计{column}的{degree}",
        "{action}{group}{column}的{degree}",
        "{connector}{group}统计{column}",
        "{group}的{column}{degree}"
    ]
    
    # 生成样本
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns:
            for degree_type, degrees in DEGREE_TEMPLATES.items():
                if degree_type not in ['avg', 'sum', 'count']:
                    continue
                    
                for degree in degrees:
                    for action in ACTION_TEMPLATES['aggregate']:
                        # 模板1
                        for template in templates_1:
                            text = template.format(
                                action=action,
                                column=col,
                                degree=degree
                            )
                            samples.append({
                                'text': text,
                                'label': 'QUERY_AGGREGATE',
                                'sub_type': degree_type
                            })
            
            # 按分组统计
            for group_type, groups in COLUMN_TEMPLATES.items():
                if group_type == col_type:
                    continue
                for group in groups[:3]:  # 每个类型只取前3个
                    for degree_type, degrees in DEGREE_TEMPLATES.items():
                        if degree_type not in ['avg', 'sum', 'count']:
                            continue
                        for degree in degrees[:2]:
                            for action in ACTION_TEMPLATES['aggregate']:
                                for connector in CONNECTOR_TEMPLATES['by']:
                                    for template in templates_2:
                                        text = template.format(
                                            action=action,
                                            group=group,
                                            column=col,
                                            degree=degree,
                                            connector=connector
                                        )
                                        samples.append({
                                            'text': text,
                                            'label': 'QUERY_AGGREGATE',
                                            'sub_type': f'{degree_type}_groupby'
                                        })
    
    return samples

def generate_filter_samples():
    """生成QUERY_FILTER意图的样本（筛选过滤）"""
    samples = []
    
    templates = [
        "{action}{value}的数据",
        "{action}{value}的",
        "只看{value}的",
        "只要{value}的",
        "{value}的数据",
        "{column}为{value}的"
    ]
    
    filter_values = ['广东', '北京', '上海', '深圳', '广州', '测试', '正式', '已完成', '进行中', '待处理']
    
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns[:3]:
            for value in filter_values:
                for action in ACTION_TEMPLATES['filter']:
                    for template in templates:
                        text = template.format(
                            action=action,
                            column=col,
                            value=value
                        )
                        samples.append({
                            'text': text,
                            'label': 'QUERY_FILTER',
                            'sub_type': 'filter'
                        })
    
    # 条件筛选
    conditions = ['大于1000', '小于100', '等于0', '超过10000', '低于50', '在100到200之间']
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns[:3]:
            for condition in conditions:
                for action in ACTION_TEMPLATES['filter']:
                    text = f"{action}{col}{condition}的"
                    samples.append({
                        'text': text,
                        'label': 'QUERY_FILTER',
                        'sub_type': 'filter_condition'
                    })
    
    return samples

def generate_sort_samples():
    """生成QUERY_SORT意图的样本（排序）"""
    samples = []
    
    templates = [
        "{action}{column}{order}",
        "{action}{order}{column}",
        "{connector}{column}{order}",
        "{column}{order}",
        "{column}从{direction1}到{direction2}"
    ]
    
    orders = [
        ('排序', ''),
        ('降序排列', 'desc'),
        ('升序排列', 'asc'),
        ('从高到低', 'desc'),
        ('从低到高', 'asc'),
        ('从大到小', 'desc'),
        ('从小到大', 'asc'),
        ('从近到远', 'desc'),
        ('从远到近', 'asc')
    ]
    
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns:
            for order_text, order_type in orders:
                for action in ACTION_TEMPLATES['sort']:
                    for connector in CONNECTOR_TEMPLATES['by']:
                        for template in templates:
                            if '{order}' in template and not order_type:
                                continue
                            if '{direction1}' in template:
                                if '高' in order_text or '大' in order_text or '近' in order_text:
                                    text = template.format(
                                        action=action,
                                        column=col,
                                        connector=connector,
                                        direction1=order_text[1:2],
                                        direction2=order_text[3:4] if len(order_text) > 3 else ''
                                    )
                                else:
                                    continue
                            else:
                                text = template.format(
                                    action=action,
                                    column=col,
                                    order=order_text,
                                    connector=connector
                                )
                            samples.append({
                                'text': text,
                                'label': 'QUERY_SORT',
                                'sub_type': f'sort_{order_type}' if order_type else 'sort'
                            })
    
    return samples

def generate_chart_samples():
    """生成图表意图的样本"""
    samples = []
    
    # CHART_BAR
    templates_bar = [
        "{action}{chart}{connector}{group}的{column}",
        "{action}{group}的{column}{chart}",
        "{group}的{column}{chart}",
        "{action}{chart}展示{group}的{column}"
    ]
    
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns[:3]:
            for group_type, groups in COLUMN_TEMPLATES.items():
                if group_type == col_type:
                    continue
                for group in groups[:2]:
                    for chart in CHART_TEMPLATES['bar']:
                        for action in ACTION_TEMPLATES['chart']:
                            for connector in CONNECTOR_TEMPLATES['of']:
                                for template in templates_bar:
                                    text = template.format(
                                        action=action,
                                        chart=chart,
                                        group=group,
                                        column=col,
                                        connector=connector
                                    )
                                    samples.append({
                                        'text': text,
                                        'label': 'CHART_BAR',
                                        'sub_type': 'bar_groupby'
                                    })
    
    # CHART_LINE
    templates_line = [
        "{action}{chart}{connector}{column}",
        "{action}{column}的{chart}",
        "{column}的{chart}",
        "{action}{chart}展示{column}的趋势"
    ]
    
    for col_type, columns in COLUMN_TEMPLATES.items():
        for col in columns[:3]:
            for chart in CHART_TEMPLATES['line']:
                for action in ACTION_TEMPLATES['chart']:
                    for connector in CONNECTOR_TEMPLATES['of']:
                        for template in templates_line:
                            text = template.format(
                                action=action,
                                chart=chart,
                                column=col,
                                connector=connector
                            )
                            samples.append({
                                'text': text,
                                'label': 'CHART_LINE',
                                'sub_type': 'line_trend'
                            })
    
    # CHART_PIE
    templates_pie = [
        "{action}{chart}{connector}{group}的分布",
        "{action}{group}的{chart}",
        "{group}的占比{chart}",
        "{action}{chart}展示{group}的占比"
    ]
    
    for group_type, groups in COLUMN_TEMPLATES.items():
        for group in groups[:3]:
            for chart in CHART_TEMPLATES['pie']:
                for action in ACTION_TEMPLATES['chart']:
                    for connector in CONNECTOR_TEMPLATES['of']:
                        for template in templates_pie:
                            text = template.format(
                                action=action,
                                chart=chart,
                                group=group,
                                connector=connector
                            )
                            samples.append({
                                'text': text,
                                'label': 'CHART_PIE',
                                'sub_type': 'pie_distribution'
                            })
    
    # CHART_GENERAL
    templates_general = [
        "{action}{chart}",
        "{action}{chart}展示",
        "帮我{action}{chart}",
        "{chart}分析",
        "数据{chart}",
        "可视化展示"
    ]
    
    for chart in CHART_TEMPLATES['general']:
        for action in ACTION_TEMPLATES['chart']:
            for template in templates_general:
                text = template.format(action=action, chart=chart)
                samples.append({
                    'text': text,
                    'label': 'CHART_GENERAL',
                    'sub_type': 'chart'
                })
    
    return samples

def main():
    print("=" * 60)
    print("智能数据洞察助手 - 大规模训练数据生成")
    print("=" * 60)
    
    all_samples = []
    
    print("\n生成QUERY_FIND样本...")
    find_samples = generate_find_samples()
    all_samples.extend(find_samples)
    print(f"  生成 {len(find_samples)} 条")
    
    print("\n生成QUERY_AGGREGATE样本...")
    aggregate_samples = generate_aggregate_samples()
    all_samples.extend(aggregate_samples)
    print(f"  生成 {len(aggregate_samples)} 条")
    
    print("\n生成QUERY_FILTER样本...")
    filter_samples = generate_filter_samples()
    all_samples.extend(filter_samples)
    print(f"  生成 {len(filter_samples)} 条")
    
    print("\n生成QUERY_SORT样本...")
    sort_samples = generate_sort_samples()
    all_samples.extend(sort_samples)
    print(f"  生成 {len(sort_samples)} 条")
    
    print("\n生成图表类样本...")
    chart_samples = generate_chart_samples()
    all_samples.extend(chart_samples)
    print(f"  生成 {len(chart_samples)} 条")
    
    # 去重
    unique_samples = []
    seen = set()
    for sample in all_samples:
        key = (sample['text'], sample['label'])
        if key not in seen:
            seen.add(key)
            unique_samples.append(sample)
    
    print(f"\n去重前: {len(all_samples)} 条")
    print(f"去重后: {len(unique_samples)} 条")
    
    # 如果超过1000条，随机采样
    if len(unique_samples) > 1000:
        random.seed(42)
        unique_samples = random.sample(unique_samples, 1000)
        print(f"采样后: {len(unique_samples)} 条")
    
    # 统计各意图类型
    intent_counts = {}
    for sample in unique_samples:
        intent = sample['label']
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
    
    print("\n各意图类型分布:")
    for intent, count in sorted(intent_counts.items()):
        print(f"  {intent}: {count} 条 ({count/len(unique_samples)*100:.1f}%)")
    
    # 保存数据
    output_data = {
        'description': '智能数据洞察助手V3.0 - 大规模训练数据集（1000条）',
        'version': '3.0.0',
        'total_samples': len(unique_samples),
        'intents': {}
    }
    
    # 按意图类型组织
    for intent in intent_counts.keys():
        intent_samples = [s for s in unique_samples if s['label'] == intent]
        output_data['intents'][intent] = {
            'samples': intent_samples
        }
    
    with open('training_data_large.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n已保存到 training_data_large.json")
    print("=" * 60)
    print("数据生成完成！")
    print("=" * 60)
    print("\n下一步: 运行 prepare_training_data.py 转换数据格式")

if __name__ == '__main__':
    main()
