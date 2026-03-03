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
                    },
                    {
                        // X排名第一/最后
                        regex: /(.+?)排名(第一|最后|第\d+)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            queryType: match[2] === '第一' ? 'find_max' : 
                                      match[2] === '最后' ? 'find_min' : 'find_rank',
                            rank: match[2].startsWith('第') ? parseInt(match[2].replace(/[^\d]/g, '')) : null
                        })
                    }
                ]
            },
            
            // 统计汇总（求和、计数、平均值等）
            'QUERY_AGGREGATE': {
                patterns: [
                    {
                        // 复合查询：统计XX为YY的ZZ数量（筛选+统计）
                        regex: /统计(.+?)(为|是|等于)(.+?)的(.+?)数量/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[1], columns),
                            filterValue: match[3].trim(),
                            valueCol: this.findColumn(match[4], columns),
                            aggregateFunction: 'count',
                            hasFilter: true
                        })
                    },
                    {
                        // 复合查询：XX为YY的ZZ数量
                        regex: /(.+?)(为|是|等于)(.+?)的(.+?)数量/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[1], columns),
                            filterValue: match[3].trim(),
                            valueCol: this.findColumn(match[4], columns),
                            aggregateFunction: 'count',
                            hasFilter: true
                        })
                    },
                    {
                        // 复合查询：统计XX区域的YY数量（区域筛选+统计）
                        regex: /统计(.+?)(区域|地区|省|市)?的(.+?)数量/,
                        extract: (match, columns) => {
                            const regionValue = match[1].trim();
                            const regionCol = this.findRegionColumn(columns);
                            return {
                                filterColumn: regionCol,
                                filterValue: regionValue,
                                valueCol: this.findColumn(match[3], columns),
                                aggregateFunction: 'count',
                                hasFilter: true
                            };
                        }
                    },
                    {
                        // 统计所有X的平均值/总和
                        regex: /统计所有(.+?)的(平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: match[2].includes('平均') ? 'avg' : 'sum',
                            isOverall: true
                        })
                    },
                    {
                        // 统计X的平均值/总和
                        regex: /统计(.+?)的(平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: match[2].includes('平均') ? 'avg' : 'sum',
                            isOverall: true
                        })
                    },
                    {
                        // 所有X的平均值/总和
                        regex: /所有(.+?)的(平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: match[2].includes('平均') ? 'avg' : 'sum',
                            isOverall: true
                        })
                    },
                    {
                        // 计算X的平均值/总和
                        regex: /计算(.+?)的(平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            valueCol: this.findColumn(match[1], columns),
                            aggregateFunction: match[2].includes('平均') ? 'avg' : 'sum',
                            isOverall: true
                        })
                    },
                    {
                        // 按照 Y 的 X 平均值/总和（新增：支持"按照省公司的险情确认时长平均值"）
                        regex: /按 [照]?(.+?) 的 (.+?)(平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            groupCol: this.findColumn(match[1], columns),
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: match[3].includes('平均') ? 'avg' : 'sum'
                        })
                    },
                    {
                        // 按照 Y 统计 X 的平均值/总和
                        regex: /按 [照]?(.+?) 统计 (.+?) 的 (平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            groupCol: this.findColumn(match[1], columns),
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: match[3].includes('平均') ? 'avg' : 'sum'
                        })
                    },
                    {
                        // 各 Y 的 X 平均值/总和
                        regex: /各 (.+?) 的 (.+?)(平均值|平均|均值|总和|合计|总计)/,
                        extract: (match, columns) => ({
                            groupCol: this.findColumn(match[1], columns),
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: match[3].includes('平均') ? 'avg' : 'sum'
                        })
                    },
                    {
                        // 统计Y的X数量
                        regex: /按[照]?(.+?)统计(.+?)数量/,
                        extract: (match, columns) => ({
                            groupCol: this.findColumn(match[1], columns),
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 各Y的X数量
                        regex: /各(.+?)的(.+?)数量/,
                        extract: (match, columns) => ({
                            groupCol: this.findColumn(match[1], columns),
                            valueCol: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 统计数量/总数/合计
                        regex: /统计(数量|总数|合计|总计|个数)/,
                        extract: (match, columns) => ({
                            aggregateFunction: 'count',
                            isOverall: true
                        })
                    }
                ]
            },
            
            // 筛选过滤（按条件筛选数据）
            'QUERY_FILTER': {
                patterns: [
                    {
                        // 谁是XX人（如"谁是广东人"）
                        regex: /谁(是|在|来自)?(.+?)(人|的)/,
                        extract: (match, columns) => {
                            const regionValue = match[2].trim();
                            const regionCol = this.findRegionColumn(columns);
                            return {
                                filterColumn: regionCol,
                                filterValue: regionValue,
                                operator: 'contains',
                                isPeopleQuery: true
                            };
                        }
                    },
                    {
                        // XX人在哪里（如"广东人在哪里"）
                        regex: /(.+?人)(在哪里|有哪些|是谁)/,
                        extract: (match, columns) => {
                            const regionValue = match[1].replace(/人$/, '').trim();
                            const regionCol = this.findRegionColumn(columns);
                            return {
                                filterColumn: regionCol,
                                filterValue: regionValue,
                                operator: 'contains',
                                isPeopleQuery: true
                            };
                        }
                    },
                    {
                        // X大于/小于/等于Y的
                        regex: /(.+?)(大于|小于|等于|超过|不足|至少|最多)(.+?)的/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[1], columns),
                            operator: this.mapOperator(match[2]),
                            filterValue: match[3].trim()
                        })
                    },
                    {
                        // 只要/只看X为Y的
                        regex: /(只要|只看|只显示|筛选出|过滤出)(.+?)(为|是|等于)(.+?)的/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[2], columns),
                            operator: '=',
                            filterValue: match[4].trim()
                        })
                    },
                    {
                        // X在Y范围内的
                        regex: /(.+?)在(.+?)(范围|区间|之间)内/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[1], columns),
                            operator: 'between',
                            filterValue: match[2].trim()
                        })
                    },
                    {
                        // 排除/去除X为Y的
                        regex: /(排除|去除|删除|不要)(.+?)(为|是|等于)(.+?)的/,
                        extract: (match, columns) => ({
                            filterColumn: this.findColumn(match[2], columns),
                            operator: '!=',
                            filterValue: match[4].trim()
                        })
                    }
                ]
            },
            
            // 排序（升序、降序排列）
            'QUERY_SORT': {
                patterns: [
                    {
                        // 按X排序
                        regex: /按[照]?(.+?)(排序|排列)/,
                        extract: (match, columns) => ({
                            sortColumn: this.findColumn(match[1], columns),
                            sortOrder: 'asc'
                        })
                    },
                    {
                        // 按X升序/降序
                        regex: /按[照]?(.+?)(升序|降序|从小到大|从大到小|从低到高|从高到低)/,
                        extract: (match, columns) => ({
                            sortColumn: this.findColumn(match[1], columns),
                            sortOrder: match[2].includes('升') || match[2].includes('小') || match[2].includes('低') ? 'asc' : 'desc'
                        })
                    },
                    {
                        // X从高到低/从低到高
                        regex: /(.+?)(从高到低|从低到高|从大到小|从小到大)/,
                        extract: (match, columns) => ({
                            sortColumn: this.findColumn(match[1], columns),
                            sortOrder: match[2].includes('高') || match[2].includes('大') ? 'desc' : 'asc'
                        })
                    }
                ]
            },
            
            // 柱状图可视化
            'CHART_BAR': {
                patterns: [
                    {
                        // 按照 X/Y 绘制柱状图（新增：支持斜杠分隔 X 轴和 Y 轴）
                        regex: /按 [照]?(.+?)[/／](.+?)(绘制 | 画|生成|做).*柱状图/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1].trim(), columns),
                            yAxisColumn: this.findColumn(match[2].trim(), columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 按照 Y 统计 X 并绘制柱状图
                        regex: /按 [照]?(.+?) 统计 (.+?).*柱状图/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            yAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 按照X绘制柱状图（只指定分组列，默认计数）
                        regex: /按[照]?(.+?)(绘制|画|生成|做).*柱状图/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 各Y的X柱状图
                        regex: /各(.+?)的(.+?).*柱状图/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            yAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 绘制XX和YY的柱状图（明确指定X轴和Y轴）
                        // 如"绘制省份和销售额的柱状图" → X轴=省份, Y轴=销售额
                        regex: /(绘制|画|生成|做)(.+?)(和|与|及)(.+?)的柱状图/,
                        extract: (match, columns) => {
                            const xDesc = match[2].trim();
                            const yDesc = match[4].trim();
                            console.log(`[CHART_BAR] 匹配"XX和YY的柱状图": X=${xDesc}, Y=${yDesc}`);
                            
                            const xAxisColumn = this.findColumn(xDesc, columns);
                            const yAxisColumn = this.findColumn(yDesc, columns);
                            
                            console.log(`[CHART_BAR] 匹配结果: X=${xAxisColumn}, Y=${yAxisColumn}`);
                            
                            return {
                                chartType: 'bar',
                                xAxisColumn: xAxisColumn,
                                yAxisColumn: yAxisColumn,
                                aggregateFunction: 'sum'
                            };
                        }
                    },
                    {
                        // 绘制X的柱状图（只指定分组列，默认计数）
                        // 注意：此模式不能包含"和"字，避免与上面的模式冲突
                        regex: /(绘制|画|生成|做)([^和]+?)的柱状图/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的柱状图（最简形式）
                        // 注意：此模式不能包含"和"字
                        regex: /([^和]+?)的柱状图/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    }
                ]
            },
            
            // 折线图可视化
            'CHART_LINE': {
                patterns: [
                    {
                        // 按照 X/Y 绘制折线图（新增：支持斜杠分隔 X 轴和 Y 轴）
                        regex: /按 [照]?(.+?)[/／](.+?)(绘制 | 画|生成|做).*折线图/,
                        extract: (match, columns) => ({
                            chartType: 'line',
                            xAxisColumn: this.findColumn(match[1].trim(), columns),
                            yAxisColumn: this.findColumn(match[2].trim(), columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 按照 Y 统计 X 并绘制折线图
                        regex: /按 [照]?(.+?) 统计 (.+?).*折线图/,
                        extract: (match, columns) => ({
                            chartType: 'line',
                            xAxisColumn: this.findColumn(match[1], columns),
                            yAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 按照X绘制折线图（只指定分组列，默认计数）
                        regex: /按[照]?(.+?)(绘制|画|生成|做).*折线图/,
                        extract: (match, columns) => ({
                            chartType: 'line',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的趋势折线图
                        regex: /(.+?)的(趋势|走势|变化).*折线图/,
                        extract: (match, columns) => ({
                            chartType: 'line',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 绘制X的折线图
                        regex: /(绘制|画|生成|做)(.+?)的折线图/,
                        extract: (match, columns) => ({
                            chartType: 'line',
                            xAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的折线图（最简形式）
                        regex: /(.+?)的折线图/,
                        extract: (match, columns) => ({
                            chartType: 'line',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    }
                ]
            },
            
            // 散点图可视化
            'CHART_SCATTER': {
                patterns: [
                    {
                        // 按照X绘制散点图
                        regex: /按[照]?(.+?)(绘制|画|生成|做).*散点图/,
                        extract: (match, columns) => ({
                            chartType: 'scatter',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X和Y的散点图
                        regex: /(.+?)和(.+?)的散点图/,
                        extract: (match, columns) => ({
                            chartType: 'scatter',
                            xAxisColumn: this.findColumn(match[1], columns),
                            yAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 绘制X的散点图
                        regex: /(绘制|画|生成|做)(.+?)的散点图/,
                        extract: (match, columns) => ({
                            chartType: 'scatter',
                            xAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的散点图
                        regex: /(.+?)的散点图/,
                        extract: (match, columns) => ({
                            chartType: 'scatter',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    }
                ]
            },
            
            // 饼图可视化
            'CHART_PIE': {
                patterns: [
                    {
                        // 按照 X/Y 绘制饼图（新增：支持斜杠分隔标签列和数值列）
                        regex: /按 [照]?(.+?)[/／](.+?)(绘制 | 画|生成|做).*饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[1].trim(), columns),
                            valueColumn: this.findColumn(match[2].trim(), columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 按X的Y绘制饼图（如"按各省销售额绘制饼图"）
                        regex: /按[照]?(.+?)的(.+?)(绘制|画|生成|做).*饼图/,
                        extract: (match, columns) => {
                            const labelDesc = match[1].trim();  // 标签列描述，如"各省"
                            const valueDesc = match[2].trim();  // 数值列描述，如"销售额"
                            console.log(`[CHART_PIE] 匹配"按X的Y绘制饼图": 标签=${labelDesc}, 数值=${valueDesc}`);
                            
                            const labelCol = this.findColumn(labelDesc, columns);
                            const valueCol = this.findColumn(valueDesc, columns);
                            
                            console.log(`[CHART_PIE] 匹配结果: 标签列=${labelCol}, 数值列=${valueCol}`);
                            
                            return {
                                chartType: 'pie',
                                labelColumn: labelCol,
                                valueColumn: valueCol,
                                aggregateFunction: 'sum'
                            };
                        }
                    },
                    {
                        // 按照 X 绘制饼图（只指定分组列，默认计数）
                        // 注意：此模式不能包含"的"字，避免与上面的"按X的Y"模式冲突
                        regex: /按[照]?([^的]+?)(绘制|画|生成|做).*饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的占比饼图
                        regex: /(.+?)的(占比|分布).*饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 统计X的占比并绘制饼图
                        regex: /统计(.+?)的(占比|分布).*饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 绘制X的饼图
                        regex: /(绘制|画|生成|做)(.+?)的饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的饼图
                        regex: /(.+?)的饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X饼图（最简形式）
                        regex: /(.+?)饼图/,
                        extract: (match, columns) => ({
                            chartType: 'pie',
                            labelColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    }
                ]
            },
            
            // 通用图表可视化
            'CHART_GENERAL': {
                patterns: [
                    {
                        // 按照Y统计X并绘制图表
                        regex: /按[照]?(.+?)统计(.+?).*图表/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            yAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 按照X绘制图表（只指定分组列，默认计数）
                        regex: /按[照]?(.+?)(绘制|画|生成|做).*图表/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 各Y的X图表
                        regex: /各(.+?)的(.+?).*图表/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            yAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'sum'
                        })
                    },
                    {
                        // 绘制X的图表
                        regex: /(绘制|画|生成|做)(.+?)的图表/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[2], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // X的图表（最简形式）
                        regex: /(.+?)的图表/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    },
                    {
                        // 绘制X的图表
                        regex: /绘制(.+?)的图表/,
                        extract: (match, columns) => ({
                            chartType: 'bar',
                            xAxisColumn: this.findColumn(match[1], columns),
                            aggregateFunction: 'count'
                        })
                    }
                ]
            }
        };
        
        // 语义映射表（用于列名匹配）
        this.semanticMappings = {
            '年龄': ['年龄', '岁数', '年纪', '年限'],
            '工资': ['工资', '收入', '薪资', '薪酬', '薪水', '月薪', '年薪'],
            '金额': ['金额', '费用', '成本', '价格', '价值', '钱'],
            '数量': ['数量', '个数', '次数', '频次', '量'],
            '时间': ['时间', '时长', '日期', '时刻', '周期'],
            '姓名': ['姓名', '名字', '名称', '谁'],
            '省': ['省', '省份', '省级', '省公司'],
            '市': ['市', '城市', '市级'],
            '部门': ['部门', '单位', '机构', '组织']
        };
    }
    
    // 查找列名（支持语义匹配）
    findColumn(description, columns) {
        // 检查参数有效性
        if (!description || !columns || !Array.isArray(columns) || columns.length === 0) {
            console.warn('findColumn: 参数无效', { description, columnsCount: columns?.length });
            return null;
        }
        
        const lowerDesc = description.toLowerCase().trim();
        
        // 1. 直接匹配
        for (const col of columns) {
            if (col.toLowerCase().includes(lowerDesc) || lowerDesc.includes(col.toLowerCase())) {
                return col;
            }
        }
        
        // 2. 语义映射匹配
        for (const [concept, synonyms] of Object.entries(this.semanticMappings)) {
            if (synonyms.some(s => lowerDesc.includes(s.toLowerCase()))) {
                // 找到包含该概念的列
                for (const col of columns) {
                    if (synonyms.some(s => col.toLowerCase().includes(s.toLowerCase()))) {
                        return col;
                    }
                }
            }
        }
        
        // 3. 部分匹配（找包含关键词的列）
        for (const col of columns) {
            const lowerCol = col.toLowerCase();
            // 检查描述中的每个字是否在列名中
            const chars = lowerDesc.split('');
            const matchCount = chars.filter(c => lowerCol.includes(c)).length;
            if (matchCount >= chars.length * 0.5) {  // 50%的字匹配
                return col;
            }
        }
        
        // 4. 返回第一个列作为默认值
        return columns[0] || null;
    }
    
    // 查找区域/省公司列（用于区域筛选）
    findRegionColumn(columns) {
        // 检查参数有效性
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            console.warn('findRegionColumn: 参数无效', { columnsCount: columns?.length });
            return null;
        }
        
        // 优先查找包含"省"、"区域"、"地区"的列
        const regionKeywords = ['省', '区域', '地区', '省份', '省公司'];
        for (const col of columns) {
            const lowerCol = col.toLowerCase();
            if (regionKeywords.some(kw => lowerCol.includes(kw))) {
                return col;
            }
        }
        // 如果没有找到，返回第一个列
        return columns[0] || null;
    }
    
    // 映射操作符
    mapOperator(op) {
        const operatorMap = {
            '大于': '>',
            '小于': '<',
            '等于': '=',
            '超过': '>',
            '不足': '<',
            '至少': '>=',
            '最多': '<='
        };
        return operatorMap[op] || '=';
    }
    
    // 生成查询配置
    generateConfig(intentType, userInput, columns, entityExtractionResult = null) {
        console.log(`[QueryConfigGenerator] 生成查询配置: ${intentType}, 输入: "${userInput}"`);
        console.log(`[QueryConfigGenerator] 可用列:`, columns);
        
        // 检查columns是否有效
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            console.warn('[QueryConfigGenerator] 列信息无效或为空');
            return null;
        }
        
        // V4.0新增：如果有高置信度的实体提取结果，生成带筛选条件的配置
        if (entityExtractionResult && entityExtractionResult.filters) {
            const highConfidenceFilters = entityExtractionResult.filters.filter(
                f => f.linkedColumn && f.matchCount > 0
            );
            
            if (highConfidenceFilters.length > 0) {
                console.log('[QueryConfigGenerator] 检测到高置信度筛选条件，生成筛选聚合配置');
                
                // V4.0修复：提取数值列
                // 优先从entityExtractionResult.columns中获取，如果没有则从用户输入中查找
                let valueColumn = null;
                if (entityExtractionResult.columns && entityExtractionResult.columns.length > 0) {
                    valueColumn = entityExtractionResult.columns[entityExtractionResult.columns.length - 1].matchedColumn;
                } else {
                    // 从用户输入中查找数值列（如"销售额"、"金额"等）
                    const numericKeywords = ['销售额', '金额', '数量', '数值', '价格', '成本', '利润', '收入'];
                    for (const keyword of numericKeywords) {
                        if (userInput.includes(keyword)) {
                            valueColumn = this.findColumn(keyword, columns);
                            if (valueColumn) break;
                        }
                    }
                    // 如果没找到，尝试查找包含这些关键词的列
                    if (!valueColumn) {
                        valueColumn = columns.find(col => 
                            numericKeywords.some(kw => col.includes(kw))
                        );
                    }
                }
                
                console.log('[QueryConfigGenerator] 数值列:', valueColumn);
                
                if (valueColumn && highConfidenceFilters.length === 1) {
                    // 单个筛选值
                    const filter = highConfidenceFilters[0];
                    return {
                        intentType: intentType,
                        userInput: userInput,
                        queryType: 'filter_aggregate',
                        filterColumn: filter.linkedColumn,
                        filterValue: filter.linkedValue,
                        valueColumn: valueColumn,
                        aggregateFunction: 'sum',
                        title: `${filter.linkedValue}的${valueColumn}`,
                        description: `筛选${filter.linkedColumn}=${filter.linkedValue}的数据，计算${valueColumn}总和`
                    };
                } else if (valueColumn && highConfidenceFilters.length > 1) {
                    // 多个筛选值
                    const filterValues = highConfidenceFilters.map(f => f.linkedValue);
                    const firstFilter = highConfidenceFilters[0];
                    return {
                        intentType: intentType,
                        userInput: userInput,
                        queryType: 'filter_aggregate',
                        filterColumn: firstFilter.linkedColumn,
                        filterValues: filterValues,
                        valueColumn: valueColumn,
                        aggregateFunction: 'sum',
                        title: `${filterValues.join('和')}的${valueColumn}`,
                        description: `筛选${firstFilter.linkedColumn}=${filterValues.join('或')}的数据，计算${valueColumn}总和`
                    };
                }
            }
        }
        
        const generator = this.configGenerators[intentType];
        if (!generator) {
            console.warn(`[QueryConfigGenerator] 未知的意图类型: ${intentType}`);
            return null;
        }
        
        console.log(`[QueryConfigGenerator] 尝试匹配 ${generator.patterns.length} 个模式`);
        
        for (let i = 0; i < generator.patterns.length; i++) {
            const pattern = generator.patterns[i];
            const match = userInput.match(pattern.regex);
            console.log(`[QueryConfigGenerator] 模式 ${i}: ${pattern.regex}, 匹配结果:`, match ? '成功' : '失败');
            
            if (match) {
                console.log('[QueryConfigGenerator] 匹配成功，match数组:', match);
                const params = pattern.extract(match, columns);
                console.log('[QueryConfigGenerator] 提取的参数:', params);
                
                const isValid = this.validateParams(params, intentType);
                console.log('[QueryConfigGenerator] 参数验证结果:', isValid ? '通过' : '失败');
                
                if (isValid) {
                    // 构建配置
                    const config = this.buildConfig(intentType, params, userInput);
                    console.log('[QueryConfigGenerator] 生成配置:', config);
                    return config;
                }
            }
        }
        
        console.log('[QueryConfigGenerator] 未匹配到任何有效模式');
        return null;
    }
    
    // 验证参数
    validateParams(params, intentType) {
        // 根据意图类型验证必需参数
        if (intentType.startsWith('CHART_')) {
            // 图表需要至少一个列
            if (!params.xAxisColumn && !params.labelColumn) {
                console.warn('图表配置缺少X轴列或标签列');
                return false;
            }
        }
        
        if (intentType === 'QUERY_FIND') {
            if (!params.valueCol) {
                console.warn('查找配置缺少数值列');
                return false;
            }
        }
        
        if (intentType === 'QUERY_AGGREGATE') {
            // 检查是否有数值列（count除外）
            if (params.aggregateFunction !== 'count' && !params.valueCol) {
                console.warn('聚合配置缺少数值列');
                return false;
            }
            // 非整体统计需要分组列
            if (!params.isOverall && !params.groupCol) {
                console.warn('聚合配置缺少分组列');
                return false;
            }
        }
        
        if (intentType === 'QUERY_FILTER') {
            if (!params.filterColumn) {
                console.warn('筛选配置缺少筛选列');
                return false;
            }
        }
        
        if (intentType === 'QUERY_SORT') {
            if (!params.sortColumn) {
                console.warn('排序配置缺少排序列');
                return false;
            }
        }
        
        return true;
    }
    
    // 构建配置
    buildConfig(intentType, params, userInput) {
        const baseConfig = {
            intentType: intentType,
            userInput: userInput
        };
        
        // 根据意图类型构建具体配置
        if (intentType === 'QUERY_FIND') {
            // 处理复合查询：哪个X的Y最高（需要先按X分组，再求Y的最大值）
            if (params.isCompoundQuery && params.groupCol) {
                console.log(`[buildConfig] 构建复合查询配置: 按${params.groupCol}分组求${params.valueCol}的极值`);
                return {
                    ...baseConfig,
                    intentType: 'QUERY_AGGREGATE',  // 重要：将意图改为聚合查询，以便正确路由
                    queryType: 'group_aggregate_find',
                    groupColumn: params.groupCol,
                    valueColumn: params.valueCol,
                    aggregateFunction: 'sum',  // 默认求和，也可以根据语义判断
                    order: params.queryType === 'find_max' ? 'desc' : 'asc',
                    limit: 1,
                    title: `${params.groupCol}的${params.valueCol}${params.queryType === 'find_max' ? '最高' : '最低'}`,
                    description: `按${params.groupCol}分组，求${params.valueCol}的${params.queryType === 'find_max' ? '最大值' : '最小值'}`
                };
            }
            
            // 处理查找前几名/后几名
            if (params.queryType === 'find_top') {
                return {
                    ...baseConfig,
                    queryType: 'find_top',
                    valueColumn: params.valueCol,
                    limit: params.limit || 5,
                    order: params.order || 'desc',
                    title: `${params.valueCol}${params.order === 'desc' ? '前' : '后'}${params.limit || 5}名`,
                    description: `查找${params.valueCol}${params.order === 'desc' ? '最大' : '最小'}的前${params.limit || 5}条记录`
                };
            }
            
            // 处理查找排名
            if (params.queryType === 'find_rank') {
                return {
                    ...baseConfig,
                    queryType: 'find_rank',
                    valueColumn: params.valueCol,
                    rank: params.rank || 1,
                    title: `${params.valueCol}排名第${params.rank || 1}`,
                    description: `查找${params.valueCol}排名第${params.rank || 1}的记录`
                };
            }
            
            // 处理查找最大/最小值
            return {
                ...baseConfig,
                queryType: params.queryType,
                valueColumn: params.valueCol,
                title: `${params.valueCol}${params.queryType === 'find_max' ? '最大值' : '最小值'}查询`,
                description: `查找${params.valueCol}${params.queryType === 'find_max' ? '最大' : '最小'}的记录`
            };
        }
        
        if (intentType === 'QUERY_AGGREGATE') {
            // 处理带筛选条件的聚合查询
            if (params.hasFilter) {
                return {
                    ...baseConfig,
                    queryType: 'aggregate_filter',
                    filterColumn: params.filterColumn,
                    filterValue: params.filterValue,
                    valueColumn: params.valueCol,
                    aggregateFunction: params.aggregateFunction,
                    title: `${params.filterColumn}为${params.filterValue}的${params.valueCol}数量`,
                    description: `筛选${params.filterColumn}为${params.filterValue}的记录，统计${params.valueCol}数量`
                };
            }
            
            if (params.isOverall) {
                return {
                    ...baseConfig,
                    queryType: 'aggregate_overall',
                    valueColumn: params.valueCol,
                    aggregateFunction: params.aggregateFunction,
                    isOverall: true,
                    title: `${params.valueCol}${params.aggregateFunction === 'avg' ? '平均值' : '总和'}`,
                    description: `统计所有${params.valueCol}的${params.aggregateFunction === 'avg' ? '平均值' : '总和'}`
                };
            } else {
                return {
                    ...baseConfig,
                    queryType: 'aggregate_groupby',
                    groupColumn: params.groupCol,
                    valueColumn: params.valueCol,
                    aggregateFunction: params.aggregateFunction,
                    title: `各${params.groupCol}${params.valueCol}${params.aggregateFunction === 'avg' ? '平均值' : params.aggregateFunction === 'count' ? '数量' : '总和'}`,
                    description: `按照${params.groupCol}统计${params.valueCol}的${params.aggregateFunction === 'avg' ? '平均值' : params.aggregateFunction === 'count' ? '数量' : '总和'}`
                };
            }
        }
        
        if (intentType === 'QUERY_FILTER') {
            // 处理人员筛选查询（如"谁是广东人"）
            if (params.isPeopleQuery) {
                return {
                    ...baseConfig,
                    queryType: 'filter_people',
                    filterColumn: params.filterColumn,
                    filterValue: params.filterValue,
                    operator: params.operator,
                    title: `${params.filterValue}人查询`,
                    description: `查找${params.filterColumn}包含${params.filterValue}的人`
                };
            }
            return {
                ...baseConfig,
                queryType: 'filter',
                filterColumn: params.filterColumn,
                operator: params.operator,
                filterValue: params.filterValue,
                title: '数据筛选',
                description: `筛选${params.filterColumn}${params.operator}${params.filterValue}的数据`
            };
        }
        
        if (intentType === 'QUERY_SORT') {
            return {
                ...baseConfig,
                queryType: 'sort',
                sortColumn: params.sortColumn,
                sortOrder: params.sortOrder,
                title: '数据排序',
                description: `按${params.sortColumn}${params.sortOrder === 'asc' ? '升序' : '降序'}排列`
            };
        }
        
        if (intentType.startsWith('CHART_')) {
            return {
                ...baseConfig,
                chartType: params.chartType,
                xAxisColumn: params.xAxisColumn,
                yAxisColumn: params.yAxisColumn,
                labelColumn: params.labelColumn,
                aggregateFunction: params.aggregateFunction || 'sum',
                title: params.title || '数据图表',
                description: params.description || '数据可视化'
            };
        }
        
        return baseConfig;
    }
}

// 导出单例
const queryConfigGenerator = new QueryConfigGenerator();
export default queryConfigGenerator;
