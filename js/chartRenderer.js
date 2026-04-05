// 图表渲染器 - V5.0
class ChartRenderer {
    constructor() {
        this.charts = new Map();
    }
    
    // 渲染图表
    async render(config, data, headers, container) {
        if (!config || !data || !headers || !container) {
            throw new Error('缺少必要的参数');
        }
        
        try {
            switch (config.chartType) {
                case 'bar':
                    return this.renderBar(config, data, headers, container);
                case 'line':
                    return this.renderLine(config, data, headers, container);
                case 'pie':
                case 'doughnut':
                    return this.renderPie(config, data, headers, container);
                case 'scatter':
                    return this.renderScatter(config, data, headers, container);
                default:
                    throw new Error(`不支持的图表类型: ${config.chartType}`);
            }
        } catch (error) {
            console.error('[ChartRenderer] 渲染图表失败:', error);
            container.innerHTML = `<div style="color: #666; padding: 20px;">图表渲染失败: ${error.message}</div>`;
            return null;
        }
    }
    
    // 渲染柱状图
    renderBar(config, data, headers, container) {
        const { xAxisColumn, yAxisColumn, title, description, aggregateFunction = 'sum', sortOrder = null } = config;
        
        // 找到实际的列
        let actualXColumn = this.findActualColumn(xAxisColumn, headers);
        let actualYColumn = this.findActualColumn(yAxisColumn, headers);
        
        if (!actualXColumn || !actualYColumn) {
            throw new Error('图表列不存在');
        }
        
        // 统计数据
        const counts = this.aggregateData(data, actualXColumn, actualYColumn, aggregateFunction);
        
        // 排序
        const sortedData = this.sortData(counts, sortOrder);
        const labels = sortedData.map(item => item.label);
        const values = sortedData.map(item => item.value);
        
        if (labels.length === 0) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">无有效数据可绘制图表</div>`;
            return null;
        }
        
        // 创建图表容器
        const chartContainer = this.createChartContainer(title, description);
        container.appendChild(chartContainer);
        
        // 创建图表
        const canvas = chartContainer.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: actualYColumn,
                    data: values,
                    backgroundColor: this.generateColors(labels.length),
                    borderColor: this.generateColors(labels.length, 1),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${actualYColumn}: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: actualYColumn
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: actualXColumn
                        }
                    }
                }
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // 渲染折线图
    renderLine(config, data, headers, container) {
        const { xAxisColumn, yAxisColumn, title, description, aggregateFunction = 'sum', sortOrder = null } = config;
        
        // 找到实际的列
        let actualXColumn = this.findActualColumn(xAxisColumn, headers);
        let actualYColumn = this.findActualColumn(yAxisColumn, headers);
        
        if (!actualXColumn || !actualYColumn) {
            throw new Error('图表列不存在');
        }
        
        // 统计数据
        const counts = this.aggregateData(data, actualXColumn, actualYColumn, aggregateFunction);
        
        // 排序
        const sortedData = this.sortData(counts, sortOrder);
        const labels = sortedData.map(item => item.label);
        const values = sortedData.map(item => item.value);
        
        if (labels.length === 0) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">无有效数据可绘制图表</div>`;
            return null;
        }
        
        // 创建图表容器
        const chartContainer = this.createChartContainer(title, description);
        container.appendChild(chartContainer);
        
        // 创建图表
        const canvas = chartContainer.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: actualYColumn,
                    data: values,
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${actualYColumn}: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: actualYColumn
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: actualXColumn
                        }
                    }
                }
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // 渲染饼图
    renderPie(config, data, headers, container) {
        const { labelColumn, valueColumn, title, description, aggregateFunction = 'count' } = config;
        
        // 找到实际的列
        let actualLabelColumn = this.findActualColumn(labelColumn, headers);
        let actualValueColumn = valueColumn ? this.findActualColumn(valueColumn, headers) : null;
        
        if (!actualLabelColumn) {
            throw new Error('标签列不存在');
        }
        
        // 统计数据
        const counts = this.aggregateData(data, actualLabelColumn, actualValueColumn, aggregateFunction);
        
        // 取前10个
        const topData = counts.slice(0, 10);
        const labels = topData.map(item => item.label);
        const values = topData.map(item => item.value);
        
        if (labels.length === 0) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">无有效数据可绘制图表</div>`;
            return null;
        }
        
        // 创建图表容器
        const chartContainer = this.createChartContainer(title, description);
        container.appendChild(chartContainer);
        
        // 创建图表
        const canvas = chartContainer.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: config.chartType,
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: this.generateColors(labels.length),
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // 渲染散点图
    renderScatter(config, data, headers, container) {
        const { xAxisColumn, yAxisColumn, title, description } = config;
        
        // 找到实际的列
        let actualXColumn = this.findActualColumn(xAxisColumn, headers);
        let actualYColumn = this.findActualColumn(yAxisColumn, headers);
        
        if (!actualXColumn) {
            throw new Error('X轴列不存在');
        }
        
        // 准备散点图数据
        const scatterData = [];
        data.forEach((row, index) => {
            let xVal = this.parseNumericValue(row[actualXColumn]);
            let yVal = actualYColumn ? this.parseNumericValue(row[actualYColumn]) : index;
            
            if (!isNaN(xVal) && !isNaN(yVal)) {
                scatterData.push({ x: xVal, y: yVal });
            }
        });
        
        if (scatterData.length === 0) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">无有效数据可绘制散点图</div>`;
            return null;
        }
        
        // 创建图表容器
        const chartContainer = this.createChartContainer(title, description);
        container.appendChild(chartContainer);
        
        // 创建图表
        const canvas = chartContainer.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: actualYColumn || '数值',
                    data: scatterData,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return `${actualXColumn}: ${point.x.toFixed(2)}, ${actualYColumn || '索引'}: ${point.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: actualXColumn
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: actualYColumn || '索引'
                        }
                    }
                }
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // 聚合数据
    aggregateData(data, groupColumn, valueColumn, aggregateFunction) {
        const result = {};
        
        data.forEach(row => {
            const key = row[groupColumn];
            if (key !== null && key !== undefined && key !== '') {
                const keyStr = String(key).trim();
                
                if (valueColumn) {
                    const value = this.parseNumericValue(row[valueColumn]);
                    if (!isNaN(value)) {
                        if (!result[keyStr]) {
                            result[keyStr] = [];
                        }
                        result[keyStr].push(value);
                    }
                } else {
                    // 计数
                    result[keyStr] = (result[keyStr] || 0) + 1;
                }
            }
        });
        
        // 计算聚合值
        const aggregated = [];
        for (const [key, values] of Object.entries(result)) {
            let value;
            if (Array.isArray(values)) {
                value = this.calculateAggregate(values, aggregateFunction);
            } else {
                value = values;
            }
            aggregated.push({ label: key, value: value });
        }
        
        return aggregated;
    }
    
    // 排序数据
    sortData(data, sortOrder) {
        if (!sortOrder) return data;
        
        return [...data].sort((a, b) => {
            return sortOrder === 'desc' ? b.value - a.value : a.value - b.value;
        });
    }
    
    // 找到实际的列
    findActualColumn(columnName, headers) {
        if (!columnName) return null;
        if (headers.includes(columnName)) return columnName;
        
        // 模糊匹配
        return headers.find(h => h.includes(columnName) || columnName.includes(h));
    }
    
    // 解析数值
    parseNumericValue(value) {
        if (value === null || value === undefined) return NaN;
        
        let str = String(value).replace(/,/g, '').replace(/[￥$€£\s]/g, '');
        return parseFloat(str);
    }
    
    // 计算聚合值
    calculateAggregate(values, functionName) {
        if (!values || values.length === 0) return 0;
        
        switch (functionName.toLowerCase()) {
            case 'sum':
                return values.reduce((sum, val) => sum + val, 0);
            case 'avg':
            case 'average':
                return values.reduce((sum, val) => sum + val, 0) / values.length;
            case 'max':
                return Math.max(...values);
            case 'min':
                return Math.min(...values);
            case 'count':
                return values.length;
            default:
                return values.reduce((sum, val) => sum + val, 0) / values.length;
        }
    }
    
    // 生成颜色
    generateColors(count, alpha = 0.6) {
        const baseColors = [
            `rgba(102, 126, 234, ${alpha})`,
            `rgba(118, 75, 162, ${alpha})`,
            `rgba(255, 99, 132, ${alpha})`,
            `rgba(54, 162, 235, ${alpha})`,
            `rgba(255, 206, 86, ${alpha})`,
            `rgba(75, 192, 192, ${alpha})`,
            `rgba(153, 102, 255, ${alpha})`,
            `rgba(255, 159, 64, ${alpha})`
        ];
        
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }
    
    // 创建图表容器
    createChartContainer(title, description) {
        const container = document.createElement('div');
        container.className = 'chart-container';
        container.innerHTML = `
            <div class="chart-header">
                <h3>${title || '图表'}</h3>
                <p>${description || ''}</p>
            </div>
            <div class="chart-wrapper" style="height: 400px; position: relative;">
                <canvas id="chart-${Date.now()}"></canvas>
            </div>
        `;
        return container;
    }
    
    // 销毁图表
    destroyChart(chartId) {
        const chart = this.charts.get(chartId);
        if (chart) {
            chart.destroy();
            this.charts.delete(chartId);
        }
    }
    
    // 销毁所有图表
    destroyAllCharts() {
        this.charts.forEach((chart, id) => {
            chart.destroy();
        });
        this.charts.clear();
    }
}

// 导出图表渲染器
export default ChartRenderer;