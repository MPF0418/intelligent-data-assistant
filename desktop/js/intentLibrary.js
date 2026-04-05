// 标准意图库 - 用于Embedding匹配的高效图表配置生成
// 功能：通过向量相似度匹配用户输入与预定义意图模板
// 优势：无需调用大模型API，响应时间 < 100ms

class IntentLibrary {
    constructor() {
        // 标准意图模板库
        this.intentTemplates = [
            {
                id: 'avg_bar_groupby',
                name: '分组平均值柱状图',
                patterns: [
                    '按照{group}统计{value}平均值并绘制柱状图',
                    '按{group}统计{value}的平均值，绘制柱状图',
                    '{group}的{value}平均值柱状图',
                    '统计各{group}的{value}平均值，用柱状图展示',
                    '按{group}分组，计算{value}平均值并绘图'
                ],
                keywords: ['平均', '均值', '柱状图', '按', '统计'],
                configTemplate: {
                    chartType: 'bar',
                    aggregateFunction: 'avg',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    // 提取分组列和数值列
                    // 先找分组列（isGroupColumn=true），再找数值列
                    const groupCol = this.findColumn(text, columns, ['省', '市', '区', '部门', '类别', '类型', '分组'], true);
                    const valueCol = this.findColumn(text, columns, ['金额', '数值', '数量', '时长', '分数', '销量', '额'], false);
                    
                    // 确保分组列和数值列不是同一个
                    if (groupCol === valueCol && columns.length > 1) {
                        // 如果相同，数值列选择另一个包含数值关键词的列
                        const otherValueCol = columns.find(c => 
                            c !== groupCol && 
                            ['金额', '数值', '数量', '时长', '分数', '销量', '额'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { groupCol, valueCol: otherValueCol };
                        }
                    }
                    
                    return { groupCol, valueCol };
                }
            },
            {
                id: 'avg_overall_with_conversion',
                name: '整体平均值统计（带单位转换）',
                patterns: [
                    '统计所有{value}的平均值',
                    '统计{value}的平均值',
                    '所有{value}的平均值',
                    '计算{value}的平均值',
                    '统计所有{value}平均',
                    '{value}的平均值是多少'
                ],
                keywords: ['统计', '平均', '所有', '计算', '平均值'],
                configTemplate: {
                    chartType: 'bar',
                    aggregateFunction: 'avg',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    // 提取数值列 - 扩展关键词列表
                    const valueKeywords = ['金额', '数值', '数量', '时长', '时间', '分数', '销量', '额', '确认时长', '处理时长'];
                    let valueCol = this.findColumn(text, columns, valueKeywords, false);
                    
                    // 如果没有匹配到，尝试直接匹配包含"时长"、"时间"、"数值"的列
                    if (!valueCol) {
                        valueCol = columns.find(c => 
                            ['时长', '时间', '数值', '金额', '数量'].some(k => c.includes(k))
                        );
                    }
                    
                    // 如果仍然没有匹配到，使用第一个列作为默认值（但会给出警告）
                    if (!valueCol && columns.length > 0) {
                        console.warn('未能识别数值列，使用第一列作为默认值:', columns[0]);
                        valueCol = columns[0];
                    }
                    
                    // 检测单位转换
                    let conversion = null;
                    const lowerText = text.toLowerCase();
                    if ((lowerText.includes('秒') && lowerText.includes('分钟')) || 
                        (lowerText.includes('秒') && lowerText.includes('分'))) {
                        conversion = { formula: 'value / 60', decimalPlaces: 2, from: '秒', to: '分钟' };
                    } else if (lowerText.includes('分钟') && lowerText.includes('小时')) {
                        conversion = { formula: 'value / 60', decimalPlaces: 2, from: '分钟', to: '小时' };
                    } else if (lowerText.includes('元') && lowerText.includes('万元')) {
                        conversion = { formula: 'value / 10000', decimalPlaces: 2, from: '元', to: '万元' };
                    }
                    
                    // 对于整体统计，使用一个固定的分组（如"全部"）
                    return { groupCol: null, valueCol, conversion, isOverall: true };
                }
            },
            {
                id: 'avg_bar_implicit',
                name: '各分组平均值柱状图（隐含图表需求）',
                patterns: [
                    '各{group}的{value}平均值',
                    '各{group}{value}平均值',
                    '{group}的{value}平均值',
                    '各{group}的{value}平均',
                    '{group}{value}平均值'
                ],
                keywords: ['各', '平均值', '平均'],
                configTemplate: {
                    chartType: 'bar',
                    aggregateFunction: 'avg',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    // 提取分组列和数值列
                    // 改进：首先尝试从文本中直接提取提到的列名
                    const lowerText = text.toLowerCase();
                    
                    // 按列名长度降序排序，优先匹配更长的列名
                    const sortedColumns = [...columns].sort((a, b) => b.length - a.length);
                    
                    // 策略1：直接匹配完整列名（在文本中查找所有列名）
                    let foundGroupCol = null;
                    let foundValueCol = null;
                    
                    for (const col of sortedColumns) {
                        const lowerCol = col.toLowerCase();
                        if (lowerText.includes(lowerCol)) {
                            // 判断这是分组列还是数值列
                            const isGroupKeyword = ['省', '市', '区', '部门', '类别', '类型', '分组', '公司', '区域', '地区'].some(k => col.includes(k));
                            const isValueKeyword = ['金额', '数值', '数量', '时长', '分数', '销量', '额', '时间', '长度', '大小', '多少'].some(k => col.includes(k));
                            
                            if (isGroupKeyword && !foundGroupCol) {
                                foundGroupCol = col;
                                console.log(`[IntentLibrary] 识别到分组列: ${col}`);
                            } else if (isValueKeyword && !foundValueCol) {
                                foundValueCol = col;
                                console.log(`[IntentLibrary] 识别到数值列: ${col}`);
                            }
                        }
                    }
                    
                    // 策略2：使用关键词匹配作为兜底
                    const groupCol = foundGroupCol || this.findColumn(text, columns, ['省', '市', '区', '部门', '类别', '类型', '分组', '公司'], true);
                    const valueCol = foundValueCol || this.findColumn(text, columns, ['金额', '数值', '数量', '时长', '分数', '销量', '额', '时间'], false);
                    
                    // 确保分组列和数值列不是同一个
                    if (groupCol === valueCol && columns.length > 1) {
                        const otherValueCol = columns.find(c => 
                            c !== groupCol && 
                            ['金额', '数值', '数量', '时长', '分数', '销量', '额', '时间'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { groupCol, valueCol: otherValueCol };
                        }
                    }
                    
                    return { groupCol, valueCol };
                }
            },
            {
                id: 'sum_bar_groupby',
                name: '分组求和柱状图',
                patterns: [
                    '按照{group}统计{value}并绘制柱状图',
                    '按{group}统计{value}，绘制柱状图',
                    '{group}的{value}汇总柱状图',
                    '统计各{group}的{value}总和，用柱状图展示'
                ],
                keywords: ['统计', '汇总', '求和', '柱状图', '按'],
                configTemplate: {
                    chartType: 'bar',
                    aggregateFunction: 'sum',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    const groupCol = this.findColumn(text, columns, ['省', '市', '区', '部门', '类别', '类型'], true);
                    const valueCol = this.findColumn(text, columns, ['金额', '数值', '数量', '销量', '额'], false);
                    
                    // 确保分组列和数值列不是同一个
                    if (groupCol === valueCol && columns.length > 1) {
                        const otherValueCol = columns.find(c => 
                            c !== groupCol && 
                            ['金额', '数值', '数量', '销量', '额'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { groupCol, valueCol: otherValueCol };
                        }
                    }
                    
                    return { groupCol, valueCol };
                }
            },
            {
                id: 'count_bar_groupby',
                name: '分组计数柱状图（隐含图表需求）',
                patterns: [
                    '按照{group}统计{value}数量',
                    '按{group}统计{value}',
                    '统计各{group}的{value}数量',
                    '按{group}统计事件数量',
                    '统计{group}的{value}个数',
                    '各{group}的{value}统计'
                ],
                keywords: ['统计', '数量', '个数', '按', '各'],
                configTemplate: {
                    chartType: 'bar',
                    aggregateFunction: 'count',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    // 尝试找到分组列
                    const groupCol = this.findColumn(text, columns, ['省', '市', '区', '部门', '类别', '类型', '地区', '区域'], true);
                    // 对于计数，valueCol可以是任意列或null
                    const valueCol = this.findColumn(text, columns, ['事件', '记录', '数据'], false) || columns[0];
                    return { groupCol, valueCol };
                }
            },
            {
                id: 'avg_bar_with_conversion',
                name: '单位转换平均值柱状图',
                patterns: [
                    '按照{group}统计{value}平均值（{from}转{to}）并绘制柱状图',
                    '按{group}统计{value}平均，{from}转换为{to}，绘制柱状图',
                    '{group}的{value}平均值（{from}转{to}）柱状图'
                ],
                keywords: ['平均', '转换', '转', '柱状图', '按'],
                configTemplate: {
                    chartType: 'bar',
                    aggregateFunction: 'avg',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    const groupCol = this.findColumn(text, columns, ['省', '市', '区', '部门', '类别'], true);
                    const valueCol = this.findColumn(text, columns, ['时长', '时间', '数值'], false);
                    
                    // 确保分组列和数值列不是同一个
                    if (groupCol === valueCol && columns.length > 1) {
                        const otherValueCol = columns.find(c => 
                            c !== groupCol && 
                            ['时长', '时间', '数值'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { groupCol, valueCol: otherValueCol, conversion };
                        }
                    }
                    
                    // 检测单位转换
                    let conversion = null;
                    if (text.includes('秒') && text.includes('分钟')) {
                        conversion = { formula: 'value / 60', decimalPlaces: 2, from: '秒', to: '分钟' };
                    } else if (text.includes('分钟') && text.includes('小时')) {
                        conversion = { formula: 'value / 60', decimalPlaces: 2, from: '分钟', to: '小时' };
                    } else if (text.includes('元') && text.includes('万元')) {
                        conversion = { formula: 'value / 10000', decimalPlaces: 2, from: '元', to: '万元' };
                    }
                    
                    return { groupCol, valueCol, conversion };
                }
            },
            {
                id: 'pie_distribution',
                name: '占比分布饼图',
                patterns: [
                    '统计{column}的占比并绘制饼图',
                    '{column}的分布饼图',
                    '按{column}统计占比，绘制饼图',
                    '{column}占比分析饼图'
                ],
                keywords: ['占比', '分布', '饼图', '比例'],
                configTemplate: {
                    chartType: 'pie',
                    aggregateFunction: 'count',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    const col = this.findColumn(text, columns, ['类别', '类型', '部门', '省', '市', '产品'], true);
                    return { col };
                }
            },
            {
                id: 'line_trend',
                name: '趋势折线图',
                patterns: [
                    '按照{time}统计{value}并绘制折线图',
                    '{time}的{value}趋势折线图',
                    '按{time}统计{value}变化，绘制折线图',
                    '{value}随{time}变化的折线图'
                ],
                keywords: ['趋势', '变化', '折线图', '时间', '随'],
                configTemplate: {
                    chartType: 'line',
                    aggregateFunction: 'sum',
                    sortOrder: 'asc'
                },
                extractParams: (text, columns) => {
                    const timeCol = this.findColumn(text, columns, ['日期', '时间', '月份', '年份', '天'], true);
                    const valueCol = this.findColumn(text, columns, ['金额', '数值', '数量', '销量'], false);
                    
                    // 确保时间列和数值列不是同一个
                    if (timeCol === valueCol && columns.length > 1) {
                        const otherValueCol = columns.find(c => 
                            c !== timeCol && 
                            ['金额', '数值', '数量', '销量'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { timeCol, valueCol: otherValueCol };
                        }
                    }
                    
                    return { timeCol, valueCol };
                }
            },
            {
                id: 'find_max',
                name: '查找最大值',
                patterns: [
                    '找出{value}最大的{group}',
                    '{value}最高的{group}是哪个',
                    '查找{value}最大的记录',
                    '找出{group}中{value}最高的'
                ],
                keywords: ['最大', '最高', '找出', '查找', '哪个'],
                configTemplate: {
                    chartType: null,  // 查询操作，不生成图表
                    aggregateFunction: 'max',
                    sortOrder: 'desc'
                },
                extractParams: (text, columns) => {
                    const groupCol = this.findColumn(text, columns, ['省', '市', '区', '部门', '类别'], true);
                    const valueCol = this.findColumn(text, columns, ['金额', '数值', '数量', '时长', '分数'], false);
                    
                    // 确保分组列和数值列不是同一个
                    if (groupCol === valueCol && columns.length > 1) {
                        const otherValueCol = columns.find(c => 
                            c !== groupCol && 
                            ['金额', '数值', '数量', '时长', '分数'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { groupCol, valueCol: otherValueCol };
                        }
                    }
                    
                    return { groupCol, valueCol };
                }
            },
            {
                id: 'find_min',
                name: '查找最小值',
                patterns: [
                    '找出{value}最小的{group}',
                    '{value}最低的{group}是哪个',
                    '查找{value}最小的记录'
                ],
                keywords: ['最小', '最低', '找出', '查找'],
                configTemplate: {
                    chartType: null,
                    aggregateFunction: 'min',
                    sortOrder: 'asc'
                },
                extractParams: (text, columns) => {
                    const groupCol = this.findColumn(text, columns, ['省', '市', '区', '部门', '类别'], true);
                    const valueCol = this.findColumn(text, columns, ['金额', '数值', '数量', '时长'], false);
                    
                    // 确保分组列和数值列不是同一个
                    if (groupCol === valueCol && columns.length > 1) {
                        const otherValueCol = columns.find(c => 
                            c !== groupCol && 
                            ['金额', '数值', '数量', '时长'].some(k => c.includes(k))
                        );
                        if (otherValueCol) {
                            return { groupCol, valueCol: otherValueCol };
                        }
                    }
                    
                    return { groupCol, valueCol };
                }
            },
            {
                id: 'filter_condition',
                name: '条件筛选',
                patterns: [
                    '筛选出{column}大于{value}的记录',
                    '找出{column}等于{value}的数据',
                    '过滤{column}在{value}范围内的记录',
                    '只显示{column}为{value}的数据'
                ],
                keywords: ['筛选', '过滤', '大于', '小于', '等于', '只显示'],
                configTemplate: {
                    chartType: null,
                    operation: 'filter'
                },
                extractParams: (text, columns) => {
                    const col = this.findColumn(text, columns, columns);  // 任意列
                    return { col };
                }
            }
        ];
        
        // 相似度阈值
        this.similarityThreshold = 0.6;
    }
    
    // 查找列名（基于位置感知的智能匹配）
    // 策略：
    // 1. 首先尝试直接匹配完整列名
    // 2. 分析句子结构，识别"按照/按 {分组列} 统计 {数值列}"的模式
    // 3. 使用关键词匹配时，优先匹配更长的列名（避免部分匹配）
    findColumn(text, columns, keywords, isGroupColumn = false) {
        const lowerText = text.toLowerCase();
        
        // 策略1：直接完整列名匹配（最准确）
        // 按列名长度降序排序，优先匹配更长的列名（避免"省"匹配到"省公司名称"）
        const sortedColumns = [...columns].sort((a, b) => b.length - a.length);
        
        for (const col of sortedColumns) {
            const lowerCol = col.toLowerCase();
            // 检查文本中是否包含完整列名
            if (lowerText.includes(lowerCol)) {
                console.log(`直接匹配到列名: ${col}`);
                return col;
            }
        }
        
        // 策略2：基于句子结构的位置感知匹配
        // 识别"按照/按 {分组列} 统计/的 {数值列}"模式
        const patterns = [
            /按[照]?\s*([^的]+?)[的\s]*统计/i,  // 按照 分组列 统计
            /按[照]?\s*([^的]+?)\s*的.*统计/i,   // 按照 分组列 的...统计
            /按[照]?\s*([^\s]+?)\s+统计/i,       // 按照 分组列 统计
        ];
        
        for (const pattern of patterns) {
            const match = lowerText.match(pattern);
            if (match) {
                const extractedText = match[1].trim();
                console.log(`从句子结构中提取: "${extractedText}"`);
                
                // 在列名中查找与提取文本最匹配的
                for (const col of sortedColumns) {
                    const lowerCol = col.toLowerCase();
                    // 检查提取的文本是否是列名的一部分，或者列名包含提取的文本
                    if (lowerCol.includes(extractedText) || extractedText.includes(lowerCol)) {
                        console.log(`结构匹配到列名: ${col}`);
                        return col;
                    }
                }
            }
        }
        
        // 策略3：关键词匹配（带优先级）
        // 对于分组列，优先匹配表示分类的词汇
        // 对于数值列，优先匹配表示数值的词汇
        const priorityKeywords = isGroupColumn 
            ? ['省公司名称', '部门', '类别', '类型', '地区', '区域', '省', '市', '区']
            : ['金额', '数值', '数量', '时长', '分数', '销量', '额'];
        
        for (const keyword of priorityKeywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                // 找到包含该关键词的列（优先更长的列名）
                const matchedCol = sortedColumns.find(c => 
                    c.toLowerCase().includes(keyword.toLowerCase())
                );
                if (matchedCol) {
                    console.log(`关键词匹配到列名: ${matchedCol} (关键词: ${keyword})`);
                    return matchedCol;
                }
            }
        }
        
        // 策略4：回退到传入的关键词列表
        for (const keyword of keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                const matchedCol = sortedColumns.find(c => 
                    c.toLowerCase().includes(keyword.toLowerCase())
                );
                if (matchedCol) {
                    console.log(`回退关键词匹配: ${matchedCol}`);
                    return matchedCol;
                }
            }
        }
        
        // 最后回退：返回第一个列（通常是最合适的默认值）
        console.warn(`未能匹配到合适列名，回退到: ${columns[0]}`);
        return columns[0] || null;
    }
    
    // 计算文本相似度（简单的Jaccard相似度）
    calculateSimilarity(text1, text2) {
        const set1 = new Set(text1.toLowerCase().split(''));
        const set2 = new Set(text2.toLowerCase().split(''));
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }
    
    // 关键词匹配得分
    calculateKeywordScore(text, keywords) {
        const lowerText = text.toLowerCase();
        let score = 0;
        
        for (const keyword of keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                score += 1;
            }
        }
        
        return score / keywords.length;
    }
    
    // 匹配用户输入与意图模板
    matchIntent(userInput, columns) {
        const startTime = performance.now();
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const template of this.intentTemplates) {
            // 计算关键词匹配得分
            const keywordScore = this.calculateKeywordScore(userInput, template.keywords);
            
            // 计算与各个pattern的相似度
            let patternScore = 0;
            for (const pattern of template.patterns) {
                const similarity = this.calculateSimilarity(userInput, pattern);
                patternScore = Math.max(patternScore, similarity);
            }
            
            // 综合得分
            const totalScore = keywordScore * 0.6 + patternScore * 0.4;
            
            if (totalScore > bestScore && totalScore >= this.similarityThreshold) {
                bestScore = totalScore;
                bestMatch = template;
            }
        }
        
        const endTime = performance.now();
        
        if (bestMatch) {
            // 提取参数
            const params = bestMatch.extractParams(userInput, columns);
            
            return {
                matched: true,
                template: bestMatch,
                score: bestScore,
                params: params,
                responseTime: endTime - startTime
            };
        }
        
        return {
            matched: false,
            score: bestScore,
            responseTime: endTime - startTime
        };
    }
    
    // 生成图表配置
    generateChartConfig(matchResult, userInput) {
        if (!matchResult.matched) {
            return null;
        }
        
        const template = matchResult.template;
        const params = matchResult.params;
        
        // 根据模板生成配置
        const config = { ...template.configTemplate };
        
        // 处理整体统计（无分组）的情况
        if (params.isOverall) {
            // 检查valueCol是否存在
            if (!params.valueCol) {
                console.error('整体统计缺少数值列');
                return null;
            }
            
            // 对于整体统计，使用一个虚拟的分组列
            config.xAxisColumn = '统计项';
            config.yAxisColumn = params.valueCol;
            config.isOverall = true;
            
            const aggName = config.aggregateFunction === 'avg' ? '平均值' : 
                           config.aggregateFunction === 'sum' ? '总和' : '统计';
            config.title = `${params.valueCol}${aggName}`;
            config.description = `统计所有${params.valueCol}的${aggName}`;
            
            if (params.conversion) {
                config.dataTransform = params.conversion;
                config.description += `，已从${params.conversion.from}转换为${params.conversion.to}`;
            }
            
            return [config];
        }
        
        // 设置列名
        if (params.groupCol && params.valueCol) {
            if (template.id === 'pie_distribution' || template.id.includes('pie')) {
                config.labelColumn = params.col || params.groupCol;
            } else {
                config.xAxisColumn = params.groupCol;
                config.yAxisColumn = params.valueCol;
            }
        } else if (params.timeCol && params.valueCol) {
            config.xAxisColumn = params.timeCol;
            config.yAxisColumn = params.valueCol;
        } else if (params.col) {
            config.labelColumn = params.col;
        }
        
        // 添加单位转换
        if (params.conversion) {
            config.dataTransform = params.conversion;
        }
        
        // 生成标题和描述
        if (!config.title) {
            if (params.groupCol && params.valueCol) {
                const aggName = config.aggregateFunction === 'avg' ? '平均值' : 
                               config.aggregateFunction === 'sum' ? '总和' : '统计';
                config.title = `各${params.groupCol}${params.valueCol}${aggName}`;
                config.description = `按照${params.groupCol}统计${params.valueCol}的${aggName}`;
                
                if (params.conversion) {
                    config.description += `，已从${params.conversion.from}转换为${params.conversion.to}`;
                }
            }
        }
        
        return [config];
    }
}

// 导出单例
const intentLibrary = new IntentLibrary();
export default intentLibrary;
