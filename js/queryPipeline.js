// 查询流水线 - V5.0
class QueryPipeline {
    constructor() {
        this.intentRecognizer = null;
        this.entityExtractor = null;
        this.configGenerator = null;
        this.queryExecutor = null;
        this.chartRenderer = null;
        this.contextManager = null;
    }
    
    // 初始化
    async init() {
        try {
            // 动态导入模块
            const { default: intentRecognizer } = await import('./intentRecognizer.js');
            const { default: entityExtractor } = await import('./entityExtractor.js');
            const { default: QueryConfigGenerator } = await import('./queryConfigGenerator.js');
            const { default: QueryExecutor } = await import('./queryExecutor.js');
            const { default: ChartRenderer } = await import('./chartRenderer.js');
            
            this.intentRecognizer = intentRecognizer;
            this.entityExtractor = entityExtractor;
            this.configGenerator = new QueryConfigGenerator();
            this.queryExecutor = new QueryExecutor();
            this.chartRenderer = new ChartRenderer();
            
            // 初始化上下文管理器
            this.contextManager = {
                maxHistory: 5,
                history: [],
                
                addInput(input) {
                    this.history.push({
                        type: 'user',
                        content: input,
                        timestamp: new Date().getTime()
                    });
                    if (this.history.length > this.maxHistory) {
                        this.history = this.history.slice(-this.maxHistory);
                    }
                },
                
                addResponse(response) {
                    this.history.push({
                        type: 'system',
                        content: response,
                        timestamp: new Date().getTime()
                    });
                    if (this.history.length > this.maxHistory) {
                        this.history = this.history.slice(-this.maxHistory);
                    }
                },
                
                getRecentHistory() {
                    return this.history.map(item => `${item.type === 'user' ? '用户: ' : '系统: '}${item.content}`).join('\n');
                },
                
                hasRecentChartRequest() {
                    return this.history.some(item => 
                        item.type === 'user' && /柱状图|条形图|饼图|折线图|图表|可视化/.test(item.content)
                    );
                },
                
                clear() {
                    this.history = [];
                }
            };
            
            console.log('[QueryPipeline] 初始化完成');
        } catch (error) {
            console.error('[QueryPipeline] 初始化失败:', error);
            throw error;
        }
    }
    
    // 处理用户输入
    async process(userInput, data, headers) {
        if (!userInput || !data || !headers) {
            throw new Error('缺少必要的参数');
        }
        
        try {
            // 添加上下文
            this.contextManager.addInput(userInput);
            
            // 1. 实体提取
            const entities = await this.extractEntities(userInput, headers, data);
            
            // 2. 意图识别
            const intent = await this.recognizeIntent(userInput, entities, headers);
            
            // 3. 配置生成
            const config = await this.generateConfig(intent, entities, headers, userInput);
            
            // 4. 执行查询或渲染图表
            const result = await this.execute(config, data, headers);
            
            // 5. 添加响应到上下文
            this.contextManager.addResponse(JSON.stringify(result));
            
            return result;
        } catch (error) {
            console.error('[QueryPipeline] 处理失败:', error);
            throw error;
        }
    }
    
    // 提取实体
    async extractEntities(userInput, headers, data) {
        try {
            if (!this.entityExtractor) {
                throw new Error('实体提取器未初始化');
            }
            
            const entities = await this.entityExtractor.extractAndLink(userInput, headers, data);
            console.log('[QueryPipeline] 实体提取结果:', entities);
            return entities;
        } catch (error) {
            console.error('[QueryPipeline] 实体提取失败:', error);
            return [];
        }
    }
    
    // 识别意图
    async recognizeIntent(userInput, entities, headers) {
        try {
            if (!this.intentRecognizer) {
                throw new Error('意图识别器未初始化');
            }
            
            const intent = await this.intentRecognizer.recognize(userInput, entities, headers);
            console.log('[QueryPipeline] 意图识别结果:', intent);
            return intent;
        } catch (error) {
            console.error('[QueryPipeline] 意图识别失败:', error);
            return { intent: 'unknown', confidence: 0 };
        }
    }
    
    // 生成配置
    async generateConfig(intent, entities, headers, userInput) {
        try {
            if (!this.configGenerator) {
                throw new Error('配置生成器未初始化');
            }
            
            const config = await this.configGenerator.generate(intent, entities, headers, userInput);
            console.log('[QueryPipeline] 配置生成结果:', config);
            return config;
        } catch (error) {
            console.error('[QueryPipeline] 配置生成失败:', error);
            throw error;
        }
    }
    
    // 执行查询或渲染图表
    async execute(config, data, headers) {
        if (!config) {
            throw new Error('配置无效');
        }
        
        try {
            if (config.queryType) {
                // 执行查询
                return await this.queryExecutor.execute(config, data, headers);
            } else if (config.chartType) {
                // 渲染图表
                const container = document.querySelector('.charts-container');
                if (!container) {
                    throw new Error('图表容器不存在');
                }
                
                const chart = await this.chartRenderer.render(config, data, headers, container);
                return { type: 'chart', chart: chart, config: config };
            } else {
                throw new Error('未知的配置类型');
            }
        } catch (error) {
            console.error('[QueryPipeline] 执行失败:', error);
            throw error;
        }
    }
    
    // 处理追问
    handleClarification(clarificationInfo, userInput, data, headers) {
        // 这里可以处理追问逻辑
        console.log('[QueryPipeline] 处理追问:', clarificationInfo);
        return clarificationInfo;
    }
    
    // 获取上下文
    getContext() {
        return this.contextManager.getRecentHistory();
    }
    
    // 清除上下文
    clearContext() {
        this.contextManager.clear();
    }
    
    // 检查是否需要追问
    async checkClarificationNeeded(userInput, headers, data) {
        try {
            // 检查是否需要追问
            const entities = await this.extractEntities(userInput, headers, data);
            const intent = await this.recognizeIntent(userInput, entities, headers);
            
            // 检查是否缺少必要的参数
            if (intent.intent === 'chart' || intent.intent === 'QUERY_CHART') {
                // 检查是否缺少图表类型或列名
                const hasChartType = /柱状图|条形图|饼图|折线图|图表/.test(userInput);
                const hasColumns = headers.some(header => userInput.includes(header));
                
                if (!hasChartType || !hasColumns) {
                    return {
                        needsClarification: true,
                        clarificationType: 'chart_params',
                        message: '请指定图表类型和数据列'
                    };
                }
            }
            
            return { needsClarification: false };
        } catch (error) {
            console.error('[QueryPipeline] 检查追问需求失败:', error);
            return { needsClarification: false };
        }
    }
}

// 导出查询流水线
export default QueryPipeline;