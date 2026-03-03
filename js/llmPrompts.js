// 大模型提示词模板 - 优化版本
// 产品意义：为大模型提供清晰的上下文和输出规范，提高配置生成的准确性

class LLMPrompts {
    constructor() {
        this.version = '3.1';
    }
    
    /**
     * 生成图表配置的智能提示词
     * 适用于：用户表达模糊、列名不明确、有复杂需求的情况
     * @param {string} userInput - 用户输入
     * @param {Array} columnInfo - 列信息
     * @param {Object} dataInfo - 数据信息
     * @param {Object} fileContext - 文件上下文（文件名、Sheet名称、关键词）
     */
    generateChartConfigPrompt(userInput, columnInfo, dataInfo, fileContext = null) {
        const columnDescriptions = columnInfo.map(col => {
            let desc = `- ${col.name} (${col.type})`;
            if (col.sampleValues && col.sampleValues.length > 0) {
                desc += `，示例值: ${col.sampleValues.slice(0, 3).join(', ')}`;
            }
            if (col.isMatched) {
                desc += ` [用户提到]`;
            }
            return desc;
        }).join('\n');
        
        // 构建文件上下文信息
        let fileContextSection = '';
        if (fileContext && (fileContext.fileName || fileContext.fileKeywords?.length > 0)) {
            fileContextSection = `
## 📁 文件上下文（重要参考）
- **文件名**: ${fileContext.fileName || '未知'}
- **Sheet名称**: ${fileContext.sheetName || '无'}
- **业务关键词**: ${fileContext.fileKeywords?.join('、') || '无'}

⚠️ **关键提示**：
1. 文件名和关键词可以帮助理解数据表的业务含义
2. 如果用户问"XX数量"且XX与文件关键词匹配，则XX指的是"数据行数"
3. 例如：文件名包含"事件"，用户问"事件数量"= 统计数据行数（COUNT）

**示例理解**：
- 文件名"24年3季度事件.xlsx"，用户问"事件有多少"
- 正确理解：用户想统计表中数据行数，返回 \`{"queryType": "count_rows"}\`
`;
        }
        
        return `你是一位数据可视化专家。请根据用户的需求和数据结构，生成图表配置。

## 用户输入
"${userInput}"
${fileContextSection}
## 数据结构
- 数据表共有 ${dataInfo.rowCount} 行数据
- 可用列：
${columnDescriptions}

## ⚠️ 重要：首先判断用户意图类型

请仔细分析用户输入，判断用户想要的是：

### 意图类型A：求总数/计数（返回一个数值）
用户问法特征：
- "有多少个XX"、"XX有多少个"、"一共几个XX"
- "统计XX的数量"、"XX的总数"
- "涉及多少个XX"、"包含多少XX"
- **如果XX与文件关键词匹配，则XX数量=数据行数**

**这种情况下，应该返回 queryType: "count_distinct" 或 "count_rows"，不要生成图表！**

示例1：
- 用户输入："表中涉及到多少个省公司"
- 正确输出：
\`\`\`json
{
  "queryType": "count_distinct",
  "column": "省公司名称",
  "title": "省公司数量统计",
  "description": "统计表中涉及的省公司数量（去重计数）"
}
\`\`\`

示例2（文件关键词匹配）：
- 文件名："24年3季度事件.xlsx"
- 用户输入："事件有多少"
- 正确输出：
\`\`\`json
{
  "queryType": "count_rows",
  "title": "事件数量统计",
  "description": "统计表中的事件数量（数据行数）"
}
\`\`\`

### 意图类型B：筛选查询（先筛选再统计，返回单个结果）
用户问法特征：
- "XX的YY是多少"（如"广东省的销售额是多少"）
- "XX的YY总和/平均值"（如"北京的销售额总和"）
- "XX和XX的YY"（如"广东和浙江的销售额"）

**这种情况下，应该返回带筛选条件的查询配置，不要生成分组图表！**

示例1（单个筛选值）：
- 用户输入："广东省的销售额是多少"
- 正确输出：
\`\`\`json
{
  "queryType": "filter_aggregate",
  "filterColumn": "省份",
  "filterValue": "广东",
  "valueColumn": "销售额",
  "aggregateFunction": "sum",
  "title": "广东省销售额",
  "description": "筛选省份=广东的数据，计算销售额总和"
}
\`\`\`

示例2（多个筛选值）：
- 用户输入："广东和浙江的销售额之和"
- 正确输出：
\`\`\`json
{
  "queryType": "filter_aggregate",
  "filterColumn": "省份",
  "filterValues": ["广东", "浙江"],
  "valueColumn": "销售额",
  "aggregateFunction": "sum",
  "title": "广东和浙江销售额总和",
  "description": "筛选省份=广东或浙江的数据，计算销售额总和"
}
\`\`\`

### 意图类型C：分组统计（返回分布，可生成图表）
用户问法特征：
- "各XX的YY"、"按XX统计YY"
- "XX的YY分布"、"每个XX有多少"
- "绘制XX的柱状图/图表"
- **"绘制柱状图和饼图" → 同时生成多个图表**

**注意区分**：
- "广东省的销售额" → 筛选查询（只看广东一个省）
- "各省份的销售额" → 分组统计（看所有省份的分布）

**这种情况下，才生成图表配置！**

示例1（单个图表）：
- 用户输入："各省公司有多少条记录"
- 正确输出：
\`\`\`json
{
  "chartType": "bar",
  "xAxisColumn": "省公司名称",
  "yAxisColumn": "主键",
  "aggregateFunction": "count",
  "title": "各省公司记录数量统计"
}
\`\`\`

示例2（多个图表）：
- 用户输入："根据各省公司的事件数量绘制柱状图和饼图"
- 正确输出（注意：返回数组格式）：
\`\`\`json
[
  {
    "chartType": "bar",
    "xAxisColumn": "省公司名称",
    "yAxisColumn": "主键",
    "aggregateFunction": "count",
    "title": "各省公司事件数量柱状图"
  },
  {
    "chartType": "pie",
    "labelColumn": "省公司名称",
    "valueColumn": "主键",
    "aggregateFunction": "count",
    "title": "各省公司事件数量饼图"
  }
]
\`\`\`

## 输出格式

### 如果是意图类型A（求总数），返回：
\`\`\`json
{
  "queryType": "count_distinct|count_rows",
  "column": "要去重计数的列名（count_distinct时必填）",
  "title": "统计标题",
  "description": "统计描述"
}
\`\`\`

### 如果是意图类型B（分组统计），返回单个图表或数组：

**单个图表**：
\`\`\`json
{
  "chartType": "bar|line|pie|scatter",
  "xAxisColumn": "分组列名（如：省公司名称）",
  "yAxisColumn": "数值列名（如：险情确认时长）",
  "aggregateFunction": "avg|sum|count|max|min",
  "title": "图表标题",
  "description": "图表描述",
  "sortOrder": "desc|asc",
  "dataTransform": {
    "unitConversion": {
      "from": "原始单位（如：秒）",
      "to": "目标单位（如：分钟）",
      "formula": "转换公式描述"
    },
    "decimalPlaces": 2
  }
}
\`\`\`

## 规则说明
1. **chartType**: 根据数据特征选择
   - bar: 分类数据对比（如：各省平均值对比）
   - line: 时间序列数据（如：趋势图）
   - pie: 占比分析（如：各部分占比）
   - scatter: 相关性分析

2. **xAxisColumn**: 分组依据的列
   - 通常是分类列（如：省公司、部门、类别）
   - 从可用列中选择最合适的

3. **yAxisColumn**: 需要统计的数值列
   - 必须是数值类型列
   - 用户提到的列优先

4. **aggregateFunction**: 聚合方式
   - avg: 平均值（如：平均时长）
   - sum: 总和（如：总金额）
   - count: 计数（如：记录数）
   - max/min: 最大/最小值

5. **dataTransform**: 数据转换（可选）
   - 如果用户要求单位转换，请在此配置
   - 如果要求保留小数位数，请设置 decimalPlaces

请根据以上要求，为用户输入生成配置。只返回JSON，不要其他内容。`;
    }
    
    /**
     * 生成查询配置的智能提示词
     * 适用于：用户需要查询数据而非生成图表的情况
     */
    generateQueryConfigPrompt(userInput, columnInfo, dataInfo) {
        const columnDescriptions = columnInfo.map(col => {
            let desc = `- ${col.name} (${col.type})`;
            if (col.sampleValues && col.sampleValues.length > 0) {
                desc += `，示例值: ${col.sampleValues.slice(0, 3).join(', ')}`;
            }
            return desc;
        }).join('\n');
        
        return `你是一位数据分析专家。请根据用户的需求和数据结构，生成查询配置。

## 用户输入
"${userInput}"

## 数据结构
- 数据表共有 ${dataInfo.rowCount} 行数据
- 可用列：
${columnDescriptions}

## 任务要求
请分析用户意图，生成查询配置。你需要：
1. 理解用户的查询条件（筛选、排序、聚合）
2. 从可用列中选择相关列
3. 确定筛选条件和排序方式
4. 如有计算需求（增长率、占比等），一并处理

## 输出格式
请返回JSON格式的配置：

\`\`\`json
{
  "queryType": "filter|aggregate|sort|top",
  "selectColumns": ["列名1", "列名2"],
  "filters": [
    {
      "column": "列名",
      "operator": "equals|contains|greater|less|between",
      "value": "筛选值"
    }
  ],
  "sortBy": {
    "column": "排序列名",
    "order": "asc|desc"
  },
  "limit": 100,
  "aggregations": [
    {
      "column": "聚合列名",
      "function": "sum|avg|count|max|min",
      "alias": "结果别名"
    }
  ],
  "calculations": [
    {
      "name": "计算结果列名",
      "formula": "计算公式描述",
      "expression": "计算表达式"
    }
  ]
}
\`\`\`

## 规则说明
1. **queryType**: 查询类型
   - filter: 筛选查询
   - aggregate: 聚合统计
   - sort: 排序查询
   - top: 取前N条

2. **selectColumns**: 需要返回的列（可选，默认全部）

3. **filters**: 筛选条件数组
   - operator: 操作符（equals等于、contains包含、greater大于、less小于、between范围）
   - 支持多个条件的 AND 关系

4. **sortBy**: 排序配置
   - column: 排序依据的列
   - order: asc升序、desc降序

5. **aggregations**: 聚合配置（用于统计查询）
   - function: 聚合函数
   - alias: 结果列的显示名称

6. **calculations**: 计算字段（用于复杂计算）
   - formula: 公式描述（如：增长率 = (本期-上期)/上期）
   - expression: 计算表达式

## 示例

**用户输入**: "查找险情确认时长大于30分钟的记录，按时长降序排列"

**预期输出**:
\`\`\`json
{
  "queryType": "filter",
  "filters": [
    {
      "column": "险情确认时长",
      "operator": "greater",
      "value": 1800
    }
  ],
  "sortBy": {
    "column": "险情确认时长",
    "order": "desc"
  }
}
\`\`\`

请根据以上要求，为用户输入生成查询配置。只返回JSON，不要其他内容。`;
    }
    
    /**
     * 生成意图识别的提示词
     * 用于判断用户是要查询还是生成图表
     */
    generateIntentRecognitionPrompt(userInput, columnInfo) {
        return `你是一位智能助手。请分析用户的输入，判断用户想要执行查询操作还是生成图表。

## 用户输入
"${userInput}"

## 可用数据列
${columnInfo.map(c => `- ${c.name} (${c.type})`).join('\n')}

## 任务
判断用户意图：
- **query**: 查询数据（查找、筛选、统计）
- **chart**: 生成图表（可视化、画图、绘制）

## 输出格式
返回JSON格式：

\`\`\`json
{
  "intent": "query|chart",
  "confidence": 0.95,
  "reason": "判断理由",
  "suggestedColumns": ["建议使用的列名"]
}
\`\`\`

## 判断规则
- 如果用户提到"图"、"表"、"可视化"、"绘制"、"画"等词，返回 "chart"
- 如果用户提到"查找"、"查询"、"统计"、"多少"、"最大"、"最小"等词，返回 "query"
- 如果不确定，默认返回 "query"

只返回JSON，不要其他内容。`;
    }
    
    /**
     * 生成列名匹配的提示词
     * 用于帮助大模型理解用户提到的列名对应数据表中的哪一列
     */
    generateColumnMatchingPrompt(userInput, columnInfo) {
        const columnDescriptions = columnInfo.map(col => {
            let desc = `${col.name} (${col.type})`;
            if (col.sampleValues && col.sampleValues.length > 0) {
                desc += ` - 示例: ${col.sampleValues.slice(0, 3).join(', ')}`;
            }
            return desc;
        }).join('\n');
        
        return `你是一位数据分析师。请帮助匹配用户提到的列名和数据表中的实际列名。

## 用户输入
"${userInput}"

## 数据表中的列
${columnDescriptions}

## 任务
从用户输入中提取提到的列名，并匹配到数据表中的实际列名。

## 输出格式
返回JSON格式：

\`\`\`json
{
  "mentionedColumns": [
    {
      "userMention": "用户提到的名称",
      "matchedColumn": "匹配的数据表列名",
      "confidence": 0.95,
      "reason": "匹配理由"
    }
  ],
  "unmatchedTerms": ["未能匹配的术语"]
}
\`\`\`

## 匹配规则
1. 完全匹配优先（如：用户说"省公司"，匹配"省公司名称"）
2. 部分匹配次之（如：用户说"时长"，匹配"险情确认时长"）
3. 语义匹配兜底（如：用户说"时间"，匹配"事发时间"或"险情确认时长"）

只返回JSON，不要其他内容。`;
    }
}

// 导出单例
export default new LLMPrompts();
