/**
 * 统一配置管理模块 - V4.0 架构重构
 * 负责：集中管理所有配置项
 */

const AppConfig = {
    // ==================== 版本信息 ====================
    version: '4.0.0',
    name: '智能数据洞察助手',
    
    // ==================== 意图识别配置 ====================
    intent: {
        // 是否启用本地意图识别
        useLocalRecognition: true,
        
        // 置信度阈值
        confidenceThreshold: 0.6,
        
        // 三层架构配置
        layers: {
            // 第一层：规则匹配
            rule: {
                enabled: true,
                timeout: 1,  // ms
                minConfidence: 0.8
            },
            
            // 第二层：本地BERT模型
            localModel: {
                enabled: true,
                timeout: 50,  // ms
                minConfidence: 0.6,
                apiUrl: null  // 动态设置
            },
            
            // 第三层：大模型API
            llm: {
                enabled: true,
                timeout: 5000,  // ms
                minConfidence: 0.5,
                apiUrl: null,
                model: 'gpt-3.5-turbo'
            }
        },
        
        // 拒识配置
        rejection: {
            enabled: true,
            patterns: [
                '天气', '天气怎么样', '今天天气',
                '你好', '您好', 'hi', 'hello',
                '帮助', '怎么用', '使用方法',
                '翻译', '翻译成',
                '写代码', '编程', '帮我写'
            ]
        }
    },
    
    // ==================== 数据库配置 ====================
    database: {
        // 存储模式: 'auto' | 'memory' | 'sqljs'
        mode: 'auto',
        
        // 自动切换阈值（行数）
        autoSwitchThreshold: 10000,
        
        // SQL.js配置
        sqljs: {
            locateFile: file => `https://sql.js.org/dist/${file}`
        }
    },
    
    // ==================== 查询配置 ====================
    query: {
        // 默认分页大小
        pageSize: 10,
        
        // 最大返回行数
        maxResults: 1000,
        
        // 默认排序
        defaultSort: {
            column: null,
            direction: 'asc'
        },
        
        // 聚合函数映射
        aggregateFunctions: {
            '总和': 'sum',
            '求和': 'sum',
            '平均': 'avg',
            '平均值': 'avg',
            '数量': 'count',
            '计数': 'count',
            '最大': 'max',
            '最大值': 'max',
            '最小': 'min',
            '最小值': 'min'
        }
    },
    
    // ==================== 图表配置 ====================
    chart: {
        // 最大同时显示图表数
        maxCharts: 5,
        
        // 默认图表类型
        defaultType: 'bar',
        
        // 颜色配置
        colors: [
            '#4fc3f7', '#81c784', '#ffb74d', '#f06292', '#ba68c8',
            '#4db6ac', '#ff8a65', '#a1887f', '#90a4ae', '#aed581'
        ],
        
        // 图表选项
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#d4d4d4',
                        font: { size: 12 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#d4d4d4' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#d4d4d4' }
                }
            }
        }
    },
    
    // ==================== 技能系统配置 ====================
    skills: {
        // 启用的技能
        enabled: [
            'dataCleaning',
            'dataAnalysis',
            'trendAnalysis',
            'anomalyDetection',
            'businessAdvice',
            'chartGenerator'
        ],
        
        // 技能配置
        configs: {
            dataCleaning: {
                removeDuplicates: true,
                handleMissingValues: true,
                missingValueStrategy: 'mean'
            },
            dataAnalysis: {
                includeStats: true,
                includeInsights: true,
                maxInsights: 5
            },
            anomalyDetection: {
                method: '3sigma',
                threshold: 3
            }
        }
    },
    
    // ==================== UI配置 ====================
    ui: {
        // 主题
        theme: 'dark',
        
        // 通知配置
        notification: {
            duration: 3000,
            position: 'top-right'
        },
        
        // 日志配置
        log: {
            maxEntries: 100,
            autoScroll: true
        },
        
        // 动画
        animation: {
            enabled: true,
            duration: 300
        }
    },
    
    // ==================== API配置 ====================
    api: {
        // 本地BERT服务
        bert: {
            baseUrl: null,  // 动态设置
            timeout: 5000
        },
        
        // 大模型API
        llm: {
            baseUrl: null,  // 从config.js读取
            apiKey: null,   // 从config.js读取
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 2000
        }
    },
    
    // ==================== 性能配置 ====================
    performance: {
        // 缓存配置
        cache: {
            enabled: true,
            timeout: 5000  // ms
        },
        
        // 防抖配置
        debounce: {
            enabled: true,
            delay: 300  // ms
        },
        
        // 日志级别
        logLevel: 'info'  // 'debug' | 'info' | 'warn' | 'error'
    },
    
    // ==================== 文件配置 ====================
    file: {
        // 最大文件大小（字节）
        maxSize: 104857600,  // 100MB
        
        // 支持的格式
        supportedFormats: ['.csv', '.xlsx', '.xls'],
        
        // 编码检测
        encoding: 'UTF-8'
    }
};

// ==================== 配置获取器 ====================

class ConfigManager {
    constructor() {
        this.config = AppConfig;
        this.overrides = {};
        
        // 从URL参数加载配置
        this.loadFromUrlParams();
        
        // 从config.js加载
        this.loadFromConfig();
    }
    
    loadFromUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        // API地址
        const apiUrl = params.get('apiUrl');
        if (apiUrl) {
            this.overrides.apiUrl = apiUrl;
            this.config.api.bert.baseUrl = apiUrl;
            this.config.intent.layers.localModel.apiUrl = `${apiUrl}/api/classify-requirement`;
        }
        
        // 调试模式
        const debug = params.get('debug');
        if (debug === 'true') {
            this.config.performance.logLevel = 'debug';
        }
    }
    
    loadFromConfig() {
        // 从全局config对象加载
        if (typeof config !== 'undefined') {
            if (config.ai) {
                this.config.api.llm.apiUrl = config.ai.apiUrl || this.config.api.llm.apiUrl;
                this.config.api.llm.apiKey = config.ai.apiKey || this.config.api.llm.apiKey;
                this.config.api.llm.model = config.ai.model || this.config.api.llm.model;
            }
        }
    }
    
    /**
     * 获取配置项
     * @param {string} key - 配置键（支持点号分隔）
     * @param {any} defaultValue - 默认值
     * @returns {any} 配置值
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    /**
     * 设置配置项
     * @param {string} key - 配置键
     * @param {any} value - 配置值
     */
    set(key, value) {
        const keys = key.split('.');
        let target = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) {
                target[keys[i]] = {};
            }
            target = target[keys[i]];
        }
        
        target[keys[keys.length - 1]] = value;
    }
    
    /**
     * 获取所有配置
     * @returns {Object} 配置对象
     */
    getAll() {
        return { ...this.config };
    }
    
    /**
     * 重置为默认配置
     */
    reset() {
        this.config = { ...AppConfig };
        this.overrides = {};
    }
    
    /**
     * 导出配置到JSON
     * @returns {string} JSON字符串
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }
    
    /**
     * 从JSON导入配置
     * @param {string} json - JSON字符串
     */
    import(json) {
        try {
            const imported = JSON.parse(json);
            this.config = { ...AppConfig, ...imported };
        } catch (error) {
            console.error('[ConfigManager] 导入配置失败', error);
        }
    }
}

// 全局实例
window.configManager = new ConfigManager();
window.AppConfig = AppConfig;

console.log('[ConfigManager] 配置管理器已加载, 版本:', AppConfig.version);