// AI API 配置
const config = {
    ai: {
        apiKey: 'sk-btdkmingrkfgheiumwsphvnjvuayveeezkeuzgvcnunydlug', // 请在此处填写您的AI API密钥
        apiUrl: window.localStorage.getItem('apiUrl') || 'https://api.siliconflow.cn/v1', // 动态配置API地址，可从localStorage读取
        model: 'Pro/moonshotai/Kimi-K2.5', // 请在此处填写使用的AI模型
        temperature: 0.7,
        maxTokens: 1000,
        prompts: {
            dataAnalysis: `你是一位专业的数据分析师，请基于以下数据摘要提供详细的分析报告：

数据概览：
- 数据行数：{{rowCount}}
- 列数：{{columnCount}}
- 列名：{{columns}}

统计分析：
{{stats}}

请提供以下内容：
1. 数据质量评估
2. 关键指标分析
3. 数据分布情况
4. 异常值和趋势分析
5. 业务洞察和建议
6. 可视化建议

报告要求：
- 专业、清晰、有条理
- 重点突出，避免冗长
- 提供具体的数据分析结果
- 给出可操作的建议`,
            dataSummary: `请基于以下数据摘要生成一个简洁的数据分析报告：

数据概览：
- 数据行数：{{rowCount}}
- 列数：{{columnCount}}
- 列名：{{columns}}

统计分析：
{{stats}}

报告要求：
- 简洁明了，重点突出
- 包含关键数据洞察
- 给出业务建议
- 不超过500字`,
            chartRecommendation: `请根据以下数据特征，推荐最适合的图表类型：

数据列：{{columnName}}
数据类型：{{dataType}}（数值/文本/日期）
唯一值数量：{{uniqueCount}}
数据范围：{{min}} - {{max}}

请推荐图表类型并说明理由。

要求：
1. 推荐1-2种最适合的图表类型
2. 说明推荐理由，基于数据特征
3. 提供图表使用建议
4. 回答简洁明了，不超过200字`
        }
    },
    app: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        supportedFormats: ['.csv', '.xlsx']
    }
};