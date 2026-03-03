// 用户反馈管理器 - 收集用户反馈和评价
// 功能：多类型反馈、快捷反馈入口、反馈统计
// 响应时间：< 1ms（提交操作）
// 用户价值：一键反馈识别有误，帮助系统持续优化

class FeedbackManager {
    constructor() {
        // 反馈记录数组
        this.feedbackRecords = [];
        
        // localStorage 存储键
        this.storageKey = 'data_insight_feedback';
        
        // 最大存储数量
        this.maxStorageSize = 500;
        
        // 反馈统计
        this.statistics = {
            totalFeedback: 0,
            byType: {},
            byCategory: {},
            averageRating: 0,
            ratingDistribution: {}
        };
        
        // 反馈回调函数
        this.onFeedbackSubmitted = null;
        
        // 从 localStorage 加载历史反馈
        this.loadFromStorage();
        
        console.log('[FeedbackManager] 用户反馈管理器已初始化，已加载历史反馈:', this.feedbackRecords.length);
    }
    
    /**
     * 提交反馈 - 核心方法
     * @param {Object} feedback - 反馈信息
     * @returns {Object} 反馈记录
     * 
     * 用户价值：提供多种反馈渠道，让用户轻松表达意见
     */
    submit(feedback) {
        const record = {
            // 唯一标识
            id: this.generateId(),
            
            // 时间戳
            timestamp: new Date().toISOString(),
            timestampFormatted: this.formatTimestamp(new Date()),
            
            // 反馈类型
            type: feedback.type || 'general', // error_report, rating, suggestion, general
            
            // 反馈类别
            category: feedback.category || 'general', // intent_recognition, chart_quality, response_speed, data_quality, ui_experience
            
            // 反馈内容
            ...feedback,
            
            // 提交状态
            isSubmitted: false,
            submittedAt: null,
            
            // 处理状态
            isProcessed: false,
            processedAt: null,
            processResult: null
        };
        
        // 新反馈排在最前面
        this.feedbackRecords.unshift(record);
        
        // 更新统计
        this.statistics.totalFeedback++;
        this.updateStatistics(record);
        
        // 限制存储数量
        if (this.feedbackRecords.length > this.maxStorageSize) {
            console.warn('[FeedbackManager] 反馈数量超过上限，删除最旧的反馈');
            this.feedbackRecords = this.feedbackRecords.slice(0, this.maxStorageSize);
        }
        
        // 保存到 localStorage
        this.saveToStorage();
        
        // 触发回调
        if (this.onFeedbackSubmitted) {
            try {
                this.onFeedbackSubmitted(record);
            } catch (e) {
                console.error('[FeedbackManager] 回调执行失败:', e);
            }
        }
        
        // 触发自定义事件
        this.dispatchEvent('feedbackSubmitted', record);
        
        console.log('[FeedbackManager] 收到反馈:', record);
        
        return record;
    }
    
    /**
     * 快捷反馈：识别有误
     * @param {String} userInput - 用户输入
     * @param {Object} intentResult - 意图识别结果
     * @param {String} expectedIntent - 用户期望的意图
     * @param {String} reason - 反馈原因（可选）
     * @returns {Object} 反馈记录
     * 
     * 用户价值：一键反馈识别错误，无需详细描述
     */
    quickFeedbackIncorrect(userInput, intentResult, expectedIntent, reason = '') {
        return this.submit({
            type: 'error_report',
            category: 'intent_recognition',
            subtype: 'incorrect_intent',
            
            // 错误详情
            userInput: userInput,
            actualIntent: intentResult,
            expectedIntent: expectedIntent,
            reason: reason,
            
            // 严重性
            severity: this.calculateSeverity(intentResult, expectedIntent),
            
            // 描述
            description: `用户反馈识别错误：期望"${expectedIntent}"，实际"${intentResult?.intent || 'null'}"`,
            
            // 用户行为
            userAction: 'quick_feedback_incorrect'
        });
    }
    
    /**
     * 快捷反馈：图表质量差
     * @param {String} chartType - 图表类型
     * @param {String} reason - 原因
     * @returns {Object} 反馈记录
     */
    quickFeedbackChartQuality(chartType, reason = '图表不符合预期') {
        return this.submit({
            type: 'error_report',
            category: 'chart_quality',
            subtype: 'poor_quality',
            
            chartType: chartType,
            reason: reason,
            
            severity: 'medium',
            description: `用户反馈图表质量问题：${reason}`,
            
            userAction: 'quick_feedback_chart_quality'
        });
    }
    
    /**
     * 评分反馈
     * @param {Number} score - 评分 1-5
     * @param {String} category - 评分类别
     * @param {String} comment - 评论（可选）
     * @returns {Object} 反馈记录
     * 
     * 用户价值：简单打分，帮助系统了解用户满意度
     */
    submitRating(score, category, comment = '') {
        if (score < 1 || score > 5) {
            console.warn('[FeedbackManager] 评分必须在 1-5 之间');
            return null;
        }
        
        return this.submit({
            type: 'rating',
            category: category || 'general',
            score: score,
            comment: comment,
            
            description: `用户评分：${score}/5 ${comment ? '- ' + comment : ''}`,
            
            userAction: 'rating_submission'
        });
    }
    
    /**
     * 建议反馈
     * @param {String} description - 建议描述
     * @param {String} category - 建议类别
     * @returns {Object} 反馈记录
     * 
     * 用户价值：收集用户建议，持续改进产品
     */
    submitSuggestion(description, category = 'general') {
        return this.submit({
            type: 'suggestion',
            category: category,
            description: description,
            
            title: `用户建议：${description.substring(0, 50)}...`,
            
            userAction: 'suggestion_submission'
        });
    }
    
    /**
     * 获取反馈历史
     * @param {Object} options - 过滤选项
     * @returns {Array} 反馈记录列表
     */
    getHistory(options = {}) {
        let filtered = [...this.feedbackRecords];
        
        // 按类型过滤
        if (options.type) {
            filtered = filtered.filter(f => f.type === options.type);
        }
        
        // 按类别过滤
        if (options.category) {
            filtered = filtered.filter(f => f.category === options.category);
        }
        
        // 按提交状态过滤
        if (options.isSubmitted !== undefined) {
            filtered = filtered.filter(f => f.isSubmitted === options.isSubmitted);
        }
        
        // 按时间范围过滤
        if (options.startDate) {
            filtered = filtered.filter(f => new Date(f.timestamp) >= new Date(options.startDate));
        }
        if (options.endDate) {
            filtered = filtered.filter(f => new Date(f.timestamp) <= new Date(options.endDate));
        }
        
        // 限制返回数量
        const limit = options.limit || 50;
        return filtered.slice(0, limit);
    }
    
    /**
     * 标记为已提交
     * @param {Array<String>} feedbackIds - 反馈 ID 列表
     */
    markAsSubmitted(feedbackIds) {
        let count = 0;
        for (const feedback of this.feedbackRecords) {
            if (feedbackIds.includes(feedback.id)) {
                feedback.isSubmitted = true;
                feedback.submittedAt = new Date().toISOString();
                count++;
            }
        }
        
        if (count > 0) {
            this.saveToStorage();
            console.log(`[FeedbackManager] 已标记 ${count} 条反馈为已提交`);
        }
    }
    
    /**
     * 标记为已处理
     * @param {Array<String>} feedbackIds - 反馈 ID 列表
     * @param {Object} result - 处理结果
     */
    markAsProcessed(feedbackIds, result = {}) {
        let count = 0;
        for (const feedback of this.feedbackRecords) {
            if (feedbackIds.includes(feedback.id)) {
                feedback.isProcessed = true;
                feedback.processedAt = new Date().toISOString();
                feedback.processResult = result;
                count++;
            }
        }
        
        if (count > 0) {
            this.saveToStorage();
            console.log(`[FeedbackManager] 已标记 ${count} 条反馈为已处理`);
        }
    }
    
    /**
     * 清除反馈
     * @param {Array<String>} feedbackIds - 反馈 ID 列表（不传则清除所有）
     */
    clear(feedbackIds) {
        if (feedbackIds) {
            const beforeCount = this.feedbackRecords.length;
            this.feedbackRecords = this.feedbackRecords.filter(f => !feedbackIds.includes(f.id));
            const removed = beforeCount - this.feedbackRecords.length;
            console.log(`[FeedbackManager] 已清除 ${removed} 条反馈`);
        } else {
            this.feedbackRecords = [];
            console.log('[FeedbackManager] 已清除所有反馈');
        }
        this.saveToStorage();
    }
    
    /**
     * 导出反馈数据
     * @returns {Object} 反馈数据报告
     */
    exportData() {
        return {
            exportTime: new Date().toISOString(),
            exportTimeFormatted: this.formatTimestamp(new Date()),
            totalFeedback: this.feedbackRecords.length,
            statistics: this.generateStatistics(),
            feedback: this.feedbackRecords,
            systemInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            }
        };
    }
    
    /**
     * 下载反馈数据为 JSON 文件
     */
    downloadData() {
        const data = this.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `用户反馈_${this.formatTimestamp(new Date()).replace(/[:\s]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('[FeedbackManager] 反馈数据已下载');
    }
    
    /**
     * 生成统计信息
     * @returns {Object} 统计信息
     */
    generateStatistics() {
        const stats = {
            totalFeedback: this.feedbackRecords.length,
            byType: {},
            byCategory: {},
            averageRating: 0,
            ratingDistribution: {},
            recentTrends: []
        };
        
        let ratingSum = 0;
        let ratingCount = 0;
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        for (const record of this.feedbackRecords) {
            // 按类型统计
            stats.byType[record.type] = (stats.byType[record.type] || 0) + 1;
            
            // 按类别统计
            const category = record.category || 'general';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            
            // 评分统计
            if (record.type === 'rating' && record.score) {
                ratingSum += record.score;
                ratingCount++;
                stats.ratingDistribution[record.score] = (stats.ratingDistribution[record.score] || 0) + 1;
            }
            
            // 最近 7 天趋势
            const feedbackDate = new Date(record.timestamp);
            if (feedbackDate >= sevenDaysAgo) {
                const dateKey = record.timestamp.split('T')[0];
                const existing = stats.recentTrends.find(t => t.date === dateKey);
                if (existing) {
                    existing.count++;
                } else {
                    stats.recentTrends.push({ date: dateKey, count: 1 });
                }
            }
        }
        
        // 计算平均评分
        if (ratingCount > 0) {
            stats.averageRating = (ratingSum / ratingCount).toFixed(2);
        }
        
        // 按日期排序趋势
        stats.recentTrends.sort((a, b) => a.date.localeCompare(b.date));
        
        return stats;
    }
    
    /**
     * 更新统计信息
     * @param {Object} record - 反馈记录
     */
    updateStatistics(record) {
        // 按类型统计
        this.statistics.byType[record.type] = (this.statistics.byType[record.type] || 0) + 1;
        
        // 按类别统计
        const category = record.category || 'general';
        this.statistics.byCategory[category] = (this.statistics.byCategory[category] || 0) + 1;
        
        // 评分统计
        if (record.type === 'rating' && record.score) {
            const ratingCount = (this.statistics.ratingDistribution[record.score] || 0) + 1;
            this.statistics.ratingDistribution[record.score] = ratingCount;
            
            // 重新计算平均分
            let sum = 0;
            let count = 0;
            for (const [score, count_] of Object.entries(this.statistics.ratingDistribution)) {
                sum += parseInt(score) * count_;
                count += count_;
            }
            if (count > 0) {
                this.statistics.averageRating = (sum / count).toFixed(2);
            }
        }
    }
    
    /**
     * 保存到 localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.feedbackRecords));
        } catch (e) {
            console.warn('[FeedbackManager] 保存到 localStorage 失败:', e);
        }
    }
    
    /**
     * 从 localStorage 加载
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.feedbackRecords = JSON.parse(stored);
                
                // 重新计算统计
                for (const record of this.feedbackRecords) {
                    this.updateStatistics(record);
                }
            }
        } catch (e) {
            console.warn('[FeedbackManager] 从 localStorage 加载失败:', e);
        }
    }
    
    /**
     * 生成唯一 ID
     * @returns {String} 唯一 ID
     */
    generateId() {
        return `FB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 格式化时间戳
     * @param {Date} date - 日期对象
     * @returns {String} 格式化后的时间字符串
     */
    formatTimestamp(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    }
    
    /**
     * 计算严重性
     * @param {Object} actualIntent - 实际意图
     * @param {String} expectedIntent - 期望意图
     * @returns {String} 严重性级别
     */
    calculateSeverity(actualIntent, expectedIntent) {
        // 如果意图类型完全不同，严重性高
        const actualType = actualIntent?.intent?.split('_')[0];
        const expectedType = expectedIntent?.split('_')[0];
        
        if (actualType !== expectedType) {
            return 'high';
        }
        
        // 如果置信度很低，严重性中等
        if (actualIntent?.confidence < 0.5) {
            return 'medium';
        }
        
        return 'low';
    }
    
    /**
     * 触发自定义事件
     * @param {String} eventName - 事件名称
     * @param {Object} detail - 事件数据
     */
    dispatchEvent(eventName, detail) {
        try {
            const event = new CustomEvent(eventName, { detail });
            window.dispatchEvent(event);
        } catch (e) {
            console.warn('[FeedbackManager] 触发事件失败:', e);
        }
    }
    
    /**
     * 获取反馈数量统计
     * @returns {Object} 数量统计
     */
    getCounts() {
        return {
            total: this.feedbackRecords.length,
            submitted: this.feedbackRecords.filter(f => f.isSubmitted).length,
            unsubmitted: this.feedbackRecords.filter(f => !f.isSubmitted).length,
            processed: this.feedbackRecords.filter(f => f.isProcessed).length,
            unprocessed: this.feedbackRecords.filter(f => !f.isProcessed).length
        };
    }
    
    /**
     * 设置反馈提交回调
     * @param {Function} callback - 回调函数
     */
    setOnFeedbackSubmitted(callback) {
        this.onFeedbackSubmitted = callback;
    }
    
    /**
     * 清除所有数据（用于测试或重置）
     */
    reset() {
        this.feedbackRecords = [];
        this.statistics = {
            totalFeedback: 0,
            byType: {},
            byCategory: {},
            averageRating: 0,
            ratingDistribution: {}
        };
        this.saveToStorage();
        console.log('[FeedbackManager] 已重置所有数据');
    }
}

// 导出单例实例
const feedbackManager = new FeedbackManager();
export default feedbackManager;
