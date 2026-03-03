/**
 * 数据画像模块 (DataProfiler) - V4.0
 * 功能：自动构建数据画像，供LLM和Agent理解数据结构
 * 
 * 核心能力：
 * 1. 列类型推断（数值/文本/日期/枚举）
 * 2. 数据质量评估（完整性、唯一性、异常值）
 * 3. 数据分布分析
 * 4. Schema推断
 * 5. 样本值提取
 */

// 立即执行日志，确认文件被加载
console.log('>>> dataProfiler.js 文件开始执行 <<<');

class DataProfiler {
    constructor() {
        this.profile = null;
        this.columnProfiles = {};
    }

    /**
     * 生成完整的数据画像
     * @param {Array} data - 数据数组
     * @param {Array} headers - 列名数组
     * @returns {Object} 数据画像对象
     */
    profile(data, headers) {
        if (!data || data.length === 0 || !headers || headers.length === 0) {
            return null;
        }

        const startTime = Date.now();
        
        // 1. 基础信息
        const shape = { rows: data.length, cols: headers.length };
        
        // 2. 分析每一列
        headers.forEach(col => {
            this.columnProfiles[col] = this.analyzeColumn(col, data);
        });
        
        // 3. 数据质量评估
        const quality = this.assessQuality(data, headers);
        
        // 4. Schema推断
        const schema = this.inferSchema(headers, data);
        
        // 5. 样本值
        const sampleValues = this.getSampleValues(data, headers, 5);
        
        // 6. 列间关系分析
        const relationships = this.analyzeRelationships(data, headers);
        
        // 7. 构建完整画像
        this.profile = {
            shape,
            columns: this.columnProfiles,
            quality,
            schema,
            sampleValues,
            relationships,
            summary: this.generateSummary(shape, quality, schema),
            generatedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        
        return this.profile;
    }

    /**
     * 分析单列数据
     * @param {string} col - 列名
     * @param {Array} data - 数据数组
     * @returns {Object} 列画像
     */
    analyzeColumn(col, data) {
        // 提取非空值
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
        const nullCount = data.length - values.length;
        const nullRate = nullCount / data.length;
        
        // 唯一值
        const uniqueValues = [...new Set(values)];
        const uniqueCount = uniqueValues.length;
        const uniqueness = uniqueCount / values.length;
        
        // 判断数据类型
        const typeInfo = this.inferColumnType(values);
        
        // 基础画像
        const profile = {
            name: col,
            type: typeInfo.type,
            subType: typeInfo.subType,
            totalCount: data.length,
            validCount: values.length,
            nullCount,
            nullRate: parseFloat((nullRate * 100).toFixed(2)),
            uniqueCount,
            uniqueness: parseFloat((uniqueness * 100).toFixed(2)),
            isKeyCandidate: uniqueness > 0.95 && nullRate < 0.05
        };
        
        // 根据类型添加额外信息
        if (typeInfo.type === 'numeric') {
            const nums = values.map(v => this.parseNumeric(v)).filter(n => !isNaN(n));
            if (nums.length > 0) {
                nums.sort((a, b) => a - b);
                profile.min = nums[0];
                profile.max = nums[nums.length - 1];
                profile.sum = nums.reduce((a, b) => a + b, 0);
                profile.avg = profile.sum / nums.length;
                profile.median = this.calculateMedian(nums);
                profile.stdDev = this.calculateStdDev(nums, profile.avg);
                // 检测异常值（使用IQR方法）
                profile.outliers = this.detectOutliers(nums);
                // 推荐聚合方式
                profile.recommendedAggregation = this.recommendAggregation(profile);
            }
        } else if (typeInfo.type === 'text') {
            // 文本类型分析
            profile.topValues = this.getTopValues(values, 10);
            profile.avgLength = values.reduce((sum, v) => sum + String(v).length, 0) / values.length;
            // 检测是否为枚举型（唯一值少）
            if (uniqueCount <= 10 && uniqueCount < values.length * 0.5) {
                profile.subType = 'categorical';
                profile.isCategorical = true;
            }
            // 检测是否为ID型
            if (uniqueness > 0.95) {
                profile.subType = 'identifier';
                profile.isIdentifier = true;
            }
        } else if (typeInfo.type === 'datetime') {
            // 日期类型分析
            const dates = values.map(v => this.parseDate(v)).filter(d => d !== null);
            if (dates.length > 0) {
                dates.sort((a, b) => a - b);
                profile.minDate = dates[0];
                profile.maxDate = dates[dates.length - 1];
                profile.dateRange = Math.ceil((profile.maxDate - profile.minDate) / (1000 * 60 * 60 * 24));
                profile.granularity = this.detectDateGranularity(dates);
            }
        }
        
        return profile;
    }

    /**
     * 推断列类型
     * @param {Array} values - 值数组
     * @returns {Object} 类型信息
     */
    inferColumnType(values) {
        if (!values || values.length === 0) {
            return { type: 'unknown', subType: 'empty' };
        }
        
        // 采样分析（提高性能）
        const sampleSize = Math.min(values.length, 100);
        const samples = values.slice(0, sampleSize);
        
        // 检测日期类型
        const datePatterns = [
            /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/,  // 2024-01-01 或 2024/01/01
            /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/,  // 01-01-2024
            /^\d{4}年\d{1,2}月\d{1,2}日/,     // 2024年1月1日
        ];
        
        let dateCount = 0;
        let numericCount = 0;
        
        samples.forEach(v => {
            const str = String(v).trim();
            
            // 检测日期
            if (datePatterns.some(p => p.test(str))) {
                dateCount++;
            }
            
            // 检测数值
            const num = this.parseNumeric(v);
            if (!isNaN(num)) {
                numericCount++;
            }
        });
        
        // 判断类型
        if (dateCount > samples.length * 0.8) {
            return { type: 'datetime', subType: 'date' };
        }
        
        if (numericCount > samples.length * 0.9) {
            // 进一步判断是整数还是浮点数
            const hasDecimal = samples.some(v => {
                const num = this.parseNumeric(v);
                return !isNaN(num) && num % 1 !== 0;
            });
            return { 
                type: 'numeric', 
                subType: hasDecimal ? 'float' : 'integer'
            };
        }
        
        return { type: 'text', subType: 'string' };
    }

    /**
     * 解析数值
     * @param {*} value - 值
     * @returns {number} 数值
     */
    parseNumeric(value) {
        if (value === null || value === undefined || value === '') return NaN;
        let str = String(value).trim();
        // 移除千分位、货币符号等
        str = str.replace(/,/g, '').replace(/[￥$€£%]/g, '');
        const num = parseFloat(str);
        return num;
    }

    /**
     * 解析日期
     * @param {*} value - 值
     * @returns {Date|null} 日期对象
     */
    parseDate(value) {
        if (!value) return null;
        const str = String(value).trim();
        
        // 尝试多种日期格式
        const formats = [
            /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,  // YYYY-MM-DD
            /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,  // MM-DD-YYYY
            /(\d{4})年(\d{1,2})月(\d{1,2})日/,     // 中文格式
        ];
        
        for (const pattern of formats) {
            const match = str.match(pattern);
            if (match) {
                let year, month, day;
                if (pattern === formats[0] || pattern === formats[2]) {
                    [, year, month, day] = match;
                } else {
                    [, month, day, year] = match;
                }
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        
        // 尝试直接解析
        const date = new Date(str);
        return isNaN(date.getTime()) ? null : date;
    }

    /**
     * 计算中位数
     * @param {Array} sortedNums - 已排序的数值数组
     * @returns {number} 中位数
     */
    calculateMedian(sortedNums) {
        const mid = Math.floor(sortedNums.length / 2);
        return sortedNums.length % 2 !== 0
            ? sortedNums[mid]
            : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
    }

    /**
     * 计算标准差
     * @param {Array} nums - 数值数组
     * @param {number} avg - 平均值
     * @returns {number} 标准差
     */
    calculateStdDev(nums, avg) {
        const squareDiffs = nums.map(n => Math.pow(n - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / nums.length;
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * 检测异常值（IQR方法）
     * @param {Array} sortedNums - 已排序的数值数组
     * @returns {Object} 异常值信息
     */
    detectOutliers(sortedNums) {
        const q1Index = Math.floor(sortedNums.length * 0.25);
        const q3Index = Math.floor(sortedNums.length * 0.75);
        const q1 = sortedNums[q1Index];
        const q3 = sortedNums[q3Index];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const outliers = sortedNums.filter(n => n < lowerBound || n > upperBound);
        
        return {
            count: outliers.length,
            ratio: parseFloat((outliers.length / sortedNums.length * 100).toFixed(2)),
            lowerBound: parseFloat(lowerBound.toFixed(2)),
            upperBound: parseFloat(upperBound.toFixed(2))
        };
    }

    /**
     * 推荐聚合方式
     * @param {Object} profile - 列画像
     * @returns {string} 推荐的聚合方式
     */
    recommendAggregation(profile) {
        // 如果唯一值很多，推荐求和或平均
        if (profile.uniqueness > 0.8) {
            return profile.subType === 'integer' ? 'sum' : 'avg';
        }
        // 如果唯一值较少，可能是枚举型数值，推荐计数
        if (profile.uniqueness < 0.1) {
            return 'count';
        }
        return 'sum';
    }

    /**
     * 获取高频值
     * @param {Array} values - 值数组
     * @param {number} topN - 返回前N个
     * @returns {Array} 高频值数组
     */
    getTopValues(values, topN = 10) {
        const counts = {};
        values.forEach(v => {
            const key = String(v).trim();
            counts[key] = (counts[key] || 0) + 1;
        });
        
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([value, count]) => ({
                value,
                count,
                percentage: parseFloat((count / values.length * 100).toFixed(2))
            }));
    }

    /**
     * 检测日期粒度
     * @param {Array} dates - 日期数组
     * @returns {string} 粒度
     */
    detectDateGranularity(dates) {
        if (dates.length < 2) return 'unknown';
        
        // 计算相邻日期的平均间隔
        let totalDiff = 0;
        for (let i = 1; i < Math.min(dates.length, 10); i++) {
            totalDiff += Math.abs(dates[i] - dates[i-1]);
        }
        const avgDiff = totalDiff / (Math.min(dates.length, 10) - 1);
        const avgDays = avgDiff / (1000 * 60 * 60 * 24);
        
        if (avgDays < 1.5) return 'daily';
        if (avgDays < 8) return 'weekly';
        if (avgDays < 32) return 'monthly';
        if (avgDays < 400) return 'quarterly';
        return 'yearly';
    }

    /**
     * 评估数据质量
     * @param {Array} data - 数据数组
     * @param {Array} headers - 列名数组
     * @returns {Object} 质量评估结果
     */
    assessQuality(data, headers) {
        let totalCells = data.length * headers.length;
        let emptyCells = 0;
        let duplicateRows = 0;
        
        // 统计空值
        data.forEach(row => {
            headers.forEach(h => {
                if (row[h] === null || row[h] === undefined || row[h] === '') {
                    emptyCells++;
                }
            });
        });
        
        // 检测重复行
        const rowSignatures = new Set();
        data.forEach(row => {
            const sig = headers.map(h => row[h]).join('|');
            if (rowSignatures.has(sig)) {
                duplicateRows++;
            } else {
                rowSignatures.add(sig);
            }
        });
        
        const completeness = ((1 - emptyCells / totalCells) * 100).toFixed(2);
        const uniqueness = ((1 - duplicateRows / data.length) * 100).toFixed(2);
        
        return {
            completeness: parseFloat(completeness),
            uniqueness: parseFloat(uniqueness),
            emptyCells,
            duplicateRows,
            score: parseFloat(((parseFloat(completeness) + parseFloat(uniqueness)) / 2).toFixed(2)),
            grade: this.getQualityGrade((parseFloat(completeness) + parseFloat(uniqueness)) / 2)
        };
    }

    /**
     * 获取质量等级
     * @param {number} score - 分数
     * @returns {string} 等级
     */
    getQualityGrade(score) {
        if (score >= 95) return 'A';
        if (score >= 85) return 'B';
        if (score >= 70) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }

    /**
     * 推断数据Schema
     * @param {Array} headers - 列名数组
     * @param {Array} data - 数据数组
     * @returns {Object} Schema信息
     */
    inferSchema(headers, data) {
        const numericCols = [];
        const textCols = [];
        const dateCols = [];
        const categoricalCols = [];
        const idCols = [];
        
        headers.forEach(col => {
            const profile = this.columnProfiles[col];
            if (!profile) return;
            
            switch (profile.type) {
                case 'numeric':
                    numericCols.push(col);
                    break;
                case 'datetime':
                    dateCols.push(col);
                    break;
                case 'text':
                    if (profile.isCategorical) {
                        categoricalCols.push(col);
                    } else if (profile.isIdentifier) {
                        idCols.push(col);
                    } else {
                        textCols.push(col);
                    }
                    break;
            }
        });
        
        // 推断数据类型
        let dataType = 'unknown';
        if (dateCols.length > 0 && numericCols.length > 0) {
            dataType = 'time_series';
        } else if (numericCols.length > headers.length * 0.5) {
            dataType = 'numerical';
        } else if (categoricalCols.length > 0) {
            dataType = 'categorical';
        } else if (textCols.length > headers.length * 0.5) {
            dataType = 'textual';
        }
        
        return {
            dataType,
            numericCols,
            textCols,
            dateCols,
            categoricalCols,
            idCols,
            dimensions: [...dateCols, ...categoricalCols],
            measures: numericCols
        };
    }

    /**
     * 获取样本值
     * @param {Array} data - 数据数组
     * @param {Array} headers - 列名数组
     * @param {number} count - 样本数量
     * @returns {Array} 样本数据
     */
    getSampleValues(data, headers, count = 5) {
        return data.slice(0, count).map(row => {
            const obj = {};
            headers.forEach(h => obj[h] = row[h]);
            return obj;
        });
    }

    /**
     * 分析列间关系
     * @param {Array} data - 数据数组
     * @param {Array} headers - 列名数组
     * @returns {Object} 关系信息
     */
    analyzeRelationships(data, headers) {
        const relationships = {
            correlations: [],
            potentialForeignKeys: []
        };
        
        // 计算数值列之间的相关性
        const numericCols = headers.filter(h => 
            this.columnProfiles[h]?.type === 'numeric'
        );
        
        if (numericCols.length >= 2) {
            // 简化的相关性分析（采样）
            const sampleSize = Math.min(data.length, 100);
            const samples = data.slice(0, sampleSize);
            
            for (let i = 0; i < numericCols.length; i++) {
                for (let j = i + 1; j < numericCols.length; j++) {
                    const col1 = numericCols[i];
                    const col2 = numericCols[j];
                    const correlation = this.calculateCorrelation(samples, col1, col2);
                    
                    if (Math.abs(correlation) > 0.7) {
                        relationships.correlations.push({
                            columns: [col1, col2],
                            coefficient: parseFloat(correlation.toFixed(3)),
                            strength: Math.abs(correlation) > 0.9 ? 'strong' : 'moderate'
                        });
                    }
                }
            }
        }
        
        return relationships;
    }

    /**
     * 计算两列的相关系数
     * @param {Array} data - 数据数组
     * @param {string} col1 - 列1
     * @param {string} col2 - 列2
     * @returns {number} 相关系数
     */
    calculateCorrelation(data, col1, col2) {
        const pairs = data
            .map(row => [this.parseNumeric(row[col1]), this.parseNumeric(row[col2])])
            .filter(([a, b]) => !isNaN(a) && !isNaN(b));
        
        if (pairs.length < 10) return 0;
        
        const n = pairs.length;
        const sumX = pairs.reduce((s, [x]) => s + x, 0);
        const sumY = pairs.reduce((s, [, y]) => s + y, 0);
        const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0);
        const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0);
        const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * 生成数据摘要
     * @param {Object} shape - 数据形状
     * @param {Object} quality - 数据质量
     * @param {Object} schema - Schema信息
     * @returns {string} 摘要文本
     */
    generateSummary(shape, quality, schema) {
        const parts = [];
        
        parts.push(`数据集共${shape.rows}行×${shape.cols}列`);
        
        if (schema.numericCols.length > 0) {
            parts.push(`数值型字段${schema.numericCols.length}个`);
        }
        if (schema.categoricalCols.length > 0) {
            parts.push(`分类字段${schema.categoricalCols.length}个`);
        }
        if (schema.dateCols.length > 0) {
            parts.push(`日期字段${schema.dateCols.length}个`);
        }
        
        parts.push(`数据完整度${quality.completeness}%`);
        parts.push(`质量评级${quality.grade}`);
        
        return parts.join('，') + '。';
    }

    /**
     * 获取LLM友好的数据描述
     * @returns {string} LLM可理解的数据描述
     */
    getLLMDescription() {
        if (!this.profile) return '';
        
        const { shape, columns, schema, quality, sampleValues } = this.profile;
        
        let desc = `数据概况：${shape.rows}行×${shape.cols}列，质量评级${quality.grade}\n`;
        desc += `字段信息：\n`;
        
        Object.entries(columns).forEach(([name, col]) => {
            if (col.type === 'numeric') {
                desc += `- ${name}：数值型，范围${col.min}~${col.max}，均值${col.avg?.toFixed(2)}\n`;
            } else if (col.type === 'datetime') {
                desc += `- ${name}：日期型，粒度${col.granularity}\n`;
            } else if (col.isCategorical) {
                desc += `- ${name}：分类型，${col.uniqueCount}个类别，主要值：${col.topValues?.slice(0,3).map(t => t.value).join('、')}\n`;
            } else {
                desc += `- ${name}：文本型，${col.uniqueCount}个不同值\n`;
            }
        });
        
        desc += `\n样本数据（前3行）：\n${JSON.stringify(sampleValues?.slice(0, 3), null, 2)}`;
        
        return desc;
    }

    /**
     * 获取推荐的图表配置
     * @returns {Array} 推荐的图表配置列表
     */
    getRecommendedCharts() {
        if (!this.profile) return [];
        
        const recommendations = [];
        const { schema, columns } = this.profile;
        
        // 时间序列数据 → 折线图
        if (schema.dataType === 'time_series' && schema.dateCols.length > 0 && schema.numericCols.length > 0) {
            recommendations.push({
                type: 'line',
                title: '趋势分析',
                xAxis: schema.dateCols[0],
                yAxis: schema.numericCols.slice(0, 2),
                reason: '时间序列数据适合用折线图展示趋势'
            });
        }
        
        // 分类数据 → 柱状图/饼图
        if (schema.categoricalCols.length > 0 && schema.numericCols.length > 0) {
            recommendations.push({
                type: 'bar',
                title: '分类对比',
                xAxis: schema.categoricalCols[0],
                yAxis: schema.numericCols[0],
                reason: '分类数据适合用柱状图进行对比'
            });
            
            const catProfile = columns[schema.categoricalCols[0]];
            if (catProfile && catProfile.uniqueCount <= 10) {
                recommendations.push({
                    type: 'pie',
                    title: '占比分布',
                    label: schema.categoricalCols[0],
                    value: schema.numericCols[0],
                    reason: '类别较少时适合用饼图展示占比'
                });
            }
        }
        
        // 多个数值列 → 散点图
        if (schema.numericCols.length >= 2) {
            recommendations.push({
                type: 'scatter',
                title: '相关性分析',
                xAxis: schema.numericCols[0],
                yAxis: schema.numericCols[1],
                reason: '两个数值列可以用散点图分析相关性'
            });
        }
        
        return recommendations;
    }
}

// 导出单例
const dataProfiler = new DataProfiler();

// 调试日志
console.log('[dataProfiler.js] 模块加载完成');
console.log('[dataProfiler.js] dataProfiler 类型:', typeof dataProfiler);
console.log('[dataProfiler.js] dataProfiler 原型:', Object.getPrototypeOf(dataProfiler));
console.log('[dataProfiler.js] profile方法类型:', typeof dataProfiler.profile);
console.log('[dataProfiler.js] 所有方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(dataProfiler)));

export default dataProfiler;
