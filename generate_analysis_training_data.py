# -*- coding: utf-8 -*-
"""
数据分析三要素训练数据生成器
生成用于训练本地BERT模型的训练数据，包含：
1. 分析方式（聚合函数类型）识别
2. 输出目标（图表类型/数值输出）识别
3. 数据范围（列名+筛选条件）识别
"""

import json
import random

# ==================== 分析方式（聚合函数）训练数据 ====================

AGGREGATE_EXPRESSIONS = {
    'sum': [
        # 基础表达
        "{column}的总和", "{column}的合计", "{column}的总计", "{column}一共是多少",
        "{column}总共多少", "{column}加起来多少", "{column}累加", "{column}求和",
        "统计{column}的总和", "计算{column}的合计", "求{column}的总和",
        "{column}总和是多少", "{column}合计是多少", "{column}总计是多少",
        "所有{column}的总和", "全部{column}的合计", "整体{column}的总计",
        
        # 变体表达
        "{column}加总", "{column}累计", "{column}汇总", "{column}合计值",
        "把{column}加起来", "将{column}累加", "对{column}求和",
        "{column}的总数", "{column}的总金额", "{column}的总价",
        
        # 口语化表达
        "{column}一共", "{column}总共", "{column}加起来", "{column}合起来",
        "算一下{column}总和", "算算{column}合计", "算出{column}总计",
        "{column}加一块是多少", "{column}凑一起多少",
        
        # 业务场景表达
        "统计所有{column}", "汇总全部{column}", "计算整体{column}",
        "{column}的累计值", "{column}的汇总值", "{column}的合计数",
        "今年{column}总和", "本月{column}合计", "本季度{column}总计",
        
        # 组合表达
        "按{group}统计{column}的总和", "按{group}汇总{column}的合计",
        "各{group}的{column}总和", "每个{group}的{column}合计",
        "{group}的{column}总计是多少", "不同{group}的{column}总和",
    ],
    
    'avg': [
        # 基础表达
        "{column}的平均值", "{column}的平均", "{column}均值", "{column}平均数",
        "{column}的平均是多少", "{column}均值是多少", "{column}平均多少",
        "计算{column}的平均值", "求{column}的平均", "统计{column}的均值",
        "{column}平均值是多少", "{column}平均是多少",
        
        # 人均表达
        "{column}的人均", "人均{column}", "每人{column}平均",
        "{column}人均多少", "平均每人{column}", "每个人的{column}平均",
        
        # 变体表达
        "{column}的平均水平", "{column}的平均状况", "{column}的均值水平",
        "所有{column}的平均", "全部{column}的平均值", "整体{column}的均值",
        
        # 口语化表达
        "{column}大概多少", "{column}一般多少", "{column}通常多少",
        "{column}平均下来多少", "{column}平均算下来",
        
        # 业务场景表达
        "平均{column}", "均值{column}", "{column}平均值",
        "今年{column}平均", "本月{column}均值", "本季度{column}平均",
        
        # 组合表达
        "按{group}计算{column}的平均值", "各{group}的{column}平均",
        "每个{group}的{column}均值", "不同{group}的{column}平均值",
        "{group}的{column}平均是多少",
    ],
    
    'max': [
        # 基础表达
        "{column}的最大值", "{column}的最大", "{column}最高值", "{column}最高",
        "{column}最大是多少", "{column}最高是多少", "{column}的最大值是多少",
        "计算{column}的最大值", "求{column}的最大", "找出{column}的最大值",
        
        # 排名表达
        "{column}最高的", "{column}最大的", "{column}排第一的",
        "{column}第一名", "{column}冠军", "{column}榜首",
        
        # 变体表达
        "{column}的峰值", "{column}的顶点", "{column}的最高点",
        "{column}最大的是哪个", "{column}最高的是谁", "{column}最大的是谁",
        
        # 口语化表达
        "{column}最多是多少", "{column}最大能到多少", "{column}最高能到多少",
        "哪个{column}最大", "谁{column}最高", "哪个{column}最多",
        
        # 业务场景表达
        "最大的{column}", "最高的{column}", "{column}最大值",
        "今年{column}最高", "本月{column}最大", "本季度{column}最高",
        
        # 组合表达
        "按{group}统计{column}的最大值", "各{group}中{column}最大的",
        "哪个{group}的{column}最高", "{group}的{column}最大是多少",
        "找出{column}最高的{group}",
    ],
    
    'min': [
        # 基础表达
        "{column}的最小值", "{column}的最小", "{column}最低值", "{column}最低",
        "{column}最小是多少", "{column}最低是多少", "{column}的最小值是多少",
        "计算{column}的最小值", "求{column}的最小", "找出{column}的最小值",
        
        # 排名表达
        "{column}最低的", "{column}最小的", "{column}排最后的",
        "{column}最后一名", "{column}垫底", "{column}倒数第一",
        
        # 变体表达
        "{column}的谷值", "{column}的最低点", "{column}的底部",
        "{column}最小的是哪个", "{column}最低的是谁", "{column}最小的是谁",
        
        # 口语化表达
        "{column}最少是多少", "{column}最小能到多少", "{column}最低能到多少",
        "哪个{column}最小", "谁{column}最低", "哪个{column}最少",
        
        # 业务场景表达
        "最小的{column}", "最低的{column}", "{column}最小值",
        "今年{column}最低", "本月{column}最小", "本季度{column}最低",
        
        # 组合表达
        "按{group}统计{column}的最小值", "各{group}中{column}最小的",
        "哪个{group}的{column}最低", "{group}的{column}最小是多少",
        "找出{column}最低的{group}",
    ],
    
    'count': [
        # 基础表达
        "{column}的数量", "{column}的个数", "{column}有多少", "{column}多少个",
        "统计{column}的数量", "计算{column}的个数", "数一下{column}",
        "{column}数量是多少", "{column}个数是多少",
        
        # 频次表达
        "{column}的次数", "{column}出现几次", "{column}发生了多少次",
        "{column}的频次", "{column}的频率", "{column}出现频率",
        
        # 变体表达
        "有多少{column}", "几个{column}", "多少条{column}",
        "{column}总共多少个", "{column}一共有多少", "{column}总计多少个",
        
        # 口语化表达
        "{column}多不多", "{column}有多少个", "数数{column}",
        "查一下{column}数量", "看看{column}有多少",
        
        # 业务场景表达
        "统计{column}", "计数{column}", "{column}计数",
        "今年{column}数量", "本月{column}个数", "本季度{column}数量",
        
        # 组合表达
        "按{group}统计{column}的数量", "各{group}的{column}有多少个",
        "每个{group}有多少{column}", "不同{group}的{column}数量",
        "{group}的{column}数量是多少",
    ],
    
    'median': [
        "{column}的中位数", "{column}的中间值", "{column}中位数是多少",
        "计算{column}的中位数", "求{column}的中间值", "统计{column}的中位数",
        "{column}中间那个值", "{column}排在中间的值", "{column}的median",
        "按{group}计算{column}的中位数", "各{group}的{column}中位数",
    ],
    
    'std': [
        "{column}的标准差", "{column}的波动", "{column}的离散程度",
        "计算{column}的标准差", "求{column}的波动", "统计{column}的离散程度",
        "{column}波动有多大", "{column}变化幅度", "{column}的稳定性",
        "按{group}计算{column}的标准差", "各{group}的{column}波动",
    ],
    
    'distinct_count': [
        "{column}有多少种", "{column}有多少个不同的值", "{column}的唯一值数量",
        "统计{column}的不同值", "计算{column}的唯一值", "{column}去重后有多少",
        "{column}有多少类", "{column}有多少个类别", "{column}的种类数量",
        "按{group}统计{column}的不同数量", "各{group}的{column}有多少种",
    ],
    
    'ratio': [
        "{column}的占比", "{column}的百分比", "{column}的比例",
        "计算{column}的占比", "求{column}的百分比", "统计{column}的比例",
        "{column}占多少比例", "{column}占百分之几", "{column}的份额",
        "{column}占总量的比例", "{column}的占比是多少",
        "按{group}计算{column}的占比", "各{group}的{column}占比",
    ],
    
    'growth_rate': [
        "{column}的增长率", "{column}的增幅", "{column}的涨幅",
        "计算{column}的增长率", "求{column}的增幅", "统计{column}的涨幅",
        "{column}增长了多少", "{column}涨了多少", "{column}增幅是多少",
        "{column}的增长速度", "{column}的变化率", "{column}的增长趋势",
        "按{group}计算{column}的增长率", "各{group}的{column}增长率",
    ],
    
    'yoy': [
        "{column}的同比", "{column}同比增长", "{column}与去年同期相比",
        "计算{column}的同比", "求{column}的同比增长率", "{column}同比是多少",
        "{column}同比变化", "{column}同比增减", "{column}同比涨跌",
        "按{group}计算{column}的同比", "各{group}的{column}同比",
    ],
    
    'mom': [
        "{column}的环比", "{column}环比增长", "{column}与上月相比",
        "计算{column}的环比", "求{column}的环比增长率", "{column}环比是多少",
        "{column}环比变化", "{column}环比增减", "{column}环比涨跌",
        "按{group}计算{column}的环比", "各{group}的{column}环比",
    ],
    
    'rank': [
        "{column}的排名", "{column}排第几", "{column}排名第几",
        "计算{column}的排名", "求{column}的排名", "统计{column}的排名",
        "{column}排在第几位", "{column}的名次", "{column}的排行",
        "按{group}计算{column}的排名", "各{group}的{column}排名",
    ],
}

# ==================== 输出目标训练数据 ====================

OUTPUT_EXPRESSIONS = {
    'chart_bar': [
        # 基础表达
        "绘制{column}的柱状图", "画{column}的柱状图", "生成{column}的柱状图",
        "{column}的柱状图", "柱状图显示{column}", "用柱状图展示{column}",
        "做一个{column}的柱状图", "出一张{column}的柱状图",
        
        # 变体表达
        "{column}柱状图", "{column}的条形图", "{column}的条形统计图",
        "条形图显示{column}", "用条形图展示{column}", "绘制{column}条形图",
        
        # 组合表达
        "按{group}绘制{column}的柱状图", "按{group}画{column}的柱状图",
        "各{group}的{column}柱状图", "不同{group}的{column}柱状图",
        "{group}的{column}柱状图", "按{group}统计{column}柱状图",
        
        # 口语化表达
        "给我画个{column}柱状图", "帮我做个{column}柱状图",
        "显示{column}柱状图", "展示{column}柱状图",
        
        # 对比场景
        "{column}对比柱状图", "{column}比较柱状图", "{column}对比图",
        "对比各{group}的{column}", "比较不同{group}的{column}",
    ],
    
    'chart_line': [
        # 基础表达
        "绘制{column}的折线图", "画{column}的折线图", "生成{column}的折线图",
        "{column}的折线图", "折线图显示{column}", "用折线图展示{column}",
        "做一个{column}的折线图", "出一张{column}的折线图",
        
        # 趋势表达
        "{column}的趋势图", "{column}的走势图", "{column}的变化趋势",
        "绘制{column}趋势图", "画{column}走势图", "{column}趋势折线图",
        
        # 变体表达
        "{column}折线图", "{column}的曲线图", "{column}的线图",
        "曲线图显示{column}", "用曲线图展示{column}",
        
        # 组合表达
        "按{group}绘制{column}的折线图", "各{group}的{column}折线图",
        "{group}的{column}趋势图", "按时间看{column}的折线图",
        
        # 口语化表达
        "给我画个{column}折线图", "帮我做个{column}趋势图",
        "显示{column}走势", "展示{column}变化趋势",
    ],
    
    'chart_pie': [
        # 基础表达
        "绘制{column}的饼图", "画{column}的饼图", "生成{column}的饼图",
        "{column}的饼图", "饼图显示{column}", "用饼图展示{column}",
        "做一个{column}的饼图", "出一张{column}的饼图",
        
        # 占比表达
        "{column}的占比饼图", "{column}的分布饼图", "{column}的比例图",
        "绘制{column}占比饼图", "画{column}分布饼图", "{column}占比图",
        
        # 变体表达
        "{column}饼图", "{column}的圆形图", "{column}的扇形图",
        "圆形图显示{column}", "用扇形图展示{column}",
        
        # 组合表达
        "按{group}绘制{column}的饼图", "各{group}的{column}饼图",
        "{group}的{column}分布", "按{group}看{column}占比",
        
        # 口语化表达
        "给我画个{column}饼图", "帮我做个{column}占比图",
        "显示{column}分布", "展示{column}占比",
    ],
    
    'chart_scatter': [
        "绘制{column}的散点图", "画{column}的散点图", "生成{column}的散点图",
        "{column}的散点图", "散点图显示{column}", "用散点图展示{column}",
        "{column}散点图", "{column}的点图", "{column}的散布图",
        "{column1}和{column2}的散点图", "{column1}与{column2}的关系图",
        "分析{column1}和{column2}的相关性", "{column1}与{column2}相关散点图",
    ],
    
    'chart_radar': [
        "绘制{column}的雷达图", "画{column}的雷达图", "生成{column}的雷达图",
        "{column}的雷达图", "雷达图显示{column}", "用雷达图展示{column}",
        "{column}雷达图", "{column}的蛛网图", "{column}的蜘蛛图",
        "各维度的{column}雷达图", "多维度{column}对比雷达图",
    ],
    
    'chart_area': [
        "绘制{column}的面积图", "画{column}的面积图", "生成{column}的面积图",
        "{column}的面积图", "面积图显示{column}", "用面积图展示{column}",
        "{column}面积图", "{column}的区域图", "{column}的堆叠面积图",
        "{column}趋势面积图", "{column}累计面积图",
    ],
    
    'value': [
        # 基础表达
        "{column}是多少", "{column}是什么", "{column}的值",
        "告诉我{column}", "显示{column}", "查询{column}",
        "查看{column}", "获取{column}", "读取{column}",
        
        # 疑问表达
        "{column}是多少？", "{column}怎么查？", "怎么知道{column}？",
        "想知道{column}", "需要{column}的值", "求{column}",
        
        # 结果表达
        "只要{column}的数值", "只需要{column}的值", "直接告诉我{column}",
        "不用画图，只要{column}", "不要图表，只要{column}数值",
        
        # 组合表达
        "{group}的{column}是多少", "各{group}的{column}是多少",
        "按{group}统计{column}", "{group}的{column}值",
        
        # 口语化表达
        "{column}呢", "{column}啥情况", "{column}怎么样",
        "看看{column}", "查查{column}", "算算{column}",
    ],
    
    'table': [
        # 基础表达
        "显示{column}的表格", "列出{column}", "展示{column}列表",
        "{column}的表格", "表格显示{column}", "用表格展示{column}",
        "做一个{column}表格", "出一张{column}表格",
        
        # 列表表达
        "{column}列表", "{column}清单", "{column}明细",
        "列出所有{column}", "显示全部{column}", "展示所有{column}",
        
        # 变体表达
        "{column}一览表", "{column}汇总表", "{column}统计表",
        "生成{column}表格", "制作{column}表格", "导出{column}表格",
        
        # 组合表达
        "按{group}列出{column}", "各{group}的{column}表格",
        "{group}的{column}列表", "按{group}显示{column}",
    ],
}

# ==================== 常用列名和分组名 ====================

COLUMNS = [
    "销售额", "金额", "数量", "价格", "成本", "利润", "收入", "支出",
    "工资", "年龄", "分数", "成绩", "评分", "得分",
    "时长", "时间", "周期", "天数", "小时数",
    "人数", "人次", "次数", "频次",
    "温度", "湿度", "速度", "距离",
    "增长率", "同比", "环比", "增幅",
    "完成率", "达标率", "合格率", "合格数",
    "事件数", "案件数", "问题数", "工单数",
]

GROUPS = [
    "省份", "城市", "地区", "区域", "地点",
    "部门", "团队", "小组", "单位", "机构",
    "产品", "类型", "类别", "分类", "品种",
    "月份", "季度", "年度", "年份", "周",
    "人员", "员工", "姓名", "名字", "用户",
    "状态", "级别", "等级", "阶段", "层级",
]

def generate_aggregate_training_data(num_samples=500):
    """生成聚合函数识别训练数据"""
    data = []
    
    for agg_type, expressions in AGGREGATE_EXPRESSIONS.items():
        samples_per_type = num_samples // len(AGGREGATE_EXPRESSIONS)
        
        for _ in range(samples_per_type):
            expr = random.choice(expressions)
            column = random.choice(COLUMNS)
            group = random.choice(GROUPS)
            
            # 替换占位符
            text = expr.replace("{column}", column).replace("{group}", group)
            
            data.append({
                "text": text,
                "aggregate_function": agg_type,
                "column": column,
                "group": group
            })
    
    return data

def generate_output_training_data(num_samples=500):
    """生成输出目标识别训练数据"""
    data = []
    
    for output_type, expressions in OUTPUT_EXPRESSIONS.items():
        samples_per_type = num_samples // len(OUTPUT_EXPRESSIONS)
        
        for _ in range(samples_per_type):
            expr = random.choice(expressions)
            column = random.choice(COLUMNS)
            group = random.choice(GROUPS)
            column2 = random.choice(COLUMNS)
            
            # 替换占位符
            text = expr.replace("{column}", column).replace("{group}", group)
            text = text.replace("{column1}", column).replace("{column2}", column2)
            
            data.append({
                "text": text,
                "output_type": output_type,
                "column": column,
                "group": group
            })
    
    return data

def generate_combined_training_data(num_samples=500):
    """生成组合训练数据（包含聚合函数和输出目标）"""
    data = []
    
    # 聚合函数 + 输出目标的组合
    combinations = [
        ("sum", "chart_bar"),
        ("avg", "chart_bar"),
        ("max", "chart_bar"),
        ("min", "chart_bar"),
        ("count", "chart_bar"),
        ("sum", "chart_line"),
        ("avg", "chart_line"),
        ("sum", "chart_pie"),
        ("count", "chart_pie"),
        ("sum", "value"),
        ("avg", "value"),
        ("max", "value"),
        ("min", "value"),
        ("count", "value"),
        ("sum", "table"),
        ("avg", "table"),
        ("count", "table"),
    ]
    
    templates = [
        "按{group}统计{column}的{agg}，用{output}展示",
        "计算各{group}的{column}{agg}，绘制{output}",
        "求{group}的{column}{agg}，生成{output}",
        "统计{group}的{column}{agg}，画{output}",
        "按{group}分析{column}的{agg}，显示{output}",
        "{group}的{column}{agg}是多少，用{output}表示",
        "各{group}的{column}{agg}，做成{output}",
        "不同{group}的{column}{agg}，展示为{output}",
    ]
    
    output_names = {
        "chart_bar": "柱状图",
        "chart_line": "折线图",
        "chart_pie": "饼图",
        "chart_scatter": "散点图",
        "chart_radar": "雷达图",
        "chart_area": "面积图",
        "value": "数值",
        "table": "表格",
    }
    
    agg_names = {
        "sum": "总和",
        "avg": "平均值",
        "max": "最大值",
        "min": "最小值",
        "count": "数量",
        "median": "中位数",
        "std": "标准差",
        "distinct_count": "不同数量",
        "ratio": "占比",
        "growth_rate": "增长率",
        "yoy": "同比",
        "mom": "环比",
        "rank": "排名",
    }
    
    for agg, output in combinations:
        samples_per_combo = num_samples // len(combinations)
        
        for _ in range(samples_per_combo):
            template = random.choice(templates)
            column = random.choice(COLUMNS)
            group = random.choice(GROUPS)
            
            text = template.replace("{column}", column)
            text = text.replace("{group}", group)
            text = text.replace("{agg}", agg_names.get(agg, agg))
            text = text.replace("{output}", output_names.get(output, output))
            
            data.append({
                "text": text,
                "aggregate_function": agg,
                "output_type": output,
                "column": column,
                "group": group
            })
    
    return data

def main():
    """主函数：生成所有训练数据"""
    print("=" * 60)
    print("数据分析三要素训练数据生成器")
    print("=" * 60)
    
    # 生成聚合函数训练数据
    print("\n1. 生成聚合函数识别训练数据...")
    agg_data = generate_aggregate_training_data(500)
    print(f"   生成 {len(agg_data)} 条数据")
    
    # 生成输出目标训练数据
    print("\n2. 生成输出目标识别训练数据...")
    output_data = generate_output_training_data(500)
    print(f"   生成 {len(output_data)} 条数据")
    
    # 生成组合训练数据
    print("\n3. 生成组合训练数据...")
    combined_data = generate_combined_training_data(500)
    print(f"   生成 {len(combined_data)} 条数据")
    
    # 合并所有数据
    all_data = agg_data + output_data + combined_data
    print(f"\n总计生成 {len(all_data)} 条训练数据")
    
    # 保存到文件
    output_file = "analysis_training_data.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"\n训练数据已保存到: {output_file}")
    
    # 统计各类型数量
    print("\n" + "=" * 60)
    print("数据统计:")
    print("=" * 60)
    
    agg_counts = {}
    for item in all_data:
        agg = item.get("aggregate_function", "N/A")
        agg_counts[agg] = agg_counts.get(agg, 0) + 1
    
    print("\n聚合函数类型分布:")
    for agg, count in sorted(agg_counts.items(), key=lambda x: -x[1]):
        print(f"  {agg}: {count} 条")
    
    output_counts = {}
    for item in all_data:
        output = item.get("output_type", "N/A")
        output_counts[output] = output_counts.get(output, 0) + 1
    
    print("\n输出目标类型分布:")
    for output, count in sorted(output_counts.items(), key=lambda x: -x[1]):
        print(f"  {output}: {count} 条")

if __name__ == "__main__":
    main()
