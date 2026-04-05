# -*- coding: utf-8 -*-
"""
训练数据准备脚本 V2
合并所有训练数据并增强
"""

import json
import random

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
            "intent": item["label"] if "label" in item else item["intent"],
            "sub_type": item.get("sub_type", item.get("params", {}).get("aggregateFunction", 
                        item.get("params", {}).get("operationType",
                        item.get("params", {}).get("chartType", "default"))))
        })
    return converted

def augment_data(data, multiplier=3):
    """数据增强"""
    augmented = []
    
    synonyms = {
        "销售额": ["销售金额", "销售总额", "销售业绩", "销售数据"],
        "中位数": ["中值", "中间值", "中位数值"],
        "最高": ["最大", "第一", "榜首", "冠军"],
        "最低": ["最小", "最后", "倒数", "垫底"],
        "筛选": ["过滤", "筛选出", "找出", "只看"],
        "画": ["绘制", "生成", "创建", "制作", "展示"],
        "柱状图": ["柱形图", "条形图", "直方图"],
        "折线图": ["线图", "曲线图", "走势图"],
        "饼图": ["圆形图", "占比图", "扇形图"],
        "统计": ["计算", "算一下", "求"],
    }
    
    for item in data:
        augmented.append(item)
        
        text = item["text"]
        for _ in range(multiplier - 1):
            new_text = text
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

def main():
    print("=" * 60)
    print("准备V3.3训练数据（增强版）")
    print("=" * 60)
    
    # 加载现有训练数据
    train_data = load_json('train_data.json')
    val_data = load_json('val_data.json')
    test_data = load_json('test_data.json')
    
    print(f"\n原始训练集: {len(train_data)} 条")
    
    # 加载V3.3新数据
    v33_data = load_json('training_data/v33_extended_intents.json')
    v33_converted = convert_v33_data(v33_data)
    
    # 加载补充训练数据
    try:
        extra_data = load_json('training_data/补充训练数据.json')
        extra_converted = convert_v33_data(extra_data)
        print(f"补充数据: {len(extra_converted)} 条")
    except:
        extra_converted = []
    
    # 数据增强
    print("\n进行数据增强...")
    v33_augmented = augment_data(v33_converted, multiplier=4)
    extra_augmented = augment_data(extra_converted, multiplier=5)
    
    print(f"增强后V3.3数据: {len(v33_augmented)} 条")
    print(f"增强后补充数据: {len(extra_augmented)} 条")
    
    # 合并数据
    all_data = train_data + val_data + test_data + v33_augmented + extra_augmented
    print(f"\n总数据量: {len(all_data)} 条")
    
    # 打乱并划分
    random.shuffle(all_data)
    
    total = len(all_data)
    train_size = int(total * 0.7)
    val_size = int(total * 0.15)
    
    new_train = all_data[:train_size]
    new_val = all_data[train_size:train_size + val_size]
    new_test = all_data[train_size + val_size:]
    
    print(f"\n划分数据集:")
    print(f"  训练集: {len(new_train)} 条")
    print(f"  验证集: {len(new_val)} 条")
    print(f"  测试集: {len(new_test)} 条")
    
    # 统计意图分布
    print("\n训练集意图分布:")
    intent_counts = {}
    for item in new_train:
        intent = item["intent"]
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
    
    for intent, count in sorted(intent_counts.items(), key=lambda x: -x[1]):
        print(f"  {intent}: {count} 条")
    
    # 保存
    save_json('train_data.json', new_train)
    save_json('val_data.json', new_val)
    save_json('test_data.json', new_test)
    
    print("\n数据准备完成！")

if __name__ == '__main__':
    random.seed(42)
    main()
