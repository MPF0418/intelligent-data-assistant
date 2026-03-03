/**
 * V4.0 实体提取与链接模块
 * 产品意义：将用户输入中的实体（如"广东省"）与数据表中的具体值关联
 * 解决痛点：本地模型无法理解"广东省"是"省份"列的一个筛选值
 */

class EntityExtractor {
    constructor() {
        // 常见的地点后缀，用于识别可能的筛选值
        this.locationSuffixes = ['省', '市', '区', '县', '镇', '乡', '自治区', '特别行政区'];
        
        // 常见的省份名称（用于快速匹配）
        this.provinceNames = [
            '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
            '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
            '广东', '广西', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海',
            '台湾', '内蒙古', '西藏', '宁夏', '新疆', '香港', '澳门'
        ];
    }

    /**
     * 主入口：提取用户输入中的实体并进行数据链接
     * @param {string} text - 用户输入
     * @param {Array} headers - 数据表列名
     * @param {Array} data - 数据表内容（用于验证实体值是否存在）
     * @returns {Object} 提取的实体和链接结果
     */
    extractAndLink(text, headers, data) {
        console.log('[EntityExtractor] 开始实体提取:', text);
        
        // 1. 提取候选实体
        const candidates = this.extractCandidates(text);
        console.log('[EntityExtractor] 候选实体:', candidates);
        
        // 2. 分类实体（列名 vs 筛选值）
        const classified = this.classifyEntities(candidates, headers);
        console.log('[EntityExtractor] 分类结果:', classified);
        
        // 3. 链接筛选值到具体列
        const linked = this.linkFilterValues(classified, headers, data);
        console.log('[EntityExtractor] 链接结果:', linked);
        
        return linked;
    }

    /**
     * 提取候选实体
     * 策略：使用BERT或简单的NER规则提取名词短语
     */
    extractCandidates(text) {
        const candidates = [];
        
        // 策略1：提取"XX的XX"结构中的修饰语
        // 如"广东省的销售额" → 提取"广东省"
        // V4.0修复：排除包含"和"、"与"、"或"的匹配，避免与策略2冲突
        const modifierPattern = /([^，。！？\s的和与或]{2,})的[^，。！？\s的]{2,}/g;
        let match;
        while ((match = modifierPattern.exec(text)) !== null) {
            // 检查是否包含"和"、"与"、"或"，如果有则跳过（由策略2处理）
            if (!/[和与或]/.test(match[1])) {
                candidates.push({
                    text: match[1],
                    type: 'modifier',
                    position: match.index
                });
            }
        }
        
        // 策略2：提取"XX和XX"结构中的并列实体
        // 如"江苏和浙江的销售额" → 提取"江苏"、"浙江"
        // V4.0修复：限制匹配长度，避免匹配过长的文本
        const listPattern = /([^，。！？\s的和与或]{2,4})(?:和|与|或)([^，。！？\s的和与或]{2,4})/g;
        while ((match = listPattern.exec(text)) !== null) {
            candidates.push(
                { text: match[1], type: 'list_item', position: match.index },
                { text: match[2], type: 'list_item', position: match.index + match[1].length + 1 }
            );
        }
        
        // 策略3：识别包含地点后缀的实体
        this.provinceNames.forEach(province => {
            if (text.includes(province)) {
                // 检查是否已添加
                const exists = candidates.some(c => c.text.includes(province) || province.includes(c.text));
                if (!exists) {
                    const pos = text.indexOf(province);
                    candidates.push({
                        text: province,
                        type: 'location',
                        position: pos
                    });
                }
            }
        });
        
        // 去重并排序
        return this.deduplicateAndSort(candidates);
    }

    /**
     * 分类实体：判断是列名还是筛选值
     * V4.0修复：改进列名匹配逻辑，避免"产品A"被误识别为列名"产品"
     */
    classifyEntities(candidates, headers) {
        const result = {
            columns: [],      // 确认的列名
            filterValues: [], // 可能的筛选值
            unknown: []       // 未分类
        };
        
        candidates.forEach(candidate => {
            const text = candidate.text;
            
            // V4.0修复：改进列名匹配逻辑
            // 1. 精确匹配：text === header
            // 2. 列名包含text：header.includes(text)，但text长度必须>=2
            // 3. 不再使用 text.includes(header)，因为这会导致"产品A"被误识别为列名"产品"
            let matchedColumn = null;
            
            // 精确匹配
            if (headers.includes(text)) {
                matchedColumn = text;
            } else {
                // 列名包含text（如text="销售额"，header="销售额（万元）"）
                // 但要排除text包含列名的情况（如text="产品A"，header="产品"）
                for (const header of headers) {
                    // 只有当header包含text时才算匹配
                    // 例如：header="销售额（万元）"包含text="销售额" → 匹配
                    // 但text="产品A"包含header="产品" → 不匹配（这是筛选值）
                    if (header.includes(text) && text.length >= 2) {
                        matchedColumn = header;
                        break;
                    }
                }
            }
            
            if (matchedColumn) {
                result.columns.push({
                    ...candidate,
                    matchedColumn: matchedColumn
                });
            } 
            // 检查是否是可能的筛选值（地点、人名等）
            else if (this.isPotentialFilterValue(text)) {
                result.filterValues.push(candidate);
            } 
            else {
                result.unknown.push(candidate);
            }
        });
        
        return result;
    }

    /**
     * 判断是否是可能的筛选值
     */
    isPotentialFilterValue(text) {
        // 地点特征
        if (this.provinceNames.some(p => text.includes(p) || p.includes(text))) {
            return true;
        }
        
        // 后缀特征
        if (this.locationSuffixes.some(suffix => text.endsWith(suffix))) {
            return true;
        }
        
        // 长度特征（筛选值通常较短）
        if (text.length <= 6 && text.length >= 2) {
            return true;
        }
        
        return false;
    }

    /**
     * 链接筛选值到具体列
     * 在数据中查找该值属于哪一列
     */
    linkFilterValues(classified, headers, data) {
        const result = {
            columns: classified.columns,
            filters: [],  // {column, value, confidence}
            unknown: classified.unknown
        };
        
        classified.filterValues.forEach(filterValue => {
            const text = filterValue.text;
            const links = [];
            
            // 在每个列中查找该值
            headers.forEach(header => {
                // 跳过数值列（筛选值通常不在数值列中）
                if (this.isNumericColumn(header, data)) {
                    return;
                }
                
                // 检查该列是否包含此值
                const matchCount = data.filter(row => {
                    const cellValue = String(row[header] || '');
                    // 支持部分匹配（如"广东"匹配"广东省"）
                    return cellValue.includes(text) || text.includes(cellValue);
                }).length;
                
                if (matchCount > 0) {
                    // 计算置信度：匹配行数占比
                    const confidence = matchCount / data.length;
                    links.push({
                        column: header,
                        value: text,
                        matchCount: matchCount,
                        confidence: confidence
                    });
                }
            });
            
            // 选择最佳匹配（匹配行数最多的列）
            if (links.length > 0) {
                links.sort((a, b) => b.confidence - a.confidence);
                result.filters.push({
                    ...filterValue,
                    linkedColumn: links[0].column,
                    linkedValue: links[0].value,
                    matchCount: links[0].matchCount,  // V4.0修复：添加matchCount
                    confidence: links[0].confidence,
                    allMatches: links
                });
            } else {
                // 未找到匹配，保留为未链接的筛选值
                result.filters.push({
                    ...filterValue,
                    linkedColumn: null,
                    linkedValue: text,
                    confidence: 0
                });
            }
        });
        
        return result;
    }

    /**
     * 判断是否是数值列
     */
    isNumericColumn(header, data) {
        const sample = data.slice(0, 10).map(row => row[header]);
        const numericCount = sample.filter(v => {
            if (v === null || v === undefined || v === '') return false;
            const num = parseFloat(String(v).replace(/,/g, ''));
            return !isNaN(num);
        }).length;
        return numericCount > sample.length * 0.7;
    }

    /**
     * 去重并排序候选实体
     */
    deduplicateAndSort(candidates) {
        const seen = new Set();
        return candidates
            .filter(c => {
                if (seen.has(c.text)) return false;
                seen.add(c.text);
                return true;
            })
            .sort((a, b) => a.position - b.position);
    }

    /**
     * 生成查询配置
     * 根据实体链接结果生成查询配置
     */
    generateQueryConfig(extractionResult, userIntent) {
        const config = {
            intentType: userIntent,
            filters: [],
            valueColumn: null,
            groupColumn: null
        };
        
        // 提取筛选条件
        extractionResult.filters.forEach(filter => {
            if (filter.linkedColumn && filter.confidence > 0.1) {
                config.filters.push({
                    column: filter.linkedColumn,
                    value: filter.linkedValue,
                    operator: 'equals'
                });
            }
        });
        
        // 提取数值列（通常是最后一个列名）
        if (extractionResult.columns.length > 0) {
            config.valueColumn = extractionResult.columns[extractionResult.columns.length - 1].matchedColumn;
        }
        
        // 提取分组列（如果有筛选值链接到的列）
        if (extractionResult.filters.length > 0 && extractionResult.filters[0].linkedColumn) {
            config.groupColumn = extractionResult.filters[0].linkedColumn;
        }
        
        return config;
    }
}

// 导出单例
const entityExtractor = new EntityExtractor();
export default entityExtractor;
