/**
 * 增强图表模块
 * 对标Excel高级图表功能，支持组合图、双Y轴、趋势线等
 */

const EnhancedCharts = {
    // 颜色配置
    colors: {
        primary: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'],
        secondary: ['#fa709a', '#fee140', '#30cfd0', '#330867', '#ff0844', '#ffb199', '#6a11cb', '#2575fc']
    },

    /**
     * 创建组合图（柱状图+折线图）
     * 对应Excel: 组合图表
     * @param {Object} config - 图表配置
     * @param {Array} config.data - 数据
     * @param {string} config.xAxis - X轴字段
     * @param {Array} config.series - 系列配置 [{ type, field, yAxisID, ... }]
     * @param {Object} config.options - 其他选项
     * @returns {Object} Chart.js配置对象
     */
    createComboChart(config) {
        const { data, xAxis, series, options = {} } = config;
        
        // 提取X轴标签
        const labels = data.map(row => row[xAxis]);
        
        // 构建数据集
        const datasets = series.map((s, index) => {
            const isLine = s.type === 'line';
            const color = this.colors.primary[index % this.colors.primary.length];
            
            return {
                type: s.type || 'bar',
                label: s.label || s.field,
                data: data.map(row => parseFloat(row[s.field]) || 0),
                yAxisID: s.yAxisID || (index === 0 ? 'y' : 'y1'),
                borderColor: isLine ? color : undefined,
                backgroundColor: isLine ? 'transparent' : color + '80',
                borderWidth: isLine ? 3 : 0,
                pointBackgroundColor: isLine ? color : undefined,
                pointRadius: isLine ? 4 : 0,
                tension: isLine ? 0.4 : 0,
                fill: isLine ? false : true,
                ...s.extra
            };
        });
        
        return {
            type: 'bar', // 基础类型，各数据集可覆盖
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: { size: 16 }
                    },
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                return `${context.dataset.label}: ${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: !!options.xAxisTitle,
                            text: options.xAxisTitle || xAxis
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: !!options.yAxisTitle,
                            text: options.yAxisTitle || series[0]?.label || ''
                        }
                    },
                    y1: series.length > 1 ? {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: !!options.y1AxisTitle,
                            text: options.y1AxisTitle || series[1]?.label || ''
                        }
                    } : undefined
                }
            }
        };
    },

    /**
     * 添加趋势线
     * 对应Excel: 添加趋势线
     * @param {Array} data - Y轴数据
     * @param {string} type - 趋势线类型：'linear'|'exponential'|'polynomial'|'movingAverage'
     * @param {Object} options - 选项
     * @returns {Object} 趋势线数据
     */
    calculateTrendline(data, type = 'linear', options = {}) {
        const validData = data.filter(v => !isNaN(v));
        const n = validData.length;
        
        if (n < 2) return null;
        
        let trendData = [];
        
        switch (type) {
            case 'linear':
                // 线性回归: y = mx + b
                const xMean = (n - 1) / 2;
                const yMean = validData.reduce((a, b) => a + b, 0) / n;
                
                let numerator = 0;
                let denominator = 0;
                
                for (let i = 0; i < n; i++) {
                    numerator += (i - xMean) * (validData[i] - yMean);
                    denominator += Math.pow(i - xMean, 2);
                }
                
                const slope = denominator !== 0 ? numerator / denominator : 0;
                const intercept = yMean - slope * xMean;
                
                trendData = Array.from({ length: n }, (_, i) => slope * i + intercept);
                break;
            
            case 'exponential':
                // 指数趋势: y = a * e^(bx)
                const logData = validData.map(v => Math.log(v));
                const logMean = logData.reduce((a, b) => a + b, 0) / n;
                const xiMean = (n - 1) / 2;
                
                let expNum = 0;
                let expDen = 0;
                
                for (let i = 0; i < n; i++) {
                    expNum += (i - xiMean) * (logData[i] - logMean);
                    expDen += Math.pow(i - xiMean, 2);
                }
                
                const b = expDen !== 0 ? expNum / expDen : 0;
                const a = Math.exp(logMean - b * xiMean);
                
                trendData = Array.from({ length: n }, (_, i) => a * Math.exp(b * i));
                break;
            
            case 'movingAverage':
                // 移动平均
                const period = options.period || 3;
                trendData = validData.map((_, i) => {
                    const start = Math.max(0, i - period + 1);
                    const slice = validData.slice(start, i + 1);
                    return slice.reduce((a, b) => a + b, 0) / slice.length;
                });
                break;
            
            case 'polynomial':
                // 多项式回归（简化版，使用二次）
                const degree = options.degree || 2;
                trendData = this.polynomialRegression(validData, degree);
                break;
        }
        
        return {
            data: trendData,
            type,
            equation: this.getTrendEquation(type, validData, trendData)
        };
    },

    /**
     * 多项式回归
     */
    polynomialRegression(data, degree = 2) {
        const n = data.length;
        const result = [];
        
        // 简化的二次回归
        if (degree === 2) {
            // 使用最小二乘法拟合 y = ax^2 + bx + c
            // 这里使用简化实现
            const x = Array.from({ length: n }, (_, i) => i);
            const y = data;
            
            // 构建矩阵方程
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumX2 = x.reduce((a, b) => a + b * b, 0);
            const sumX3 = x.reduce((a, b) => a + b * b * b, 0);
            const sumX4 = x.reduce((a, b) => a + b * b * b * b, 0);
            const sumY = y.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
            const sumX2Y = x.reduce((a, xi, i) => a + xi * xi * y[i], 0);
            
            // 解方程组（简化）
            const c = sumY / n;
            const b = (sumXY - sumX * c) / (sumX2 - sumX * sumX / n);
            const a = (sumX2Y - sumX2 * c - b * sumX3) / (sumX4 - sumX2 * sumX2 / n);
            
            for (let i = 0; i < n; i++) {
                result.push(a * i * i + b * i + c);
            }
        }
        
        return result;
    },

    /**
     * 获取趋势线方程
     */
    getTrendEquation(type, originalData, trendData) {
        const n = originalData.length;
        
        switch (type) {
            case 'linear':
                const xMean = (n - 1) / 2;
                const yMean = originalData.reduce((a, b) => a + b, 0) / n;
                let numerator = 0, denominator = 0;
                for (let i = 0; i < n; i++) {
                    numerator += (i - xMean) * (originalData[i] - yMean);
                    denominator += Math.pow(i - xMean, 2);
                }
                const slope = denominator !== 0 ? numerator / denominator : 0;
                const intercept = yMean - slope * xMean;
                return `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`;
            
            default:
                return type;
        }
    },

    /**
     * 创建雷达图
     * 对应Excel: 雷达图
     * @param {Object} config - 图表配置
     * @returns {Object} Chart.js配置对象
     */
    createRadarChart(config) {
        const { data, dimensions, metrics, options = {} } = config;
        
        const labels = dimensions;
        const datasets = metrics.map((metric, index) => ({
            label: metric.label,
            data: dimensions.map(dim => {
                const row = data.find(r => r[options.dimensionField] === dim);
                return row ? parseFloat(row[metric.field]) || 0 : 0;
            }),
            borderColor: this.colors.primary[index % this.colors.primary.length],
            backgroundColor: this.colors.primary[index % this.colors.primary.length] + '40',
            pointBackgroundColor: this.colors.primary[index % this.colors.primary.length],
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: this.colors.primary[index % this.colors.primary.length]
        }));
        
        return {
            type: 'radar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || ''
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: '#e0e0e0'
                        },
                        angleLines: {
                            color: '#e0e0e0'
                        },
                        pointLabels: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        };
    },

    /**
     * 创建漏斗图
     * 对应Excel: 漏斗图（通过条形图模拟）
     * @param {Object} config - 图表配置
     * @returns {Object} Chart.js配置对象
     */
    createFunnelChart(config) {
        const { data, labelField, valueField, options = {} } = config;
        
        // 按值排序
        const sortedData = [...data].sort((a, b) => b[valueField] - a[valueField]);
        const maxValue = sortedData[0]?.[valueField] || 1;
        
        const labels = sortedData.map(row => row[labelField]);
        const values = sortedData.map(row => row[valueField]);
        
        // 计算漏斗形状
        const datasets = [{
            label: options.title || '漏斗图',
            data: values,
            backgroundColor: this.colors.primary.slice(0, sortedData.length),
            borderColor: 'transparent',
            borderWidth: 0,
            barPercentage: 1.0,
            categoryPercentage: 0.8
        }];
        
        return {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || ''
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.x;
                                const total = values[0];
                                const percent = ((value / total) * 100).toFixed(1);
                                return `${value} (${percent}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: maxValue * 1.1,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        };
    },

    /**
     * 创建热力图（使用矩阵背景色）
     * @param {Object} config - 图表配置
     * @returns {string} HTML表格
     */
    createHeatmap(config) {
        const { data, rowField, colField, valueField, options = {} } = config;
        
        // 获取唯一的行和列
        const rows = [...new Set(data.map(r => r[rowField]))].sort();
        const cols = [...new Set(data.map(r => r[colField]))].sort();
        
        // 构建矩阵
        const matrix = {};
        let minVal = Infinity, maxVal = -Infinity;
        
        for (const row of data) {
            const key = `${row[rowField]}|||${row[colField]}`;
            const val = parseFloat(row[valueField]) || 0;
            matrix[key] = val;
            minVal = Math.min(minVal, val);
            maxVal = Math.max(maxVal, val);
        }
        
        // 生成HTML
        let html = '<div class="heatmap-container" style="overflow-x: auto;">';
        html += '<table style="border-collapse: collapse;">';
        
        // 表头
        html += '<thead><tr><th style="padding: 10px; background: #667eea; color: white;"></th>';
        for (const col of cols) {
            html += `<th style="padding: 10px; background: #667eea; color: white;">${col}</th>`;
        }
        html += '</tr></thead>';
        
        // 数据行
        html += '<tbody>';
        for (const row of rows) {
            html += `<tr><td style="padding: 10px; background: #f0f0f0; font-weight: bold;">${row}</td>`;
            for (const col of cols) {
                const key = `${row}|||${col}`;
                const val = matrix[key] || 0;
                const intensity = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
                const bgColor = this.getHeatmapColor(intensity);
                const textColor = intensity > 0.5 ? 'white' : 'black';
                
                html += `<td style="padding: 10px; background: ${bgColor}; color: ${textColor}; text-align: center;">${val.toFixed(2)}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        
        // 图例
        html += '<div style="display: flex; align-items: center; margin-top: 10px;">';
        html += `<span style="margin-right: 10px;">${minVal.toFixed(2)}</span>`;
        html += '<div style="flex: 1; height: 20px; background: linear-gradient(to right, #e8f5e9, #81c784, #4caf50);"></div>';
        html += `<span style="margin-left: 10px;">${maxVal.toFixed(2)}</span>`;
        html += '</div></div>';
        
        return html;
    },

    /**
     * 获取热力图颜色
     */
    getHeatmapColor(intensity) {
        // 从浅绿到深绿
        const r = Math.round(255 - intensity * 155);
        const g = Math.round(255 - intensity * 55);
        const b = Math.round(255 - intensity * 155);
        return `rgb(${r}, ${g}, ${b})`;
    },

    /**
     * 创建箱线图数据
     * 对应Excel: 箱线图
     * @param {Array} data - 原始数据
     * @param {string} groupField - 分组字段
     * @param {string} valueField - 数值字段
     * @returns {Object} 箱线图数据
     */
    createBoxPlotData(data, groupField, valueField) {
        const groups = {};
        
        // 分组
        for (const row of data) {
            const group = row[groupField];
            if (!groups[group]) groups[group] = [];
            groups[group].push(parseFloat(row[valueField]) || 0);
        }
        
        // 计算每组的箱线图统计量
        const result = [];
        for (const [group, values] of Object.entries(groups)) {
            const sorted = values.filter(v => !isNaN(v)).sort((a, b) => a - b);
            const n = sorted.length;
            
            if (n === 0) continue;
            
            const q1 = this.percentile(sorted, 25);
            const q3 = this.percentile(sorted, 75);
            const iqr = q3 - q1;
            
            result.push({
                group,
                min: sorted[0],
                q1,
                median: this.percentile(sorted, 50),
                q3,
                max: sorted[n - 1],
                lowerFence: q1 - 1.5 * iqr,
                upperFence: q3 + 1.5 * iqr,
                outliers: sorted.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr)
            });
        }
        
        return result;
    },

    /**
     * 辅助函数：计算百分位数
     */
    percentile(sortedValues, p) {
        const rank = (p / 100) * (sortedValues.length - 1);
        const lower = Math.floor(rank);
        const fraction = rank - lower;
        if (lower === sortedValues.length - 1) {
            return sortedValues[lower];
        }
        return sortedValues[lower] + fraction * (sortedValues[lower + 1] - sortedValues[lower]);
    },

    /**
     * 创建带趋势线的图表配置
     * @param {Object} baseConfig - 基础图表配置
     * @param {string} trendType - 趋势线类型
     * @returns {Object} 增强的图表配置
     */
    addTrendlineToChart(baseConfig, trendType = 'linear') {
        const { data, labels } = baseConfig.data;
        
        if (!data || data.length === 0) return baseConfig;
        
        // 计算趋势线
        const trend = this.calculateTrendline(data, trendType);
        
        // 添加趋势线数据集
        baseConfig.data.datasets.push({
            type: 'line',
            label: `趋势线 (${trendType})`,
            data: trend.data,
            borderColor: '#ff6b6b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        return baseConfig;
    },

    /**
     * 创建面积图
     * @param {Object} config - 图表配置
     * @returns {Object} Chart.js配置对象
     */
    createAreaChart(config) {
        const { data, xAxis, series, options = {} } = config;
        
        const labels = data.map(row => row[xAxis]);
        const datasets = series.map((s, index) => ({
            label: s.label || s.field,
            data: data.map(row => parseFloat(row[s.field]) || 0),
            borderColor: this.colors.primary[index % this.colors.primary.length],
            backgroundColor: this.colors.primary[index % this.colors.primary.length] + '40',
            fill: true,
            tension: 0.4
        }));
        
        return {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || ''
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedCharts;
}
