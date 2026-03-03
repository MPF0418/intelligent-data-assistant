# Excel对标分析 - 产品能力差距与迭代规划

**版本**: V3.3规划  
**日期**: 2026-03-02  
**对标工具**: Microsoft Excel  

---

## 1. Excel核心数据分析能力清单

### 1.1 数据处理能力

| 功能分类 | Excel功能 | 描述 | 当前系统支持 |
|---------|----------|------|-------------|
| **数据导入** | 多格式导入 | CSV、Excel、TXT、JSON、数据库连接 | ✅ CSV/Excel |
| | 多Sheet支持 | 一个文件多个工作表 | ❌ 不支持 |
| | 数据分列 | 按分隔符拆分列 | ❌ 不支持 |
| | 文本转列 | 固定宽度分列 | ❌ 不支持 |
| **数据清洗** | 去除重复 | 删除重复行 | ⚠️ 部分支持 |
| | 空值处理 | 填充、删除、插值 | ⚠️ 部分支持 |
| | 数据类型转换 | 文本/数字/日期转换 | ❌ 不支持 |
| | 查找替换 | 批量查找替换 | ❌ 不支持 |
| | 文本处理 | 合并、截取、大小写转换 | ❌ 不支持 |
| **数据验证** | 数据验证规则 | 限制输入范围、格式 | ❌ 不支持 |
| | 条件格式 | 按条件高亮显示 | ❌ 不支持 |
| | 错误检查 | 公式错误提示 | ⚠️ 部分支持 |

### 1.2 数据分析能力

| 功能分类 | Excel功能 | 描述 | 当前系统支持 |
|---------|----------|------|-------------|
| **基础统计** | 求和/平均/计数 | SUM/AVERAGE/COUNT | ✅ 支持 |
| | 最大/最小值 | MAX/MIN | ✅ 支持 |
| | 中位数/众数 | MEDIAN/MODE | ❌ 不支持 |
| | 标准差/方差 | STDEV/VAR | ❌ 不支持 |
| | 百分位数 | PERCENTILE | ❌ 不支持 |
| **高级统计** | 排名 | RANK | ⚠️ 部分支持 |
| | 分组统计 | GROUP BY | ✅ 支持 |
| | 交叉统计 | 交叉表/透视表 | ❌ 不支持 |
| | 相关性分析 | CORREL | ❌ 不支持 |
| | 回归分析 | 线性回归 | ❌ 不支持 |
| **数据透视** | 数据透视表 | 多维数据分析 | ❌ 不支持 |
| | 切片器 | 交互式筛选 | ❌ 不支持 |
| | 时间线 | 时间维度筛选 | ❌ 不支持 |
| **公式计算** | 数学函数 | 三角函数、对数等 | ❌ 不支持 |
| | 逻辑函数 | IF/AND/OR/SWITCH | ❌ 不支持 |
| | 查找函数 | VLOOKUP/XLOOKUP | ❌ 不支持 |
| | 日期函数 | 日期计算、格式化 | ⚠️ 部分支持 |
| | 文本函数 | 字符串处理 | ❌ 不支持 |

### 1.3 可视化能力

| 功能分类 | Excel功能 | 描述 | 当前系统支持 |
|---------|----------|------|-------------|
| **基础图表** | 柱状图 | 簇状、堆积、百分比 | ✅ 基础柱状图 |
| | 折线图 | 带标记、平滑线 | ✅ 基础折线图 |
| | 饼图 | 普通、环形、复合饼图 | ✅ 基础饼图 |
| | 散点图 | 普通、气泡图 | ⚠️ 基础散点图 |
| **高级图表** | 组合图 | 多图表组合 | ❌ 不支持 |
| | 面积图 | 普通、堆积面积图 | ❌ 不支持 |
| | 雷达图 | 多维度对比 | ❌ 不支持 |
| | 热力图 | 矩阵热力图 | ❌ 不支持 |
| | 树状图 | 层级数据展示 | ❌ 不支持 |
| | 漏斗图 | 流程转化分析 | ❌ 不支持 |
| | 箱线图 | 数据分布分析 | ❌ 不支持 |
| **图表增强** | 趋势线 | 线性、指数、多项式 | ❌ 不支持 |
| | 误差线 | 数据误差范围 | ❌ 不支持 |
| | 数据标签 | 数值、百分比、自定义 | ⚠️ 基础标签 |
| | 双Y轴 | 左右双轴 | ❌ 不支持 |
| | 图表交互 | 悬停、点击、缩放 | ⚠️ 基础交互 |

### 1.4 数据操作能力

| 功能分类 | Excel功能 | 描述 | 当前系统支持 |
|---------|----------|------|-------------|
| **排序筛选** | 单列排序 | 升序/降序 | ✅ 支持 |
| | 多列排序 | 多条件排序 | ⚠️ 部分支持 |
| | 自动筛选 | 按条件筛选 | ✅ 支持 |
| | 高级筛选 | 复杂条件筛选 | ⚠️ 部分支持 |
| **数据编辑** | 单元格编辑 | 直接编辑 | ❌ 不支持 |
| | 批量填充 | 拖拽填充 | ❌ 不支持 |
| | 撤销重做 | 操作历史 | ❌ 不支持 |
| | 复制粘贴 | 数据复制 | ⚠️ 部分支持 |
| **数据导出** | 导出Excel | 保存为Excel | ❌ 不支持 |
| | 导出CSV | 保存为CSV | ❌ 不支持 |
| | 导出图片 | 图表导出图片 | ✅ 支持 |
| | 导出PDF | 导出PDF报告 | ✅ 支持 |

---

## 2. 核心差距分析

### 2.1 高优先级差距（P0 - 必须实现）

#### 差距1: 数据透视表能力缺失
**Excel能力**: 数据透视表是Excel最强大的数据分析工具，支持：
- 多维度分组统计
- 行列交叉分析
- 动态筛选和钻取
- 多种聚合方式

**当前系统**: 完全不支持

**用户痛点**: 无法进行"按地区、按产品、按时间的交叉分析"

**解决方案**: 实现轻量级数据透视表功能

#### 差距2: 高级统计函数缺失
**Excel能力**: 支持中位数、众数、标准差、方差、百分位数等
**当前系统**: 只支持求和、平均、计数、最大、最小

**用户痛点**: 无法回答"销售额的中位数是多少"、"数据的波动程度如何"

**解决方案**: 扩展聚合函数库

#### 差距3: 组合图/双Y轴图不支持
**Excel能力**: 可以将柱状图和折线图组合，支持双Y轴
**当前系统**: 只支持单一图表类型

**用户痛点**: 无法同时展示"销售额和增长率"这类不同量级的数据

**解决方案**: 实现组合图和双Y轴支持

### 2.2 中优先级差距（P1 - 应该实现）

#### 差距4: 数据清洗能力不足
**Excel能力**: 去重、空值处理、数据类型转换、文本处理
**当前系统**: 只有基础的去重和空值处理

**用户痛点**: 无法处理"脏数据"

**解决方案**: 增强数据预处理模块

#### 差距5: 条件格式缺失
**Excel能力**: 按条件高亮单元格（如大于100显示红色）
**当前系统**: 不支持

**用户痛点**: 无法快速识别异常数据

**解决方案**: 实现条件格式功能

#### 差距6: 更多图表类型
**Excel能力**: 雷达图、热力图、漏斗图、箱线图等
**当前系统**: 只支持4种基础图表

**用户痛点**: 无法满足多样化的可视化需求

**解决方案**: 扩展图表库

### 2.3 低优先级差距（P2 - 可以实现）

#### 差距7: 数据导出能力
**Excel能力**: 导出Excel、CSV
**当前系统**: 不支持

**解决方案**: 添加数据导出功能

#### 差距8: 多Sheet支持
**Excel能力**: 一个文件多个工作表
**当前系统**: 只支持单Sheet

**解决方案**: 支持多Sheet加载和关联

---

## 3. 产品能力迭代计划

### 3.1 V3.3 迭代目标

**核心目标**: 补齐核心数据分析能力差距，达到Excel 60%的核心功能覆盖

**迭代重点**:
1. 数据透视表能力
2. 高级统计函数
3. 组合图/双Y轴
4. 数据清洗增强

### 3.2 功能迭代清单

#### 阶段一：核心分析能力（2周）

| 功能 | 描述 | 优先级 | 复杂度 |
|-----|------|-------|-------|
| 数据透视表 | 多维交叉分析 | P0 | 高 |
| 中位数/众数 | 统计函数扩展 | P0 | 低 |
| 标准差/方差 | 统计函数扩展 | P0 | 低 |
| 百分位数 | 统计函数扩展 | P1 | 低 |
| 组合图 | 柱状图+折线图组合 | P0 | 中 |
| 双Y轴 | 左右双轴支持 | P0 | 中 |

#### 阶段二：数据处理能力（1周）

| 功能 | 描述 | 优先级 | 复杂度 |
|-----|------|-------|-------|
| 数据去重增强 | 按列去重、重复标记 | P1 | 低 |
| 空值处理增强 | 填充策略（均值、中位数、插值） | P1 | 中 |
| 数据类型转换 | 文本/数字/日期转换 | P1 | 中 |
| 条件格式 | 按条件高亮显示 | P1 | 中 |

#### 阶段三：可视化增强（1周）

| 功能 | 描述 | 优先级 | 复杂度 |
|-----|------|-------|-------|
| 趋势线 | 线性、指数趋势线 | P1 | 中 |
| 雷达图 | 多维度对比 | P2 | 低 |
| 漏斗图 | 转化分析 | P2 | 低 |
| 数据标签增强 | 百分比、自定义格式 | P1 | 低 |

#### 阶段四：数据导出（0.5周）

| 功能 | 描述 | 优先级 | 复杂度 |
|-----|------|-------|-------|
| 导出Excel | 保存为xlsx格式 | P1 | 中 |
| 导出CSV | 保存为CSV格式 | P1 | 低 |

---

## 4. 意图识别模型扩展

### 4.1 新增意图类型

```javascript
// V3.3 新增意图类型
const NEW_INTENT_TYPES = {
    // 数据透视表相关
    'PIVOT_TABLE': '数据透视分析',
    'PIVOT_DRILLDOWN': '透视表钻取',
    
    // 高级统计相关
    'STAT_MEDIAN': '中位数统计',
    'STAT_MODE': '众数统计',
    'STAT_STDDEV': '标准差统计',
    'STAT_VARIANCE': '方差统计',
    'STAT_PERCENTILE': '百分位数统计',
    
    // 组合图表相关
    'CHART_COMBO': '组合图表',
    'CHART_DUAL_AXIS': '双轴图表',
    
    // 数据清洗相关
    'DATA_CLEAN': '数据清洗',
    'DATA_DEDUP': '数据去重',
    'DATA_FILLNA': '空值填充',
    'DATA_CONVERT': '数据类型转换',
    
    // 条件格式相关
    'CONDITION_FORMAT': '条件格式',
    'HIGHLIGHT_RULE': '高亮规则',
    
    // 数据导出相关
    'EXPORT_EXCEL': '导出Excel',
    'EXPORT_CSV': '导出CSV'
};
```

### 4.2 训练数据扩展

需要为新增意图准备训练数据，示例：

```json
// 数据透视表意图训练数据
{
    "text": "按地区和产品统计销售额",
    "label": "PIVOT_TABLE",
    "params": {
        "rowColumn": "地区",
        "colColumn": "产品",
        "valueColumn": "销售额",
        "aggregateFunction": "sum"
    }
}

// 中位数意图训练数据
{
    "text": "销售额的中位数是多少",
    "label": "STAT_MEDIAN",
    "params": {
        "valueColumn": "销售额"
    }
}

// 组合图意图训练数据
{
    "text": "画一个柱状图显示销售额，折线图显示增长率",
    "label": "CHART_COMBO",
    "params": {
        "charts": [
            {"type": "bar", "yAxisColumn": "销售额"},
            {"type": "line", "yAxisColumn": "增长率"}
        ]
    }
}
```

---

## 5. 技术实现方案

### 5.1 数据透视表实现

```javascript
// 数据透视表核心逻辑
class PivotTable {
    constructor(data, config) {
        this.data = data;
        this.config = config;  // { rows, cols, values, aggFunc }
    }
    
    generate() {
        const result = {};
        
        // 按行维度分组
        const rowGroups = this.groupBy(this.config.rows);
        
        // 按列维度分组
        const colGroups = this.groupBy(this.config.cols);
        
        // 计算交叉聚合值
        for (const rowKey of Object.keys(rowGroups)) {
            result[rowKey] = {};
            for (const colKey of Object.keys(colGroups)) {
                const filtered = this.intersect(rowGroups[rowKey], colGroups[colKey]);
                result[rowKey][colKey] = this.aggregate(filtered, this.config.values, this.config.aggFunc);
            }
        }
        
        return result;
    }
}
```

### 5.2 高级统计函数实现

```javascript
// 统计函数扩展
const StatFunctions = {
    // 中位数
    median(values) {
        const sorted = values.filter(v => !isNaN(v)).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    
    // 众数
    mode(values) {
        const counts = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    },
    
    // 标准差
    stdDev(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
    },
    
    // 方差
    variance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    },
    
    // 百分位数
    percentile(values, p) {
        const sorted = values.filter(v => !isNaN(v)).sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[index];
    }
};
```

### 5.3 组合图实现

```javascript
// 组合图配置生成
function generateComboChart(config) {
    const datasets = config.charts.map((chart, index) => ({
        type: chart.type,
        label: chart.yAxisColumn,
        data: extractData(chart.yAxisColumn),
        yAxisID: index === 0 ? 'y' : 'y1',
        borderColor: COLORS[index],
        backgroundColor: COLORS[index] + '80'
    }));
    
    return {
        type: 'bar',  // 基础类型
        data: {
            labels: extractData(config.xAxisColumn),
            datasets: datasets
        },
        options: {
            scales: {
                y: { position: 'left' },
                y1: { position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    };
}
```

---

## 6. 预期效果

### 6.1 功能覆盖提升

| 维度 | V3.2 | V3.3 | 提升 |
|-----|------|------|------|
| 数据处理能力 | 30% | 60% | +30% |
| 数据分析能力 | 40% | 70% | +30% |
| 可视化能力 | 35% | 55% | +20% |
| 整体功能覆盖 | 35% | 60% | +25% |

### 6.2 用户场景覆盖

**新增支持的用户场景**:
1. "按地区和产品交叉统计销售额" → 数据透视表
2. "销售额的中位数是多少" → 中位数统计
3. "数据的波动程度如何" → 标准差分析
4. "画一个柱状图显示销售额，折线图显示增长率" → 组合图
5. "把空值填充为平均值" → 空值处理
6. "大于1000的显示红色" → 条件格式
7. "导出为Excel文件" → 数据导出

---

## 7. 实施时间表

| 阶段 | 内容 | 时间 | 里程碑 |
|-----|------|------|-------|
| 阶段一 | 核心分析能力 | 第1-2周 | 数据透视表上线 |
| 阶段二 | 数据处理能力 | 第3周 | 数据清洗增强 |
| 阶段三 | 可视化增强 | 第4周 | 组合图上线 |
| 阶段四 | 数据导出 | 第5周 | 导出功能上线 |

---

**文档结束**
