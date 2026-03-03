// 智能意图匹配器 - 基于语义相似度的列名匹配
// 解决"现场确认时间"无法匹配到"险情确认时长"的问题

class SmartIntentMatcher {
    constructor() {
        // 定义列名语义映射表
        this.semanticMappings = {
            // 时间/时长相关
            '时间': ['时间', '时长', '日期', '时刻', '周期'],
            '时长': ['时长', '时间', '耗时', '用时', '持续时间'],
            '确认': ['确认', '核实', '验证', '审核', '审批'],
            '现场': ['现场', '实地', '现场勘查', '现场处置'],
            
            // 组合概念
            '现场确认': ['现场确认', '现场核实', '现场验证', '现场勘查'],
            '确认时长': ['确认时长', '确认时间', '核实时长', '验证时间'],
            '现场时长': ['现场时长', '现场时间', '现场耗时'],
            '险情确认': ['险情确认', '险情核实', '险情验证', '确认险情'],
            
            // 地点相关
            '省': ['省', '省份', '省级', '省公司'],
            '市': ['市', '城市', '市级'],
            '区': ['区', '地区', '区域', '区县'],
            '部门': ['部门', '单位', '机构', '组织'],
            
            // 数值相关
            '金额': ['金额', '费用', '成本', '价格', '价值', '钱'],
            '数量': ['数量', '个数', '次数', '频次', '量'],
            '数值': ['数值', '值', '数据', '指标'],
            
            // 事件相关
            '事件': ['事件', '事故', '情况', '险情', '问题', '案例'],
            '险情': ['险情', '危险', '风险', '隐患', '事故'],
        };
        
        // 定义意图模板
        // 注意：模板按优先级排序，更具体的模式放在前面
        this.intentTemplates = [
            // ========== 平均值相关（最高优先级）==========
            {
                id: 'avg_groupby',
                name: '分组平均值统计',
                patterns: [
                    /按照(.+?)统计(.+?)平均值/,
                    /按(.+?)统计(.+?)平均值/,
                    /(.+?)的(.+?)平均值/,
                    /各(.+?)的(.+?)平均值/,
                    /统计各(.+?)的(.+?)平均值/,
                    /哪个(.+?)的(.+?)平均值最高/,  // 新增：哪个XX的YY平均值最高
                    /哪个(.+?)的(.+?)平均值最大/,  // 新增：哪个XX的YY平均值最大
                    /哪个(.+?)的(.+?)平均值最小/,  // 新增：哪个XX的YY平均值最小
                    /哪个(.+?)的(.+?)平均值最低/   // 新增：哪个XX的YY平均值最低
                ],
                requiredParams: ['groupCol', 'valueCol'],
                configGenerator: (params) => ({
                    chartType: 'bar',
                    aggregateFunction: 'avg',
                    sortOrder: 'desc',
                    xAxisColumn: params.groupCol,
                    yAxisColumn: params.valueCol,
                    title: `各${params.groupCol}${params.valueCol}平均值`,
                    description: `按照${params.groupCol}统计${params.valueCol}的平均值`,
                    dataTransform: params.conversion
                })
            },
            {
                id: 'avg_overall',
                name: '整体平均值统计',
                patterns: [
                    /统计所有(.+?)的平均值/,
                    /统计(.+?)的平均值/,
                    /所有(.+?)的平均值/,
                    /计算(.+?)的平均值/,
                    /(.+?)的平均值是多少/
                ],
                requiredParams: ['valueCol'],
                configGenerator: (params) => ({
                    chartType: 'bar',
                    aggregateFunction: 'avg',
                    sortOrder: 'desc',
                    xAxisColumn: null,  // 整体统计不需要X轴列
                    yAxisColumn: params.valueCol,
                    isOverall: true,
                    title: `${params.valueCol}平均值`,
                    description: `统计所有${params.valueCol}的平均值`,
                    dataTransform: params.conversion
                })
            },
            {
                id: 'sum_groupby',
                name: '分组求和统计',
                patterns: [
                    /按照(.+?)统计(.+?)(?:总和|合计|总计)/,
                    /按(.+?)统计(.+?)(?:总和|合计|总计)/,
                    /(.+?)的(.+?)(?:总和|合计|总计)/,
                    /统计各(.+?)的(.+?)(?:总和|合计|总计)/
                ],
                requiredParams: ['groupCol', 'valueCol'],
                configGenerator: (params) => ({
                    chartType: 'bar',
                    aggregateFunction: 'sum',
                    sortOrder: 'desc',
                    xAxisColumn: params.groupCol,
                    yAxisColumn: params.valueCol,
                    title: `各${params.groupCol}${params.valueCol}总和`,
                    description: `按照${params.groupCol}统计${params.valueCol}的总和`
                })
            },
            {
                id: 'count_groupby',
                name: '分组计数统计',
                patterns: [
                    /按照(.+?)统计数量/,
                    /按(.+?)统计数量/,
                    /统计各(.+?)的数量/,
                    /各(.+?)的数量统计/
                ],
                requiredParams: ['groupCol'],
                configGenerator: (params) => ({
                    chartType: 'bar',
                    aggregateFunction: 'count',
                    sortOrder: 'desc',
                    xAxisColumn: params.groupCol,
                    yAxisColumn: params.groupCol,
                    title: `各${params.groupCol}数量统计`,
                    description: `按照${params.groupCol}统计数量`
                })
            },
            {
                id: 'pie_distribution',
                name: '占比分布饼图',
                patterns: [
                    /(.+?)的占比分布/,
                    /(.+?)的分布情况/,
                    /统计(.+?)的占比/,
                    /(.+?)占比分析/
                ],
                requiredParams: ['groupCol'],
                configGenerator: (params) => ({
                    chartType: 'pie',
                    aggregateFunction: 'count',
                    sortOrder: 'desc',
                    labelColumn: params.groupCol,
                    title: `${params.groupCol}占比分布`,
                    description: `各${params.groupCol}的数量占比`
                })
            },
            {
                id: 'find_max',
                name: '查找最大值',
                patterns: [
                    /谁的(.+?)最大/,
                    /哪个(.+?)最大/,
                    /(.+?)最大的是谁/,
                    /(.+?)最大的是哪个/,
                    /查找(.+?)最大的/,       // 查找XX最大的
                    /找出(.+?)最大的/,       // 找出XX最大的
                    /查找最大的(.+)/,        // 查找最大的XX（新增）
                    /找出最大的(.+)/,        // 找出最大的XX（新增）
                    /查询最大的(.+)/,        // 查询最大的XX（新增）
                    /搜索最大的(.+)/         // 搜索最大的XX（新增）
                ],
                requiredParams: ['valueCol'],
                configGenerator: (params) => ({
                    chartType: null,  // 查询操作，不生成图表
                    queryType: 'find_max',
                    valueColumn: params.valueCol,
                    title: `${params.valueCol}最大值查询`,
                    description: `查找${params.valueCol}最大的记录`
                })
            },
            {
                id: 'find_min',
                name: '查找最小值',
                patterns: [
                    /谁的(.+?)最小/,
                    /哪个(.+?)最小/,
                    /(.+?)最小的是谁/,
                    /(.+?)最小的是哪个/,
                    /查找(.+?)最小的/,       // 查找XX最小的
                    /找出(.+?)最小的/,       // 找出XX最小的
                    /查找最小的(.+)/,        // 查找最小的XX（新增）
                    /找出最小的(.+)/,        // 找出最小的XX（新增）
                    /查询最小的(.+)/,        // 查询最小的XX（新增）
                    /搜索最小的(.+)/         // 搜索最小的XX（新增）
                ],
                requiredParams: ['valueCol'],
                configGenerator: (params) => ({
                    chartType: null,
                    queryType: 'find_min',
                    valueColumn: params.valueCol,
                    title: `${params.valueCol}最小值查询`,
                    description: `查找${params.valueCol}最小的记录`
                })
            }
        ];
    }
    
    // 计算两个字符串的语义相似度（基于共同子串和语义映射）
    calculateSemanticSimilarity(str1, str2) {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        // 直接包含关系（最高优先级）
        if (s1.includes(s2) || s2.includes(s1)) {
            return 0.95;
        }
        
        // 检查语义映射
        let semanticScore = 0;
        for (const [concept, synonyms] of Object.entries(this.semanticMappings)) {
            const s1HasConcept = synonyms.some(s => s1.includes(s.toLowerCase()));
            const s2HasConcept = synonyms.some(s => s2.includes(s.toLowerCase()));
            
            if (s1HasConcept && s2HasConcept) {
                semanticScore = Math.max(semanticScore, 0.7);
            }
        }
        
        // 计算最长公共子序列（LCS）
        const lcsLength = this.calculateLCS(s1, s2);
        const lcsScore = lcsLength / Math.max(s1.length, s2.length);
        
        // 计算共同子串（连续匹配）
        let commonSubstringLength = 0;
        let maxCommonSubstring = 0;
        for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
            if (s1[i] === s2[i]) {
                commonSubstringLength++;
                maxCommonSubstring = Math.max(maxCommonSubstring, commonSubstringLength);
            } else {
                commonSubstringLength = 0;
            }
        }
        const substringScore = maxCommonSubstring / Math.max(s1.length, s2.length);
        
        // 综合得分（加权平均）
        const finalScore = Math.max(
            semanticScore * 0.9,
            lcsScore * 0.8,
            substringScore * 0.7
        );
        
        return finalScore;
    }
    
    // 计算最长公共子序列（LCS）长度
    calculateLCS(s1, s2) {
        const m = s1.length;
        const n = s2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }
        
        return dp[m][n];
    }
    
    // 智能列名匹配
    findBestMatchingColumn(userInput, columns, isGroupColumn = false) {
        let bestMatch = null;
        let bestScore = 0;
        
        console.log('智能列名匹配:', { userInput, columns: columns.slice(0, 10), isGroupColumn });
        
        // 首先尝试直接包含匹配（最准确）
        for (const col of columns) {
            const lowerCol = col.toLowerCase();
            const lowerInput = userInput.toLowerCase();
            
            // 如果列名包含用户输入，或用户输入包含列名
            if (lowerCol.includes(lowerInput) || lowerInput.includes(lowerCol)) {
                const score = 0.95;
                console.log(`  列名"${col}"直接匹配，相似度: ${score.toFixed(2)}`);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = col;
                }
            }
        }
        
        // 如果直接匹配成功，直接返回
        if (bestMatch && bestScore >= 0.9) {
            console.log('最佳匹配(直接):', bestMatch, '相似度:', bestScore.toFixed(2));
            return bestMatch;
        }
        
        // 否则使用语义相似度匹配
        for (const col of columns) {
            const score = this.calculateSemanticSimilarity(userInput, col);
            console.log(`  列名"${col}"语义相似度: ${score.toFixed(2)}`);
            
            if (score > bestScore && score >= 0.25) {  // 降低阈值到0.25
                bestScore = score;
                bestMatch = col;
            }
        }
        
        console.log('最佳匹配:', bestMatch, '相似度:', bestScore.toFixed(2));
        return bestMatch;
    }
    
    // 从用户输入中提取参数
    extractParams(userInput, columns, template) {
        const params = {};
        
        // 尝试匹配模式
        for (const pattern of template.patterns) {
            const match = userInput.match(pattern);
            if (match) {
                console.log('模式匹配成功:', pattern, '捕获组:', match.slice(1));
                
                // 根据模板类型提取参数
                if (template.id === 'avg_overall') {
                    // 整体平均值：只有一个捕获组（数值列描述）
                    const valueDesc = match[1].trim();
                    params.valueCol = this.findBestMatchingColumn(valueDesc, columns, false);
                    params.isOverall = true;
                } else if (template.id === 'avg_groupby' || template.id === 'sum_groupby') {
                    // 分组统计：两个捕获组（分组列描述，数值列描述）
                    const groupDesc = match[1].trim();
                    const valueDesc = match[2].trim();
                    params.groupCol = this.findBestMatchingColumn(groupDesc, columns, true);
                    params.valueCol = this.findBestMatchingColumn(valueDesc, columns, false);
                } else if (template.id === 'count_groupby' || template.id === 'pie_distribution') {
                    // 计数/饼图：一个捕获组（分组列描述）
                    const groupDesc = match[1].trim();
                    params.groupCol = this.findBestMatchingColumn(groupDesc, columns, true);
                } else if (template.id === 'find_max' || template.id === 'find_min') {
                    // 查找最大/最小值：一个捕获组（数值列描述）
                    // 重要：排除包含"平均值"的情况，避免与 avg_groupby 冲突
                    const valueDesc = match[1].trim();
                    if (valueDesc.includes('平均值') || valueDesc.includes('平均')) {
                        console.log('  排除：匹配到平均值相关描述，跳过find_max/find_min');
                        return null;
                    }
                    params.valueCol = this.findBestMatchingColumn(valueDesc, columns, false);
                }
                
                // 检测单位转换
                const lowerInput = userInput.toLowerCase();
                if ((lowerInput.includes('秒') && lowerInput.includes('分钟')) || 
                    (lowerInput.includes('秒') && lowerInput.includes('分'))) {
                    params.conversion = { formula: 'value / 60', decimalPlaces: 2, from: '秒', to: '分钟' };
                } else if (lowerInput.includes('分钟') && lowerInput.includes('小时')) {
                    params.conversion = { formula: 'value / 60', decimalPlaces: 2, from: '分钟', to: '小时' };
                } else if (lowerInput.includes('元') && lowerInput.includes('万元')) {
                    params.conversion = { formula: 'value / 10000', decimalPlaces: 2, from: '元', to: '万元' };
                }
                
                return params;
            }
        }
        
        return null;
    }
    
    // 检查参数是否完整
    validateParams(params, template) {
        for (const param of template.requiredParams) {
            if (!params[param]) {
                console.warn(`缺少必需参数: ${param}`);
                return false;
            }
        }
        return true;
    }
    
    // 主匹配函数
    match(userInput, columns) {
        console.log('========== 智能意图匹配 ==========');
        console.log('用户输入:', userInput);
        console.log('可用列名:', columns);
        
        const startTime = performance.now();
        
        for (const template of this.intentTemplates) {
            console.log(`\n尝试匹配模板: ${template.name} (${template.id})`);
            
            const params = this.extractParams(userInput, columns, template);
            
            if (params && this.validateParams(params, template)) {
                const endTime = performance.now();
                
                console.log('✓ 匹配成功!');
                console.log('提取参数:', params);
                console.log('耗时:', (endTime - startTime).toFixed(2), 'ms');
                
                // 生成配置
                const config = template.configGenerator(params);
                
                return {
                    matched: true,
                    template: template,
                    params: params,
                    config: [config],
                    responseTime: endTime - startTime
                };
            }
        }
        
        const endTime = performance.now();
        console.log('\n✗ 未匹配到任何模板');
        
        return {
            matched: false,
            responseTime: endTime - startTime
        };
    }
}

// 导出单例
const smartIntentMatcher = new SmartIntentMatcher();
export default smartIntentMatcher;
