/**
 * 高级统计函数模块
 * 支持中位数、众数、标准差、方差、百分位数等统计计算
 * 对标Excel的统计函数能力
 */

const AdvancedStatistics = {
    /**
     * 计算中位数
     * 对应Excel函数: MEDIAN
     * @param {Array} values - 数值数组
     * @returns {number} 中位数
     * 
     * 示例: median([1, 3, 5, 7, 9]) → 5
     */
    median(values) {
        // 过滤非数值并排序
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);
        
        if (validValues.length === 0) return null;
        
        const mid = Math.floor(validValues.length / 2);
        // 偶数个取中间两数平均值，奇数个取中间值
        return validValues.length % 2 
            ? validValues[mid] 
            : (validValues[mid - 1] + validValues[mid]) / 2;
    },

    /**
     * 计算众数（出现次数最多的值）
     * 对应Excel函数: MODE
     * @param {Array} values - 数值或字符串数组
     * @returns {Object} { mode: 众数值, count: 出现次数 }
     * 
     * 示例: mode([1, 2, 2, 3, 3, 3, 4]) → { mode: 3, count: 3 }
     */
    mode(values) {
        const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
        
        if (validValues.length === 0) return null;
        
        // 统计每个值的出现次数
        const counts = {};
        validValues.forEach(v => {
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
        });
        
        // 找出出现次数最多的值
        let maxCount = 0;
        let modeValue = null;
        Object.entries(counts).forEach(([value, count]) => {
            if (count > maxCount) {
                maxCount = count;
                modeValue = value;
            }
        });
        
        return {
            mode: modeValue,
            count: maxCount
        };
    },

    /**
     * 计算标准差
     * 对应Excel函数: STDEV.P (总体标准差) / STDEV.S (样本标准差)
     * @param {Array} values - 数值数组
     * @param {boolean} isSample - 是否为样本标准差（默认false为总体标准差）
     * @returns {number} 标准差
     * 
     * 示例: stdDev([2, 4, 4, 4, 5, 5, 7, 9]) → 2.0 (总体标准差)
     */
    stdDev(values, isSample = false) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (validValues.length < 2) return 0;
        
        // 计算平均值
        const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        
        // 计算方差
        const squaredDiffs = validValues.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / 
            (isSample ? validValues.length - 1 : validValues.length);
        
        return Math.sqrt(variance);
    },

    /**
     * 计算方差
     * 对应Excel函数: VAR.P (总体方差) / VAR.S (样本方差)
     * @param {Array} values - 数值数组
     * @param {boolean} isSample - 是否为样本方差
     * @returns {number} 方差
     */
    variance(values, isSample = false) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (validValues.length < 2) return 0;
        
        const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        const squaredDiffs = validValues.map(v => Math.pow(v - mean, 2));
        
        return squaredDiffs.reduce((sum, v) => sum + v, 0) / 
            (isSample ? validValues.length - 1 : validValues.length);
    },

    /**
     * 计算百分位数
     * 对应Excel函数: PERCENTILE.INC / PERCENTILE.EXC
     * @param {Array} values - 数值数组
     * @param {number} p - 百分位（0-100）
     * @param {boolean} exclusive - 是否使用exclusive方法
     * @returns {number} 百分位数值
     * 
     * 示例: percentile([1, 2, 3, 4, 5], 50) → 3 (第50百分位即中位数)
     */
    percentile(values, p, exclusive = false) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);
        
        if (validValues.length === 0) return null;
        
        // 将百分位转换为小数
        const percentile = p / 100;
        
        if (exclusive) {
            // PERCENTILE.EXC 方法
            const rank = percentile * (validValues.length + 1) - 1;
            if (rank < 0 || rank >= validValues.length) {
                return null; // 超出范围
            }
            const lower = Math.floor(rank);
            const fraction = rank - lower;
            if (lower === validValues.length - 1) {
                return validValues[lower];
            }
            return validValues[lower] + fraction * (validValues[lower + 1] - validValues[lower]);
        } else {
            // PERCENTILE.INC 方法（默认）
            const rank = percentile * (validValues.length - 1);
            const lower = Math.floor(rank);
            const fraction = rank - lower;
            if (lower === validValues.length - 1) {
                return validValues[lower];
            }
            return validValues[lower] + fraction * (validValues[lower + 1] - validValues[lower]);
        }
    },

    /**
     * 计算四分位数
     * 对应Excel函数: QUARTILE.INC / QUARTILE.EXC
     * @param {Array} values - 数值数组
     * @param {number} quartile - 四分位（1, 2, 3 分别代表第25、50、75百分位）
     * @returns {number} 四分位数值
     */
    quartile(values, quartile) {
        const percentiles = { 1: 25, 2: 50, 3: 75 };
        return this.percentile(values, percentiles[quartile] || 50);
    },

    /**
     * 计算偏度（衡量数据分布的不对称程度）
     * 对应Excel函数: SKEW
     * @param {Array} values - 数值数组
     * @returns {number} 偏度
     */
    skewness(values) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (validValues.length < 3) return 0;
        
        const n = validValues.length;
        const mean = validValues.reduce((sum, v) => sum + v, 0) / n;
        const stdDev = this.stdDev(validValues, true);
        
        if (stdDev === 0) return 0;
        
        // 计算三阶中心矩
        const skewSum = validValues.reduce((sum, v) => {
            return sum + Math.pow((v - mean) / stdDev, 3);
        }, 0);
        
        return (n / ((n - 1) * (n - 2))) * skewSum;
    },

    /**
     * 计算峰度（衡量数据分布的尖锐程度）
     * 对应Excel函数: KURT
     * @param {Array} values - 数值数组
     * @returns {number} 峰度
     */
    kurtosis(values) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (validValues.length < 4) return 0;
        
        const n = validValues.length;
        const mean = validValues.reduce((sum, v) => sum + v, 0) / n;
        const stdDev = this.stdDev(validValues, true);
        
        if (stdDev === 0) return 0;
        
        // 计算四阶中心矩
        const kurtSum = validValues.reduce((sum, v) => {
            return sum + Math.pow((v - mean) / stdDev, 4);
        }, 0);
        
        return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * kurtSum 
            - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    },

    /**
     * 计算相关系数
     * 对应Excel函数: CORREL
     * @param {Array} x - 第一个数值数组
     * @param {Array} y - 第二个数值数组
     * @returns {number} 相关系数（-1到1之间）
     */
    correlation(x, y) {
        const validPairs = [];
        for (let i = 0; i < Math.min(x.length, y.length); i++) {
            const xVal = parseFloat(x[i]);
            const yVal = parseFloat(y[i]);
            if (!isNaN(xVal) && !isNaN(yVal)) {
                validPairs.push([xVal, yVal]);
            }
        }
        
        if (validPairs.length < 2) return null;
        
        const n = validPairs.length;
        const sumX = validPairs.reduce((sum, p) => sum + p[0], 0);
        const sumY = validPairs.reduce((sum, p) => sum + p[1], 0);
        const sumXY = validPairs.reduce((sum, p) => sum + p[0] * p[1], 0);
        const sumX2 = validPairs.reduce((sum, p) => sum + p[0] * p[0], 0);
        const sumY2 = validPairs.reduce((sum, p) => sum + p[1] * p[1], 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt(
            (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
        );
        
        return denominator === 0 ? 0 : numerator / denominator;
    },

    /**
     * 计算数据范围（最大值-最小值）
     * 对应Excel概念: Range
     * @param {Array} values - 数值数组
     * @returns {Object} { min, max, range }
     */
    range(values) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (validValues.length === 0) return null;
        
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        
        return {
            min,
            max,
            range: max - min
        };
    },

    /**
     * 计算完整的描述性统计
     * @param {Array} values - 数值数组
     * @returns {Object} 包含所有统计指标的对象
     */
    descriptiveStats(values) {
        const validValues = values
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (validValues.length === 0) return null;
        
        const sum = validValues.reduce((s, v) => s + v, 0);
        const mean = sum / validValues.length;
        const rangeInfo = this.range(validValues);
        
        return {
            count: validValues.length,
            sum: sum,
            mean: mean,
            median: this.median(validValues),
            mode: this.mode(validValues),
            min: rangeInfo.min,
            max: rangeInfo.max,
            range: rangeInfo.range,
            stdDev: this.stdDev(validValues),
            variance: this.variance(validValues),
            q1: this.quartile(validValues, 1),
            q3: this.quartile(validValues, 3),
            iqr: this.quartile(validValues, 3) - this.quartile(validValues, 1),
            skewness: this.skewness(validValues),
            kurtosis: this.kurtosis(validValues)
        };
    },

    /**
     * 根据函数名执行对应的统计函数
     * @param {string} funcName - 函数名（median, mode, stdDev等）
     * @param {Array} values - 数值数组
     * @param {Object} options - 额外参数
     * @returns {*} 统计结果
     */
    execute(funcName, values, options = {}) {
        const funcMap = {
            'median': () => this.median(values),
            'mode': () => this.mode(values),
            'stdDev': () => this.stdDev(values, options.isSample),
            'variance': () => this.variance(values, options.isSample),
            'percentile': () => this.percentile(values, options.p || 50),
            'quartile': () => this.quartile(values, options.quartile || 2),
            'skewness': () => this.skewness(values),
            'kurtosis': () => this.kurtosis(values),
            'range': () => this.range(values),
            'descriptiveStats': () => this.descriptiveStats(values)
        };
        
        const func = funcMap[funcName.toLowerCase()];
        if (!func) {
            throw new Error(`未知的统计函数: ${funcName}`);
        }
        
        return func();
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedStatistics;
}
