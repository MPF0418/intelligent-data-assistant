// 异常检测技能
// 负责识别数据中的异常值和异常模式

const anomalyDetectionSkill = {
    info: {
        name: 'anomalyDetection',
        displayName: '异常检测',
        description: '识别数据中的异常值和异常模式，发现数据中的异常情况',
        version: '1.0.0',
        author: 'AI Assistant'
    },
    
    // 执行异常检测
    async execute(data, options = {}) {
        try {
            const anomalyResult = this.detectAnomalies(data, options);
            
            return {
                success: true,
                data: anomalyResult,
                message: '异常检测完成',
                details: {
                    anomalyCount: anomalyResult.anomalies.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 检测异常
    detectAnomalies(data, options) {
        const anomalyResult = {
            anomalies: [],
            summary: {
                totalAnomalies: 0,
                affectedColumns: []
            }
        };
        
        // 检测异常值
        const valueAnomalies = this.detectValueAnomalies(data, options);
        anomalyResult.anomalies.push(...valueAnomalies);
        
        // 检测异常模式
        const patternAnomalies = this.detectPatternAnomalies(data, options);
        anomalyResult.anomalies.push(...patternAnomalies);
        
        // 生成摘要
        anomalyResult.summary.totalAnomalies = anomalyResult.anomalies.length;
        anomalyResult.summary.affectedColumns = [...new Set(anomalyResult.anomalies.map(a => a.column))];
        
        return anomalyResult;
    },
    
    // 检测值异常
    detectValueAnomalies(data, options) {
        const anomalies = [];
        
        if (!data || data.length === 0) {
            return anomalies;
        }
        
        const columns = Object.keys(data[0]);
        
        columns.forEach(column => {
            const numericValues = data.map(item => item[column])
                .filter(val => val !== '' && val !== null && val !== undefined && !isNaN(parseFloat(val)))
                .map(val => parseFloat(val));
            
            if (numericValues.length >= 3) {
                const columnAnomalies = this.detectColumnAnomalies(numericValues, column, data);
                anomalies.push(...columnAnomalies);
            }
        });
        
        return anomalies;
    },
    
    // 检测列异常
    detectColumnAnomalies(values, column, originalData) {
        const anomalies = [];
        
        // 计算统计量
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
        
        // 使用3σ法则检测异常
        const threshold = 3 * stdDev;
        
        originalData.forEach((row, index) => {
            const value = row[column];
            if (value !== '' && value !== null && value !== undefined && !isNaN(parseFloat(value))) {
                const numericValue = parseFloat(value);
                if (Math.abs(numericValue - mean) > threshold) {
                    anomalies.push({
                        type: 'value_anomaly',
                        column,
                        rowIndex: index,
                        value: numericValue,
                        expectedRange: `${(mean - threshold).toFixed(2)} - ${(mean + threshold).toFixed(2)}`,
                        deviation: ((Math.abs(numericValue - mean) / stdDev).toFixed(2)),
                        severity: Math.abs(numericValue - mean) > 5 * stdDev ? 'high' : 'medium'
                    });
                }
            }
        });
        
        return anomalies;
    },
    
    // 检测模式异常
    detectPatternAnomalies(data, options) {
        const anomalies = [];
        
        if (!data || data.length < 5) {
            return anomalies;
        }
        
        const columns = Object.keys(data[0]);
        
        columns.forEach(column => {
            const values = data.map(item => item[column])
                .filter(val => val !== '' && val !== null && val !== undefined);
            
            if (values.length >= 5) {
                const patternAnomalies = this.detectPatternAnomaly(values, column, data);
                anomalies.push(...patternAnomalies);
            }
        });
        
        return anomalies;
    },
    
    // 检测模式异常
    detectPatternAnomaly(values, column, originalData) {
        const anomalies = [];
        
        // 检测突变
        for (let i = 1; i < values.length; i++) {
            const prevValue = values[i - 1];
            const currentValue = values[i];
            
            if (!isNaN(parseFloat(prevValue)) && !isNaN(parseFloat(currentValue))) {
                const prevNumeric = parseFloat(prevValue);
                const currentNumeric = parseFloat(currentValue);
                
                // 检测突变（变化超过50%）
                if (prevNumeric !== 0) {
                    const changePercent = Math.abs((currentNumeric - prevNumeric) / prevNumeric) * 100;
                    if (changePercent > 50) {
                        anomalies.push({
                            type: 'pattern_anomaly',
                            column,
                            rowIndex: i,
                            prevValue: prevNumeric,
                            currentValue: currentNumeric,
                            changePercent: changePercent.toFixed(2),
                            severity: changePercent > 100 ? 'high' : 'medium'
                        });
                    }
                }
            }
        }
        
        return anomalies;
    }
};

export default anomalyDetectionSkill;