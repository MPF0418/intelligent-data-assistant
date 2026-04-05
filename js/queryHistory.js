// 查询历史管理模块
// 功能：记录用户查询历史，显示常用查询建议

class QueryHistoryManager {
    constructor() {
        this.storageKey = 'smart_data_insight_query_history';
        this.maxHistorySize = 50; // 最多保存50条历史
        this.maxSuggestions = 5;  // 最多显示5个建议
        this.minQueryLength = 5;  // 最小查询长度
        
        // 默认建议查询（用于新用户或历史为空时）
        this.defaultSuggestions = [
            { query: '哪个省公司的销售额最高？', label: '查找最高值' },
            { query: '按地区统计事件数量', label: '分组统计' },
            { query: '绘制柱状图展示各区域数据', label: '生成图表' },
            { query: '按照省份绘制销售额的柱状图', label: '销售分析' },
            { query: '统计各地区的平均值', label: '平均值统计' }
        ];
        
        this.history = this.loadHistory();
    }
    
    // 加载历史记录
    loadHistory() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const history = JSON.parse(stored);
                // 验证数据格式
                if (Array.isArray(history)) {
                    return history.filter(item => 
                        item && 
                        typeof item.query === 'string' && 
                        item.query.length >= this.minQueryLength
                    );
                }
            }
        } catch (error) {
            console.warn('[QueryHistory] 加载历史记录失败:', error);
        }
        return [];
    }
    
    // 保存历史记录
    saveHistory() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.history));
        } catch (error) {
            console.warn('[QueryHistory] 保存历史记录失败:', error);
        }
    }
    
    // 添加查询到历史
    addQuery(query, success = true) {
        if (!query || query.length < this.minQueryLength) {
            return;
        }
        
        const normalizedQuery = query.trim();
        
        // 检查是否已存在相同查询
        const existingIndex = this.history.findIndex(
            item => item.query === normalizedQuery
        );
        
        if (existingIndex !== -1) {
            // 更新已有记录的计数和时间
            this.history[existingIndex].count = (this.history[existingIndex].count || 1) + 1;
            this.history[existingIndex].lastUsed = Date.now();
            this.history[existingIndex].success = success;
            // 移到最前面
            const item = this.history.splice(existingIndex, 1)[0];
            this.history.unshift(item);
        } else {
            // 添加新记录
            this.history.unshift({
                query: normalizedQuery,
                count: 1,
                firstUsed: Date.now(),
                lastUsed: Date.now(),
                success: success
            });
        }
        
        // 限制历史记录数量
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
        
        this.saveHistory();
        console.log('[QueryHistory] 添加查询:', normalizedQuery);
    }
    
    // 获取查询建议
    getSuggestions() {
        // 如果有历史记录，优先使用历史记录
        if (this.history.length > 0) {
            // 按使用频率和时间排序
            const sorted = [...this.history].sort((a, b) => {
                // 优先显示使用次数多的
                const countDiff = (b.count || 1) - (a.count || 1);
                if (countDiff !== 0) return countDiff;
                // 其次显示最近使用的
                return (b.lastUsed || 0) - (a.lastUsed || 0);
            });
            
            // 取前maxSuggestions个
            return sorted.slice(0, this.maxSuggestions).map(item => ({
                query: item.query,
                label: this.generateLabel(item.query)
            }));
        }
        
        // 没有历史记录时返回默认建议
        return this.defaultSuggestions;
    }
    
    // 生成标签（从查询中提取关键词）
    generateLabel(query) {
        // 预定义的标签映射
        const labelPatterns = [
            { pattern: /最高|最大|最多|最长/, label: '查找最高值' },
            { pattern: /最低|最小|最少|最短/, label: '查找最低值' },
            { pattern: /平均|均值/, label: '平均值统计' },
            { pattern: /求和|总和|合计|总计/, label: '求和统计' },
            { pattern: /柱状图|条形图/, label: '柱状图' },
            { pattern: /折线图|趋势图/, label: '趋势图' },
            { pattern: /饼图|占比/, label: '占比图' },
            { pattern: /按.*统计|分组.*统计/, label: '分组统计' },
            { pattern: /数量|个数|次数/, label: '计数统计' },
            { pattern: /销售/, label: '销售分析' },
            { pattern: /地区|省份|城市/, label: '地区分析' }
        ];
        
        for (const { pattern, label } of labelPatterns) {
            if (pattern.test(query)) {
                return label;
            }
        }
        
        // 默认标签
        return '常用查询';
    }
    
    // 清空历史记录
    clearHistory() {
        this.history = [];
        localStorage.removeItem(this.storageKey);
        console.log('[QueryHistory] 历史记录已清空');
    }
    
    // 获取统计信息
    getStats() {
        return {
            totalQueries: this.history.length,
            uniqueQueries: new Set(this.history.map(h => h.query)).size,
            mostUsedQuery: this.history.length > 0 ? this.history[0] : null,
            successRate: this.history.length > 0 
                ? (this.history.filter(h => h.success).length / this.history.length * 100).toFixed(1)
                : 0
        };
    }
}

// 导出单例
const queryHistoryManager = new QueryHistoryManager();
export default queryHistoryManager;
