// 数据清洗技能
// 负责处理数据中的缺失值、重复值等问题

const dataCleaningSkill = {
    info: {
        name: 'dataCleaning',
        displayName: '数据清洗',
        description: '处理数据中的缺失值、重复值等问题，提高数据质量',
        version: '1.0.0',
        author: 'AI Assistant'
    },
    
    // 执行数据清洗
    async execute(data, options = {}) {
        try {
            const cleanedData = this.cleanData(data, options);
            
            return {
                success: true,
                data: cleanedData,
                message: `数据清洗完成，处理了 ${data.length - cleanedData.length} 条记录`,
                details: {
                    originalCount: data.length,
                    cleanedCount: cleanedData.length,
                    processedCount: data.length - cleanedData.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 清洗数据
    cleanData(data, options) {
        let cleanedData = [...data];
        
        // 移除重复记录
        if (options.removeDuplicates !== false) {
            cleanedData = this.removeDuplicates(cleanedData);
        }
        
        // 处理缺失值
        if (options.handleMissingValues !== false) {
            cleanedData = this.handleMissingValues(cleanedData, options);
        }
        
        // 数据类型转换
        if (options.convertTypes !== false) {
            cleanedData = this.convertDataTypes(cleanedData);
        }
        
        return cleanedData;
    },
    
    // 移除重复记录
    removeDuplicates(data) {
        const seen = new Set();
        return data.filter(item => {
            const key = JSON.stringify(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    },
    
    // 处理缺失值
    handleMissingValues(data, options) {
        const strategy = options.missingValueStrategy || 'remove';
        
        if (strategy === 'remove') {
            return data.filter(item => {
                return Object.values(item).every(val => val !== '' && val !== null && val !== undefined);
            });
        } else if (strategy === 'fill') {
            return data.map(item => {
                const filledItem = { ...item };
                Object.keys(filledItem).forEach(key => {
                    if (filledItem[key] === '' || filledItem[key] === null || filledItem[key] === undefined) {
                        filledItem[key] = options.fillValue || '';
                    }
                });
                return filledItem;
            });
        }
        
        return data;
    },
    
    // 转换数据类型
    convertDataTypes(data) {
        return data.map(item => {
            const convertedItem = { ...item };
            Object.keys(convertedItem).forEach(key => {
                const value = convertedItem[key];
                
                // 尝试转换为数字
                if (!isNaN(value) && value !== '') {
                    convertedItem[key] = parseFloat(value);
                }
                // 尝试转换为日期
                else if (!isNaN(Date.parse(value))) {
                    convertedItem[key] = new Date(value);
                }
            });
            return convertedItem;
        });
    }
};

export default dataCleaningSkill;