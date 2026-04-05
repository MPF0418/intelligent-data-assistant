/**
 * 应用主入口类
 * 产品意义：作为整个应用的核心控制器，协调各模块的工作
 * 解决痛点：统一管理应用状态和模块生命周期
 * @class App
 */
class App {
    /**
     * 应用构造函数
     * @constructor
     */
    constructor() {
        this.state = this.initState();
        this.modules = this.initModules();
        this.bindEvents();
        this.initialize();
    }
    
    /**
     * 初始化应用状态
     * 产品意义：为应用提供初始状态，确保应用启动时的一致性
     * @returns {Object} 应用初始状态
     */
    initState() {
        return {
            data: [],
            originalData: [],
            headers: [],
            charts: [],
            currentSort: { column: null, direction: 'asc' },
            currentFilter: null,
            currentPage: 1,
            pageSize: 10,
            isLoading: false,
            fileContext: {
                fileName: '',
                sheetName: '',
                fileKeywords: []
            },
            vectorizationEnabled: true,
            vectorizationTable: 'data',
            useLocalIntentRecognition: true,
            useDatabaseMode: false
        };
    }
    
    /**
     * 初始化模块
     * 产品意义：集中管理所有功能模块，便于统一调用和管理
     * @returns {Object} 模块集合
     */
    initModules() {
        return {
            intentRecognizer: null,
            queryExecutor: null,
            chartRenderer: null,
            skillManager: null,
            dbManager: null,
            contextManager: this.initContextManager()
        };
    }
    
    /**
     * 初始化上下文管理器
     * 产品意义：管理用户对话历史，为意图识别提供上下文信息
     * @returns {Object} 上下文管理器
     */
    initContextManager() {
        return {
            maxHistory: 5,
            history: [],
            
            /**
             * 添加用户输入到历史记录
             * @param {string} input - 用户输入
             */
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
            
            /**
             * 添加系统响应到历史记录
             * @param {string} response - 系统响应
             */
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
            
            /**
             * 获取最近的历史记录
             * @returns {string} 格式化的历史记录
             */
            getRecentHistory() {
                return this.history.map(item => `${item.type === 'user' ? '用户: ' : '系统: '}${item.content}`).join('\n');
            },
            
            /**
             * 检查是否有最近的图表相关请求
             * @returns {boolean} 是否有图表请求
             */
            hasRecentChartRequest() {
                return this.history.some(item => 
                    item.type === 'user' && /柱状图|条形图|饼图|折线图|图表|可视化/.test(item.content)
                );
            },
            
            /**
             * 清空历史记录
             */
            clear() {
                this.history = [];
            }
        };
    }
    
    /**
     * 初始化应用
     * 产品意义：启动应用，加载所有必要的模块和资源
     * @async
     */
    async initialize() {
        try {
            // 动态导入模块
            await this.loadModules();
            
            // 初始化事件监听器
            this.initEventListeners();
            
            console.log('[V5.0] 应用初始化完成');
        } catch (error) {
            console.error('[V5.0] 应用初始化失败:', error);
        }
    }
    
    /**
     * 加载模块
     * 产品意义：动态导入所需模块，优化初始加载性能
     * @async
     */
    async loadModules() {
        try {
            // 导入意图识别器
            const { default: intentRecognizer } = await import('./intentRecognizer.js');
            this.modules.intentRecognizer = intentRecognizer;
            
            // 导入查询执行器
            const { default: QueryExecutor } = await import('./queryExecutor.js');
            this.modules.queryExecutor = new QueryExecutor();
            
            // 导入图表渲染器
            const { default: ChartRenderer } = await import('./chartRenderer.js');
            this.modules.chartRenderer = new ChartRenderer();
            
            // 导入数据库管理器
            const { default: dbManager } = await import('./dbManager.js');
            this.modules.dbManager = dbManager;
            
            // 导入技能管理器
            const { default: SkillManager } = await import('./skillManager.js');
            this.modules.skillManager = SkillManager;
            
            console.log('[V5.0] 模块加载完成');
        } catch (error) {
            console.error('[V5.0] 模块加载失败:', error);
        }
    }
    
    /**
     * 绑定事件
     * 产品意义：为应用添加事件监听器，响应用户交互
     */
    bindEvents() {
        // 这里将在initEventListeners中实现
    }
    
    /**
     * 初始化事件监听器
     * 产品意义：具体实现事件绑定逻辑，处理用户交互
     */
    initEventListeners() {
        // 文件上传相关
        const dropArea = document.getElementById('drop-area');
        const fileInput = document.getElementById('file-input');
        
        if (dropArea && fileInput) {
            dropArea.addEventListener('dragover', this.handleDragOver.bind(this));
            dropArea.addEventListener('drop', this.handleDrop.bind(this));
            dropArea.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
        
        // NLP交互
        const submitNlpBtn = document.getElementById('submit-nlp');
        const nlpInput = document.getElementById('nlp-input');
        
        if (submitNlpBtn && nlpInput) {
            submitNlpBtn.addEventListener('click', this.handleUnifiedNLP.bind(this));
            nlpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleUnifiedNLP();
                }
            });
        }
    }
    
    /**
     * 处理拖拽事件
     * 产品意义：实现文件拖拽上传功能
     * @param {DragEvent} e - 拖拽事件
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }
    
    /**
     * 处理文件上传
     * 产品意义：处理用户拖拽上传的文件
     * @param {DragEvent} e - 拖拽事件
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            this.processFile(e.dataTransfer.files[0]);
        }
    }
    
    /**
     * 处理文件选择
     * 产品意义：处理用户通过文件选择器选择的文件
     * @param {Event} e - 文件选择事件
     */
    handleFileSelect(e) {
        if (e.target.files.length) {
            this.processFile(e.target.files[0]);
        }
    }
    
    /**
     * 处理文件
     * 产品意义：处理上传的文件，包括解析和处理数据
     * @param {File} file - 上传的文件
     * @async
     */
    async processFile(file) {
        this.setState({ isLoading: true });
        
        try {
            // 这里将调用文件处理逻辑
            console.log('[V5.0] 处理文件:', file.name);
            // 实际的文件处理逻辑将在dataManager中实现
        } catch (error) {
            console.error('[V5.0] 文件处理失败:', error);
        } finally {
            this.setState({ isLoading: false });
        }
    }
    
    /**
     * 处理NLP请求
     * 产品意义：处理用户的自然语言查询，调用相应的处理逻辑
     * @async
     */
    async handleUnifiedNLP() {
        const nlpInput = document.getElementById('nlp-input');
        if (!nlpInput) return;
        
        const userInput = nlpInput.value.trim();
        if (!userInput) return;
        
        this.modules.contextManager.addInput(userInput);
        
        try {
            // 这里将调用NLP处理逻辑
            console.log('[V5.0] 处理NLP请求:', userInput);
            // 实际的NLP处理逻辑将在queryPipeline中实现
        } catch (error) {
            console.error('[V5.0] NLP处理失败:', error);
        }
    }
    
    /**
     * 更新状态
     * 产品意义：更新应用状态并通知状态变更
     * @param {Object} newState - 新的状态对象
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyStateChange();
    }
    
    /**
     * 状态变更通知
     * 产品意义：通知所有状态监听器状态已变更
     */
    notifyStateChange() {
        // 可以添加状态变更监听器
    }
    
    /**
     * 获取状态
     * 产品意义：提供获取应用当前状态的接口
     * @returns {Object} 应用当前状态
     */
    getState() {
        return this.state;
    }
    
    /**
     * 获取模块
     * 产品意义：提供获取指定模块的接口
     * @param {string} name - 模块名称
     * @returns {Object} 模块实例
     */
    getModule(name) {
        return this.modules[name];
    }
}

// 导出应用实例
export default App;