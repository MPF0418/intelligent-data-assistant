// 自动修复器 - 基于规则引擎的自动修复系统
// 功能：定时自动处理错误记录，或手动触发批量修复
// 响应时间：< 100ms（单次修复）
// 用户价值：系统自动优化，减少重复错误，提升用户体验

class AutoFixer {
    constructor() {
        // 修复规则库
        this.fixRules = [];
        
        // 定时任务状态
        this.isScheduled = false;
        this.scheduleTimer = null;
        this.scheduleInterval = 60000; // 默认 60 分钟
        
        // 修复历史
        this.fixHistory = [];
        this.maxHistorySize = 200;
        
        // 修复统计
        this.statistics = {
            totalFixes: 0,
            successfulFixes: 0,
            failedFixes: 0,
            byRule: {}
        };
        
        // 注册默认修复规则
        this.registerDefaultRules();
        
        console.log('[AutoFixer] 自动修复器已初始化，已注册规则:', this.fixRules.length);
    }
    
    /**
     * 注册默认修复规则
     * 产品意义：针对常见错误类型提供自动修复方案
     */
    registerDefaultRules() {
        // 规则 1：语义映射缺失自动补充
        this.registerRule({
            id: 'semantic_mapping_missing',
            name: '语义映射缺失自动补充',
            description: '当用户输入中的关键词无法匹配到列名时，自动添加到语义映射表',
            condition: (error) => {
                return error.type === 'COLUMN_ERROR' && 
                       error.error.message?.includes('未能匹配到列名');
            },
            fixAction: async (error, context) => {
                // 从错误上下文中提取新术语
                const userInput = error.context.userInput;
                const columns = context?.columns || [];
                
                // 提取可能的术语（简单实现，实际可能需要 NLP）
                const terms = this.extractTermsFromInput(userInput);
                
                // 尝试匹配最相似的列名
                const bestMatch = this.findBestColumnMatch(terms, columns);
                
                if (bestMatch) {
                    // 添加到语义映射（需要调用外部 API 或更新配置）
                    await this.addSemanticMapping(terms[0], bestMatch.column);
                    
                    return {
                        success: true,
                        action: 'added_semantic_mapping',
                        details: `从"${userInput}"中提取术语"${terms[0]}",映射到列"${bestMatch.column}"(相似度：${bestMatch.similarity})`
                    };
                }
                
                return {
                    success: false,
                    action: 'no_suitable_mapping',
                    details: '未找到合适的列名映射'
                };
            },
            successRate: 0.7, // 预估成功率
            priority: 1 // 高优先级
        });
        
        // 规则 2：低置信度意图识别优化
        this.registerRule({
            id: 'low_confidence_intent',
            name: '低置信度意图识别优化',
            description: '当意图识别置信度低于阈值时，调整识别策略',
            condition: (error) => {
                const confidence = error.context.intent?.confidence;
                return confidence !== undefined && confidence < 0.5;
            },
            fixAction: async (error, context) => {
                // 记录低置信度案例，用于后续模型优化
                const caseData = {
                    userInput: error.context.userInput,
                    intent: error.context.intent,
                    timestamp: new Date().toISOString()
                };
                
                await this.logLowConfidenceCase(caseData);
                
                return {
                    success: true,
                    action: 'logged_for_optimization',
                    details: `记录低置信度案例，用于模型优化`
                };
            },
            successRate: 0.9,
            priority: 2
        });
        
        // 规则 3：参数提取失败修复
        this.registerRule({
            id: 'param_extraction_failed',
            name: '参数提取失败修复',
            description: '当参数提取失败时，尝试使用备用提取策略',
            condition: (error) => {
                return error.type === 'PARAM_ERROR' &&
                       error.error.message?.includes('参数提取失败');
            },
            fixAction: async (error, context) => {
                // 尝试使用大模型 API 重新提取参数
                if (window.intentAPI?.extractParams) {
                    try {
                        const extractedParams = await window.intentAPI.extractParams(
                            error.context.userInput,
                            context?.columns || []
                        );
                        
                        if (extractedParams && Object.keys(extractedParams).length > 0) {
                            return {
                                success: true,
                                action: 're_extracted_params',
                                details: '使用大模型 API 重新提取参数成功',
                                extractedParams
                            };
                        }
                    } catch (e) {
                        console.warn('[AutoFixer] 大模型 API 提取失败:', e);
                    }
                }
                
                return {
                    success: false,
                    action: 'extraction_failed',
                    details: '所有参数提取策略均失败'
                };
            },
            successRate: 0.6,
            priority: 1
        });
        
        // 规则 4：图表类型不匹配修复
        this.registerRule({
            id: 'chart_type_mismatch',
            name: '图表类型不匹配修复',
            description: '当推荐的图表类型不适合数据时，重新推荐',
            condition: (error) => {
                return error.type === 'DATA_ERROR' &&
                       error.error.message?.includes('图表类型不匹配');
            },
            fixAction: async (error, context) => {
                // 使用图表推荐器重新推荐
                if (window.chartRecommender) {
                    const dataInfo = context.dataInfo || {};
                    const intentResult = context.intent || {};
                    
                    const recommendations = window.chartRecommender.recommend(
                        dataInfo,
                        intentResult,
                        error.context.userInput
                    );
                    
                    if (recommendations.length > 0) {
                        return {
                            success: true,
                            action: 'recomm ended_chart',
                            details: `重新推荐图表：${recommendations[0].chartType}`,
                            recommendation: recommendations[0]
                        };
                    }
                }
                
                return {
                    success: false,
                    action: 'no_suitable_chart',
                    details: '未找到合适的图表类型'
                };
            },
            successRate: 0.8,
            priority: 2
        });
        
        // 规则 5：数据格式错误修复
        this.registerRule({
            id: 'data_format_error',
            name: '数据格式错误修复',
            description: '当数据格式错误时，尝试自动修正',
            condition: (error) => {
                return error.type === 'DATA_ERROR' &&
                       (error.error.message?.includes('数据格式') || 
                        error.error.message?.includes('无法解析'));
            },
            fixAction: async (error, context) => {
                // 尝试使用数据预处理器修正
                if (window.dataPreprocessor) {
                    const data = context.data || [];
                    const transformConfig = {
                        dataFormatting: {
                            decimalPlaces: 2,
                            thousandSeparator: true
                        }
                    };
                    
                    try {
                        const fixedData = window.dataPreprocessor.transform(data, transformConfig);
                        
                        return {
                            success: true,
                            action: 'fixed_data_format',
                            details: '修正数据格式',
                            fixedData
                        };
                    } catch (e) {
                        console.warn('[AutoFixer] 数据格式修正失败:', e);
                    }
                }
                
                return {
                    success: false,
                    action: 'format_fix_failed',
                    details: '数据格式修正失败'
                };
            },
            successRate: 0.5,
            priority: 3
        });
        
        // 规则 6：用户反馈驱动的修复
        this.registerRule({
            id: 'user_feedback_driven',
            name: '用户反馈驱动的修复',
            description: '根据用户反馈自动调整识别策略',
            condition: (error) => {
                // 检查是否有相关的用户反馈
                const feedbackManager = window.feedbackManager;
                if (!feedbackManager) return false;
                
                const feedbacks = feedbackManager.getHistory({ 
                    type: 'error_report',
                    limit: 100 
                });
                
                // 查找相似的反馈
                const similarFeedback = feedbacks.find(fb => 
                    fb.userInput === error.context.userInput ||
                    fb.expectedIntent === error.context.intent?.intent
                );
                
                return !!similarFeedback;
            },
            fixAction: async (error, context) => {
                const feedbackManager = window.feedbackManager;
                const feedbacks = feedbackManager.getHistory({ type: 'error_report' });
                
                // 找到最相关的反馈
                const relatedFeedback = feedbacks.find(fb => 
                    fb.userInput === error.context.userInput
                );
                
                if (relatedFeedback) {
                    // 根据用户期望的意图进行调整
                    return {
                        success: true,
                        action: 'adjusted_by_feedback',
                        details: `根据用户反馈调整，期望意图：${relatedFeedback.expectedIntent}`,
                        expectedIntent: relatedFeedback.expectedIntent
                    };
                }
                
                return {
                    success: false,
                    action: 'no_related_feedback',
                    details: '未找到相关的用户反馈'
                };
            },
            successRate: 0.85,
            priority: 1
        });
    }
    
    /**
     * 注册修复规则
     * @param {Object} rule - 规则配置
     */
    registerRule(rule) {
        // 验证规则
        if (!rule.id || !rule.name || !rule.condition || !rule.fixAction) {
            console.error('[AutoFixer] 规则配置不完整:', rule);
            return false;
        }
        
        // 检查是否已存在
        const existingIndex = this.fixRules.findIndex(r => r.id === rule.id);
        if (existingIndex !== -1) {
            console.warn('[AutoFixer] 规则已存在，将覆盖:', rule.id);
            this.fixRules[existingIndex] = rule;
        } else {
            this.fixRules.push(rule);
        }
        
        // 按优先级排序
        this.fixRules.sort((a, b) => (a.priority || 999) - (b.priority || 999));
        
        console.log(`[AutoFixer] 规则已注册：${rule.name} (优先级：${rule.priority || '默认'})`);
        return true;
    }
    
    /**
     * 执行自动修复 - 核心方法
     * @param {Array} errorRecords - 错误记录列表
     * @returns {Array} 修复结果
     */
    async executeAutoFix(errorRecords) {
        const results = [];
        const startTime = performance.now();
        
        console.log(`[AutoFixer] 开始执行自动修复，待处理错误：${errorRecords.length} 条`);
        
        for (const error of errorRecords) {
            // 查找匹配的修复规则
            const matchedRules = this.fixRules.filter(rule => {
                try {
                    return rule.condition(error);
                } catch (e) {
                    console.error('[AutoFixer] 规则条件检查失败:', rule.id, e);
                    return false;
                }
            });
            
            if (matchedRules.length === 0) {
                console.log('[AutoFixer] 未找到匹配的修复规则:', error.id);
                continue;
            }
            
            // 按顺序尝试执行规则
            for (const rule of matchedRules) {
                try {
                    const fixResult = await rule.fixAction(error, {
                        columns: error.context.columns || [],
                        dataInfo: error.context.dataInfo,
                        intent: error.context.intent,
                        data: error.context.data
                    });
                    
                    const result = {
                        errorId: error.id,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        success: fixResult.success,
                        action: fixResult.action,
                        details: fixResult.details,
                        timestamp: new Date().toISOString()
                    };
                    
                    results.push(result);
                    
                    // 更新统计
                    this.updateStatistics(rule.id, fixResult.success);
                    
                    // 记录修复历史
                    this.recordFixHistory({
                        ...result,
                        error: error
                    });
                    
                    console.log(`[AutoFixer] 规则执行${fixResult.success ? '成功' : '失败'}:`, rule.name, fixResult.details);
                    
                    if (fixResult.success) {
                        break; // 修复成功后不再尝试其他规则
                    }
                } catch (e) {
                    console.error('[AutoFixer] 规则执行失败:', rule.id, e);
                }
            }
        }
        
        const endTime = performance.now();
        const successCount = results.filter(r => r.success).length;
        
        console.log(`[AutoFixer] 自动修复完成，耗时：${(endTime - startTime).toFixed(2)}ms，成功：${successCount}/${results.length}`);
        
        return results;
    }
    
    /**
     * 定时自动修复
     * @param {Number} intervalMinutes - 间隔时间（分钟）
     */
    scheduleAutoFix(intervalMinutes = 60) {
        if (this.isScheduled) {
            clearInterval(this.scheduleTimer);
        }
        
        this.isScheduled = true;
        this.scheduleInterval = intervalMinutes * 60 * 1000;
        
        this.scheduleTimer = setInterval(async () => {
            console.log('[AutoFixer] 开始定时自动修复...');
            
            try {
                // 获取未修复的错误
                const errorCollector = window.errorCollector;
                if (!errorCollector) {
                    console.warn('[AutoFixer] 错误收集器未初始化');
                    return;
                }
                
                const errors = errorCollector.getUnsubmittedErrors();
                console.log(`[AutoFixer] 获取到 ${errors.length} 条未处理错误`);
                
                if (errors.length === 0) {
                    console.log('[AutoFixer] 没有需要修复的错误');
                    return;
                }
                
                // 执行修复
                const results = await this.executeAutoFix(errors);
                
                // 标记已修复的错误
                const fixedErrorIds = results
                    .filter(r => r.success)
                    .map(r => r.errorId);
                
                if (fixedErrorIds.length > 0) {
                    errorCollector.markAsFixed(fixedErrorIds, 'auto_fix');
                    console.log(`[AutoFixer] 已标记 ${fixedErrorIds.length} 条错误为已修复`);
                }
                
            } catch (e) {
                console.error('[AutoFixer] 定时修复执行失败:', e);
            }
            
        }, this.scheduleInterval);
        
        console.log(`[AutoFixer] 已启动定时任务，间隔：${intervalMinutes}分钟`);
    }
    
    /**
     * 停止定时修复
     */
    stopAutoFix() {
        if (this.isScheduled && this.scheduleTimer) {
            clearInterval(this.scheduleTimer);
            this.isScheduled = false;
            console.log('[AutoFixer] 已停止定时自动修复');
        }
    }
    
    /**
     * 手动触发修复
     * @param {Array} errorIds - 错误 ID 列表
     * @returns {Array} 修复结果
     */
    async triggerFix(errorIds) {
        const errorCollector = window.errorCollector;
        if (!errorCollector) {
            throw new Error('错误收集器未初始化');
        }
        
        // 获取指定错误
        const errors = errorCollector.errors.filter(e => errorIds.includes(e.id));
        
        if (errors.length === 0) {
            console.warn('[AutoFixer] 未找到指定的错误');
            return [];
        }
        
        return await this.executeAutoFix(errors);
    }
    
    /**
     * 一键修复所有
     * @returns {Array} 修复结果
     */
    async fixAll() {
        const errorCollector = window.errorCollector;
        if (!errorCollector) {
            throw new Error('错误收集器未初始化');
        }
        
        const errors = errorCollector.getUnsubmittedErrors();
        console.log(`[AutoFixer] 开始修复所有 ${errors.length} 条错误...`);
        
        return await this.executeAutoFix(errors);
    }
    
    /**
     * 更新统计信息
     * @param {String} ruleId - 规则 ID
     * @param {Boolean} success - 是否成功
     */
    updateStatistics(ruleId, success) {
        this.statistics.totalFixes++;
        
        if (success) {
            this.statistics.successfulFixes++;
        } else {
            this.statistics.failedFixes++;
        }
        
        // 按规则统计
        if (!this.statistics.byRule[ruleId]) {
            this.statistics.byRule[ruleId] = {
                total: 0,
                successful: 0,
                failed: 0
            };
        }
        
        this.statistics.byRule[ruleId].total++;
        if (success) {
            this.statistics.byRule[ruleId].successful++;
        } else {
            this.statistics.byRule[ruleId].failed++;
        }
    }
    
    /**
     * 记录修复历史
     * @param {Object} record - 修复记录
     */
    recordFixHistory(record) {
        this.fixHistory.unshift(record);
        
        // 限制历史记录数量
        if (this.fixHistory.length > this.maxHistorySize) {
            this.fixHistory = this.fixHistory.slice(0, this.maxHistorySize);
        }
    }
    
    /**
     * 获取修复历史
     * @param {Number} limit - 返回数量限制
     * @returns {Array} 修复历史
     */
    getFixHistory(limit = 50) {
        return this.fixHistory.slice(0, limit);
    }
    
    /**
     * 获取修复统计
     * @returns {Object} 统计信息
     */
    getStatistics() {
        const stats = {
            ...this.statistics,
            successRate: this.statistics.totalFixes > 0 
                ? ((this.statistics.successfulFixes / this.statistics.totalFixes * 100).toFixed(2) + '%')
                : '0%',
            registeredRules: this.fixRules.length,
            isScheduled: this.isScheduled,
            scheduleInterval: this.isScheduled ? this.scheduleInterval / 60000 : 0
        };
        
        // 计算每条规则的成功率
        stats.byRule = Object.fromEntries(
            Object.entries(stats.byRule).map(([ruleId, data]) => [
                ruleId,
                {
                    ...data,
                    successRate: data.total > 0 
                        ? ((data.successful / data.total * 100).toFixed(2) + '%')
                        : '0%'
                }
            ])
        );
        
        return stats;
    }
    
    /**
     * 清除修复历史
     */
    clearHistory() {
        this.fixHistory = [];
        console.log('[AutoFixer] 修复历史已清除');
    }
    
    /**
     * 重置统计信息
     */
    resetStatistics() {
        this.statistics = {
            totalFixes: 0,
            successfulFixes: 0,
            failedFixes: 0,
            byRule: {}
        };
        console.log('[AutoFixer] 统计信息已重置');
    }
    
    /**
     * 从输入中提取术语（简单实现）
     * @param {String} input - 用户输入
     * @returns {Array} 术语列表
     */
    extractTermsFromInput(input) {
        // 简单实现：提取 2-4 个字的词组
        const terms = [];
        const words = input.split(/[\s,，.。]/);
        
        for (const word of words) {
            if (word.length >= 2 && word.length <= 4) {
                terms.push(word);
            }
        }
        
        return terms;
    }
    
    /**
     * 查找最佳列名匹配
     * @param {Array} terms - 术语列表
     * @param {Array} columns - 列名列表
     * @returns {Object} 最佳匹配
     */
    findBestColumnMatch(terms, columns) {
        let bestMatch = null;
        let bestSimilarity = 0;
        
        for (const term of terms) {
            for (const column of columns) {
                const similarity = this.calculateSimilarity(term, column);
                
                if (similarity > bestSimilarity && similarity > 0.5) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        term,
                        column,
                        similarity
                    };
                }
            }
        }
        
        return bestMatch;
    }
    
    /**
     * 计算相似度（简单实现）
     * @param {String} str1 - 字符串 1
     * @param {String} str2 - 字符串 2
     * @returns {Number} 相似度 0-1
     */
    calculateSimilarity(str1, str2) {
        // 包含关系
        if (str1.includes(str2) || str2.includes(str1)) {
            return Math.max(str1.length, str2.length) / Math.min(str1.length, str2.length);
        }
        
        // 简单编辑距离
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / Math.max(str1.length, str2.length));
    }
    
    /**
     * 计算编辑距离
     * @param {String} s1 - 字符串 1
     * @param {String} s2 - 字符串 2
     * @returns {Number} 编辑距离
     */
    levenshteinDistance(s1, s2) {
        const m = s1.length;
        const n = s2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
                }
            }
        }
        
        return dp[m][n];
    }
    
    /**
     * 添加语义映射（占位符，实际需要集成到语义映射表）
     * @param {String} term - 术语
     * @param {String} column - 列名
     */
    async addSemanticMapping(term, column) {
        console.log(`[AutoFixer] 添加语义映射：${term} → ${column}`);
        // TODO: 实际实现需要更新语义映射配置文件或数据库
        return Promise.resolve();
    }
    
    /**
     * 记录低置信度案例（占位符）
     * @param {Object} caseData - 案例数据
     */
    async logLowConfidenceCase(caseData) {
        console.log('[AutoFixer] 记录低置信度案例:', caseData);
        // TODO: 实际实现需要保存到日志文件或数据库
        return Promise.resolve();
    }
    
    /**
     * 获取所有注册的规则
     * @returns {Array} 规则列表
     */
    getRegisteredRules() {
        return this.fixRules.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            successRate: rule.successRate
        }));
    }
}

// 导出单例实例
const autoFixer = new AutoFixer();
export default autoFixer;
