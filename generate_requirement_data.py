# -*- coding: utf-8 -*-
"""
智能数据分析助手 - 需求分类训练数据生成
功能：生成数据分析需求 vs 无关需求的二分类训练数据
"""

import json
import random

# 数据分析相关需求模板
DATA_ANALYSIS_TEMPLATES = {
    'query_find': [
        "查找{column}的最大值",
        "查找最大的{column}",
        "找出{column}最大的",
        "谁的{column}最大",
        "哪个{column}最大",
        "{column}最大的是谁",
        "查找{column}的最小值",
        "查找最小的{column}",
        "找出{column}最小的",
        "谁的{column}最小",
        "查找前{num}名",
        "找出排名前{num}的",
        "查找第{num}名",
    ],
    'query_aggregate': [
        "统计{column}的平均值",
        "计算{column}的平均",
        "{column}的平均值是多少",
        "按{group}统计{column}的平均值",
        "各{group}的{column}平均值",
        "统计{column}的总和",
        "计算{column}的合计",
        "{column}的总和是多少",
        "按{group}统计{column}的总和",
        "统计数量",
        "计算总数",
        "按{group}统计数量",
        "各{group}有多少",
    ],
    'query_filter': [
        "筛选出{value}的数据",
        "只看{value}的",
        "只要{value}的记录",
        "显示{value}的数据",
        "{column}为{value}的",
        "排除{value}的数据",
        "不要{value}的",
        "{column}大于{num}的",
        "{column}小于{num}的",
        "{column}在{num1}到{num2}之间的",
    ],
    'query_sort': [
        "按{column}排序",
        "按照{column}排列",
        "根据{column}排序",
        "{column}从高到低",
        "{column}从大到小",
        "{column}从小到大",
        "按{column}降序排列",
        "按{column}升序排列",
    ],
    'chart': [
        "绘制{column}的柱状图",
        "画一个{column}的柱状图",
        "按{group}绘制{column}柱状图",
        "各{group}的{column}柱状图",
        "绘制{column}的折线图",
        "画{column}的趋势图",
        "{column}的变化趋势",
        "绘制{column}的饼图",
        "画{column}的占比图",
        "{group}的分布饼图",
        "生成图表",
        "可视化展示",
        "画个图看看",
    ]
}

# 无关需求模板
IRRELEVANT_TEMPLATES = {
    'greeting': [
        "你好",
        "您好",
        "嗨",
        "哈喽",
        "在吗",
        "在不在",
        "有人吗",
        "你好呀",
        "您好呀",
        "早上好",
        "下午好",
        "晚上好",
        "晚安",
        "再见",
        "拜拜",
        "谢谢",
        "感谢",
        "辛苦了",
    ],
    'chat': [
        "今天天气怎么样",
        "明天会下雨吗",
        "今天下雨了没",
        "天气如何",
        "气温多少",
        "讲个笑话",
        "说个故事",
        "来首诗",
        "唱首歌",
        "你叫什么名字",
        "你是谁",
        "你多大了",
        "你有女朋友吗",
        "你喜欢什么",
        "你真聪明",
        "你真笨",
        "你好厉害",
        "无聊",
        "好无聊啊",
        "陪我聊聊天",
        "聊聊天吧",
    ],
    'other_task': [
        "帮我写一篇作文",
        "翻译这段话",
        "帮我写代码",
        "这个bug怎么修",
        "帮我查一下股票",
        "今天新闻有什么",
        "推荐一部电影",
        "有什么好听的音乐",
        "帮我买东西",
        "叫个外卖",
        "打个车",
        "导航到北京",
        "帮我订机票",
        "查一下快递",
        "帮我做作业",
        "教我英语",
        "怎么学编程",
        "如何减肥",
        "怎么做菜",
    ],
    'unclear': [
        "帮我",
        "帮忙",
        "帮我看看",
        "分析一下",
        "统计一下",
        "查一下",
        "看看",
        "分析",
        "统计",
        "查询",
        "123",
        "测试",
        "hello",
        "hi",
        "abc",
        "???",
        "。。。"
    ]
}

# 列名模板
COLUMNS = [
    "险情确认时长", "处理时长", "响应时长", "持续时间", "金额", "费用", "成本",
    "数量", "次数", "人数", "销售额", "收入", "支出", "利润",
    "省公司", "市公司", "区域", "地区", "部门", "类型", "状态",
    "温度", "湿度", "速度", "距离", "面积", "体积", "重量",
    "年龄", "身高", "体重", "分数", "成绩", "工资", "奖金"
]

# 分组列
GROUPS = ["省公司", "市公司", "区域", "地区", "部门", "类型", "状态", "时间", "日期"]

# 值
VALUES = ["广东", "北京", "上海", "深圳", "测试", "正式", "已完成", "进行中", "待处理"]

def generate_data_analysis_samples():
    """生成数据分析相关需求样本"""
    samples = []
    
    for category, templates in DATA_ANALYSIS_TEMPLATES.items():
        for template in templates:
            # 为每个模板生成多个样本
            for _ in range(5):
                column = random.choice(COLUMNS)
                group = random.choice(GROUPS)
                value = random.choice(VALUES)
                num = random.choice([1, 3, 5, 10, 20])
                num1 = random.randint(1, 100)
                num2 = random.randint(num1, 200)
                
                try:
                    text = template.format(
                        column=column,
                        group=group,
                        value=value,
                        num=num,
                        num1=num1,
                        num2=num2
                    )
                    samples.append({
                        'text': text,
                        'label': 'DATA_ANALYSIS',
                        'category': category
                    })
                except:
                    pass
    
    return samples

def generate_irrelevant_samples():
    """生成无关需求样本"""
    samples = []
    
    for category, templates in IRRELEVANT_TEMPLATES.items():
        for template in templates:
            samples.append({
                'text': template,
                'label': 'IRRELEVANT',
                'category': category
            })
            
            # 添加一些变体
            if category == 'greeting':
                samples.append({
                    'text': template + "！",
                    'label': 'IRRELEVANT',
                    'category': category
                })
                samples.append({
                    'text': template + "。",
                    'label': 'IRRELEVANT',
                    'category': category
                })
    
    return samples

def main():
    print("=" * 60)
    print("需求分类训练数据生成")
    print("=" * 60)
    
    # 生成样本
    print("\n生成数据分析需求样本...")
    data_analysis_samples = generate_data_analysis_samples()
    print(f"  生成 {len(data_analysis_samples)} 条")
    
    print("\n生成无关需求样本...")
    irrelevant_samples = generate_irrelevant_samples()
    print(f"  生成 {len(irrelevant_samples)} 条")
    
    # 合并并打乱
    all_samples = data_analysis_samples + irrelevant_samples
    random.seed(42)
    random.shuffle(all_samples)
    
    # 统计
    print(f"\n总计: {len(all_samples)} 条样本")
    print(f"  DATA_ANALYSIS: {len(data_analysis_samples)} 条 ({len(data_analysis_samples)/len(all_samples)*100:.1f}%)")
    print(f"  IRRELEVANT: {len(irrelevant_samples)} 条 ({len(irrelevant_samples)/len(all_samples)*100:.1f}%)")
    
    # 保存
    output = {
        'description': '需求分类训练数据 - 二分类（数据分析需求 vs 无关需求）',
        'version': '1.0.0',
        'labels': {
            'DATA_ANALYSIS': '数据分析相关需求',
            'IRRELEVANT': '无关需求（问候、聊天、其他任务等）'
        },
        'samples': all_samples
    }
    
    with open('requirement_train_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n已保存到 requirement_train_data.json")
    
    # 同时生成train/val/test格式
    from sklearn.model_selection import train_test_split
    
    train_samples, temp = train_test_split(all_samples, test_size=0.3, random_state=42, 
                                            stratify=[s['label'] for s in all_samples])
    val_samples, test_samples = train_test_split(temp, test_size=0.5, random_state=42,
                                                  stratify=[s['label'] for s in temp])
    
    print(f"\n划分数据集:")
    print(f"  训练集: {len(train_samples)} 条")
    print(f"  验证集: {len(val_samples)} 条")
    print(f"  测试集: {len(test_samples)} 条")
    
    # 保存为训练格式
    for name, data in [('train', train_samples), ('val', val_samples), ('test', test_samples)]:
        with open(f'requirement_{name}.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("\n数据生成完成！")

if __name__ == '__main__':
    main()
