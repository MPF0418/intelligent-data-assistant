// 查询配置生成器 - 覆盖所有意图识别训练场景
// 功能：将意图识别结果转换为具体的查询/图表配置
// 优势：无需大模型API，本地生成配置 < 10ms

class QueryConfigGenerator {
    constructor() {
        // 意图类型到配置生成器的映射
        this.configGenerators = {
            // 查找特定数据（最大值、最小值、排名等）
            'QUERY_FIND': {
                patterns: [
                    {
                        // 复合查询：哪个X的Y最高/最低（如"哪个产品的销售额最高"）
                        // 注意：此模式必须放在"哪个X最大"之前，因为正则匹配顺序很重要
                        regex: /哪个(.+?)的(.+?)(最大|最小|最高|最低|最多|最少)/,
                        extract: (match, columns) => {
                            const groupDesc = match[1].trim();  // 分组维度描述，如"产品"
                            const valueDesc = match[2].trim();  // 数值列描述，如"销售额"
                            const order = match[3];
                            console.log(`[QUERY_FIND] 匹配复合查询"哪个X的Y最高": 分组=${groupDesc}, 数值=${valueDesc}`);
                            
                            const groupCol = this.findColumn(groupDesc, columns);
                            const valueCol = this.findColumn(valueDesc, columns);
                            
                            console.log(`[QUERY_FIND] 匹配结果: 分组列=${groupCol}, 数值列=${valueCol}`);
                            
                            // 对于复合查询，我们需要返回聚合查询配置而不是简单的查找配置
                            // 但由于这是QUERY_FIND意图，我们返回一个特殊的配置，让上层处理
                            return {
                                valueCol: valueCol,
                                groupCol: groupCol,
                                queryType: order.includes('大') || order.includes('高') || order.includes('多') ? 'find_max' : 'find_min',
                                isCompoundQuery: true  // 标记这是复合查询
                            };
                        }
                    },
                    {
                        // 查找/找出最大的X（如"查找最大的险情确认时长"）
                        regex: /(查找|找出|搜索|查询)(最大|最小|最高|最低)的?(.+)/,
                        extract: (match, columns) => {
                            const colName = match[3].trim();
                            console.log('[QUERY_FIND] 匹配"查找最大的X"模式, 提取列名:', colName);
                            const valueCol = this.findColumn(colName, columns);
                            console.log('[QUERY_FIND] findColumn结果:', valueCol);
                            return {
                                valueCol: valueCol,
                                queryType: match[2].includes('大') || match[2].includes('高') ? 'find_max' : 'find_min'
                            };
                        }
                    },
                    {
                        // 谁的X最大/最小
                        regex: /谁的(.+?)(最大|最小|最高|最低)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            queryType: match[2].includes('大') || match[2].includes('高') ? 'find_max' : 'find_min'
                        })
                    },
                    {
                        // 哪个X最大/最小（简单形式，不含"的"字）
                        // 注意：复合查询"哪个X的Y最高"已经被上面的模式捕获
                        regex: /哪个([^的]+?)(最大|最小|最高|最低)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            queryType: match[2].includes('大') || match[2].includes('高') ? 'find_max' : 'find_min'
                        })
                    },
                    {
                        // X最大/最小的是谁
                        regex: /(.+?)(最大|最小|最高|最低)的是谁/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            queryType: match[2].includes('大') || match[2].includes('高') ? 'find_max' : 'find_min'
                        })
                    },
                    {
                        // X最大/最小的是哪个
                        regex: /(.+?)(最大|最小|最高|最低)的是哪个/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            queryType: match[2].includes('大') || match[2].includes('高') ? 'find_max' : 'find_min'
                        })
                    },
                    {
                        // 查找/找出X最大/最小的（如"查找险情确认时长最大的"）
                        regex: /(查找|找出)(.+?)(最大|最小|最高|最低)的/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[2], columns),
                            queryType: match[3].includes('大') || match[3].includes('高') ? 'find_max' : 'find_min'
                        })
                    },
                    {
                        // 前几名/后几名
                        regex: /(.+?)(前|后)(\d+)(名|个)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            queryType: 'find_top',
                            limit: parseInt(match[3]),
                            order: match[2] === '前' ? 'desc' : 'asc'
                        })
                    }
                ],
                default: (intentText, columns) => ({
                    valueCol: this.findColumn(intentText, columns),
                    queryType: 'find_value'
                })
            },
            
            // 聚合统计（求和、平均、计数等）
            'QUERY_AGGREGATE': {
                patterns: [
                    {
                        // 计算/统计/求和X总和（如"统计销售额总和"）
                        regex: /(统计|计算|求和)(.+?)(总和|总数|合计|合计)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 平均值/平均数/平均/平均X
                        regex: /(平均|平均值|平均数)(.+?)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: 'avg'
                        })
                    },
                    {
                        // 计算X的平均值
                        regex: /计算(.+?)的平均值/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: 'avg'
                        })
                    },
                    {
                        // 中位数
                        regex: /(.+?)(中位数|中点)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: 'median'
                        })
                    },
                    {
                        // 统计/计数/计算X的数量/个数
                        regex: /(统计|计数|计算)(.+?)(数量|个数|数目)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 最大值/最小值
                        regex: /(.+?)(最大值|最小值)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: match[2].includes('大') ? 'max' : 'min'
                        })
                    },
                    {
                        // 标准差/方差/波动程度
                        regex: /(.+?)(标准差|方差|波动程度)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: match[1].includes('差') ? 'std' : 'var'
                        })
                    },
                    {
                        // 第X百分位数
                        regex: /第(\d+)(.+)百分位数/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: 'percentile',
                            percentile: parseInt(match[1])
                        })
                    }
                ],
                default: (intentText, columns) => {
                    // 如果没有匹配特定模式，尝试推断聚合函数
                    if (intentText.includes('总和') || intentText.includes('合计')) {
                        return { valueCol: this.findColumn(intentText, columns), aggregateFunction: 'sum' };
                    } else if (intentText.includes('平均')) {
                        return { valueCol: this.findColumn(intentText, columns), aggregateFunction: 'avg' };
                    } else if (intentText.includes('数量') || intentText.includes('个数')) {
                        return { valueCol: this.findColumn(intentText, columns), aggregateFunction: 'count' };
                    } else {
                        return { valueCol: this.findColumn(intentText, columns), aggregateFunction: 'sum' };
                    }
                }
            },
            
            // 数据筛选
            'QUERY_FILTER': {
                patterns: [
                    {
                        // 筛选/选择大于/小于/等于某个值的
                        regex: /(筛选|选择)(.+?)(大于|小于|等于)(.+?)/,
                        extract: (match, columns) => {
                            return {
                                filterColumn: this.findColumn(match[2], columns),
                                operator: match[3],
                                filterValue: match[4].trim()
                            };
                        }
                    },
                    {
                        // 所有X的Y（如"所有广东省的数据"）
                        regex: /所有(.+?)的(.+)/,
                        extract: (match, columns) => {
                            return {
                                filterColumn: this.findColumn(match[1], columns),
                                filterValue: match[2].replace(/的/g, '').trim()
                            };
                        }
                    },
                    {
                        // X包含/不包含Y
                        regex: /(.+?)(包含|不包含)(.+)/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[1], columns),
                            operator: match[2] === '包含' ? 'contain' : 'not_contain',
                            filterValue: match[3].trim()
                        })
                    },
                    {
                        // 找出X（简单的筛选）
                        regex: /找出(.+?)/,
                        extract: (match, columns) => {
                            // 尝试提取列名和值
                            const input = match[1].trim();
                            const parts = input.split('的');
                            if (parts.length >= 2) {
                                return {
                                    filterColumn: this.findColumn(parts[0], columns),
                                    filterValue: parts.slice(1).join('的')
                                };
                            } else {
                                return {
                                    filterColumn: this.findColumn(input, columns),
                                    filterValue: input
                                };
                            }
                        }
                    }
                ],
                default: (intentText, columns) => {
                    // 简单的列名筛选
                    return {
                        filterColumn: this.findColumn(intentText, columns),
                        filterValue: intentText
                    };
                }
            },
            
            // 数据排序
            'QUERY_SORT': {
                patterns: [
                    {
                        // 按X从大到小/从小到大排序
                        regex: /按(.+?)(从大到小|从小到大)(排序|排列)/,
                        extract: (match, columns) => ({
                            sortColumn: this.findColumn(match[1], columns),
                            direction: match[2].includes('大') ? 'desc' : 'asc'
                        })
                    },
                    {
                        // X从小到大排序/从新到旧排序
                        regex: /(.+?)(从小到大|从新到旧)(排序|排列)/,
                        extract: (match, columns) => ({
                            sortColumn: this.findColumn(match[1], columns),
                            direction: match[2].includes('小') || match[2].includes('新') ? 'asc' : 'desc'
                        })
                    },
                    {
                        // 按X排序
                        regex: /按(.+?)排序/,
                        extract: (match, columns) => ({
                            sortColumn: this.findColumn(match[1], columns),
                            direction: 'desc'
                        })
                    }
                ],
                default: (intentText, columns) => ({
                    sortColumn: this.findColumn(intentText, columns),
                    direction: 'desc'
                })
            },
            
            // 图表生成
            'CHART': {
                patterns: [
                    {
                        // 画一个X（柱状|条形|饼|折线）图
                        regex: /画一个(.+?)(柱状|条形|饼|折线)图/,
                        extract: (match, columns) => ({
                            chartType: this.mapChartType(match[2]),
                            dimension: this.findColumn(match[1], columns)
                        })
                    },
                    {
                        // 用柱状图展示X
                        regex: /用(.+?)展示(.+)/,
                        extract: (match, columns) => ({
                            chartType: this.mapChartType(match[1]),
                            dimension: this.findColumn(match[2], columns)
                        })
                    },
                    {
                        // 绘制X（趋势|分布|对比）图
                        regex: /绘制(.+?)(趋势|分布|对比)图/,
                        extract: (match, columns) => ({
                            chartType: match[1] === '趋势' ? 'line' : match[1] === '分布' ? 'pie' : 'bar',
                            dimension: this.findColumn(match[2], columns)
                        })
                    }
                ],
                default: (intentText, columns) => {
                    // 推断图表类型
                    let chartType = 'bar';
                    if (intentText.includes('趋势') || intentText.includes('时间')) {
                        chartType = 'line';
                    } else if (intentText.includes('占比') || intentText.includes('比例')) {
                        chartType = 'pie';
                    }
                    
                    return {
                        chartType: chartType,
                        dimension: this.findColumn(intentText, columns)
                    };
                }
            },
            
            // 数据透视表
            'PIVOT_TABLE': {
                patterns: [
                    {
                        // 按X和Y交叉统计
                        regex: /按(.+?)和(.+?)交叉统计/,
                        extract: (match, columns) => ({
                            rowDimension: this.findColumn(match[1], columns),
                            columnDimension: this.findColumn(match[2], columns)
                        })
                    },
                    {
                        // X和Y的透视表
                        regex: /(.+?)和(.+?)的透视表/,
                        extract: (match, columns) => ({
                            rowDimension: this.findColumn(match[1], columns),
                            columnDimension: this.findColumn(match[2], columns)
                        })
                    }
                ],
                default: (intentText, columns) => ({
                    rowDimension: this.findColumn(intentText, columns),
                    columnDimension: null
                })
            }
        };
    }

    // 生成查询配置
    generateConfig(intentType, intentText, columns, data) {
        console.log(`[QueryConfigGenerator] 生成配置: intentType=${intentType}, intentText=${intentText}, columns=${columns.length}个`);
        
        const generator = this.configGenerators[intentType];
        if (!generator) {
            console.warn(`[QueryConfigGenerator] 未知意图类型: ${intentType}`);
            return this.generateDefaultConfig(intentType, intentText, columns, data);
        }
        
        // 尝试匹配模式
        for (const pattern of generator.patterns || []) {
            const match = intentText.match(pattern.regex);
            if (match) {
                console.log(`[QueryConfigGenerator] 匹配模式: ${pattern.regex}`);
                try {
                    const config = pattern.extract(match, columns, data);
                    console.log(`[QueryConfigGenerator] 提取配置:`, config);
                    return config;
                } catch (error) {
                    console.error(`[QueryConfigGenerator] 提取配置时出错:`, error);
                    continue;
                }
            }
        }
        
        // 如果没有匹配模式，使用默认生成器
        console.log(`[QueryConfigGenerator] 使用默认配置生成器`);
        if (generator.default) {
            try {
                const config = generator.default(intentText, columns, data);
                console.log(`[QueryConfigGenerator] 默认配置:`, config);
                return config;
            } catch (error) {
                console.error(`[QueryConfigGenerator] 默认配置生成失败:`, error);
            }
        }
        
        // 最终兜底
        return this.generateDefaultConfig(intentType, intentText, columns, data);
    }
    
    // 生成默认配置
    generateDefaultConfig(intentType, intentText, columns, data) {
        console.log(`[QueryConfigGenerator] 生成兜底配置 for ${intentType}`);
        
        switch (intentType) {
            case 'QUERY_FIND':
                return {
                    valueCol: columns[0] || 'column1',
                    queryType: 'find_value'
                };
            case 'QUERY_AGGREGATE':
                return {
                    valueCol: columns[0] || 'column1',
                    aggregateFunction: 'sum'
                };
            case 'QUERY_FILTER':
                return {
                    filterColumn: columns[0] || 'column1',
                    filterValue: intentText || 'value'
                };
            case 'QUERY_SORT':
                return {
                    sortColumn: columns[0] || 'column1',
                    direction: 'desc'
                };
            case 'CHART':
                return {
                    chartType: 'bar',
                    dimension: columns[0] || 'column1',
                    measure: columns[1] || 'column2'
                };
            default:
                return {
                    type: intentType,
                    query: intentText
                };
        }
    }
    
    // 查找列名
    findColumn(input, columns) {
        if (!input || !columns) {
            console.log(`[findColumn] 输入或列为空: input=${input}, columns=${columns}`);
            return null;
        }
        
        const normalizedInput = input.toLowerCase().trim();
        console.log(`[findColumn] 查找列: "${normalizedInput}" 从 ${columns.length} 个列中`);
        
        // 1. 精确匹配（忽略大小写）
        for (const col of columns) {
            if (col.toLowerCase() === normalizedInput) {
                console.log(`[findColumn] 精确匹配: ${col}`);
                return col;
            }
        }
        
        // 2. 包含匹配
        for (const col of columns) {
            if (col.toLowerCase().includes(normalizedInput) || normalizedInput.includes(col.toLowerCase())) {
                console.log(`[findColumn] 包含匹配: ${col}`);
                return col;
            }
        }
        
        // 3. 语义相似度匹配（简单版本）
        for (const col of columns) {
            if (this.calculateSimilarity(col, input) > 0.6) {
                console.log(`[findColumn] 语义相似匹配: ${col} (相似度>0.6)`);
                return col;
            }
        }
        
        console.log(`[findColumn] 未找到匹配列，返回第一个列: ${columns[0]}`);
        return columns[0] || 'column1';
    }
    
    // 计算字符串相似度（简单实现）
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        // 完全相同
        if (s1 === s2) return 1.0;
        
        // 包含关系
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;
        
        // 计算共同字符比例
        const set1 = new Set(s1);
        const set2 = new Set(s2);
        let common = 0;
        for (const char of set1) {
            if (set2.has(char)) common++;
        }
        
        const total = set1.size + set2.size;
        return total > 0 ? (2 * common) / total : 0;
    }
    
    // 映射图表类型
    mapChartType(typeName) {
        const mapping = {
            '柱状': 'bar',
            '条形': 'bar',
            '条状': 'bar',
            '饼': 'pie',
            '折线': 'line',
            '趋势': 'line',
            '分布': 'pie',
            '对比': 'bar'
        };
        
        return mapping[typeName] || 'bar';
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueryConfigGenerator;
}