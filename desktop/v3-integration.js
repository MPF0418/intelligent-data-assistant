// V3.0 功能集成补丁
// 产品意义：将 V3.0 的核心功能无缝集成到现有查询流程中
// 用户在界面上会看到：反馈组件、图表推荐提示、错误报告入口

console.log('[V3.0] V3 集成补丁已加载');

// 等待主 script.js 加载完成
window.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，确保主脚本已初始化
    setTimeout(() => {
        initV3Integration();
    }, 1000);
});

function initV3Integration() {
    console.log('[V3.0] 开始集成 V3.0 功能...');
    
    // 1. 增强错误处理 - 捕获所有未处理的错误
    setupGlobalErrorHandling();
    
    // 2. 在查询结果后自动添加反馈组件
    enhanceQueryResultWithFeedback();
    
    // 3. 添加图表推荐提示
    enhanceChartGeneration();
    
    console.log('[V3.0] V3.0 功能集成完成');
}

// 1. 全局错误处理增强
function setupGlobalErrorHandling() {
    // 全局错误捕获
    window.addEventListener('error', (event) => {
        if (window.errorCollector) {
            window.errorCollector.record(event.error || event, {
                module: 'global',
                action: 'uncaught_error'
            });
        }
    });
    
    // 未处理的 Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
        if (window.errorCollector) {
            window.errorCollector.record(event.reason || new Error('Unhandled rejection'), {
                module: 'global',
                action: 'unhandled_promise'
            });
        }
    });
    
    console.log('[V3.0] 全局错误处理已设置');
}

// 2. 增强查询结果区域添加反馈组件
function enhanceQueryResultWithFeedback() {
    // 保存原始的 displayNLPQueryResults 函数
    const originalDisplayQueryResults = window.displayNLPQueryResults;
    
    if (originalDisplayQueryResults) {
        window.displayNLPQueryResults = function(userInput, queryResult) {
            // 调用原始函数
            const result = originalDisplayQueryResults.call(this, userInput, queryResult);
            
            // 添加反馈组件
            setTimeout(() => {
                if (window.feedbackUI && window.feedbackUI.setCurrentQuery) {
                    window.feedbackUI.setCurrentQuery({
                        userInput: userInput,
                        intent: { intent: 'query' }
                    });
                    console.log('[V3.0] 查询结果已添加反馈组件');
                }
            }, 500);
            
            return result;
        };
        
        console.log('[V3.0] 查询结果反馈组件已增强');
    }
    
    // 保存原始的 displayNLPChartResults 函数
    const originalDisplayChartResults = window.displayNLPChartResults;
    
    if (originalDisplayChartResults) {
        window.displayNLPChartResults = function(userInput, chartConfigs) {
            // 调用原始函数
            const result = originalDisplayChartResults.call(this, userInput, chartConfigs);
            
            // 添加反馈组件
            setTimeout(() => {
                if (window.feedbackUI && window.feedbackUI.setCurrentQuery) {
                    window.feedbackUI.setCurrentQuery({
                        userInput: userInput,
                        intent: { intent: chartConfigs[0]?.chartType || 'chart' }
                    });
                    console.log('[V3.0] 图表结果已添加反馈组件');
                }
            }, 500);
            
            return result;
        };
        
        console.log('[V3.0] 图表结果反馈组件已增强');
    }
}

// 3. 增强图表生成 - 添加推荐提示
function enhanceChartGeneration() {
    // 保存原始的 createChartFromConfig 函数
    const originalCreateChart = window.createChartFromConfig;
    
    if (originalCreateChart && window.chartRecommender) {
        window.createChartFromConfig = function(config, container, chartInstance) {
            // 调用原始函数
            const result = originalCreateChart.call(this, config, container, chartInstance);
            
            // 使用图表推荐器验证
            try {
                const dataInfo = {
                    columns: window.headers || [],
                    rowCount: window.data?.length || 0,
                    sampleData: window.data?.slice(0, 3) || []
                };
                
                const recommendations = window.chartRecommender.recommend(dataInfo, 
                    { intent: config.chartType ? 'CHART_' + config.chartType.toUpperCase() : 'QUERY_AGGREGATE' },
                    config.title || ''
                );
                
                if (recommendations && recommendations.length > 0) {
                    const bestMatch = recommendations[0];
                    if (bestMatch.chartType !== config.chartType) {
                        console.log('[V3.0] 图表推荐器建议:', bestMatch);
                        // 可以在这里添加 UI 提示，建议更合适的图表类型
                    }
                }
            } catch (error) {
                console.warn('[V3.0] 图表推荐验证失败:', error);
            }
            
            return result;
        };
        
        console.log('[V3.0] 图表生成已增强推荐验证');
    }
}

// 4. 数据预处理集成
function applyDataPreprocessing(data, transformConfig) {
    if (window.dataPreprocessor && transformConfig) {
        try {
            return window.dataPreprocessor.transform(data, transformConfig);
        } catch (error) {
            console.error('[V3.0] 数据预处理失败:', error);
            if (window.errorCollector) {
                window.errorCollector.record(error, {
                    module: 'dataPreprocessor',
                    action: 'transform'
                });
            }
        }
    }
    return data;
}

// 导出到全局作用域
window.applyDataPreprocessing = applyDataPreprocessing;

console.log('[V3.0] V3 集成补丁初始化完成');
