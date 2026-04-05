// 数据管理器 - V5.0
class DataManager {
    constructor() {
        this.data = [];
        this.originalData = [];
        this.headers = [];
        this.fileContext = {
            fileName: '',
            sheetName: '',
            fileKeywords: []
        };
        this.vectorizationEnabled = true;
        this.vectorizationTable = 'data';
        this.useDatabaseMode = false;
    }
    
    // 处理文件上传
    async processFile(file) {
        try {
            this.fileContext.fileName = file.name;
            this.fileContext.fileKeywords = this.extractKeywordsFromFileName(file.name);
            
            if (file.name.endsWith('.csv')) {
                return await this.processCSV(file);
            } else if (file.name.endsWith('.xlsx')) {
                return await this.processExcel(file);
            } else {
                throw new Error('不支持的文件格式');
            }
        } catch (error) {
            console.error('[DataManager] 处理文件失败:', error);
            throw error;
        }
    }
    
    // 处理CSV文件
    async processCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                complete: (results) => {
                    try {
                        this.headers = results.meta.fields || [];
                        this.data = results.data.filter(row => {
                            // 过滤空行
                            return Object.values(row).some(val => val !== null && val !== undefined && val !== '');
                        });
                        this.originalData = JSON.parse(JSON.stringify(this.data));
                        
                        resolve({
                            success: true,
                            headers: this.headers,
                            rows: this.data.length
                        });
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
    
    // 处理Excel文件
    async processExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 使用第一个sheet
                    const sheetName = workbook.SheetNames[0];
                    this.fileContext.sheetName = sheetName;
                    
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    this.headers = Object.keys(jsonData[0] || {});
                    this.data = jsonData.filter(row => {
                        // 过滤空行
                        return Object.values(row).some(val => val !== null && val !== undefined && val !== '');
                    });
                    this.originalData = JSON.parse(JSON.stringify(this.data));
                    
                    resolve({
                        success: true,
                        headers: this.headers,
                        rows: this.data.length,
                        sheetName: sheetName
                    });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    
    // 提取文件名关键词
    extractKeywordsFromFileName(fileName) {
        const keywords = [];
        const name = fileName.replace(/\.[^/.]+$/, ''); // 移除扩展名
        
        // 提取年份
        const yearMatch = name.match(/\d{4}/);
        if (yearMatch) {
            keywords.push(yearMatch[0]);
        }
        
        // 提取季度
        const quarterMatch = name.match(/(Q[1-4]|第[一二三四]季度|季度)/);
        if (quarterMatch) {
            keywords.push(quarterMatch[0]);
        }
        
        // 提取月份
        const monthMatch = name.match(/(\d{1,2}月|月份)/);
        if (monthMatch) {
            keywords.push(monthMatch[0]);
        }
        
        // 提取常见业务关键词
        const businessKeywords = ['销售', '数据', '报表', '分析', '统计', '业绩', '财务', '库存', '客户'];
        businessKeywords.forEach(keyword => {
            if (name.includes(keyword)) {
                keywords.push(keyword);
            }
        });
        
        return keywords;
    }
    
    // 获取数据
    getData() {
        return this.data;
    }
    
    // 获取原始数据
    getOriginalData() {
        return this.originalData;
    }
    
    // 获取表头
    getHeaders() {
        return this.headers;
    }
    
    // 获取文件上下文
    getFileContext() {
        return this.fileContext;
    }
    
    // 设置数据
    setData(data) {
        this.data = data;
    }
    
    // 重置数据
    resetData() {
        this.data = JSON.parse(JSON.stringify(this.originalData));
    }
    
    // 应用筛选
    applyFilter(conditions) {
        if (!conditions || conditions.length === 0) {
            this.resetData();
            return;
        }
        
        this.data = this.originalData.filter(row => {
            return conditions.every(condition => {
                const { column, operator, value } = condition;
                if (!this.headers.includes(column)) return false;
                
                const rowValue = row[column];
                return this.evaluateCondition(rowValue, operator, value);
            });
        });
    }
    
    // 应用排序
    applySort(column, direction) {
        if (!column || !this.headers.includes(column)) return;
        
        this.data.sort((a, b) => {
            const valueA = this.parseNumericValue(a[column]);
            const valueB = this.parseNumericValue(b[column]);
            
            if (isNaN(valueA) || isNaN(valueB)) {
                // 非数值比较
                const strA = String(a[column]);
                const strB = String(b[column]);
                return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
            }
            
            // 数值比较
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        });
    }
    
    // 评估条件
    evaluateCondition(rowValue, operator, targetValue) {
        const numRowValue = this.parseNumericValue(rowValue);
        const numTargetValue = this.parseNumericValue(targetValue);
        
        switch (operator) {
            case 'eq':
            case '=':
                return rowValue === targetValue;
            case 'ne':
            case '!=':
                return rowValue !== targetValue;
            case 'gt':
            case '>':
                return numRowValue > numTargetValue;
            case 'lt':
            case '<':
                return numRowValue < numTargetValue;
            case 'ge':
            case '>=':
                return numRowValue >= numTargetValue;
            case 'le':
            case '<=':
                return numRowValue <= numTargetValue;
            case 'contains':
                return String(rowValue).includes(String(targetValue));
            case 'not_contains':
                return !String(rowValue).includes(String(targetValue));
            default:
                return false;
        }
    }
    
    // 解析数值
    parseNumericValue(value) {
        if (value === null || value === undefined) return NaN;
        
        let str = String(value).replace(/,/g, '').replace(/[￥$€£\s]/g, '');
        return parseFloat(str);
    }
    
    // 数据向量化
    async vectorizeData() {
        if (!this.vectorizationEnabled || this.data.length === 0) {
            return { success: false, message: '向量化未启用或无数据' };
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/vectorization/vectorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_name: this.vectorizationTable,
                    data: this.data
                })
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[DataManager] 向量化失败:', error);
            return { success: false, message: error.message };
        }
    }
    
    // 检查向量化状态
    async checkVectorizationStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/vectorization/collections`);
            const result = await response.json();
            return result.collections || [];
        } catch (error) {
            console.error('[DataManager] 检查向量化状态失败:', error);
            return [];
        }
    }
    
    // 设置向量化启用状态
    setVectorizationEnabled(enabled) {
        this.vectorizationEnabled = enabled;
    }
    
    // 设置向量化表名
    setVectorizationTable(tableName) {
        this.vectorizationTable = tableName;
    }
    
    // 设置数据库模式
    setDatabaseMode(enabled) {
        this.useDatabaseMode = enabled;
    }
    
    // 获取数据统计信息
    getStatistics() {
        const stats = {
            rowCount: this.data.length,
            columnCount: this.headers.length,
            columns: this.headers.map(header => {
                const values = this.data.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '');
                const numericValues = values.map(v => this.parseNumericValue(v)).filter(v => !isNaN(v));
                
                return {
                    name: header,
                    type: numericValues.length > values.length * 0.8 ? 'numeric' : 'text',
                    uniqueCount: [...new Set(values)].length,
                    nullCount: this.data.length - values.length,
                    min: numericValues.length > 0 ? Math.min(...numericValues) : null,
                    max: numericValues.length > 0 ? Math.max(...numericValues) : null,
                    avg: numericValues.length > 0 ? numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length : null
                };
            })
        };
        
        return stats;
    }
}

// 导出数据管理器
export default DataManager;