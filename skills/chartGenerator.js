// 图表生成技能
// 负责根据数据生成各种类型的图表

const chartGeneratorSkill = {
    info: {
        name: 'chartGenerator',
        displayName: '图表生成',
        description: '根据数据生成各种类型的图表，包括柱状图、折线图、饼图等',
        version: '1.0.0',
        author: 'AI Assistant'
    },
    
    // 执行图表生成
    async execute(data, options = {}) {
        try {
            const chartResult = this.generateCharts(data, options);
            
            return {
                success: true,
                data: chartResult,
                message: '图表生成完成',
                details: {
                    chartCount: chartResult.charts.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 生成图表
    generateCharts(data, options) {
        const chartResult = {
            charts: [],
            recommendations: []
        };
        
        // 分析数据特征
        const dataFeatures = this.analyzeDataFeatures(data);
        
        // 生成推荐图表
        chartResult.recommendations = this.recommendCharts(dataFeatures);
        
        // 生成图表配置
        chartResult.charts = this.generateChartConfigs(data, dataFeatures, options);
        
        return chartResult;
    },
    
    // 分析数据特征
    analyzeDataFeatures(data) {
        const features = {
            rowCount: data.length,
            columnCount: data.length > 0 ? Object.keys(data[0]).length : 0,
            numericColumns: [],
            categoricalColumns: [],
            dateColumns: []
        };
        
        if (data.length === 0) {
            return features;
        }
        
        const columns = Object.keys(data[0]);
        
        columns.forEach(column => {
            const values = data.map(item => item[column]).filter(val => val !== '' && val !== null && val !== undefined);
            const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
            
            if (numericValues.length === values.length && values.length > 0) {
                features.numericColumns.push(column);
            } else {
                // 尝试判断是否为日期
                const dateValues = values.filter(val => !isNaN(Date.parse(val)));
                if (dateValues.length > 0) {
                    features.dateColumns.push(column);
                } else {
                    features.categoricalColumns.push(column);
                }
            }
        });
        
        return features;
    },
    
    // 推荐图表类型
    recommendCharts(dataFeatures) {
        const recommendations = [];
        
        // 基于数据特征推荐图表
        if (dataFeatures.numericColumns.length > 0) {
            if (dataFeatures.numericColumns.length === 1) {
                recommendations.push({
                    chartType: 'bar',
                    reason: '单个数值列适合使用柱状图展示数据分布',
                    priority: 'high'
                });
            } else if (dataFeatures.numericColumns.length > 1) {
                recommendations.push({
                    chartType: 'bar',
                    reason: '多个数值列适合使用柱状图进行比较',
                    priority: 'high'
                });
            }
        }
        
        if (dataFeatures.categoricalColumns.length > 0) {
            const catColumn = dataFeatures.categoricalColumns[0];
            recommendations.push({
                chartType: 'pie',
                reason: '分类列适合使用饼图展示各分类的占比',
                priority: 'medium'
            });
        }
        
        if (dataFeatures.dateColumns.length > 0 && dataFeatures.numericColumns.length > 0) {
            recommendations.push({
                chartType: 'line',
                reason: '日期列和数值列适合使用折线图展示趋势',
                priority: 'high'
            });
        }
        
        return recommendations;
    },
    
    // 生成图表配置
    generateChartConfigs(data, dataFeatures, options) {
        const charts = [];
        
        // 生成柱状图
        if (dataFeatures.numericColumns.length > 0) {
            charts.push(this.generateBarChart(data, dataFeatures));
        }
        
        // 生成饼图
        if (dataFeatures.categoricalColumns.length > 0) {
            charts.push(this.generatePieChart(data, dataFeatures));
        }
        
        // 生成折线图
        if (dataFeatures.dateColumns.length > 0 && dataFeatures.numericColumns.length > 0) {
            charts.push(this.generateLineChart(data, dataFeatures));
        }
        
        return charts;
    },
    
    // 生成柱状图配置
    generateBarChart(data, dataFeatures) {
        const chartData = {
            labels: [],
            datasets: []
        };
        
        // 使用第一列作为标签（如果是分类列）
        let labelColumn = dataFeatures.categoricalColumns[0] || dataFeatures.dateColumns[0] || Object.keys(data[0])[0];
        
        // 准备标签
        chartData.labels = data.slice(0, 10).map(row => row[labelColumn] || '未知');
        
        // 准备数据集
        dataFeatures.numericColumns.forEach((column, index) => {
            const dataset = {
                label: column,
                data: data.slice(0, 10).map(row => {
                    const value = row[column];
                    return !isNaN(parseFloat(value)) ? parseFloat(value) : 0;
                }),
                backgroundColor: `rgba(${102 + index * 20}, ${126 + index * 10}, ${234 - index * 20}, 0.6)`,
                borderColor: `rgba(${102 + index * 20}, ${126 + index * 10}, ${234 - index * 20}, 1)`,
                borderWidth: 1
            };
            chartData.datasets.push(dataset);
        });
        
        return {
            type: 'bar',
            title: `${dataFeatures.numericColumns.join(' vs ')} - 柱状图`,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };
    },
    
    // 生成饼图配置
    generatePieChart(data, dataFeatures) {
        const chartData = {
            labels: [],
            datasets: []
        };
        
        const catColumn = dataFeatures.categoricalColumns[0];
        if (!catColumn) return null;
        
        // 计算分类计数
        const categoryCount = {};
        data.forEach(row => {
            const value = row[catColumn];
            if (value) {
                categoryCount[value] = (categoryCount[value] || 0) + 1;
            }
        });
        
        // 准备数据
        chartData.labels = Object.keys(categoryCount).slice(0, 8);
        chartData.datasets.push({
            data: Object.values(categoryCount).slice(0, 8),
            backgroundColor: [
                'rgba(102, 126, 234, 0.8)',
                'rgba(118, 75, 162, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)'
            ]
        });
        
        return {
            type: 'pie',
            title: `${catColumn} - 饼图`,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        };
    },
    
    // 生成折线图配置
    generateLineChart(data, dataFeatures) {
        const chartData = {
            labels: [],
            datasets: []
        };
        
        const dateColumn = dataFeatures.dateColumns[0];
        const numericColumn = dataFeatures.numericColumns[0];
        
        if (!dateColumn || !numericColumn) return null;
        
        // 准备数据
        const sortedData = [...data].sort((a, b) => {
            const dateA = new Date(a[dateColumn]);
            const dateB = new Date(b[dateColumn]);
            return dateA - dateB;
        });
        
        chartData.labels = sortedData.slice(0, 10).map(row => {
            const date = new Date(row[dateColumn]);
            return date.toISOString().split('T')[0];
        });
        
        chartData.datasets.push({
            label: numericColumn,
            data: sortedData.slice(0, 10).map(row => {
                const value = row[numericColumn];
                return !isNaN(parseFloat(value)) ? parseFloat(value) : 0;
            }),
            borderColor: 'rgba(102, 126, 234, 1)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            tension: 0.1
        });
        
        return {
            type: 'line',
            title: `${dateColumn} vs ${numericColumn} - 折线图`,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: dateColumn
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: numericColumn
                        }
                    }
                }
            }
        };
    }
};

export default chartGeneratorSkill;