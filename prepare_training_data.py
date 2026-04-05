# -*- coding: utf-8 -*-
"""
训练数据准备脚本
合并现有训练数据与V3.3新增意图数据
"""

import json
import random
from pathlib import Path

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def convert_v33_data(v33_data):
    """将V3.3格式转换为训练格式"""
    converted = []
    for item in v33_data:
        converted.append({
            "text": item["text"],
            "intent": item["label"],
            "sub_type": item.get("params", {}).get("aggregateFunction", 
                        item.get("params", {}).get("operationType",
                        item.get("params", {}).get("chartType", "default")))
        })
    return converted

def augment_data(data, multiplier=3):
    """数据增强：通过同义词替换等方式增加数据量"""
    augmented = []
    
    # 同义词映射
    synonyms = {
        "销售额": ["销售金额", "销售总额", "销售业绩", "销售数据"],
        "中位数": ["中值", "中间值", "中位数值"],
        "众数": ["出现最多的值", "最频繁的值"],
        "标准差": ["波动程度", "离散程度", "波动性"],
        "方差": ["方差值", "离散程度"],
        "统计": ["计算", "算一下", "求"],
        "分析": ["查看", "展示", "分析一下"],
        "画": ["绘制", "生成", "创建", "制作"],
        "图": ["图表", "图形"],
        "导出": ["保存", "下载", "输出"],
        "删除": ["去除", "去掉", "清除"],
        "重复": ["重复项", "重复数据", "重复记录"],
        "空值": ["缺失值", "空白值", "空数据"],
        "填充": ["补全", "补充", "填补"],
        "异常值": ["离群点", "异常数据", "离群值"],
        "透视表": ["交叉表", "交叉分析", "透视分析"],
        "交叉": ["交叉统计", "交叉分析", "交叉对比"],
        "组合图": ["混合图", "双轴图", "复合图"],
        "雷达图": ["蛛网图", "星形图"],
        "漏斗图": ["转化漏斗", "漏斗分析"],
        "热力图": ["热图", "热度图"],
    }
    
    for item in data:
        # 原始数据
        augmented.append(item)
        
        # 数据增强
        text = item["text"]
        for _ in range(multiplier - 1):
            new_text = text
            # 随机替换同义词
            for word, syns in synonyms.items():
                if word in new_text and random.random() > 0.5:
                    new_text = new_text.replace(word, random.choice(syns), 1)
            
            if new_text != text:
                augmented.append({
                    "text": new_text,
                    "intent": item["intent"],
                    "sub_type": item["sub_type"]
                })
    
    return augmented

def prepare_training_data():
    """准备训练数据"""
    print("=" * 60)
    print("准备V3.3训练数据")
    print("=" * 60)
    
    # 加载现有训练数据
    print("\n加载现有训练数据...")
    train_data = load_json('train_data.json')
    val_data = load_json('val_data.json')
    test_data = load_json('test_data.json')
    
    print(f"  原始训练集: {len(train_data)} 条")
    print(f"  原始验证集: {len(val_data)} 条")
    print(f"  原始测试集: {len(test_data)} 条")
    
    # 加载V3.3新数据
    print("\n加载V3.3新增数据...")
    v33_data = load_json('training_data/v33_extended_intents.json')
    v33_converted = convert_v33_data(v33_data)
    print(f"  V3.3新增数据: {len(v33_converted)} 条")
    
    # 数据增强
    print("\n进行数据增强...")
    v33_augmented = augment_data(v33_converted, multiplier=4)
    print(f"  增强后V3.3数据: {len(v33_augmented)} 条")
    
    # 合并数据
    print("\n合并数据...")
    all_data = train_data + val_data + test_data + v33_augmented
    print(f"  总数据量: {len(all_data)} 条")
    
    # 打乱数据
    random.shuffle(all_data)
    
    # 划分数据集 (70% 训练, 15% 验证, 15% 测试)
    total = len(all_data)
    train_size = int(total * 0.7)
    val_size = int(total * 0.15)
    
    new_train = all_data[:train_size]
    new_val = all_data[train_size:train_size + val_size]
    new_test = all_data[train_size + val_size:]
    
    print(f"\n划分数据集:")
    print(f"  训练集: {len(new_train)} 条 ({len(new_train)/total*100:.1f}%)")
    print(f"  验证集: {len(new_val)} 条 ({len(new_val)/total*100:.1f}%)")
    print(f"  测试集: {len(new_test)} 条 ({len(new_test)/total*100:.1f}%)")
    
    # 统计各意图分布
    print("\n训练集意图分布:")
    intent_counts = {}
    for item in new_train:
        intent = item["intent"]
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
    
    for intent, count in sorted(intent_counts.items(), key=lambda x: -x[1]):
        print(f"  {intent}: {count} 条")
    
    # 保存数据
    print("\n保存数据...")
    save_json('train_data.json', new_train)
    save_json('val_data.json', new_val)
    save_json('test_data.json', new_test)
    
    print("\n数据准备完成！")
    print("=" * 60)

if __name__ == '__main__':
    random.seed(42)  # 设置随机种子，保证可复现
    prepare_training_data()
