// 全局变量
let data = [];
let originalData = []; // 存储原始数据，用于筛选和排序
let headers = [];
let charts = [];
let currentSort = { column: null, direction: 'asc' };
let currentFilter = null;
let currentPage = 1; // 当前页码
const pageSize = 10; // 每页显示行数
let currentQueryController = null; // 当前查询的AbortController
let skillManager = null; // Skill管理器
let dbManager = null; // 数据库管理器
let intentRecognizer = null; // 意图识别器
let useLocalIntentRecognition = true; // 是否使用本地意图识别
let useDatabaseMode = false; // 是否使用数据库模式（大数据量时启用）
let vectorizationEnabled = true; // 启用Excel向量化功能
let vectorizationTable = 'data'; // 向量化表名

// 上下文管理模块
const contextManager = {
    maxHistory: 5, // 最大历史记录数
    history: [], // 对话历史
    
    // 添加新的用户输入到历史
    addInput(input) {
        this.history.push({
            type: 'user',
            content: input,
            timestamp: new Date().getTime()
        });
        
        // 保持历史记录不超过最大数量
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    },
    
    // 添加系统响应到历史
    addResponse(response) {
        this.history.push({
            type: 'system',
            content: response,
            timestamp: new Date().getTime()
        });
        
        // 保持历史记录不超过最大数量
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    },
    
    // 获取最近的历史记录
    getRecentHistory() {
        return this.history.map(item => `${item.type === 'user' ? '用户: ' : '系统: '}${item.content}`).join('\n');
    },
    
    // 检查是否有之前的图表相关请求
    hasRecentChartRequest() {
        return this.history.some(item => 
            item.type === 'user' && /柱状图|条形图|饼图|折线图|图表|可视化/.test(item.content)
        );
    },
    
    // 清空历史记录
    clear() {
        this.history = [];
    }
};

// API基础URL配置 - 支持从URL参数动态配置（用于公网部署）
// 用法：https://前端地址?apiUrl=https://后端API地址
// 向量化API使用端口5002，其他API使用端口5001
const API_BASE_URL = new URLSearchParams(window.location.search).get('apiUrl') || 'http://localhost:5001';
const VECTOR_API_BASE_URL = 'http://localhost:5002';

// 文件上下文信息（用于辅助理解用户意图）
let fileContext = {
    fileName: '',           // 文件名（如："24年3季度事件.xlsx"）
    sheetName: '',          // Sheet名称（如："事件明细"）
    fileKeywords: []        // 从文件名提取的关键词（如：["事件", "24年", "3季度"]）
};

// 处理日志相关
let processingLogs = [];
let currentOperationStartTime = null;

// ========== V4.0 内联数据画像模块（简化版）==========
class SimpleDataProfiler {
    constructor() {
        this.currentProfile = null; // 使用不同的属性名，避免覆盖方法
    }

    profile(data, headers) {
        if (!data || data.length === 0 || !headers || headers.length === 0) {
            return null;
        }

        const shape = { rows: data.length, cols: headers.length };
        const columns = {};
        let numericCols = [], textCols = [], dateCols = [], categoricalCols = [];

        headers.forEach(col => {
            const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
            const uniqueCount = [...new Set(values)].length;
            
            let type = 'text';
            if (values.every(v => !isNaN(parseFloat(v)))) {
                type = 'numeric';
                numericCols.push(col);
            } else if (col.includes('日期') || col.includes('时间') || (values[0] && /^\d{4}[-/]/.test(values[0]))) {
                type = 'datetime';
                dateCols.push(col);
            } else if (uniqueCount <= 10 && uniqueCount < values.length * 0.5) {
                type = 'categorical';
                categoricalCols.push(col);
            } else {
                textCols.push(col);
            }

            columns[col] = {
                name: col,
                type: type,
                uniqueCount: uniqueCount,
                nullCount: data.length - values.length
            };
        });

        const totalCells = data.length * headers.length;
        const emptyCells = headers.reduce((sum, col) => sum + columns[col].nullCount, 0);
        const completeness = ((1 - emptyCells / totalCells) * 100).toFixed(2);

        return {
            shape,
            columns,
            schema: { numericCols, textCols, dateCols, categoricalCols },
            quality: {
                completeness: parseFloat(completeness),
                grade: completeness > 95 ? 'A' : completeness > 85 ? 'B' : 'C'
            },
            summary: `数据集共${shape.rows}行×${shape.cols}列，数值型${numericCols.length}个，质量评级${completeness > 95 ? 'A' : completeness > 85 ? 'B' : 'C'}`
        };
    }
}

// 立即创建全局实例
window.dataProfiler = new SimpleDataProfiler();
console.log('[V4.0] ✅ 内联数据画像模块已创建（文件头部）');

// Excel向量化相关函数
async function vectorizeExcelData(tableName, excelData) {
    try {
        // 检查数据格式，兼容多种格式
        let rowCount = 0;
        let dataReference = excelData;
        
        if (excelData.data && Array.isArray(excelData.data)) {
            rowCount = excelData.data.length;
        } else if (excelData.rows && Array.isArray(excelData.rows)) {
            rowCount = excelData.rows.length;
            // 为了向后兼容，创建一个data属性的副本
            dataReference = {
                ...excelData,
                data: excelData.rows
            };
        } else if (Array.isArray(excelData)) {
            rowCount = excelData.length;
            dataReference = {
                data: excelData,
                rows: excelData
            };
        } else {
            throw new Error('向量化数据格式无效: 缺少data或rows属性');
        }
        
        console.log('[向量化] 开始向量化处理，表名:', tableName, '数据行数:', rowCount);
        addProcessingLog('info', '开始Excel数据向量化', `表名: ${tableName}, 行数: ${rowCount}`);
        
        // 检查向量化API是否可用
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const healthResponse = await fetch(`${VECTOR_API_BASE_URL}/health`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const healthResult = await healthResponse.json();
            if (!healthResult || !healthResult.status || healthResult.status !== 'healthy') {
                console.warn('[向量化] API不健康，状态:', healthResult);
                // 不抛出错误，继续尝试向量化，让API自己处理
            }
        } catch (error) {
            console.warn('[向量化] 健康检查失败，将继续尝试向量化:', error.message);
            // 不阻塞流程，继续尝试向量化
        }
        
        // 调用向量化API
        const response = await fetch(`${VECTOR_API_BASE_URL}/api/v1/vectorization/vectorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                table_name: tableName,
                data: dataReference  // 使用修复后的数据引用
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addProcessingLog('success', 'Excel数据向量化成功', `向量数量: ${result.row_count || 0}`);
            showNotification('Excel数据向量化成功，支持语义查询', 'success');
            console.log('[向量化] 成功:', result);
            return result;
        } else {
            addProcessingLog('warning', 'Excel数据向量化失败', result.message || '未知错误');
            showNotification('Excel数据向量化失败: ' + (result.message || '未知错误'), 'warning');
            return null;
        }
    } catch (error) {
        addProcessingLog('error', 'Excel数据向量化异常', error.message);
        console.error('[向量化] 异常:', error);
        
        // 如果向量化失败，但Excel数据已成功加载，不应中断主流程
        // 只是显示一个警告
        showNotification('Excel向量化处理失败，但数据已正常加载: ' + error.message, 'warning');
        return null;
    }
}

// 更新向量化状态显示
function updateVectorizationStatus(status = 'check') {
    const vectorizationStatus = document.getElementById('vectorization-status');
    if (!vectorizationStatus) return;
    
    if (status === 'processing') {
        vectorizationStatus.textContent = '⏳ 正在向量化';
        vectorizationStatus.style.color = '#ffc107';
    } else if (status === 'check') {
        // 检查实际状态
        getVectorizedCollections().then(collections => {
            const isVectorized = collections.includes(vectorizationTable);
            vectorizationStatus.textContent = isVectorized ? '✅ 已向量化' : '❌ 未向量化';
            vectorizationStatus.style.color = isVectorized ? '#28a745' : '#dc3545';
        });
    }
}

async function queryVectorizedData(queryText, tableName, filters = {}) {
    if (!vectorizationEnabled) {
        console.log('[向量化查询] 向量化功能已禁用');
        return null;
    }
    
    try {
        console.log('[向量化查询] 开始语义查询:', queryText, tableName);
        addProcessingLog('info', '开始语义查询', `查询: ${queryText}, 表名: ${tableName}`);
        
        // 检查向量化API是否可用
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const healthResponse = await fetch(`${VECTOR_API_BASE_URL}/health`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const healthResult = await healthResponse.json();
            if (!healthResult || !healthResult.status || healthResult.status !== 'healthy') {
                throw new Error('向量化API不健康');
            }
        } catch (error) {
            console.log('[向量化查询] API不可用，跳过向量化查询:', error.message);
            return null; // 静默失败，不影响主查询流程
        }
        
        const response = await fetch(`${VECTOR_API_BASE_URL}/api/v1/vectorization/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: queryText,
                table_name: tableName,
                filters: filters,
                top_k: 10
            }),
            timeout: 10000 // 10秒超时
        });
        
        const result = await response.json();
        
        if (result.success && result.results && result.results.length > 0) {
            addProcessingLog('success', '语义查询成功', `匹配结果数: ${result.results.length}`);
            console.log('[向量化查询] 成功，匹配结果:', result.results.length);
            return result;
        } else {
            console.log('[向量化查询] 无匹配结果或失败:', result.message || '未知错误');
            return null;
        }
    } catch (error) {
        console.warn('[向量化查询] 异常:', error.message);
        // 不显示错误，避免影响用户体验
        return null;
    }
}

async function getVectorizedCollections() {
    try {
        const response = await fetch(`${VECTOR_API_BASE_URL}/api/v1/vectorization/collections`);
        const result = await response.json();
        return result.collections || [];
    } catch (error) {
        console.error('获取向量化集合失败:', error);
        return [];
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        word-wrap: break-word;
        background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : type === 'error' ? '#f44336' : '#2196f3'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    // 添加动画样式
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加处理日志
function addProcessingLog(type, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        type, // 'info', 'success', 'error', 'warning', 'performance'
        message,
        details
    };
    processingLogs.push(logEntry);
    
    // 更新日志显示
    updateProcessingLogDisplay();
    
    // 更新日志徽章
    updateLogBadge();
}

// 更新处理日志显示
function updateProcessingLogDisplay() {
    const logContainer = document.getElementById('processing-log');
    if (!logContainer) return;
    
    const typeColors = {
        'info': '#569cd6',
        'success': '#4ec9b0',
        'error': '#f44747',
        'warning': '#dcdcaa',
        'performance': '#ce9178',
        'command': '#c586c0'
    };
    
    const typeLabels = {
        'info': '[INFO]',
        'success': '[SUCCESS]',
        'error': '[ERROR]',
        'warning': '[WARN]',
        'performance': '[PERF]',
        'command': '[CMD]'
    };
    
    let html = '';
    processingLogs.forEach(log => {
        const color = typeColors[log.type] || '#d4d4d4';
        const label = typeLabels[log.type] || '[INFO]';
        html += `<div style="margin-bottom: 8px;">`;
        html += `<span style="color: #858585;">${log.timestamp}</span> `;
        html += `<span style="color: ${color}; font-weight: bold;">${label}</span> `;
        html += `<span style="color: #d4d4d4;">${escapeHtml(log.message)}</span>`;
        if (log.details) {
            html += `<div style="margin-left: 20px; margin-top: 4px; color: #9cdcfe; font-size: 0.9em;">${escapeHtml(log.details)}</div>`;
        }
        html += `</div>`;
    });
    
    logContainer.innerHTML = html;
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 转义HTML特殊字符
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 清空处理日志
function clearProcessingLogs() {
    processingLogs = [];
    updateProcessingLogDisplay();
}

// 记录操作开始时间
function startOperationTiming(operationName) {
    currentOperationStartTime = {
        name: operationName,
        startTime: Date.now()
    };
    addProcessingLog('info', `开始执行: ${operationName}`);
}

// 记录操作结束时间并计算耗时
function endOperationTiming() {
    if (!currentOperationStartTime) return;
    
    const endTime = Date.now();
    const duration = endTime - currentOperationStartTime.startTime;
    addProcessingLog('performance', `${currentOperationStartTime.name} 完成`, `耗时: ${duration}ms (${(duration/1000).toFixed(2)}秒)`);
    currentOperationStartTime = null;
}

// 初始化技能管理器
async function initSkillManager() {
    try {
        // 动态导入技能管理器
        let SkillManagerClass = null;
        try {
            console.log('[初始化] 尝试加载技能管理器...');
            const module = await import('./skills/skillManager.js');
            SkillManagerClass = module.default;
            console.log('[初始化] 技能管理器加载成功');
        } catch (e) {
            console.log('[初始化] 无法加载技能管理器:', e.message, '使用备用方案...');
            // 创建简单的技能管理器替代
            class SimpleSkillManager {
                constructor() {
                    this.skills = {};
                    this.loadedSkills = [];
                }
                
                async loadSkills() {
                    console.log('[备用技能管理器] 加载基础技能');
                    // 仅提供基础技能
                    const baseSkills = ['dataAnalysis', 'chartGenerator'];
                    this.loadedSkills = baseSkills;
                    return this.loadedSkills;
                }
                
                getLoadedSkills() {
                    return this.loadedSkills;
                }
            }
            SkillManagerClass = SimpleSkillManager;
        }
        skillManager = new SkillManagerClass();
        
        // 加载技能
        const loadedSkills = await skillManager.loadSkills();
        addProcessingLog('success', `技能加载完成，共加载 ${loadedSkills.length} 个技能`, loadedSkills.join(', '));
        
        // 初始化技能UI
        initSkillUI();
    } catch (error) {
        console.error('初始化技能管理器失败:', error);
        addProcessingLog('error', '技能管理器初始化失败', error.message);
    }
}

// 初始化意图识别器
async function initIntentRecognizer() {
    try {
        // 动态导入意图识别器
        const { default: recognizer } = await import('./js/intentRecognizer.js');
        intentRecognizer = recognizer;
        
        // 设置状态变化回调，让UI自动更新
        intentRecognizer.onStatusChange = (status) => {
            updateSystemStatus();
            addProcessingLog('info', '本地模型状态更新', status.modelAvailable ? '可用' : '不可用');
        };
        
        // 等待模型可用性检测完成
        await intentRecognizer.checkLocalModelAvailability();
        
        addProcessingLog('success', '意图识别器初始化完成', '支持规则匹配和本地模型API');
    } catch (error) {
        console.error('初始化意图识别器失败:', error);
        addProcessingLog('warning', '意图识别器初始化失败，将使用LLM API', error.message);
        useLocalIntentRecognition = false;
    }
}

// 初始化数据库管理器
async function initDatabaseManager() {
    try {
        // 动态导入数据库管理器
        const { default: manager } = await import('./js/dbManager.js');
        dbManager = manager;
        
        // 初始化SQL.js数据库
        const initSuccess = await dbManager.init();
        if (initSuccess) {
            addProcessingLog('success', '数据库管理器初始化完成', '支持SQL查询和大数据量处理');
        } else {
            addProcessingLog('warning', '数据库管理器初始化失败', '将使用内存模式');
            dbManager = null;
        }
    } catch (error) {
        console.error('初始化数据库管理器失败:', error);
        addProcessingLog('warning', '数据库管理器初始化失败，将使用内存模式', error.message);
        dbManager = null;
    }
}

// 初始化技能UI
function initSkillUI() {
    // 这里可以添加技能管理的UI元素
    // 例如技能列表、执行按钮等
}

// 初始化事件监听器
function initEventListeners() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const generateReportBtn = document.getElementById('generate-report');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportImageBtn = document.getElementById('export-image');
    const exportAllChartsBtn = document.getElementById('export-all-charts');
    
    // 拖拽事件
    dropArea.addEventListener('dragover', handleDragOver);
    dropArea.addEventListener('drop', handleDrop);
    
    // 点击上传
    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // 生成报告
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateAIReport);
    }
    
    // 导出
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportPDF);
    }
    if (exportImageBtn) {
        exportImageBtn.addEventListener('click', exportImage);
    }
    if (exportAllChartsBtn) {
        exportAllChartsBtn.addEventListener('click', exportAllCharts);
    }
    
    // 排序功能
    const table = document.getElementById('data-table');
    if (table) {
        const thead = table.querySelector('thead');
        if (thead) {
            thead.addEventListener('click', handleTableSort);
        }
    }
    
    // 新的统一NLP交互功能
    const submitNlpBtn = document.getElementById('submit-nlp');
    const nlpInput = document.getElementById('nlp-input');
    const clearNlpBtn = document.getElementById('clear-nlp');
    const stopNlpBtn = document.getElementById('stop-nlp');
    const addFilterBtn = document.getElementById('add-filter');
    const applyFilterBtn = document.getElementById('apply-filter');
    const clearFilterBtn = document.getElementById('clear-filter');
    
    // 统一NLP提交
    if (submitNlpBtn && nlpInput) {
        submitNlpBtn.addEventListener('click', handleUnifiedNLP);
        nlpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleUnifiedNLP();
            }
        });
    }
    
    // 清空NLP输入
    if (clearNlpBtn && nlpInput) {
        clearNlpBtn.addEventListener('click', () => {
            nlpInput.value = '';
            nlpInput.focus();
        });
    }
    
    // 停止NLP处理
    if (stopNlpBtn) {
        stopNlpBtn.addEventListener('click', () => {
            if (currentQueryController) {
                currentQueryController.abort();
                currentQueryController = null;
            }
            hideNLPProgress();
            addProcessingLog('warning', '用户取消了操作');
        });
    }
    
    // 多字段筛选功能
    if (addFilterBtn) {
        addFilterBtn.addEventListener('click', addFilterCondition);
    }
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyMultiFilter);
    }
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearAllFilters);
    }
    
    // 新增：日志弹窗相关
    const toggleLogBtn = document.getElementById('toggle-log-btn');
    const toggleLogBtnFooter = document.getElementById('toggle-log-btn-footer');
    const closeLogModal = document.getElementById('close-log-modal');
    const copyLogBtn = document.getElementById('copy-log');
    const clearLogBtn = document.getElementById('clear-log');
    const logModal = document.getElementById('log-modal');
    const logModalOverlay = logModal?.querySelector('.modal-overlay');
    
    if (toggleLogBtn) {
        toggleLogBtn.addEventListener('click', toggleLogModal);
    }
    if (toggleLogBtnFooter) {
        toggleLogBtnFooter.addEventListener('click', toggleLogModal);
    }
    if (closeLogModal) {
        closeLogModal.addEventListener('click', hideLogModal);
    }
    if (logModalOverlay) {
        logModalOverlay.addEventListener('click', hideLogModal);
    }
    if (copyLogBtn) {
        copyLogBtn.addEventListener('click', copyLogsToClipboard);
    }
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            clearProcessingLogs();
            updateLogBadge();
        });
    }
    
    // 新增：设置弹窗相关
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsModal = document.getElementById('close-settings-modal');
    const settingsModal = document.getElementById('settings-modal');
    const settingsOverlay = settingsModal?.querySelector('.modal-overlay');
    const useLocalIntentCheckbox = document.getElementById('use-local-intent');
    const useDatabaseModeCheckbox = document.getElementById('use-database-mode');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettingsModal);
    }
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', hideSettingsModal);
    }
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', hideSettingsModal);
    }
    if (useLocalIntentCheckbox) {
        useLocalIntentCheckbox.checked = useLocalIntentRecognition;
        useLocalIntentCheckbox.addEventListener('change', (e) => {
            useLocalIntentRecognition = e.target.checked;
            if (intentRecognizer) {
                intentRecognizer.setUseLocalModel(e.target.checked);
            }
            addProcessingLog('info', `本地意图识别已${e.target.checked ? '启用' : '禁用'}`);
        });
    }
    if (useDatabaseModeCheckbox) {
        useDatabaseModeCheckbox.addEventListener('change', (e) => {
            addProcessingLog('info', `数据库模式设置已更新，下次加载数据时生效`);
        });
    }
    
    // 大模型兜底设置
    const useLLMFallbackCheckbox = document.getElementById('use-llm-fallback');
    const confidenceThresholdSlider = document.getElementById('confidence-threshold');
    const thresholdValueSpan = document.getElementById('threshold-value');
    
    if (useLLMFallbackCheckbox) {
        useLLMFallbackCheckbox.addEventListener('change', (e) => {
            if (intentRecognizer) {
                intentRecognizer.setUseLLMFallback(e.target.checked);
            }
            addProcessingLog('info', `大模型兜底已${e.target.checked ? '启用' : '禁用'}`);
        });
    }
    
    if (confidenceThresholdSlider && thresholdValueSpan) {
        confidenceThresholdSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            thresholdValueSpan.textContent = value.toFixed(1);
            if (intentRecognizer) {
                intentRecognizer.setLLMConfidenceThreshold(value);
            }
        });
    }
    
    // V3.3新增：API测试按钮
    const testApiBtn = document.getElementById('test-api-btn');
    const apiUrlInput = document.getElementById('api-url-input');
    const apiTestResult = document.getElementById('api-test-result');
    
    if (apiUrlInput) {
        // 初始化时从config加载API地址
        apiUrlInput.value = config.ai.apiUrl;
        
        // 监听输入变化，保存到localStorage
        apiUrlInput.addEventListener('change', (e) => {
            const newUrl = e.target.value.trim();
            if (newUrl) {
                localStorage.setItem('apiUrl', newUrl);
                config.ai.apiUrl = newUrl;
                addProcessingLog('info', `API地址已更新: ${newUrl}`);
            }
        });
    }
    
    if (testApiBtn && apiTestResult) {
        testApiBtn.addEventListener('click', async () => {
            apiTestResult.innerHTML = '<span style="color: #666;">🔄 测试中...</span>';
            try {
                const result = await testAPIConnection();
                apiTestResult.innerHTML = `<span style="color: #4caf50;">✅ ${result}</span>`;
            } catch (error) {
                apiTestResult.innerHTML = `<span style="color: #f44336;">❌ ${error.message}</span>`;
            }
        });
    }
    
    // 更新系统状态显示
    updateSystemStatus();
    
    // 新增：示例按钮
    const exampleBtns = document.querySelectorAll('.example-btn');
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            if (query && nlpInput) {
                nlpInput.value = query;
                nlpInput.focus();
            }
        });
    });
    
    // 新增：筛选区域折叠
    const toggleFilterBtn = document.getElementById('toggle-filter');
    const filterBody = document.getElementById('filter-body');
    if (toggleFilterBtn && filterBody) {
        toggleFilterBtn.addEventListener('click', () => {
            filterBody.classList.toggle('collapsed');
            toggleFilterBtn.style.transform = filterBody.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
        });
    }
    
    // 新增：对话窗口功能
    const sendMessageBtn = document.getElementById('send-message');
    const conversationInput = document.getElementById('conversation-input');
    const clearConversationBtn = document.getElementById('clear-conversation');
    const conversationMessages = document.getElementById('conversation-messages');
    
    if (sendMessageBtn && conversationInput) {
        // 添加输入验证 - 启用/禁用发送按钮
        const updateSendButtonState = () => {
            const inputValue = conversationInput.value.trim();
            if (inputValue.length === 0) {
                sendMessageBtn.disabled = true;
                sendMessageBtn.style.opacity = '0.6';
                sendMessageBtn.style.cursor = 'not-allowed';
            } else {
                sendMessageBtn.disabled = false;
                sendMessageBtn.style.opacity = '1';
                sendMessageBtn.style.cursor = 'pointer';
            }
        };
        
        // 监听输入事件
        conversationInput.addEventListener('input', updateSendButtonState);
        conversationInput.addEventListener('paste', () => {
            setTimeout(updateSendButtonState, 0);
        });
        
        // 初始化按钮状态
        updateSendButtonState();
        
        // 绑定发送事件
        sendMessageBtn.addEventListener('click', handleSendMessage);
        conversationInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (conversationInput.value.trim().length > 0) {
                    handleSendMessage();
                }
            }
        });
        
        console.log('[initChat] 对话窗口输入验证已初始化');
    }
    
    if (clearConversationBtn && conversationInput) {
        clearConversationBtn.addEventListener('click', () => {
            conversationInput.value = '';
            conversationInput.focus();
            // 更新按钮状态
            const sendBtn = document.getElementById('send-message');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.style.opacity = '0.6';
                sendBtn.style.cursor = 'not-allowed';
            }
        });
    }
    
    // V3.0 功能按钮事件绑定
    const errorReportBtn = document.getElementById('error-report-btn');
    const autoFixBtn = document.getElementById('auto-fix-btn');
    
    if (errorReportBtn) {
        errorReportBtn.addEventListener('click', () => {
            if (window.feedbackUI && window.feedbackUI.showErrorReport) {
                window.feedbackUI.showErrorReport();
            } else {
                alert('错误报告功能尚未加载');
            }
        });
    }
    
    if (autoFixBtn) {
        autoFixBtn.addEventListener('click', async () => {
            if (window.autoFixer && window.autoFixer.fixAll) {
                const confirmFix = confirm('确定要一键修复所有已知问题吗？这可能需要几分钟时间。');
                if (!confirmFix) return;
                
                try {
                    showNotification('开始自动修复...', 'info');
                    const results = await window.autoFixer.fixAll();
                    showNotification(`修复完成！成功修复 ${results.filter(r => r.success).length} 个问题`, 'success');
                } catch (error) {
                    showNotification('修复失败：' + error.message, 'error');
                }
            } else {
                alert('自动修复功能尚未加载');
            }
        });
    }
}

// 更新系统状态显示
function updateSystemStatus() {
    const localModelStatus = document.getElementById('local-model-status');
    const llmApiStatus = document.getElementById('llm-api-status');
    
    // 检查本地模型状态
    if (localModelStatus && intentRecognizer) {
        const status = intentRecognizer.getModelStatus();
        localModelStatus.textContent = status.modelAvailable ? '✅ 可用' : '❌ 不可用';
        localModelStatus.style.color = status.modelAvailable ? '#28a745' : '#dc3545';
    }
    
    // 检查大模型API状态
    if (llmApiStatus) {
        if (typeof config !== 'undefined' && config.ai && config.ai.apiKey) {
            llmApiStatus.textContent = '✅ 已配置';
            llmApiStatus.style.color = '#28a745';
        } else {
            llmApiStatus.textContent = '❌ 未配置';
            llmApiStatus.style.color = '#dc3545';
        }
    }
}

// 显示日志弹窗
function toggleLogModal() {
    const logModal = document.getElementById('log-modal');
    if (logModal) {
        logModal.classList.toggle('hidden');
    }
}

// 隐藏日志弹窗
function hideLogModal() {
    const logModal = document.getElementById('log-modal');
    if (logModal) {
        logModal.classList.add('hidden');
    }
}

// V5.0新增：更新Agent工作流可视化
function updateAgentWorkflow(step, status, data = null) {
    const workflowContainer = document.getElementById('workflow-container');
    if (!workflowContainer) return;
    
    // 定义工作流步骤
    const workflowSteps = {
        'intent_recognition': { name: '意图识别', icon: '🎯' },
        'entity_extraction': { name: '实体提取', icon: '📋' },
        'generate_config': { name: '生成查询配置', icon: '⚙️' },
        'execute_query': { name: '执行查询', icon: '🔍' },
        'render_result': { name: '渲染结果', icon: '📊' }
    };
    
    // 获取或创建工作流列表
    let workflowList = workflowContainer.querySelector('.workflow-list');
    if (!workflowList) {
        workflowList = document.createElement('div');
        workflowList.className = 'workflow-list';
        workflowContainer.innerHTML = '';
        workflowContainer.appendChild(workflowList);
        
        // 初始化所有步骤
        Object.keys(workflowSteps).forEach((stepKey, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = `workflow-step ${stepKey}`;
            stepDiv.innerHTML = `
                <div class="step-number">${index + 1}</div>
                <div class="step-icon">${workflowSteps[stepKey].icon}</div>
                <div class="step-info">
                    <div class="step-name">${workflowSteps[stepKey].name}</div>
                    <div class="step-status">等待中...</div>
                </div>
                <div class="step-time"></div>
            `;
            workflowList.appendChild(stepDiv);
        });
    }
    
    // 更新指定步骤的状态
    const stepElement = workflowList.querySelector('.workflow-step.' + step);
    if (stepElement) {
        const statusElement = stepElement.querySelector('.step-status');
        const timeElement = stepElement.querySelector('.step-time');
        
        const statusMap = {
            'running': { text: '进行中...', class: 'running', color: '#667eea' },
            'completed': { text: '已完成', class: 'completed', color: '#38ef7d' },
            'error': { text: '失败', class: 'error', color: '#f44747' }
        };
        
        const statusInfo = statusMap[status] || statusMap['running'];
        statusElement.textContent = statusInfo.text;
        statusElement.style.color = statusInfo.color;
        stepElement.className = `workflow-step ${step} ${statusInfo.class}`;
        
        if (status === 'completed' && data) {
            timeElement.textContent = new Date().toLocaleTimeString();
            
            // 添加详细信息
            if (data.configs) {
                const detailDiv = document.createElement('div');
                detailDiv.className = 'step-detail';
                detailDiv.innerHTML = `<small>生成 ${data.configs.length} 个配置</small>`;
                stepElement.appendChild(detailDiv);
            }
        }
    }
}

// 显示设置弹窗
function showSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.classList.remove('hidden');
    }
}

// 隐藏设置弹窗
function hideSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.classList.add('hidden');
    }
}

// 复制日志到剪贴板
async function copyLogsToClipboard() {
    const logText = processingLogs.map(log => {
        return `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}${log.details ? ' - ' + log.details : ''}`;
    }).join('\n');
    
    try {
        await navigator.clipboard.writeText(logText);
        
        // 处理页面中的复制按钮
        const copyBtn = document.getElementById('copy-log');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '已复制!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }
        
        // 处理动态modal中的复制按钮
        const copyLogsBtn = document.getElementById('copy-logs-btn');
        if (copyLogsBtn) {
            const originalText2 = copyLogsBtn.textContent;
            copyLogsBtn.textContent = '已复制!';
            copyLogsBtn.style.background = '#17a2b8';
            setTimeout(() => {
                copyLogsBtn.textContent = originalText2;
                copyLogsBtn.style.background = '#28a745';
            }, 2000);
        }
        
        // 显示复制成功提示
        showToast('日志已复制到剪贴板！', 'success');
    } catch (err) {
        console.error('复制失败:', err);
        showToast('复制失败，请手动复制', 'error');
    }
}

// 更新日志徽章
function updateLogBadge() {
    const badge = document.getElementById('log-badge');
    if (badge) {
        if (processingLogs.length > 0) {
            badge.style.display = 'block';
            badge.textContent = processingLogs.length > 99 ? '99+' : processingLogs.length;
        } else {
            badge.style.display = 'none';
        }
    }
}

// 显示查询进度
function showQueryProgress(text = '正在分析查询意图...') {
    const progressDiv = document.getElementById('query-progress');
    const progressText = progressDiv.querySelector('.progress-text');
    const submitBtn = document.getElementById('submit-query');
    const stopBtn = document.getElementById('stop-query');
    
    if (progressDiv) {
        progressDiv.classList.remove('hidden');
        if (progressText) {
            progressText.textContent = text;
        }
    }
    if (submitBtn) {
        submitBtn.classList.add('hidden');
    }
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
    }
}

// 隐藏查询进度
function hideQueryProgress() {
    const progressDiv = document.getElementById('query-progress');
    const submitBtn = document.getElementById('submit-query');
    const stopBtn = document.getElementById('stop-query');
    
    if (progressDiv) {
        progressDiv.classList.add('hidden');
    }
    if (submitBtn) {
        submitBtn.classList.remove('hidden');
    }
    if (stopBtn) {
        stopBtn.classList.add('hidden');
    }
}

// 更新进度文本
function updateProgressText(text) {
    const progressText = document.querySelector('.progress-text');
    if (progressText) {
        progressText.textContent = text;
    }
}

// 设置查询进度百分比
function setQueryProgress(percent, text) {
    const progressFill = document.getElementById('query-progress-fill');
    const progressPercent = document.getElementById('query-progress-percent');
    const progressText = document.querySelector('#query-progress .progress-text');
    
    if (progressFill) {
        progressFill.style.width = percent + '%';
    }
    if (progressPercent) {
        progressPercent.textContent = percent + '%';
    }
    if (progressText && text) {
        progressText.textContent = text;
    }
}

// 设置图表进度百分比
function setChartProgress(percent, text) {
    const progressFill = document.getElementById('chart-progress-fill');
    const progressPercent = document.getElementById('chart-progress-percent');
    const progressText = document.querySelector('#chart-progress .progress-text');
    
    if (progressFill) {
        progressFill.style.width = percent + '%';
    }
    if (progressPercent) {
        progressPercent.textContent = percent + '%';
    }
    if (progressText && text) {
        progressText.textContent = text;
    }
}

// 显示图表进度
function showChartProgress(text = '正在分析绘图需求...') {
    const progressDiv = document.getElementById('chart-progress');
    const progressText = progressDiv.querySelector('.progress-text');
    const generateBtn = document.getElementById('generate-chart');
    const stopBtn = document.getElementById('stop-chart');
    
    if (progressDiv) {
        progressDiv.classList.remove('hidden');
        if (progressText) {
            progressText.textContent = text;
        }
    }
    if (generateBtn) {
        generateBtn.classList.add('hidden');
    }
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
    }
}

// 隐藏图表进度
function hideChartProgress() {
    const progressDiv = document.getElementById('chart-progress');
    const generateBtn = document.getElementById('generate-chart');
    const stopBtn = document.getElementById('stop-chart');
    
    if (progressDiv) {
        progressDiv.classList.add('hidden');
    }
    if (generateBtn) {
        generateBtn.classList.remove('hidden');
    }
    if (stopBtn) {
        stopBtn.classList.add('hidden');
    }
}

// 更新图表进度文本
function updateChartProgressText(text) {
    const progressDiv = document.getElementById('chart-progress');
    if (progressDiv) {
        const progressText = progressDiv.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = text;
        }
    }
}

// ==================== 新的统一NLP处理功能 ====================

// 进度消息容器，用于将所有进度信息显示在一个方框里
let progressMessageContainer = null;

// 在聊天窗口中添加进度信息消息
function addProgressMessage(text, percent = 0) {
    const messagesContainer = document.getElementById('conversation-messages');
    if (!messagesContainer) return;
    
    // 如果还没有进度消息容器，创建一个
    if (!progressMessageContainer) {
        progressMessageContainer = document.createElement('div');
        progressMessageContainer.className = 'message system progress-message-container';
        progressMessageContainer.innerHTML = `
            <div class="message-content">
                <div class="progress-card">
                    <div class="progress-card-header">
                        <div class="progress-card-title">
                            <span class="progress-icon">🔄</span>
                            <span>执行进度</span>
                        </div>
                        <div class="progress-card-percent">${percent}%</div>
                    </div>
                    <div class="progress-card-body">
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${percent}%"></div>
                        </div>
                        <div class="progress-current-step">${text}</div>
                        <div class="progress-steps"></div>
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(progressMessageContainer);
    } else {
        // 更新现有进度卡片
        const progressBarFill = progressMessageContainer.querySelector('.progress-bar-fill');
        const progressCardPercent = progressMessageContainer.querySelector('.progress-card-percent');
        const progressCurrentStep = progressMessageContainer.querySelector('.progress-current-step');
        
        if (progressBarFill) {
            progressBarFill.style.width = percent + '%';
        }
        if (progressCardPercent) {
            progressCardPercent.textContent = percent + '%';
        }
        if (progressCurrentStep) {
            progressCurrentStep.textContent = text;
        }
        
        // 确保更新所有百分比显示元素
        const allPercentElements = progressMessageContainer.querySelectorAll('.progress-card-percent');
        allPercentElements.forEach(element => {
            element.textContent = percent + '%';
        });
        
        // 当完成时，更新图标和标题
        if (percent === 100 && text === '完成') {
            const progressIcon = progressMessageContainer.querySelector('.progress-icon');
            if (progressIcon) {
                progressIcon.textContent = '✅';
            }
        }
    }
    
    // 在进度容器中添加新的进度步骤
    const progressSteps = progressMessageContainer.querySelector('.progress-steps');
    if (progressSteps) {
        // 检查是否已经存在相同的进度步骤，避免重复添加
        const existingSteps = progressSteps.querySelectorAll('.progress-step');
        const isDuplicate = Array.from(existingSteps).some(step => step.textContent === text);
        
        // 特别处理：避免重复添加"正在分析您的需求..."步骤
        if (text === '正在分析您的需求...') {
            const existingAnalysisSteps = Array.from(existingSteps).filter(step => 
                step.textContent.includes('分析您的需求') || step.textContent.includes('分析需求特征')
            );
            if (existingAnalysisSteps.length > 0) {
                return; // 避免重复添加分析步骤
            }
        }
        
        if (!isDuplicate) {
            const stepElement = document.createElement('div');
            stepElement.className = 'progress-step';
            stepElement.textContent = text;
            progressSteps.appendChild(stepElement);
        }
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 清除进度消息容器
function clearProgressMessageContainer() {
    if (progressMessageContainer) {
        progressMessageContainer.remove();
        progressMessageContainer = null;
    }
}

// 显示NLP进度
function showNLPProgress(text = '正在分析您的需求...') {
    // 清除之前的进度消息容器
    clearProgressMessageContainer();
    
    // 隐藏旧的进度条
    const progressDiv = document.getElementById('nlp-progress');
    if (progressDiv) {
        progressDiv.classList.add('hidden');
    }
    
    const submitBtn = document.getElementById('submit-nlp');
    const stopBtn = document.getElementById('stop-nlp');
    
    if (submitBtn) {
        submitBtn.classList.add('hidden');
    }
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
    }
    
    // 不在这里添加进度步骤，由setNLPProgress函数负责添加
    // 创建进度卡片但不添加步骤
    const messagesContainer = document.getElementById('conversation-messages');
    if (messagesContainer) {
        progressMessageContainer = document.createElement('div');
        progressMessageContainer.className = 'message system progress-message-container';
        progressMessageContainer.innerHTML = `
            <div class="message-content">
                <div class="progress-card">
                    <div class="progress-card-header">
                        <div class="progress-card-title">
                            <span class="progress-icon">🔄</span>
                            <span>执行进度</span>
                        </div>
                        <div class="progress-card-percent">0%</div>
                    </div>
                    <div class="progress-card-body">
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-current-step">${text}</div>
                        <div class="progress-steps"></div>
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(progressMessageContainer);
    }
}

// 隐藏NLP进度
function hideNLPProgress() {
    const progressDiv = document.getElementById('nlp-progress');
    const submitBtn = document.getElementById('submit-nlp');
    const stopBtn = document.getElementById('stop-nlp');
    
    if (progressDiv) {
        progressDiv.classList.add('hidden');
    }
    if (submitBtn) {
        submitBtn.classList.remove('hidden');
    }
    if (stopBtn) {
        stopBtn.classList.add('hidden');
    }
}

// 重置NLP进度
function resetNLPProgress() {
    const progressFill = document.getElementById('nlp-progress-fill');
    const progressPercent = document.getElementById('nlp-progress-percent');
    const progressText = document.querySelector('#nlp-progress .progress-text');
    
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    if (progressPercent) {
        progressPercent.textContent = '0%';
    }
    if (progressText) {
        progressText.textContent = '准备中...';
    }
    
    // 重置聊天窗口中的进度卡片
    progressMessageContainer = null;
}

// 设置NLP进度
function setNLPProgress(percent, text) {
    const progressFill = document.getElementById('nlp-progress-fill');
    const progressPercent = document.getElementById('nlp-progress-percent');
    const progressText = document.querySelector('#nlp-progress .progress-text');
    
    if (progressFill) {
        progressFill.style.width = percent + '%';
    }
    if (progressPercent) {
        progressPercent.textContent = percent + '%';
    }
    if (progressText && text) {
        progressText.textContent = text;
    }
    
    // 无论如何都更新聊天窗口中的进度信息，确保进度卡片正确更新
    if (text) {
        addProgressMessage(text, percent);
    }
}

// 统一NLP处理函数
async function handleUnifiedNLP() {
    const nlpInput = document.getElementById('nlp-input');
    const nlpResult = document.getElementById('nlp-result');
    
    if (!nlpInput || !nlpResult) return;
    
    const userInput = nlpInput.value.trim();
    if (!userInput) {
        alert('请输入您的查询或可视化需求');
        return;
    }
    
    // 添加上下文管理
    contextManager.addInput(userInput);
    
    // 检查是否有之前的图表相关请求
    const hasRecentChart = contextManager.hasRecentChartRequest();
    if (hasRecentChart && /排序|从高到低|从低到高|升序|降序/.test(userInput)) {
        addProcessingLog('info', '检测到与之前图表请求相关的排序需求', '将当前输入视为对之前图表的补充');
    }
    
    // 清空之前的日志
    clearProcessingLogs();
    
    // 重置进度
    resetNLPProgress();
    
    // V5.0: 初始化Agent工作流
    updateAgentWorkflow('intent_recognition', 'running');
    updateAgentWorkflow('entity_extraction', 'waiting');
    updateAgentWorkflow('generate_config', 'waiting');
    updateAgentWorkflow('execute_query', 'waiting');
    updateAgentWorkflow('render_result', 'waiting');
    
    // 记录开始时间
    const totalStartTime = Date.now();
    addProcessingLog('info', '开始处理用户请求', `输入内容: "${userInput}"`);
    startOperationTiming('意图识别');
    
    // 显示进度
    showNLPProgress('正在分析您的需求...');
    setNLPProgress(10, '正在分析您的需求...');
    nlpResult.innerHTML = '';
    
    // 准备数据信息
    // V4.0修复：增加sampleData大小到10行，确保能覆盖更多筛选值
    const dataInfo = {
        columns: headers,
        rowCount: data.length,
        sampleData: data.slice(0, 10)
    };
    
    try {
        // 创建AbortController
        currentQueryController = new AbortController();
        
        let intentResult;
        let processingMode = 'unknown';
        let classification = null;  // V4.0修复：在块外定义，以便后续使用
        
        // V3.0 新架构：智能路由 - 根据需求特征选择处理模式
        // 1. 需求分类模块分析用户输入
        // 2. 精准模式（本地模型）：用户提供了准确的列名和清晰的指令
        // 3. 智能模式（大模型）：用户表达模糊、列名不明确、有复杂需求
        
        if (window.requirementClassifier) {
            // 使用需求分类模块进行智能路由
            setNLPProgress(15, '正在分析需求特征...');
            addProcessingLog('info', '使用需求分类模块进行智能路由');
            
            // V3.0更新：classify方法现在是异步的（调用BERT API）
            classification = await window.requirementClassifier.classify(
                userInput, 
                dataInfo.columns, 
                dataInfo.sampleData
            );
            
            addProcessingLog('info', `需求分类结果: ${classification.mode}`, 
                `理由: ${classification.reason}, 置信度: ${classification.confidence.toFixed(2)}`);
            
            // V5.0: 更新Agent工作流 - 意图识别完成
            updateAgentWorkflow('intent_recognition', 'completed', {
                mode: classification.mode,
                confidence: classification.confidence
            });
            
            // V5.0: 更新Agent工作流 - 实体提取开始
            updateAgentWorkflow('entity_extraction', 'running');
            
            // 模拟实体提取过程
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // V5.0: 更新Agent工作流 - 实体提取完成
            updateAgentWorkflow('entity_extraction', 'completed', {
                entities: classification.entityExtraction || [],  // 修复null错误
                matchedColumns: classification.matchedColumns || []
            });
            
            // V5.0: 更新Agent工作流 - 生成配置开始
            updateAgentWorkflow('generate_config', 'running');
            
            processingMode = classification.mode;
            
            // V3.0新增：处理拒识情况
            if (classification.mode === 'rejected') {
                setNLPProgress(100, '已识别为无效输入');
                addProcessingLog('warning', '输入被拒识', classification.reason);
                
                // 显示友好的拒识提示
                const nlpResult = document.getElementById('nlp-result');
                if (nlpResult) {
                    nlpResult.innerHTML = `
                        <div class="rejection-notice">
                            <div class="rejection-icon">🤔</div>
                            <div class="rejection-title">抱歉，我无法理解您的需求</div>
                            <div class="rejection-reason">${classification.reason}</div>
                            <div class="rejection-suggestion">
                                <strong>建议：</strong>${classification.suggestion}
                            </div>
                            <div class="rejection-examples">
                                <strong>您可以尝试：</strong>
                                <ul>
                                    <li>"统计各省份的平均值"</li>
                                    <li>"绘制销售额柱状图"</li>
                                    <li>"查找最大的险情确认时长"</li>
                                    <li>"按地区分组统计数量"</li>
                                </ul>
                            </div>
                        </div>
                    `;
                }
                
                endOperationTiming();
                return;
            }
            
            // V5.0新增：处理多意图场景
            // 多意图场景直接转向大模型，不在本地模型处理
            // 这是为了保障不漏掉用户需求中的复杂意图
            if (classification.mode === 'multi_intent') {
                addProcessingLog('info', '检测到多意图需求，自动转大模型处理', 
                    `检测到意图: ${(classification.detectedIntents || classification.intents || []).join(', ')}`);
                addProcessingLog('info', '多意图说明', classification.reason);
                
                // V5.0: 更新Agent工作流 - 多意图识别完成
                updateAgentWorkflow('intent_recognition', 'completed', {
                    mode: 'multi_intent',
                    confidence: classification.confidence,
                    detectedIntents: classification.detectedIntents || classification.intents || []
                });
                
                // 直接转向大模型分支处理
                processingMode = 'intelligent';
            }
            
            if (classification.mode === 'precise') {
                // 精准模式：使用本地模型
                setNLPProgress(20, '需求明确，使用本地模型处理...');
                addProcessingLog('info', '进入精准模式（本地模型）', 
                    `匹配列: ${classification.matchedColumns.map(m => m.column).join(', ')}`);
                
                if (useLocalIntentRecognition && intentRecognizer) {
                    intentResult = await intentRecognizer.recognize(userInput);
                    
                    endOperationTiming();
                    
                    if (intentResult.isRejected) {
                        // 本地模型拒识，降级到大模型
                        addProcessingLog('warning', '本地模型拒识，降级到大模型', intentResult.rejectionReason);
                        processingMode = 'intelligent';
                    } else {
                        addProcessingLog('success', '本地意图识别完成', 
                            `意图: ${intentResult.intent}, 置信度: ${intentResult.confidence.toFixed(2)}, 方法: ${intentResult.method}`);
                        
                        // V5.0: 更新Agent工作流状态
                        updateAgentWorkflow('generate_config', 'completed');
                        updateAgentWorkflow('execute_query', 'running');
                        
                        // 检查是否包含图表关键词
                        const hasChartKeyword = /柱状图|条形图|饼图|折线图|图表|可视化/.test(userInput);
                        // 检查是否有之前的图表请求
                        const hasRecentChart = contextManager.hasRecentChartRequest();
                        // 检查是否包含排序关键词
                        const hasSortKeyword = intentResult.intent === 'QUERY_SORT' || /排序|从高到低|从低到高|升序|降序/.test(userInput);
                        
                        // 如果有之前的图表请求且当前输入包含排序关键词，将其视为图表意图
                        const isChart = intentRecognizer.isChartIntent(intentResult.intent) || hasChartKeyword || (hasRecentChart && hasSortKeyword);
                        intentResult = {
                            intent: isChart ? 'chart' : 'query',
                            confidence: intentResult.confidence,
                            reason: intentResult.description,
                            detailedIntent: intentResult.intent,
                            mode: 'precise',
                            hasSort: hasSortKeyword,
                            hasRecentChart: hasRecentChart
                        };
                    }
                } else {
                    processingMode = 'intelligent';
                }
            }
            
            if (processingMode === 'intelligent') {
                // 智能模式：使用大模型（V3.0优化：只调用一次大模型）
                setNLPProgress(20, '需求较复杂，使用大模型处理...');
                addProcessingLog('info', '进入智能模式（大模型）', 
                    classification.reason);
                
                // V3.0：检查是否需要先执行Skills
                if (classification.requiredSkills && classification.requiredSkills.length > 0) {
                    const nonChartSkills = classification.requiredSkills.filter(s => s.name !== 'chartGenerator');
                    if (nonChartSkills.length > 0) {
                        addProcessingLog('info', '需要调用Skills', 
                            nonChartSkills.map(s => `${s.name}(${s.reason})`).join(', '));
                        // 这里可以集成Skills调用逻辑
                    }
                }
                
                // 构建大模型需要的上下文
                const columnInfo = window.requirementClassifier.getContextForLLM(
                    dataInfo.columns,
                    dataInfo.sampleData,
                    classification.matchedColumns
                );
                
                // V3.0优化：只调用一次大模型，直接生成配置（包含意图判断）
                let llmPrompt;
                if (window.llmPrompts) {
                    // 根据需求特征智能选择提示词类型
                    const hasChartKeyword = /图|表|可视化|绘制|画/.test(userInput);
                    const hasQueryKeyword = /查找|查询|筛选|统计/.test(userInput);
                    
                    if (hasChartKeyword || !hasQueryKeyword) {
                        // 优先使用图表配置提示词（包含意图判断逻辑）
                        // V3.1：传递文件上下文信息
                        llmPrompt = window.llmPrompts.generateChartConfigPrompt(userInput, columnInfo, dataInfo, fileContext);
                        addProcessingLog('info', '使用图表配置提示词（含意图判断和文件上下文）');
                    } else {
                        llmPrompt = window.llmPrompts.generateQueryConfigPrompt(userInput, columnInfo, dataInfo);
                        addProcessingLog('info', '使用查询配置提示词');
                    }
                } else {
                    // 兜底：使用简单提示词
                    llmPrompt = `分析用户需求并生成配置。用户输入: "${userInput}"，列名: ${dataInfo.columns.join(', ')}`;
                }
                
                // V4.0优化：增加超时时间到120秒，配合重试机制
                const llmResponse = await callLLMAPI(llmPrompt, currentQueryController.signal, 120000);
                
                // 解析大模型返回的配置
                try {
                    // 尝试匹配 JSON 数组或单个对象
                    const arrayMatch = llmResponse.match(/\[[\s\S]*\]/);
                    const objectMatch = llmResponse.match(/\{[\s\S]*\}/);
                    
                    let config;
                    let isMultiChart = false;
                    
                    if (arrayMatch) {
                        // 尝试解析数组（多图表场景）
                        try {
                            config = JSON.parse(arrayMatch[0]);
                            if (Array.isArray(config) && config.length > 0) {
                                isMultiChart = true;
                                console.log('[大模型] 检测到多图表配置，共', config.length, '个图表');
                            }
                        } catch (e) {
                            // 数组解析失败，尝试对象
                            if (objectMatch) {
                                config = JSON.parse(objectMatch[0]);
                            }
                        }
                    } else if (objectMatch) {
                        config = JSON.parse(objectMatch[0]);
                    }
                    
                    if (!config) {
                        throw new Error('无法解析大模型响应');
                    }
                    
                    // 判断是图表配置还是查询配置
                    // count_distinct 和 count_rows 明确是查询类型，不应生成图表
                    const firstConfig = isMultiChart ? config[0] : config;
                    const isCountDistinct = firstConfig.queryType === 'count_distinct' || firstConfig.queryType === 'count_unique';
                    const isCountRows = firstConfig.queryType === 'count_rows';
                    const isQuery = isCountDistinct || isCountRows;
                    const isChart = !isQuery && (firstConfig.chartType || (firstConfig.xAxisColumn && firstConfig.yAxisColumn));
                    
                    intentResult = {
                        intent: isChart ? 'chart' : 'query',
                        confidence: 0.9,
                        reason: isCountRows ? '大模型识别为数据行数统计' : (isCountDistinct ? '大模型识别为去重计数查询' : (isMultiChart ? '大模型识别为多图表需求' : '大模型智能识别')),
                        detailedIntent: isChart ? (isMultiChart ? 'CHART_MULTI' : 'CHART_BAR') : (isCountRows ? 'QUERY_COUNT_ROWS' : (isCountDistinct ? 'QUERY_COUNT_DISTINCT' : 'QUERY_FILTER')),
                        llmConfig: config,
                        isMultiChart: isMultiChart,
                        mode: 'intelligent',
                        requiredSkills: classification.requiredSkills
                    };
                    
                    const typeDesc = isCountRows ? '数据行数统计' : (isCountDistinct ? '去重计数' : (isMultiChart ? `多图表(${config.length}个)` : (isChart ? '图表' : '查询')));
                    addProcessingLog('success', '大模型配置生成完成', 
                        `类型: ${typeDesc}, 配置: ${JSON.stringify(config).substring(0, 150)}...`);
                } catch (parseError) {
                    addProcessingLog('error', '解析大模型响应失败', parseError.message);
                    throw parseError;
                }
                
                endOperationTiming();
            }
        } else {
            // 兜底：使用原有逻辑
            addProcessingLog('warning', '需求分类模块未加载，使用默认逻辑');
            
            if (useLocalIntentRecognition && intentRecognizer) {
                setNLPProgress(20, '正在使用本地模型识别意图...');
                intentResult = await intentRecognizer.recognize(userInput);
                
                endOperationTiming();
                
                if (intentResult.isRejected) {
                    addProcessingLog('warning', '意图识别失败', intentResult.rejectionReason);
                    showNotification(intentResult.rejectionReason, 'warning');
                    resetNLPProgress();
                    return;
                }
                
                const isChart = intentRecognizer.isChartIntent(intentResult.intent);
                intentResult = {
                    intent: isChart ? 'chart' : 'query',
                    confidence: intentResult.confidence,
                    reason: intentResult.description,
                    detailedIntent: intentResult.intent
                };
            }
        }
        
        // 根据意图执行相应操作
        // V3.0优化：如果大模型已经生成了配置，直接使用，不再重复调用
        if (intentResult.mode === 'intelligent' && intentResult.llmConfig) {
            // 智能模式且已有大模型配置，直接使用
            if (intentResult.intent === 'chart') {
                setNLPProgress(40, '使用大模型生成的图表配置...');
                
                // V3.1：支持多图表配置
                const chartConfigs = intentResult.isMultiChart ? intentResult.llmConfig : [intentResult.llmConfig];
                addProcessingLog('info', `直接使用大模型生成的图表配置（${chartConfigs.length}个图表）`, 
                    JSON.stringify(chartConfigs).substring(0, 150));
                
                // 显示处理中的消息
                const processingMessage = addMessage('system', '正在生成图表...');
                
                // 直接使用大模型配置生成图表
                await handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, chartConfigs);
                
                // 更新处理消息为完成状态
                if (processingMessage) {
                    const messageContent = processingMessage.querySelector('.message-content');
                    if (messageContent) {
                        messageContent.innerHTML = '<p>图表生成完成，请在下方"数据可视化"区域查看</p>';
                    }
                }
            } else {
                setNLPProgress(40, '使用大模型生成的查询配置...');
                addProcessingLog('info', '直接使用大模型生成的查询配置');
                
                // 执行大模型生成的查询
                await executeLLMQuery(userInput, dataInfo, totalStartTime, intentResult.llmConfig);
            }
        } else {
            // 精准模式或没有大模型配置，使用原有流程
            // V4.0优化：传递实体提取结果，支持高置信度筛选查询
            const entityExtractionResult = classification.entityExtraction;
            if (intentResult.intent === 'chart') {
                setNLPProgress(40, '识别为绘图需求，正在生成图表配置...');
                await handleNLPChart(userInput, dataInfo, totalStartTime, intentResult.detailedIntent, entityExtractionResult);
            } else {
                setNLPProgress(40, '识别为查询需求，正在生成查询配置...');
                // 传递isLocalModelSuccess参数，指示本地模型已成功识别
                await handleNLPQuery(userInput, dataInfo, totalStartTime, intentResult.detailedIntent, entityExtractionResult, true);
            }
        }
        
    } catch (error) {
        endOperationTiming();
        hideNLPProgress();
        
        if (error.message && error.message.includes('aborted')) {
            addProcessingLog('warning', '操作被用户取消');
            return;
        }
        
        addProcessingLog('error', '处理失败', error.message);
        nlpResult.innerHTML = `<div style="color: #dc3545; padding: 15px;">处理失败: ${error.message}</div>`;
    }
}

// 处理NLP查询
async function handleNLPQuery(userInput, dataInfo, totalStartTime, detailedIntent = null, entityExtractionResult = null, isLocalModelSuccess = false) {
    startOperationTiming('生成查询配置');
    
    // ========== 增强复合查询处理 ==========
    // 专门处理"哪个区域的销售额最大？"这类查询
    const enhancedQueryConfig = await enhanceComplexQueryHandling(userInput, dataInfo);
    if (enhancedQueryConfig) {
        addProcessingLog('success', '检测到复合查询，使用增强处理', `查询类型: ${enhancedQueryConfig.queryType}`);
        endOperationTiming();
        await executeLocalQuery(userInput, dataInfo, totalStartTime, enhancedQueryConfig);
        return;
    }
    
    // 如果本地模型已经成功识别，直接执行本地查询逻辑
    if (isLocalModelSuccess) {
        addProcessingLog('info', '本地模型已成功识别，直接执行本地查询');
        
        // 尝试本地生成配置
        const localConfig = await tryGenerateChartConfigLocally(userInput, dataInfo, detailedIntent, entityExtractionResult);
        
        // 如果本地生成成功且是筛选聚合查询
        if (localConfig && localConfig.length > 0 && localConfig[0].queryType === 'filter_aggregate') {
            addProcessingLog('success', '本地生成筛选聚合配置成功', `配置: ${JSON.stringify(localConfig[0]).substring(0, 100)}...`);
            endOperationTiming();
            
            // 执行本地查询
            await executeLocalQuery(userInput, dataInfo, totalStartTime, localConfig[0]);
            return;
        }
        
        // 兜底：如果没有生成配置，尝试直接执行本地聚合查询
        if (detailedIntent === 'QUERY_AGGREGATE') {
            // 分析用户输入，生成合适的查询配置
            const lowerInput = userInput.toLowerCase();
            
            // 检查是否包含"平均"、"时长"等关键词
            if (lowerInput.includes('平均') && lowerInput.includes('时长')) {
                // 查找时长列
                const durationColumn = dataInfo.columns.find(col => 
                    col.includes('时长') || col.includes('时间')
                );
                
                // 查找地区列
                const regionColumn = dataInfo.columns.find(col => 
                    col.includes('区域') || col.includes('地区') || col.includes('省份') || col.includes('省公司')
                );
                
                // 提取地区名称（如"江苏区域"）
                const regionMatch = userInput.match(/(\w+)(区域|地区|省份|省公司)/);
                const regionValue = regionMatch ? regionMatch[1] + regionMatch[2] : null;
                
                if (durationColumn) {
                    const config = {
                        queryType: 'filter_aggregate',
                        filterColumn: regionColumn,
                        filterValue: regionValue,
                        valueColumn: durationColumn,
                        aggregateFunction: 'avg',
                        title: `${regionValue || '地区'}平均${durationColumn}统计`,
                        description: `计算${regionValue || '地区'}的平均${durationColumn}`
                    };
                    
                    addProcessingLog('success', '生成平均时长统计配置', `配置: ${JSON.stringify(config).substring(0, 100)}...`);
                    endOperationTiming();
                    
                    // 执行本地查询
                    await executeLocalQuery(userInput, dataInfo, totalStartTime, config);
                    return;
                }
            }
            
            // 如果不是平均时长查询，再尝试省公司数量统计
            const provinceColumn = dataInfo.columns.find(col => 
                col.includes('省公司') || col.includes('省份') || col.includes('地区')
            );
            
            if (provinceColumn) {
                const config = {
                    queryType: 'filter_aggregate',
                    valueColumn: provinceColumn,
                    aggregateFunction: 'count_distinct',
                    title: '省公司数量统计',
                    description: '计算表中省公司的数量'
                };
                
                addProcessingLog('success', '生成省公司数量统计配置', `配置: ${JSON.stringify(config).substring(0, 100)}...`);
                endOperationTiming();
                
                // 执行本地查询
                await executeLocalQuery(userInput, dataInfo, totalStartTime, config);
                return;
            }
        }
    }
    
    // 首先尝试使用Excel向量化进行语义查询
    if (vectorizationEnabled) {
        const vectorizedResult = await queryVectorizedData(userInput, vectorizationTable);
        if (vectorizedResult && vectorizedResult.results && vectorizedResult.results.length > 0) {
            addProcessingLog('success', '语义查询成功', `匹配结果: ${vectorizedResult.results.length}`);
            console.log('[语义查询] 向量化结果:', vectorizedResult.results);
            
            // V6.0优化：从用户查询中直接提取筛选条件，而不是依赖向量化结果的metadata
            // 1. 提取筛选值（如"上海的" -> "上海"）
            const filterValue = extractFilterValueFromQuery(userInput);
            // 2. 提取聚合列（如"销售额"）
            const aggregateColumn = extractAggregateColumnFromQuery(userInput, dataInfo.columns);
            
            console.log('[语义查询] 提取的筛选值:', filterValue, '聚合列:', aggregateColumn);
            
            // 如果能提取到筛选值和聚合列，直接生成配置执行
            if (filterValue && aggregateColumn) {
                // 找到对应的列
                let filterColumn = dataInfo.columns.find(col => 
                    col.includes('地区') || col.includes('区域') || col.includes('省') || col.includes('省份') || 
                    col.includes('城市') || col.includes('市') || col.includes('产品') || col.includes('类别')
                );
                
                let valueColumn = dataInfo.columns.find(col => 
                    col.includes(aggregateColumn) || col.includes('销售额') || col.includes('销售') || 
                    col.includes('金额') || col.includes('利润') || col.includes('数量')
                );
                
                if (filterColumn && valueColumn) {
                    const semanticConfig = {
                        queryType: 'filter_aggregate',
                        filterColumn: filterColumn,
                        filterValue: filterValue,
                        filterValues: [filterValue],
                        valueColumn: valueColumn,
                        aggregateFunction: 'sum',
                        title: `${filterValue}${valueColumn}`,
                        description: `计算${filterValue}的${valueColumn}总和`
                    };
                    
                    addProcessingLog('success', '基于语义查询生成配置成功', `筛选: ${filterColumn}=${filterValue}, 聚合: ${valueColumn}`);
                    endOperationTiming();
                    
                    // 执行本地查询
                    await executeLocalQuery(userInput, dataInfo, totalStartTime, semanticConfig);
                    return;
                }
            }
            
            // 如果无法从查询提取，回退到原来的metadata分析逻辑
            const semanticResults = vectorizedResult.results;
            
            // 尝试从语义查询结果中提取筛选条件和聚合列
            const regionResult = semanticResults.find(result => {
                return result.metadata.data && (result.metadata.data.includes('华东') || result.metadata.data.includes('地区') || result.metadata.data.includes('上海'));
            });
            
            const salesResult = semanticResults.find(result => {
                return result.metadata.data && (result.metadata.data.includes('销售额') || result.metadata.data.includes('销售'));
            });
            
            if (regionResult && salesResult) {
                let regionValue = '华东';
                if (regionResult.metadata.data) {
                    const regionMatch = regionResult.metadata.data.match(/['"](华东|华南|华北|华中|西南|西北|东北|上海|北京|广东)['"]/);
                    if (regionMatch) {
                        regionValue = regionMatch[1];
                    }
                }
                
                let regionColumn = dataInfo.columns.find(col => 
                    col.includes('地区') || col.includes('区域') || col.includes('省') || col.includes('省份')
                );
                
                let salesColumn = dataInfo.columns.find(col => 
                    col.includes('销售额') || col.includes('销售') || col.includes('金额')
                );
                
                if (regionColumn && salesColumn) {
                    const semanticConfig = {
                        queryType: 'filter_aggregate',
                        filterColumn: regionColumn,
                        filterValue: regionValue,
                        filterValues: [regionValue],
                        valueColumn: salesColumn,
                        aggregateFunction: 'sum',
                        title: `${regionValue}的${salesColumn}`,
                        description: `计算${regionValue}的${salesColumn}总和`
                    };
                    
                    addProcessingLog('success', '基于语义查询结果生成配置成功', `配置: ${JSON.stringify(semanticConfig).substring(0, 100)}...`);
                    endOperationTiming();
                    
                    await executeLocalQuery(userInput, dataInfo, totalStartTime, semanticConfig);
                    return;
                }
            }
        }
    }
    
    // V6.0新增：从用户查询中提取筛选值
    function extractFilterValueFromQuery(query) {
        // 匹配 "上海的" -> "上海", "北京的" -> "北京"
        const patterns = [
            /([^\s]+)的(销售额|利润|数量|金额|地区|省|市|产品)/,
            /在([^\s]+?)(?:的|销售额|利润|数量|金额|地区|省|市|产品)/,
            /([^\s]+?)(?:地区|省|市|产品)的/
        ];
        
        for (const pattern of patterns) {
            const match = query.match(pattern);
            if (match && match[1]) {
                const value = match[1].trim();
                // 过滤掉常见动词和助词
                if (!['计算', '查询', '查看', '统计', '看看', '帮我', '我要', '请问'].includes(value)) {
                    return value;
                }
            }
        }
        
        // 备选：从查询中提取可能的地名/产品名
        const chineseRegions = ['上海', '北京', '广东', '浙江', '江苏', '山东', '四川', '湖北', '湖南', '福建', '安徽', '河南', '河北', '东北', '华东', '华南', '华北', '华中', '西南', '西北'];
        for (const region of chineseRegions) {
            if (query.includes(region)) {
                return region;
            }
        }
        
        return null;
    }
    
    // V6.0新增：从用户查询中提取聚合列
    function extractAggregateColumnFromQuery(query, availableColumns) {
        // 优先从查询中提取
        const columnPatterns = [
            /(销售额|销售金额|总收入|营业额)/,
            /(利润|纯利润|净利润)/,
            /(数量|总数量|销量|销售数量)/,
            /(成本|总成本)/,
            /(订单|订单数|客户)/
        ];
        
        for (const pattern of columnPatterns) {
            const match = query.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        // 如果查询中没有，尝试从可用列中推断
        if (availableColumns) {
            // 优先找销售额相关的列
            const salesCol = availableColumns.find(col => col.includes('销售额') || col.includes('销售') || col.includes('金额'));
            if (salesCol) return salesCol;
            
            const profitCol = availableColumns.find(col => col.includes('利润'));
            if (profitCol) return profitCol;
            
            const quantityCol = availableColumns.find(col => col.includes('数量') || col.includes('销量'));
            if (quantityCol) return quantityCol;
        }
        
        return null;
    }
    
    // 首先尝试本地生成配置（意图库匹配）
    setNLPProgress(45, '正在尝试本地生成查询配置...');
    const localConfig = await tryGenerateChartConfigLocally(userInput, dataInfo, detailedIntent, entityExtractionResult);
    
    // 如果本地生成成功且是图表配置，转到图表处理流程
    if (localConfig && localConfig.length > 0 && localConfig[0].chartType) {
        addProcessingLog('success', '本地生成图表配置成功', `配置: ${JSON.stringify(localConfig[0]).substring(0, 100)}...`);
        endOperationTiming();
        
        // 显示处理中的消息
        const processingMessage = addMessage('system', '正在生成图表...');
        
        // 使用图表处理流程
        await handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, localConfig);
        
        // 更新处理消息为完成状态
        if (processingMessage) {
            const messageContent = processingMessage.querySelector('.message-content');
            if (messageContent) {
                messageContent.innerHTML = '<p>图表生成完成，请在下方"数据可视化"区域查看</p>';
            }
        }
        
        return;
    }
    
    // V4.0修复：优先检查 filter_aggregate，因为它也有 aggregateFunction 属性
    // 如果本地生成成功且是筛选聚合查询（如"广东省的销售额"）
    if (localConfig && localConfig.length > 0 && localConfig[0].queryType === 'filter_aggregate') {
        addProcessingLog('success', '本地生成筛选聚合配置成功', `配置: ${JSON.stringify(localConfig[0]).substring(0, 100)}...`);
        endOperationTiming();
        
        // 执行本地查询（filter_aggregate在executeLocalQuery中处理）
        await executeLocalQuery(userInput, dataInfo, totalStartTime, localConfig[0]);
        return;
    }
    
    // 修复：如果本地生成的配置不是filter_aggregate，且用户查询包含"的"和"平均"，则尝试手动生成filter_aggregate配置
    if (userInput.includes('的') && userInput.includes('平均') && dataInfo.columns.length > 0) {
        const parts = userInput.split('的');
        if (parts.length >= 2) {
            const filterValue = parts[0].trim();
            const valuePart = parts[1].trim();
            
            // 找到筛选列（优先匹配包含"省公司名称"的列，然后是"省公司"或"区域"）
            let filterColumn = dataInfo.columns.find(col => col.includes('省公司名称'));
            if (!filterColumn) {
                filterColumn = dataInfo.columns.find(col => col.includes('省公司') || col.includes('区域'));
            }
            if (!filterColumn && dataInfo.columns.length > 0) {
                filterColumn = dataInfo.columns[0];
            }
            
            // 找到数值列（优先匹配包含"时长"的列）
            let valueColumn = dataInfo.columns.find(col => col.includes('时长') || col.includes('数值'));
            if (!valueColumn && dataInfo.columns.length > 1) {
                valueColumn = dataInfo.columns[1];
            }
            
            if (filterColumn && valueColumn) {
                const filterAggregateConfig = {
                    queryType: 'filter_aggregate',
                    filterColumn: filterColumn,
                    filterValue: filterValue,
                    filterValues: [filterValue],
                    valueColumn: valueColumn,
                    aggregateFunction: 'avg',
                    title: `${filterValue}的${valueColumn}平均值`,
                    description: `计算${filterValue}的${valueColumn}平均值`
                };
                
                addProcessingLog('success', '手动生成筛选聚合配置成功', `配置: ${JSON.stringify(filterAggregateConfig).substring(0, 100)}...`);
                endOperationTiming();
                
                // 执行本地查询
                await executeLocalQuery(userInput, dataInfo, totalStartTime, filterAggregateConfig);
                return;
            }
        }
    }
    
    // 如果本地生成成功且是聚合查询配置（优先检查，因为聚合查询也有queryType）
    if (localConfig && localConfig.length > 0 && localConfig[0].aggregateFunction) {
        addProcessingLog('success', '本地生成聚合查询配置成功', `配置: ${JSON.stringify(localConfig[0]).substring(0, 100)}...`);
        endOperationTiming();
        
        // 执行聚合查询
        await executeAggregateQuery(userInput, dataInfo, totalStartTime, localConfig[0]);
        return;
    }
    
    // 如果本地生成成功且是查询配置（如查找最大值/最小值）
    if (localConfig && localConfig.length > 0 && localConfig[0].queryType) {
        addProcessingLog('success', '本地生成查询配置成功', `配置: ${JSON.stringify(localConfig[0]).substring(0, 100)}...`);
        endOperationTiming();
        
        // 执行本地查询
        await executeLocalQuery(userInput, dataInfo, totalStartTime, localConfig[0]);
        return;
    }
    
    // 如果本地匹配成功但配置生成失败，记录日志
    if (localConfig === null) {
        addProcessingLog('warning', '本地正则匹配失败，尝试BERT语义匹配...', '');
        
        // V4.2新增：获取列的唯一值，帮助模型识别筛选列
        const columnValues = getColumnUniqueValues(dataInfo);
        
        // V4.2关键改进：在前端进行智能匹配，不依赖后端
        // 根据columnValues智能识别筛选列
        let smartConfig = null;
        if (columnValues) {
            smartConfig = generateSmartFilterConfig(userInput, dataInfo.columns, columnValues);
            if (smartConfig) {
                addProcessingLog('success', 'V4.2前端智能匹配成功', `配置: ${JSON.stringify(smartConfig)}`);
                endOperationTiming();
                await executeLocalQuery(userInput, dataInfo, totalStartTime, smartConfig);
                return;
            }
        }
        
        // V4.2改进：调用BERT语义匹配配置生成API，传入列的唯一值
        try {
            const bertConfig = await callBERTConfigAPI(userInput, detailedIntent, dataInfo.columns, columnValues);
            if (bertConfig) {
                addProcessingLog('success', 'BERT语义匹配配置生成成功', `配置: ${JSON.stringify(bertConfig).substring(0, 100)}...`);
                endOperationTiming();
                
                // 根据配置类型执行相应操作
                if (bertConfig.chartType) {
                    // 显示处理中的消息
                    const processingMessage = addMessage('system', '正在生成图表...');
                    
                    await handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, [bertConfig]);
                    
                    // 更新处理消息为完成状态
                    if (processingMessage) {
                        const messageContent = processingMessage.querySelector('.message-content');
                        if (messageContent) {
                            messageContent.innerHTML = '<p>图表生成完成，请在下方"数据可视化"区域查看</p>';
                        }
                    }
                } else if (bertConfig.queryType) {
                    await executeLocalQuery(userInput, dataInfo, totalStartTime, bertConfig);
                } else if (bertConfig.aggregateFunction) {
                    // 处理聚合查询配置（如平均值、总和、计数）
                    await executeAggregateQuery(userInput, dataInfo, totalStartTime, bertConfig);
                }
                return;
            }
        } catch (bertError) {
            addProcessingLog('warning', 'BERT语义匹配失败', bertError.message);
        }
        
        addProcessingLog('warning', '将尝试使用大模型API', '');
    }
    
    // V4.1新增：如果大模型也未配置，提示用户
    if (!config.ai.apiKey || config.ai.apiKey === 'your-api-key-here') {
        addProcessingLog('warning', '大模型API未配置，无法生成配置');
        
        // 显示用户确认对话框
        const userConfirmed = confirm(
            `系统无法自动理解您的查询需求："${userInput}"\n\n` +
            `可能原因：\n` +
            `1. 查询表达不够明确\n` +
            `2. 缺少大模型API配置\n\n` +
            `建议：\n` +
            `• 尝试更明确的表达，如"统计华东地区的销售额总和"\n` +
            `• 使用"各XX的YY"格式，如"各省份的销售额"\n` +
            `• 在设置中配置大模型API密钥\n\n` +
            `是否查看帮助文档？`
        );
        
        if (userConfirmed) {
            // 显示帮助信息
            showNotification('请尝试使用以下格式：\n1. 统计[列名]的[求和/平均值/数量]\n2. [地区/省份]的[列名]是多少\n3. 各[分组列]的[数值列]分布', 'info', 8000);
        }
        
        hideNLPProgress();
        throw new Error('配置生成失败：本地模型无法理解需求，且大模型API未配置');
    }
    
    // V3.0优化：使用优化的大模型提示词
    setNLPProgress(50, '正在调用AI生成查询配置...');
    addProcessingLog('info', '使用优化的大模型提示词生成配置');
    
    // 更新工作流状态 - 大模型生成配置
    updateAgentWorkflow('generate_config', 'completed', {
        method: 'llm',
        configs: 1
    });
    
    let queryPrompt;
    if (window.llmPrompts && window.requirementClassifier) {
        // 构建大模型需要的上下文
        const columnInfo = window.requirementClassifier.getContextForLLM(
            dataInfo.columns,
            dataInfo.sampleData,
            []  // 本地模式没有matchedColumns
        );
        
        // 使用优化的查询配置提示词
        queryPrompt = window.llmPrompts.generateQueryConfigPrompt(userInput, columnInfo, dataInfo);
    } else {
        // 兜底：使用简单提示词
        queryPrompt = `分析用户需求并生成查询配置。用户输入: "${userInput}"，列名: ${dataInfo.columns.join(', ')}`;
    }
    
    // V3.0优化：减少超时时间到30秒（简单查询不需要60秒）
    const response = await callLLMAPI(queryPrompt, currentQueryController.signal, 30000);
    endOperationTiming();
    
    // V5.0修复：增强查询配置解析逻辑，更健壮地处理大模型返回的JSON
    startOperationTiming('解析并执行查询');
    setNLPProgress(60, '正在解析查询配置...');
    
    let queryLogics = [];
    try {
        // 1. 清理响应内容，移除可能的Markdown代码块和额外文本
        let cleanedResponse = response.trim();
        
        // 移除Markdown代码块标记
        cleanedResponse = cleanedResponse.replace(/^```json\n|^```\n|\n```$/g, '');
        
        // 2. 尝试解析完整响应
        try {
            const parsed = JSON.parse(cleanedResponse);
            queryLogics = Array.isArray(parsed) ? parsed : [parsed];
            addProcessingLog('info', `直接解析成功，共${queryLogics.length}个查询任务`);
        } catch (e1) {
            // 3. 如果直接解析失败，尝试匹配JSON数组
            const jsonArrayMatch = cleanedResponse.match(/\[[\s\S]*\]/);
            if (jsonArrayMatch) {
                try {
                    const parsed = JSON.parse(jsonArrayMatch[0]);
                    queryLogics = Array.isArray(parsed) ? parsed : [parsed];
                    addProcessingLog('info', `解析到数组配置，共${queryLogics.length}个查询任务`);
                } catch (e2) {
                    // 4. 尝试匹配JSON对象
                    const jsonMatch = cleanedResponse.match(/\{[\s\S]*?\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            queryLogics = [parsed];
                            addProcessingLog('info', `解析到对象配置，1个查询任务`);
                        } catch (e3) {
                            // 5. 尝试修复常见的JSON格式问题
                            try {
                                const fixedJson = fixJSON(cleanedResponse);
                                const parsed = JSON.parse(fixedJson);
                                queryLogics = Array.isArray(parsed) ? parsed : [parsed];
                                addProcessingLog('info', `修复JSON格式后解析成功，共${queryLogics.length}个查询任务`);
                            } catch (e4) {
                                throw new Error('无法解析查询配置');
                            }
                        }
                    } else {
                        throw new Error('未找到JSON配置');
                    }
                }
            } else {
                throw new Error('未找到JSON配置');
            }
        }
        
        // 验证配置有效性
        if (!queryLogics || queryLogics.length === 0) {
            throw new Error('配置为空');
        }
        
        addProcessingLog('info', `成功解析 ${queryLogics.length} 个查询任务`);
    } catch (e) {
        addProcessingLog('error', '查询配置解析失败', e.message);
        console.error('[查询配置解析]', e);
        console.error('[原始响应]', response);
        throw new Error(`无法解析查询配置: ${e.message}`);
    }
    
    // 执行查询
    setNLPProgress(70, '正在执行查询...');
    const results = [];
    for (let i = 0; i < queryLogics.length; i++) {
        const logic = queryLogics[i];
        addProcessingLog('command', `执行查询 ${i + 1}/${queryLogics.length}`, `${logic.description}`);
        const startTime = Date.now();
        const result = executeQueryLogic(logic);
        const duration = Date.now() - startTime;
        addProcessingLog('performance', `查询 ${i + 1} 完成`, `耗时: ${duration}ms`);
        results.push({ logic, result });
    }
    
    endOperationTiming();
    
    // 显示结果
    setNLPProgress(90, '正在生成结果...');
    displayNLPQueryResults(userInput, results, queryLogics, response);
    
    // 记录总耗时
    const totalDuration = Date.now() - totalStartTime;
    addProcessingLog('performance', '查询处理完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
    
    // V5.0修复：更新Agent工作流为完成状态
    updateAgentWorkflow('execute_query', 'completed');
    updateAgentWorkflow('render_result', 'completed', {
        resultType: 'llm_query',
        duration: totalDuration
    });
    
    // V4.0新增：记录成功查询到历史
    if (window.queryHistoryManager) {
        window.queryHistoryManager.addQuery(userInput, true);
        updateQuerySuggestions();
    }
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
}

// 执行去重计数查询（统计某列有多少个不同的值）
function executeCountDistinct(column) {
    if (!column || !headers.includes(column)) {
        // 尝试模糊匹配列名
        const matchedCol = headers.find(h => 
            h.includes(column) || column.includes(h) || 
            h.toLowerCase().includes(column.toLowerCase())
        );
        if (matchedCol) {
            column = matchedCol;
        } else {
            throw new Error(`列"${column}"不存在`);
        }
    }
    
    // 使用 Set 进行去重计数
    const uniqueValues = new Set();
    for (const row of data) {
        const value = row[column];
        if (value !== null && value !== undefined && value !== '') {
            uniqueValues.add(value);
        }
    }
    
    return uniqueValues.size;
}

// 执行聚合查询（平均值、总和、计数等）
async function executeAggregateQuery(userInput, dataInfo, totalStartTime, config) {
    startOperationTiming('执行聚合查询');
    setNLPProgress(70, '正在执行聚合查询...');
    
    console.log('executeAggregateQuery - 开始执行:', {
        userInput,
        config,
        columns: dataInfo.columns,
        dataLength: dataInfo.data ? dataInfo.data.length : 0
    });
    
    const { aggregateFunction, valueColumn, groupColumn, queryType } = config;
    
    // 从dataInfo获取实际数据
    const headers = dataInfo.columns;
    const data = dataInfo.data || [];
    
    // 判断是否是找极值的复合查询（如"哪个产品的销售额最高"）
    const isFindExtremeQuery = queryType === 'group_aggregate_find';
    
    // 找到实际的数值列
    let actualValueCol = valueColumn;
    if (valueColumn && !headers.includes(valueColumn)) {
        actualValueCol = headers.find(h => h.includes(valueColumn) || valueColumn.includes(h));
    }
    
    // 找到实际的分组列
    let actualGroupCol = groupColumn;
    if (groupColumn && !headers.includes(groupColumn)) {
        actualGroupCol = headers.find(h => h.includes(groupColumn) || groupColumn.includes(h));
    }
    
    console.log('executeAggregateQuery - 列匹配结果:', {
        actualValueCol,
        actualGroupCol,
        isFindExtremeQuery,
        aggregateFunction,
        queryType
    });
    
    // 辅助函数：解析数值（处理千分位逗号、货币符号等）
    const parseNumericValue = (value) => {
        if (value === null || value === undefined || value === '') return NaN;
        let str = value.toString();
        str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
        return parseFloat(str);
    };
    
    let results = [];
    
    console.log('debug-complex-query - 数据检查:', {
        dataLength: data.length,
        actualGroupCol,
        actualValueCol,
        config
    });
    
    if (actualGroupCol) {
        // ========== 处理分组聚合查询 ==========
        console.log('debug-complex-query - 开始分组聚合，分组列:', actualGroupCol);
        
        // 按分组列分组
        const groups = {};
        for (const row of data) {
            const groupKey = row[actualGroupCol];
            if (!groupKey) {
                console.log('debug-complex-query - 跳过空分组键的行:', row);
                continue;
            }
            
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    count: 0,
                    sum: 0,
                    max: -Infinity
                };
            }
            
            if (actualValueCol) {
                const origVal = row[actualValueCol];
                const val = parseNumericValue(origVal);
                console.log('debug-complex-query - 数值:', {actualValueCol, origVal, parsed: val});
                
                if (!isNaN(val)) {
                    groups[groupKey].sum += val;
                    groups[groupKey].count++;
                    // 计算最大值
                    if (val > groups[groupKey].max) {
                        groups[groupKey].max = val;
                    }
                } else if (origVal) {
                    console.warn('debug-complex-query - 数值解析失败:', origVal);
                }
            } else {
                // 如果没有数值列，只计数
                groups[groupKey].count++;
            }
        }
        
        console.log('debug-complex-query - 分组统计结果:', groups);
        
        // 计算聚合结果
        for (const [group, stats] of Object.entries(groups)) {
            let resultValue;
            if (aggregateFunction === 'avg') {
                resultValue = stats.count > 0 ? stats.sum / stats.count : 0;
            } else if (aggregateFunction === 'sum') {
                resultValue = stats.sum;
            } else if (aggregateFunction === 'count') {
                resultValue = stats.count;
            } else if (aggregateFunction === 'max') {
                // 处理最大值查询
                resultValue = stats.max === -Infinity ? 0 : stats.max;
            } else {
                // 默认使用sum
                resultValue = stats.sum;
            }
            
            console.log('debug-complex-query - 聚合结果:', {
                group, 
                resultValue, 
                stats,
                aggregateFunction
            });
            
            results.push({
                group: group,
                value: resultValue
            });
        }
        
        // 对结果排序（如果需要找到最高/最低）
        const userInputLower = userInput.toLowerCase();
        if (userInputLower.includes('最高') || userInputLower.includes('最大')) {
            results.sort((a, b) => b.value - a.value);
        } else if (userInputLower.includes('最低') || userInputLower.includes('最小')) {
            results.sort((a, b) => a.value - b.value);
        }
        
    } else {
        // ========== 处理整体聚合查询 ==========
        let sum = 0;
        let count = 0;
        let max = -Infinity;
        
        if (actualValueCol) {
            for (const row of data) {
                const val = parseNumericValue(row[actualValueCol]);
                if (!isNaN(val)) {
                    sum += val;
                    count++;
                    // 计算最大值
                    if (val > max) {
                        max = val;
                    }
                }
            }
        } else {
            count = data.length;
        }
        
        let resultValue;
        if (aggregateFunction === 'avg') {
            resultValue = count > 0 ? sum / count : 0;
        } else if (aggregateFunction === 'sum') {
            resultValue = sum;
        } else if (aggregateFunction === 'count') {
            resultValue = count;
        } else if (aggregateFunction === 'max') {
            // 处理最大值查询
            resultValue = max === -Infinity ? 0 : max;
        } else {
            // 默认使用sum
            resultValue = sum;
        }
        
        results = [{ group: '整体', value: resultValue }];
    }
    
    endOperationTiming();
    
    console.log('debug-complex-query - 最终结果摘要:', {
        resultsCount: results.length,
        results: results.slice(0, 5),
        isFindExtremeQuery,
        actualGroupCol,
        actualValueCol,
        aggregateFunction
    });
    
    // 显示结果
    setNLPProgress(90, '正在生成结果...');
    
    const nlpResult = document.getElementById('nlp-result');
    if (nlpResult) {
        console.log('debug-complex-query - nlpResult元素找到，开始渲染结果');
        
        const resultType = aggregateFunction === 'avg' ? '平均值' : aggregateFunction === 'sum' ? '总和' : '数量';
        const groupDesc = actualGroupCol || '整体';
        
        // 如果是找极值查询（如"哪个产品的销售额最高"），只显示第一名
        if (isFindExtremeQuery && results.length > 0) {
            const topResult = results[0];
            const orderText = userInput.toLowerCase().includes('高') || userInput.toLowerCase().includes('大') || userInput.toLowerCase().includes('多') ? '最高' : '最低';
            
            // 生成标题和描述
            const extremeTitle = config.title || `${actualGroupCol || '数据'}的${valueColumn || '统计'}分析`;
            const extremeDesc = config.description || `查找${actualGroupCol || '各组'}中${valueColumn || '统计值'}${orderText}的项`;
            
            let html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${extremeTitle}</h4>
                        <p>${extremeDesc}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualGroupCol || '分组'}的${valueColumn || '统计值'}${orderText}的是：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${topResult.group}</span>
                            <span style="margin-left: 20px; color: #666;">${valueColumn || '统计值'}合计：<strong>${topResult.value.toFixed(2)}</strong></span>
                        </div>
                        <div style="margin-top: 20px;">
                            <h5 style="margin-bottom: 10px;">各${actualGroupCol || '分组'}${valueColumn || '统计值'}排名（前5名）：</h5>
                            <div style="overflow-x: auto; max-width: 100%;">
                                <table class="result-table" style="width: auto; min-width: 300px; border-collapse: collapse; white-space: nowrap;">
                                    <thead>
                                        <tr style="background: #667eea; color: white;">
                                            <th style="padding: 10px; text-align: left;">排名</th>
                                            <th style="padding: 10px; text-align: left;">${actualGroupCol}</th>
                                            <th style="padding: 10px; text-align: left;">${valueColumn}${resultType}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${results.slice(0, 5).map((r, i) => `
                                            <tr style="background: ${i === 0 ? '#e8f4f8' : (i % 2 === 0 ? 'white' : '#f8f9fa')};">
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${i + 1}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${r.group}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${r.value.toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        } else {
            // 普通聚合查询，显示所有结果
            // 生成标题和描述
            const resultTitle = config.title || `${actualGroupCol || '数据'}的${valueColumn || '统计'}分析`;
            const resultDesc = config.description || `按${actualGroupCol || '整体'}分组统计${valueColumn || '记录数'}`;
            
            let html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${resultTitle}</h4>
                        <p>${resultDesc}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 16px; margin-bottom: 15px; color: #666;">
                            共 ${results.length} 个${actualGroupCol ? '分组' : '结果'}
                        </div>
                        <div style="overflow-x: auto; max-width: 100%;">
                            <table class="result-table" style="width: 100%; border-collapse: collapse; white-space: nowrap;">
                                <thead>
                                    <tr style="background: #667eea; color: white;">
                                        <th style="padding: 10px; text-align: left; white-space: nowrap;">${actualGroupCol || '项目'}</th>
                                        <th style="padding: 10px; text-align: left; white-space: nowrap;">${valueColumn || '统计值'}${resultType}</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            results.forEach((item, index) => {
                html += `
                    <tr style="background: ${index % 2 === 0 ? 'white' : '#f8f9fa'};">
                        <td style="padding: 10px; border-bottom: 1px solid #eee; white-space: nowrap;">${item.group}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; white-space: nowrap;">${item.value.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
    }
    
    // ========== V4.0新增：处理带筛选条件的聚合查询（如"广东省的销售额"）==========
    else if (queryType === 'filter_aggregate') {
        const { filterColumn, filterValue, filterValues, valueColumn, aggregateFunction = 'sum' } = config;
        
        // 找到实际的数值列
        let actualValueCol = valueColumn;
        if (valueColumn && !headers.includes(valueColumn)) {
            actualValueCol = headers.find(h => h.includes(valueColumn) || valueColumn.includes(h));
        }
        
        // 定义实际的筛选列变量
        let actualFilterCol = filterColumn;
        
        // 对于count_distinct查询，不需要筛选列
        if (aggregateFunction === 'count_distinct') {
            if (!actualValueCol) {
                throw new Error(`数值列"${valueColumn}"不存在`);
            }
        } else {
            // 找到实际的筛选列
            if (filterColumn && !headers.includes(filterColumn)) {
                actualFilterCol = headers.find(h => h.includes(filterColumn) || filterColumn.includes(h));
            }
            
            if (!actualFilterCol) {
                throw new Error(`筛选列"${filterColumn}"不存在`);
            }
            if (!actualValueCol) {
                throw new Error(`数值列"${valueColumn}"不存在`);
            }
        }
        
        // 处理单个筛选值或多个筛选值
        const filterValueList = filterValues || (filterValue ? [filterValue] : []);
        
        // 执行筛选并聚合
        let result = 0;
        let count = 0;
        const filteredRows = [];
        
        if (aggregateFunction === 'count_distinct') {
            // 去重计数逻辑
            const uniqueValues = new Set();
            for (const row of data) {
                const cellValue = row[actualValueCol];
                if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                    uniqueValues.add(String(cellValue));
                }
            }
            result = uniqueValues.size;
            count = data.length;
        } else {
            // 传统聚合逻辑
            for (const row of data) {
                const cellValue = row[actualFilterCol];
                if (cellValue !== undefined && cellValue !== null) {
                    const cellStr = cellValue.toString().toLowerCase();
                    // 检查是否匹配任一筛选值
                    const isMatch = filterValueList.some(fv => {
                        const filterStr = fv.toString().toLowerCase();
                        return cellStr.includes(filterStr) || filterStr.includes(cellStr);
                    });
                    
                    if (isMatch) {
                        count++;
                        const numValue = parseFloat(String(row[actualValueCol] || 0).replace(/,/g, ''));
                        if (!isNaN(numValue)) {
                            result += numValue;
                        }
                        filteredRows.push(row);
                    }
                }
            }
            
            // 根据聚合函数计算最终结果
            if (aggregateFunction === 'avg' && count > 0) {
                result = result / count;
            }
        }
        
        const finalResult = result;
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const aggDesc = aggregateFunction === 'sum' ? '总和' : aggregateFunction === 'avg' ? '平均值' : aggregateFunction === 'count_distinct' ? '去重计数' : '统计';
            
            let html, cardContent;
            
            if (aggregateFunction === 'count_distinct') {
                // 对于count_distinct查询的特殊显示
                html = `
                    <div class="query-results">
                        <div class="result-header">
                            <h4>查询结果：${config.title}</h4>
                            <p>${config.description}</p>
                        </div>
                        <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                            <div style="font-size: 18px; margin-bottom: 15px;">
                                <strong>${actualValueCol}${aggDesc}：</strong>
                                <span style="color: #667eea; font-size: 24px; font-weight: bold;">${finalResult}</span>
                            </div>
                            <div style="color: #666; font-size: 14px;">
                                基于 ${data.length} 条记录计算
                            </div>
                        </div>
                    </div>
                `;
                
                cardContent = `
                    <div class="result-card">
                        <div class="result-card-header">
                            <h4>查询结果</h4>
                        </div>
                        <div class="result-card-body">
                            <p><strong>${config.title || '数据查询'}</strong></p>
                            <p>${actualValueCol}${aggDesc}：<span style="font-size: 1.2em; font-weight: bold;">${finalResult}</span></p>
                            <p style="font-size: 0.85em; opacity: 0.9;">基于 ${data.length} 条记录计算</p>
                        </div>
                    </div>
                `;
            } else {
                // 传统筛选聚合查询的显示
                const filterDesc = filterValueList.map(fv => `"${fv}"`).join(' 或 ');
                html = `
                    <div class="query-results">
                        <div class="result-header">
                            <h4>查询结果：${config.title}</h4>
                            <p>${config.description}</p>
                        </div>
                        <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                            <div style="font-size: 18px; margin-bottom: 15px;">
                                <strong>${actualFilterCol}为${filterDesc}时，${actualValueCol}${aggDesc}：</strong>
                                <span style="color: #667eea; font-size: 24px; font-weight: bold;">${finalResult.toFixed(2)}</span>
                            </div>
                            <div style="color: #666; font-size: 14px;">
                                基于 ${data.length} 条记录筛选，匹配 ${count} 条
                            </div>
                            ${filteredRows.length > 0 ? `
                            <div style="margin-top: 15px;">
                                <h5 style="margin-bottom: 10px;">匹配记录（前10条）：</h5>
                                <table class="result-table" style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                    <thead>
                                        <tr style="background: #667eea; color: white;">
                                            ${headers.map(h => `<th style="padding: 8px; text-align: left;">${h}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${filteredRows.slice(0, 10).map((r, i) => `
                                            <tr style="background: ${i % 2 === 0 ? 'white' : '#f8f9fa'};">
                                                ${headers.map(h => `<td style="padding: 8px; border-bottom: 1px solid #eee;">${r[h] || ''}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                cardContent = `
                    <div class="result-card">
                        <div class="result-card-header">
                            <h4>查询结果</h4>
                        </div>
                        <div class="result-card-body">
                            <p><strong>${config.title || '数据查询'}</strong></p>
                            <p>${actualFilterCol}为${filterDesc}时，${actualValueCol}${aggDesc}：<span style="font-size: 1.2em; font-weight: bold;">${finalResult.toFixed(2)}</span></p>
                            <p style="font-size: 0.85em; opacity: 0.9;">基于 ${data.length} 条记录筛选，匹配 ${count} 条</p>
                        </div>
                    </div>
                `;
            }
            
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
            addMessage('system', cardContent);
        }
        
        // ========== V5.0修复：更新Agent工作流状态 ==========
        updateAgentWorkflow('execute_query', 'completed');
        updateAgentWorkflow('render_result', 'completed', {
            resultType: 'filter_aggregate',
            value: finalResult.toFixed(2)
        });
    }
    
    // 记录总耗时
    const totalDuration = Date.now() - totalStartTime;
    addProcessingLog('performance', '聚合查询处理完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
}

// 执行本地查询（查找最大值/最小值等）
async function executeLocalQuery(userInput, dataInfo, totalStartTime, config) {
    startOperationTiming('执行本地查询');
    setNLPProgress(70, '正在执行查询...');
    
    // V5.0: 更新Agent工作流 - 开始执行查询
    updateAgentWorkflow('generate_config', 'completed', {
        configType: config.queryType || 'unknown',
        description: config.description || '执行查询'
    });
    updateAgentWorkflow('execute_query', 'running');
    
    // ========== V4.0新增：使用实体抽取增强配置 ==========
    let enhancedConfig = { ...config };
    // V4.2修复：检查entityExtractor和extract方法都存在
    if (window.entityExtractor && typeof window.entityExtractor.extract === 'function') {
        try {
            const headers = dataInfo.columns;
            const entities = window.entityExtractor.extract(userInput, headers);
            enhancedConfig = window.entityExtractor.enhanceConfig(entities, config);
            console.log('[V4.0] 实体抽取结果:', entities);
            console.log('[V4.0] 增强配置:', enhancedConfig);
        } catch (error) {
            console.warn('[V4.0] 实体抽取失败:', error);
        }
    }
    
    // ========== V4.0新增：使用Agent调度器执行查询 ==========
    // V4.0修复：filter_aggregate查询不走Agent调度器，直接使用传统方式处理
    if (window.agentRouter && enhancedConfig.queryType && enhancedConfig.queryType !== 'filter_aggregate') {
        try {
            // 生成执行计划
            const planResult = await window.agentRouter.route('planning', {
                action: 'plan',
                userInput,
                dataProfile: window.currentDataProfile,
                config: enhancedConfig
            });
            
            console.log('[V4.0] 执行计划:', planResult);
            
            // 对于复杂查询，展示执行计划
            if (planResult.success && planResult.plan?.complexity !== 'simple' && window.executionPlanUI) {
                // 可以选择展示执行计划让用户确认
                // 这里暂时自动执行，后续可以添加用户确认机制
                addProcessingLog('info', '执行计划', planResult.summary);
            }
            
            // 使用分析Agent执行查询
            const analysisResult = await window.agentRouter.route('analysis', {
                config: enhancedConfig,
                data,
                headers
            });
            
            if (analysisResult.success) {
                console.log('[V4.0] 分析结果:', analysisResult);
                
                // 使用解释Agent生成解释
                const explanationResult = await window.agentRouter.route('explanation', {
                    action: 'summarize',
                    analysisResult,
                    dataProfile: window.currentDataProfile,
                    userInput
                });
                
                console.log('[V4.0] 解释结果:', explanationResult);
                
                // 显示结果
                displayAgentQueryResult(userInput, enhancedConfig, analysisResult, explanationResult, totalStartTime);
                return;
            }
        } catch (error) {
            console.warn('[V4.0] Agent执行失败，降级使用传统方式:', error);
            // 继续使用传统方式执行
        }
    }
    
    // 传统执行方式（兜底）
    const { queryType, valueColumn, aggregateFunction, groupColumn, order, limit } = enhancedConfig;
    
    // 检查是否是filter_aggregate类型的查询
    const isFilterAggregate = queryType === 'filter_aggregate' || (enhancedConfig.filterColumn && enhancedConfig.valueColumn && enhancedConfig.aggregateFunction);
    
    // ========== V4.0新增：处理带筛选条件的聚合查询（如"广东省的销售额"）==========
    if (isFilterAggregate) {
        const { filterColumn, filterValue, filterValues, valueColumn: vc, aggregateFunction: af = 'sum' } = enhancedConfig;
        const headers = dataInfo.columns;
        
        // 定义实际的筛选列变量
        let actualFilterCol = filterColumn;
        
        // 找到实际的数值列
        let actualValueCol = vc;
        if (vc && !headers.includes(vc)) {
            actualValueCol = headers.find(h => h.includes(vc) || vc.includes(h));
        }
        
        // 对于count_distinct查询，不需要筛选列
        if (af === 'count_distinct') {
            if (!actualValueCol) {
                throw new Error(`数值列不存在: ${vc}`);
            }
        } else {
            // 找到实际的筛选列
            if (filterColumn && !headers.includes(filterColumn)) {
                actualFilterCol = headers.find(h => h.includes(filterColumn) || filterColumn.includes(h));
            }
            
            if (!actualFilterCol || !actualValueCol) {
                throw new Error(`筛选列或数值列不存在: ${filterColumn}, ${vc}`);
            }
        }
        
        // 处理单个筛选值或多个筛选值
        const filterValueList = filterValues || (filterValue ? [filterValue] : []);
        
        // 执行筛选并聚合
        let result = 0;
        let count = 0;
        const filteredRows = [];
        
        if (af === 'count_distinct') {
            // 去重计数逻辑
            const uniqueValues = new Set();
            for (const row of data) {
                const cellValue = row[actualValueCol];
                if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                    uniqueValues.add(String(cellValue));
                }
            }
            result = uniqueValues.size;
            count = data.length;
        } else {
            // 传统聚合逻辑
            for (const row of data) {
                const cellValue = row[actualFilterCol];
                if (cellValue !== undefined && cellValue !== null) {
                    const cellStr = cellValue.toString().toLowerCase();
                    const isMatch = filterValueList.some(fv => {
                        const filterStr = fv.toString().toLowerCase();
                        return cellStr.includes(filterStr) || filterStr.includes(cellStr);
                    });
                    
                    if (isMatch) {
                        count++;
                        const numValue = parseFloat(String(row[actualValueCol] || 0).replace(/,/g, ''));
                        if (!isNaN(numValue)) {
                            result += numValue;
                        }
                        filteredRows.push(row);
                    }
                }
            }
        }
        
        // 根据聚合函数计算最终结果
        let finalResult = result;
        if (af === 'avg' && count > 0) {
            finalResult = result / count;
        }
        
        endOperationTiming();
        
        // 检查是否需要单位换算
        let displayValue = finalResult;
        let unit = '';
        
        // 检查用户输入是否包含单位换算要求
        if (userInput && (userInput.includes('换算') || userInput.includes('转换'))) {
            if (userInput.includes('分钟') && actualValueCol.includes('时长')) {
                // 秒换算为分钟
                displayValue = finalResult / 60;
                unit = '分钟';
                addProcessingLog('info', '单位换算', '秒 → 分钟');
            } else if (userInput.includes('小时') && actualValueCol.includes('时长')) {
                // 秒换算为小时
                displayValue = finalResult / 3600;
                unit = '小时';
                addProcessingLog('info', '单位换算', '秒 → 小时');
            }
        }
        
        // 显示结果
        const nlpResult = document.getElementById('nlp-result');
        const totalTime = Date.now() - totalStartTime;
        const filterDesc = filterValueList.map(fv => `"${fv}"`).join(' 或 ');
        const aggDesc = af === 'sum' ? '总和' : af === 'avg' ? '平均值' : '统计';
        
        nlpResult.innerHTML = `
            <div class="query-result-card">
                <div class="result-header">
                    <span class="result-icon">📊</span>
                    <span class="result-title">${enhancedConfig.title || '查询结果'}</span>
                </div>
                <div class="result-body">
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 18px; margin-bottom: 15px; color: white;">
                            <strong>${actualFilterCol ? actualFilterCol + '为' + filterDesc + '时，' : ''}${actualValueCol}${aggDesc}：</strong>
                        </div>
                        <div style="color: white; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${displayValue.toFixed(2)}${unit}</div>
                        <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 10px;">
                            基于 ${data.length} 条记录筛选，匹配 ${count} 条
                        </div>
                    </div>
                </div>
                <div class="result-footer">
                    <span class="result-time">查询耗时: ${totalTime}ms</span>
                </div>
            </div>
        `;
        
        nlpResult.classList.remove('hidden');
        
        addProcessingLog('success', '筛选聚合查询完成', `${actualFilterCol ? actualFilterCol + '=' + filterDesc + ', ' : ''}${actualValueCol}${aggDesc}=${finalResult.toFixed(2)}`);
        
        // V5.0: 更新Agent工作流 - 完成
        updateAgentWorkflow('execute_query', 'completed');
        updateAgentWorkflow('render_result', 'completed', {
            resultType: 'filter_aggregate',
            value: finalResult.toFixed(2)
        });
        
        setNLPProgress(100, '完成');
        setTimeout(() => {
            hideNLPProgress();
        }, 500);
        return;
    }
    
    // ========== V3.3新增：处理分组计数后找极值的复合查询 ==========
    if (queryType === 'group_count_find') {
        // 找到实际的分组列
        let actualGroupCol = groupColumn;
        if (groupColumn && !headers.includes(groupColumn)) {
            actualGroupCol = headers.find(h => h.includes(groupColumn) || groupColumn.includes(h));
        }
        
        if (!actualGroupCol) {
            throw new Error(`分组列"${groupColumn}"不存在`);
        }
        
        // 按分组列统计数量
        const groupCounts = {};
        for (const row of data) {
            const groupKey = row[actualGroupCol];
            if (groupKey) {
                groupCounts[groupKey] = (groupCounts[groupKey] || 0) + 1;
            }
        }
        
        // 转换为数组并排序
        const results = Object.entries(groupCounts).map(([group, count]) => ({
            group,
            count
        }));
        
        // 根据order排序
        results.sort((a, b) => order === 'desc' ? b.count - a.count : a.count - b.count);
        
        // 取第一条（数量最多/最少的）
        const topResult = results[0];
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const orderText = order === 'desc' ? '最多' : '最少';
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualGroupCol}数量${orderText}的是：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${topResult.group}</span>
                            <span style="margin-left: 20px; color: #666;">数量：<strong>${topResult.count}</strong> 条</span>
                        </div>
                        <div style="margin-top: 20px;">
                            <h5 style="margin-bottom: 10px;">各${actualGroupCol}数量排名：</h5>
                            <div style="overflow-x: auto; max-width: 100%;">
                                <table class="result-table" style="width: auto; min-width: 300px; border-collapse: collapse; white-space: nowrap;">
                                    <thead>
                                        <tr style="background: #667eea; color: white;">
                                            <th style="padding: 10px; text-align: left;">排名</th>
                                            <th style="padding: 10px; text-align: left;">${actualGroupCol}</th>
                                            <th style="padding: 10px; text-align: left;">数量</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${results.slice(0, 10).map((r, i) => `
                                            <tr style="background: ${i === 0 ? '#e8f4f8' : (i % 2 === 0 ? 'white' : '#f8f9fa')};">
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${i + 1}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${r.group}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${r.count}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ${results.length > 10 ? `<p style="margin-top: 10px; color: #666;">仅显示前10名，共${results.length}个${actualGroupCol}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
        
        // 记录总耗时
        const totalDuration = Date.now() - totalStartTime;
        addProcessingLog('performance', '查询处理完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
        
        // V4.0新增：记录成功查询到历史
        if (window.queryHistoryManager) {
            window.queryHistoryManager.addQuery(userInput, true);
            updateQuerySuggestions();
        }
        
        setNLPProgress(100, '完成');
        setTimeout(() => {
            hideNLPProgress();
        }, 500);
        
        return;
    }
    
    // ========== V3.3新增：处理分组聚合后找极值的复合查询（如：哪个地区的数量最多，按"数量"列求和）==========
    if (queryType === 'group_aggregate_find') {
        // 找到实际的分组列和数值列
        let actualGroupCol = groupColumn;
        let actualValueCol = valueColumn;
        
        if (groupColumn && !headers.includes(groupColumn)) {
            actualGroupCol = headers.find(h => h.includes(groupColumn) || groupColumn.includes(h));
        }
        if (valueColumn && !headers.includes(valueColumn)) {
            actualValueCol = headers.find(h => h.includes(valueColumn) || valueColumn.includes(h));
        }
        
        if (!actualGroupCol) {
            throw new Error(`分组列"${groupColumn}"不存在`);
        }
        if (!actualValueCol) {
            throw new Error(`数值列"${valueColumn}"不存在`);
        }
        
        // 辅助函数：解析数值
        const parseNumericValue = (value) => {
            if (value === null || value === undefined || value === '') return 0;
            let str = value.toString();
            str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };
        
        // 按分组列聚合数值列
        const groupAggregates = {};
        for (const row of data) {
            const groupKey = row[actualGroupCol];
            if (groupKey) {
                const val = parseNumericValue(row[actualValueCol]);
                if (!groupAggregates[groupKey]) {
                    groupAggregates[groupKey] = { sum: 0, count: 0 };
                }
                groupAggregates[groupKey].sum += val;
                groupAggregates[groupKey].count += 1;
            }
        }
        
        // 转换为数组并排序
        const results = Object.entries(groupAggregates).map(([group, agg]) => ({
            group,
            sum: agg.sum,
            count: agg.count,
            avg: agg.sum / agg.count
        }));
        
        // 根据order排序（按sum排序）
        results.sort((a, b) => order === 'desc' ? b.sum - a.sum : a.sum - b.sum);
        
        // 取第一条（sum最多/最少的）
        const topResult = results[0];
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const orderText = order === 'desc' ? '最多' : '最少';
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualGroupCol}的${actualValueCol}${orderText}的是：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${topResult.group}</span>
                            <span style="margin-left: 20px; color: #666;">${actualValueCol}合计：<strong>${topResult.sum.toFixed(2)}</strong></span>
                            <span style="margin-left: 10px; color: #888;">(共${topResult.count}条记录)</span>
                        </div>
                        <div style="margin-top: 20px;">
                            <h5 style="margin-bottom: 10px;">各${actualGroupCol}的${actualValueCol}排名：</h5>
                            <div style="overflow-x: auto; max-width: 100%;">
                                <table class="result-table" style="width: auto; min-width: 400px; border-collapse: collapse; white-space: nowrap;">
                                    <thead>
                                        <tr style="background: #667eea; color: white;">
                                            <th style="padding: 10px; text-align: left;">排名</th>
                                            <th style="padding: 10px; text-align: left;">${actualGroupCol}</th>
                                            <th style="padding: 10px; text-align: left;">${actualValueCol}合计</th>
                                            <th style="padding: 10px; text-align: left;">记录数</th>
                                            <th style="padding: 10px; text-align: left;">平均值</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${results.slice(0, 10).map((r, i) => `
                                            <tr style="background: ${i === 0 ? '#e8f4f8' : (i % 2 === 0 ? 'white' : '#f8f9fa')};">
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${i + 1}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${r.group}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${i === 0 ? 'bold' : 'normal'};">${r.sum.toFixed(2)}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee;">${r.count}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee;">${r.avg.toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ${results.length > 10 ? `<p style="margin-top: 10px; color: #666;">仅显示前10名，共${results.length}个${actualGroupCol}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
        
        // 记录总耗时
        const totalDuration = Date.now() - totalStartTime;
        addProcessingLog('performance', '查询处理完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
        
        setNLPProgress(100, '完成');
        setTimeout(() => {
            hideNLPProgress();
        }, 500);
        
        return;
    }
    
    // 找到实际的数值列
    let actualValueCol = valueColumn;
    if (valueColumn && !headers.includes(valueColumn)) {
        actualValueCol = headers.find(h => h.includes(valueColumn) || valueColumn.includes(h));
    }
    
    // ========== 处理查找类查询（最大/最小值）==========
    if (queryType === 'find_max' || queryType === 'find_min') {
        if (!actualValueCol) {
            throw new Error(`数值列"${valueColumn}"不存在`);
        }
        
        // 查找最大/最小值
        let targetRow = null;
        let targetValue = null;
        
        // 辅助函数：解析数值（处理千分位逗号、货币符号等）
        const parseNumericValue = (value) => {
            if (value === null || value === undefined || value === '') return NaN;
            // 转换为字符串并清理
            let str = value.toString();
            // 移除千分位逗号、货币符号、空格
            str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
            // 解析数值
            return parseFloat(str);
        };
        
        if (queryType === 'find_max') {
            // 查找最大值
            targetValue = -Infinity;
            for (const row of data) {
                const val = parseNumericValue(row[actualValueCol]);
                if (!isNaN(val) && val > targetValue) {
                    targetValue = val;
                    targetRow = row;
                }
            }
        } else if (queryType === 'find_min') {
            // 查找最小值
            targetValue = Infinity;
            for (const row of data) {
                const val = parseNumericValue(row[actualValueCol]);
                if (!isNaN(val) && val < targetValue) {
                    targetValue = val;
                    targetRow = row;
                }
            }
        }
        
        if (!targetRow) {
            throw new Error('未找到符合条件的记录');
        }
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const resultType = queryType === 'find_max' ? '最大值' : '最小值';
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualValueCol}${resultType}：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${targetValue}</span>
                        </div>
                        <div style="overflow-x: auto; max-width: 100%;">
                            <table class="result-table" style="width: auto; min-width: 100%; border-collapse: collapse; white-space: nowrap;">
                                <thead>
                                    <tr style="background: #667eea; color: white;">
                                        ${headers.map(h => `<th style="padding: 10px; text-align: left; white-space: nowrap;">${h}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="background: white;">
                                        ${headers.map(h => `<td style="padding: 10px; border-bottom: 1px solid #eee; white-space: nowrap;">${targetRow[h] || ''}</td>`).join('')}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
    }
    
    // ========== 处理查找前几名/后几名 ==========
    else if (queryType === 'find_top') {
        if (!actualValueCol) {
            throw new Error(`数值列"${valueColumn}"不存在`);
        }
        
        const { limit = 5, order = 'desc' } = config;
        
        // 辅助函数：解析数值（处理千分位逗号、货币符号等）
        const parseNumericValue = (value) => {
            if (value === null || value === undefined || value === '') return NaN;
            let str = value.toString();
            str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
            return parseFloat(str);
        };
        
        // 收集所有有效记录
        const validRows = [];
        for (const row of data) {
            const val = parseNumericValue(row[actualValueCol]);
            if (!isNaN(val)) {
                validRows.push({ row, value: val });
            }
        }
        
        // 排序
        validRows.sort((a, b) => order === 'desc' ? b.value - a.value : a.value - b.value);
        
        // 取前N名
        const topRows = validRows.slice(0, limit);
        
        if (topRows.length === 0) {
            throw new Error('未找到符合条件的记录');
        }
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const orderText = order === 'desc' ? '前' : '后';
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 16px; margin-bottom: 15px; color: #666;">
                            共找到 ${topRows.length} 条记录
                        </div>
                        <table class="result-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #667eea; color: white;">
                                    <th style="padding: 10px; text-align: left;">排名</th>
                                    <th style="padding: 10px; text-align: left;">${actualValueCol}</th>
                                    ${headers.filter(h => h !== actualValueCol).map(h => `<th style="padding: 10px; text-align: left;">${h}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${topRows.map((item, i) => `
                                    <tr style="background: ${i % 2 === 0 ? 'white' : '#f8f9fa'};">
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #667eea;">${i + 1}</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${item.value}</td>
                                        ${headers.filter(h => h !== actualValueCol).map(h => `<td style="padding: 10px; border-bottom: 1px solid #eee;">${item.row[h] || ''}</td>`).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
    }
    
    // ========== 处理查找特定排名 ==========
    else if (queryType === 'find_rank') {
        if (!actualValueCol) {
            throw new Error(`数值列"${valueColumn}"不存在`);
        }
        
        const { rank = 1 } = config;
        
        // 辅助函数：解析数值（处理千分位逗号、货币符号等）
        const parseNumericValue = (value) => {
            if (value === null || value === undefined || value === '') return NaN;
            let str = value.toString();
            str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
            return parseFloat(str);
        };
        
        // 收集所有有效记录
        const validRows = [];
        for (const row of data) {
            const val = parseNumericValue(row[actualValueCol]);
            if (!isNaN(val)) {
                validRows.push({ row, value: val });
            }
        }
        
        // 按降序排序
        validRows.sort((a, b) => b.value - a.value);
        
        // 获取指定排名的记录
        const targetIndex = rank - 1;
        const targetItem = validRows[targetIndex];
        
        if (!targetItem) {
            throw new Error(`未找到排名第${rank}的记录`);
        }
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualValueCol}排名第${rank}：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${targetItem.value}</span>
                        </div>
                        <table class="result-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #667eea; color: white;">
                                    ${headers.map(h => `<th style="padding: 10px; text-align: left;">${h}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="background: white;">
                                    ${headers.map(h => `<td style="padding: 10px; border-bottom: 1px solid #eee;">${targetItem.row[h] || ''}</td>`).join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
    }
    
    // ========== 处理整体聚合查询（平均值/总和/计数）==========
    else if (queryType === 'aggregate_overall') {
        if (!actualValueCol && aggregateFunction !== 'count') {
            throw new Error(`数值列"${valueColumn}"不存在`);
        }
        
        // 辅助函数：解析数值（处理千分位逗号、货币符号等）
        const parseNumericValue = (value) => {
            if (value === null || value === undefined || value === '') return NaN;
            let str = value.toString();
            str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
            return parseFloat(str);
        };
        
        let result = 0;
        let count = 0;
        
        if (aggregateFunction === 'avg' || aggregateFunction === 'sum') {
            let sum = 0;
            for (const row of data) {
                const val = parseNumericValue(row[actualValueCol]);
                if (!isNaN(val)) {
                    sum += val;
                    count++;
                }
            }
            result = aggregateFunction === 'avg' ? (count > 0 ? sum / count : 0) : sum;
        } else if (aggregateFunction === 'count') {
            result = data.length;
        }
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const resultType = aggregateFunction === 'avg' ? '平均值' : aggregateFunction === 'sum' ? '总和' : '总数';
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualValueCol || '数据'}${resultType}：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${result.toFixed(2)}</span>
                        </div>
                        <div style="color: #666; font-size: 14px;">
                            基于 ${data.length} 条记录统计
                        </div>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
    }
    
    // ========== 处理分组聚合查询 ===========
    else if (queryType === 'aggregate_groupby') {
        const { groupColumn } = config;
        
        // 找到实际的分组列
        let actualGroupCol = groupColumn;
        if (!headers.includes(groupColumn)) {
            actualGroupCol = headers.find(h => h.includes(groupColumn) || groupColumn.includes(h));
        }
        
        if (!actualGroupCol) {
            throw new Error(`分组列"${groupColumn}"不存在`);
        }
        if (!actualValueCol && aggregateFunction !== 'count') {
            throw new Error(`数值列"${valueColumn}"不存在`);
        }
        
        // 辅助函数：解析数值（处理千分位逗号、货币符号等）
        const parseNumericValue = (value) => {
            if (value === null || value === undefined || value === '') return NaN;
            let str = value.toString();
            str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
            return parseFloat(str);
        };
        
        // 执行分组聚合
        const groups = {};
        for (const row of data) {
            const groupKey = row[actualGroupCol];
            if (!groupKey) continue;
            
            if (!groups[groupKey]) {
                groups[groupKey] = { sum: 0, count: 0 };
            }
            
            if (aggregateFunction !== 'count') {
                const val = parseNumericValue(row[actualValueCol]);
                if (!isNaN(val)) {
                    groups[groupKey].sum += val;
                    groups[groupKey].count++;
                }
            } else {
                groups[groupKey].count++;
            }
        }
        
        // 计算最终结果
        const results = Object.entries(groups).map(([key, vals]) => ({
            group: key,
            value: aggregateFunction === 'avg' ? (vals.count > 0 ? vals.sum / vals.count : 0) :
                   aggregateFunction === 'sum' ? vals.sum : vals.count
        })).sort((a, b) => b.value - a.value);
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const resultType = aggregateFunction === 'avg' ? '平均值' : aggregateFunction === 'sum' ? '总和' : '数量';
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <table class="result-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #667eea; color: white;">
                                    <th style="padding: 10px; text-align: left;">${actualGroupCol}</th>
                                    <th style="padding: 10px; text-align: left;">${actualValueCol || '计数'}${resultType}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${results.map((r, i) => `
                                    <tr style="background: ${i % 2 === 0 ? 'white' : '#f8f9fa'};">
                                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${r.group}</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${r.value.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
    }
    
    // ========== 处理带筛选条件的聚合查询 ===========
    else if (queryType === 'aggregate_filter') {
        const { filterColumn, filterValue } = config;
        
        // 找到实际的筛选列
        let actualFilterCol = filterColumn;
        if (!headers.includes(filterColumn)) {
            actualFilterCol = headers.find(h => h.includes(filterColumn) || filterColumn.includes(h));
        }
        
        if (!actualFilterCol) {
            throw new Error(`筛选列"${filterColumn}"不存在`);
        }
        
        // 执行筛选并统计
        let count = 0;
        const filteredRows = [];
        
        for (const row of data) {
            const cellValue = row[actualFilterCol];
            if (cellValue !== undefined && cellValue !== null) {
                const cellStr = cellValue.toString().toLowerCase();
                const filterStr = filterValue.toString().toLowerCase();
                // 支持包含匹配（如"山东区域"匹配"山东"）
                if (cellStr.includes(filterStr) || filterStr.includes(cellStr)) {
                    count++;
                    filteredRows.push(row);
                }
            }
        }
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>${actualFilterCol}包含"${filterValue}"的记录数：</strong>
                            <span style="color: #667eea; font-size: 24px; font-weight: bold;">${count}</span>
                        </div>
                        <div style="color: #666; font-size: 14px;">
                            基于 ${data.length} 条记录筛选，匹配 ${count} 条
                        </div>
                        ${filteredRows.length > 0 ? `
                        <div style="margin-top: 15px;">
                            <h5 style="margin-bottom: 10px;">匹配记录（前10条）：</h5>
                            <table class="result-table" style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                <thead>
                                    <tr style="background: #667eea; color: white;">
                                        ${headers.map(h => `<th style="padding: 8px; text-align: left;">${h}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredRows.slice(0, 10).map((r, i) => `
                                        <tr style="background: ${i % 2 === 0 ? 'white' : '#f8f9fa'};">
                                            ${headers.map(h => `<td style="padding: 8px; border-bottom: 1px solid #eee;">${r[h] || ''}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
        
        // ========== V5.0修复：更新Agent工作流状态 ==========
        updateAgentWorkflow('execute_query', 'completed');
        updateAgentWorkflow('render_result', 'completed', {
            resultType: 'aggregate_filter',
            count: count
        });
    }
    
    // ========== 处理人员筛选查询（如"谁是广东人"）==========
    else if (queryType === 'filter_people') {
        const { filterColumn, filterValue } = config;
        
        // 找到实际的筛选列
        let actualFilterCol = filterColumn;
        if (!headers.includes(filterColumn)) {
            actualFilterCol = headers.find(h => h.includes(filterColumn) || filterColumn.includes(h));
        }
        
        if (!actualFilterCol) {
            throw new Error(`筛选列"${filterColumn}"不存在`);
        }
        
        // 执行筛选
        const filteredRows = [];
        for (const row of data) {
            const cellValue = row[actualFilterCol];
            if (cellValue !== undefined && cellValue !== null) {
                const cellStr = cellValue.toString().toLowerCase();
                const filterStr = filterValue.toString().toLowerCase();
                // 支持包含匹配（如"广州市"匹配"广东"）
                if (cellStr.includes(filterStr) || filterStr.includes(cellStr)) {
                    filteredRows.push(row);
                }
            }
        }
        
        endOperationTiming();
        
        // 显示结果
        setNLPProgress(90, '正在生成结果...');
        
        const nlpResult = document.getElementById('nlp-result');
        if (nlpResult) {
            const html = `
                <div class="query-results">
                    <div class="result-header">
                        <h4>查询结果：${config.title}</h4>
                        <p>${config.description}</p>
                    </div>
                    <div class="result-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; margin-bottom: 15px;">
                            <strong>找到 ${filteredRows.length} 位${filterValue}人</strong>
                        </div>
                        ${filteredRows.length > 0 ? `
                        <div style="margin-top: 15px;">
                            <table class="result-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #667eea; color: white;">
                                        ${headers.map(h => `<th style="padding: 10px; text-align: left;">${h}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredRows.map((r, i) => `
                                        <tr style="background: ${i % 2 === 0 ? 'white' : '#f8f9fa'};">
                                            ${headers.map(h => `<td style="padding: 10px; border-bottom: 1px solid #eee;">${r[h] || ''}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : '<div style="color: #666;">未找到匹配的记录</div>'}
                    </div>
                </div>
            `;
            nlpResult.innerHTML = html;
            nlpResult.classList.remove('hidden');
        }
        
        // ========== V5.0修复：更新Agent工作流状态 ==========
        updateAgentWorkflow('execute_query', 'completed');
        updateAgentWorkflow('render_result', 'completed', {
            resultType: 'filter_people',
            count: filteredRows.length
        });
    }
    
    // ========== V5.0修复：确保所有查询路径都更新Agent工作流状态 ==========
    // 记录总耗时
    const totalDuration = Date.now() - totalStartTime;
    addProcessingLog('performance', '查询处理完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
    
    // V5.0修复：更新Agent工作流为完成状态（如果还没有更新）
    updateAgentWorkflow('execute_query', 'completed');
    updateAgentWorkflow('render_result', 'completed', {
        resultType: queryType || 'unknown',
        duration: totalDuration
    });
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
}

// V3.0新增：执行大模型生成的查询配置
async function executeLLMQuery(userInput, dataInfo, totalStartTime, config) {
    startOperationTiming('执行大模型查询');
    setNLPProgress(70, '正在执行大模型生成的查询...');
    
    addProcessingLog('info', '执行大模型查询配置', JSON.stringify(config).substring(0, 200));
    
    try {
        const queryType = config.queryType;
        
        // 新增：处理 count_distinct 查询（去重计数）
        if (queryType === 'count_distinct' || queryType === 'count_unique') {
            const column = config.column || config.targetColumn;
            const distinctCount = executeCountDistinct(column);
            
            console.log('[executeLLMQuery] count_distinct 结果:', distinctCount);
            
            // 显示结果
            const nlpResult = document.getElementById('nlp-result');
            const totalTime = Date.now() - totalStartTime;
            
            console.log('[executeLLMQuery] nlpResult 元素:', nlpResult);
            
            nlpResult.innerHTML = `
                <div class="query-result-card">
                    <div class="result-header">
                        <span class="result-icon">📊</span>
                        <span class="result-title">${config.title || `${column}数量统计`}</span>
                    </div>
                    <div class="result-body">
                        <div class="count-result">
                            <div class="count-number">${distinctCount}</div>
                            <div class="count-label">${config.description || `表中${column}的数量（去重后）`}</div>
                        </div>
                    </div>
                    <div class="result-footer">
                        <span class="result-time">查询耗时: ${totalTime}ms</span>
                    </div>
                </div>
            `;
            
            nlpResult.classList.remove('hidden');
            
            console.log('[executeLLMQuery] 已设置 innerHTML 并移除 hidden 类');
            
            endOperationTiming();
            addProcessingLog('success', '去重计数查询完成', `${column}共有 ${distinctCount} 个不同值`);
            
            // ========== V5.0修复：更新Agent工作流状态 ==========
            updateAgentWorkflow('execute_query', 'completed');
            updateAgentWorkflow('render_result', 'completed', {
                resultType: 'count_distinct',
                count: distinctCount
            });
            
            // 隐藏进度条
            setNLPProgress(100, '完成');
            setTimeout(() => {
                hideNLPProgress();
            }, 500);
            return;
        }
        
        // 新增：处理 count_rows 查询（统计数据行数）
        if (queryType === 'count_rows') {
            const rowCount = data.length;
            
            console.log('[executeLLMQuery] count_rows 结果:', rowCount);
            
            // 显示结果
            const nlpResult = document.getElementById('nlp-result');
            const totalTime = Date.now() - totalStartTime;
            
            nlpResult.innerHTML = `
                <div class="query-result-card">
                    <div class="result-header">
                        <span class="result-icon">📊</span>
                        <span class="result-title">${config.title || '数据行数统计'}</span>
                    </div>
                    <div class="result-body">
                        <div class="count-result">
                            <div class="count-number">${rowCount}</div>
                            <div class="count-label">${config.description || `表中共有 ${rowCount} 条数据`}</div>
                        </div>
                    </div>
                    <div class="result-footer">
                        <span class="result-time">查询耗时: ${totalTime}ms</span>
                    </div>
                </div>
            `;
            
            nlpResult.classList.remove('hidden');
            
            endOperationTiming();
            addProcessingLog('success', '数据行数统计完成', `表中共有 ${rowCount} 条数据`);
            
            // ========== V5.0修复：更新Agent工作流状态 ==========
            updateAgentWorkflow('execute_query', 'completed');
            updateAgentWorkflow('render_result', 'completed', {
                resultType: 'count_rows',
                count: rowCount
            });
            
            // 隐藏进度条
            setNLPProgress(100, '完成');
            setTimeout(() => {
                hideNLPProgress();
            }, 500);
            return;
        }
        
        // V4.0修复：优先检查 filter_aggregate，因为它也有 aggregateFunction 属性
        // 必须在 aggregate_overall 之前检查！
        if (queryType === 'filter_aggregate') {
            // V4.0新增：带筛选条件的聚合查询（如"广东省的销售额"）
            // 筛选并聚合，直接使用本地数据计算
            const { filterColumn, filterValue, filterValues, valueColumn, aggregateFunction = 'sum' } = config;
            
            // 获取完整数据
            const allData = dataInfo.data || data;
            const headers = dataInfo.columns;
            
            // 找到实际的筛选列
            let actualFilterCol = filterColumn;
            if (filterColumn && !headers.includes(filterColumn)) {
                actualFilterCol = headers.find(h => h.includes(filterColumn) || filterColumn.includes(h));
            }
            
            // 找到实际的数值列
            let actualValueCol = valueColumn;
            if (valueColumn && !headers.includes(valueColumn)) {
                actualValueCol = headers.find(h => h.includes(valueColumn) || valueColumn.includes(h));
            }
            
            if (!actualFilterCol || !actualValueCol) {
                throw new Error(`筛选列或数值列不存在: ${filterColumn}, ${valueColumn}`);
            }
            
            // 处理单个筛选值或多个筛选值
            const filterValueList = filterValues || (filterValue ? [filterValue] : []);
            
            // 执行筛选并聚合
            let result = 0;
            let count = 0;
            const filteredRows = [];
            
            for (const row of allData) {
                const cellValue = row[actualFilterCol];
                if (cellValue !== undefined && cellValue !== null) {
                    const cellStr = cellValue.toString().toLowerCase();
                    const isMatch = filterValueList.some(fv => {
                        const filterStr = fv.toString().toLowerCase();
                        return cellStr.includes(filterStr) || filterStr.includes(cellStr);
                    });
                    
                    if (isMatch) {
                        count++;
                        const numValue = parseFloat(String(row[actualValueCol] || 0).replace(/,/g, ''));
                        if (!isNaN(numValue)) {
                            result += numValue;
                        }
                        filteredRows.push(row);
                    }
                }
            }
            
            // 根据聚合函数计算最终结果
            let finalResult = result;
            if (aggregateFunction === 'avg' && count > 0) {
                finalResult = result / count;
            }
            
            // 显示结果
            const nlpResult = document.getElementById('nlp-result');
            const totalTime = Date.now() - totalStartTime;
            const filterDesc = filterValueList.map(fv => `"${fv}"`).join(' 或 ');
            const aggDesc = aggregateFunction === 'sum' ? '总和' : aggregateFunction === 'avg' ? '平均值' : '统计';
            
            nlpResult.innerHTML = `
                <div class="query-result-card">
                    <div class="result-header">
                        <span class="result-icon">📊</span>
                        <span class="result-title">${config.title || '查询结果'}</span>
                    </div>
                    <div class="result-body">
                        <div style="padding: 20px; text-align: center;">
                            <div style="font-size: 18px; margin-bottom: 15px; color: white;">
                                <strong>${actualFilterCol}为${filterDesc}时，${actualValueCol}${aggDesc}：</strong>
                            </div>
                            <div style="color: white; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${finalResult.toFixed(2)}</div>
                            <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 10px;">
                                基于 ${allData.length} 条记录筛选，匹配 ${count} 条
                            </div>
                        </div>
                    </div>
                    <div class="result-footer">
                        <span class="result-time">查询耗时: ${totalTime}ms</span>
                    </div>
                </div>
            `;
            
            nlpResult.classList.remove('hidden');
            
            endOperationTiming();
            addProcessingLog('success', '筛选聚合查询完成', `${actualFilterCol}=${filterDesc}, ${actualValueCol}${aggDesc}=${finalResult.toFixed(2)}`);
            
            // ========== V5.0修复：更新Agent工作流状态 ==========
            updateAgentWorkflow('execute_query', 'completed');
            updateAgentWorkflow('render_result', 'completed', {
                resultType: 'filter_aggregate',
                value: finalResult.toFixed(2),
                method: 'llm'
            });
            
            setNLPProgress(100, '完成');
            setTimeout(() => {
                hideNLPProgress();
            }, 500);
            return;
        } else if (queryType === 'aggregate_groupby' || config.groupByColumn || config.groupColumn) {
            // 分组聚合查询（如：按省公司统计平均值）
            await executeLocalQuery(userInput, dataInfo, totalStartTime, {
                queryType: 'aggregate_groupby',
                groupColumn: config.groupByColumn || config.groupColumn,
                valueColumn: config.valueColumn || config.targetColumn,
                aggregateFunction: config.aggregateFunction || 'avg',
                title: config.title || '分组统计',
                description: config.description || '分组聚合统计'
            });
        } else if (queryType === 'aggregate_overall' || (config.aggregateFunction && !config.filterColumn)) {
            // 整体聚合查询（如：计算所有数据的平均值）
            // V4.0修复：添加 !config.filterColumn 条件，避免与 filter_aggregate 冲突
            await executeLocalQuery(userInput, dataInfo, totalStartTime, {
                queryType: 'aggregate_overall',
                valueColumn: config.valueColumn || config.targetColumn,
                aggregateFunction: config.aggregateFunction,
                title: config.title || '统计结果',
                description: config.description || '聚合统计'
            });
        } else if (queryType === 'filter' || config.filters) {
            // 筛选查询
            if (config.filters && config.filters.length > 0) {
                const filter = config.filters[0];
                await executeLocalQuery(userInput, dataInfo, totalStartTime, {
                    queryType: 'aggregate_filter',
                    filterColumn: filter.column,
                    filterValue: filter.value,
                    title: config.title || '筛选结果',
                    description: config.description || '数据筛选'
                });
            }
        } else {
            // 默认使用本地查询处理
            await executeLocalQuery(userInput, dataInfo, totalStartTime, config);
        }
        
        endOperationTiming();
        addProcessingLog('success', '大模型查询执行完成');
        
        // ========== V5.0修复：更新Agent工作流状态 ==========
        updateAgentWorkflow('execute_query', 'completed');
        updateAgentWorkflow('render_result', 'completed', {
            resultType: queryType || 'llm_query',
            method: 'llm'
        });
        
    } catch (error) {
        addProcessingLog('error', '执行大模型查询失败', error.message);
        // V5.0修复：更新Agent工作流为失败状态
        updateAgentWorkflow('execute_query', 'error', { error: error.message });
        throw error;
    }
}

// 增强复合查询处理
async function enhanceComplexQueryHandling(userInput, dataInfo) {
    const lowerInput = userInput.toLowerCase();
    const columns = dataInfo.columns;
    
    console.log('enhanceComplexQueryHandling - 处理查询:', userInput, '列:', columns);
    
    // 检测"哪个...最大/最高/最多"模式
    const maxPatterns = [
        /哪个(.+?)最(大|高|多)/,
        /哪些(.+?)最(大|高|多)/,
        /(.+?)(最多|最大|最高)/,
        /找出最(大|高|多)的(.+?)/
    ];
    
    let matched = false;
    let groupColumn = null;
    let valueColumn = null;
    
    for (const pattern of maxPatterns) {
        const match = lowerInput.match(pattern);
        if (match) {
            matched = true;
            const queryText = (match[1] || match[2] || '').trim();
            console.log('匹配到查询模式:', pattern, '查询文本:', queryText);
            
            // 智能列名匹配逻辑
            for (const col of columns) {
                const colLower = col.toLowerCase();
                
                // 1. 首先检查查询文本中是否包含列名
                if (queryText && queryText.includes(colLower)) {
                    console.log('查询文本匹配到列名:', col);
                    // 判断这是分组列还是数值列
                    if (colLower.includes('区域') || colLower.includes('地区') || colLower.includes('省') || 
                        colLower.includes('市') || colLower.includes('城市') || colLower.includes('产品') ||
                        colLower.includes('类别')) {
                        groupColumn = col;
                    } else if (colLower.includes('销售') || colLower.includes('金额') || colLower.includes('收入') ||
                              colLower.includes('数') || colLower.includes('额') || colLower.includes('价')) {
                        valueColumn = col;
                    } else {
                        // 不确定的类型，先作为分组列
                        groupColumn = col;
                    }
                }
                
                // 2. 检查完整输入中是否包含列名
                if (lowerInput.includes(colLower) && !colLower.includes('哪个') && !colLower.includes('最大')) {
                    console.log('完整输入匹配到列名:', col);
                    if (!valueColumn && (colLower.includes('销售') || colLower.includes('金额') || 
                                         colLower.includes('收入') || colLower.includes('价'))) {
                        valueColumn = col;
                    }
                    if (!groupColumn && (colLower.includes('区域') || colLower.includes('地区') || 
                                        colLower.includes('产品') || colLower.includes('类别'))) {
                        groupColumn = col;
                    }
                }
            }
            
            // 3. 如果没有找到分组列，但查询类型是"哪个X最大"，那么X就是分组列
            if (!groupColumn && queryText) {
                // 尝试从查询文本中提取可能的列名关键词
                const categoryKeywords = ['区域', '地区', '产品', '类别', '部门', '省', '市'];
                for (const keyword of categoryKeywords) {
                    if (queryText.includes(keyword)) {
                        // 尝试在列名中查找包含该关键词的列
                        const matchedCol = columns.find(c => c.includes(keyword));
                        if (matchedCol) {
                            groupColumn = matchedCol;
                            console.log('通过关键词找到分组列:', keyword, '->', groupColumn);
                            break;
                        }
                    }
                }
            }
            
            break;
        }
    }
    
    if (!matched) {
        // 检测极值类型查询
        const extremePatterns = [
            /最大(.+?)$/,
            /最高(.+?)$/,
            /最多(.+?)$/,
            /最小值$/,
            /最低$/,
            /最少$/
        ];
        
        for (const pattern of extremePatterns) {
            if (pattern.test(lowerInput)) {
                matched = true;
                
                // 尝试从输入中提取列名
                for (const col of columns) {
                    if (lowerInput.includes(col.toLowerCase()) && !col.toLowerCase().includes('哪个')) {
                        if (!valueColumn && (col.toLowerCase().includes('销售') || col.toLowerCase().includes('数') || 
                                             col.toLowerCase().includes('额') || col.toLowerCase().includes('价'))) {
                            valueColumn = col;
                        }
                        if (!groupColumn && !col.toLowerCase().includes('销售') && !col.toLowerCase().includes('数')) {
                            groupColumn = col;  // 假设其他列为分组列
                        }
                    }
                }
                break;
            }
        }
    }
    
    if (!matched) {
        console.log('未匹配到复合查询模式');
        return null;
    }
    
    console.log('初步匹配结果:', { groupColumn, valueColumn, columns });
    
    // 如果没有自动匹配到数值列，尝试常用数值列名
    if (!valueColumn) {
        const numericCols = ['销售额', '收入', '金额', '数量', '价格', '数值', '值', '金额'];
        for (const colName of numericCols) {
            for (const col of columns) {
                if (col.includes(colName)) {
                    valueColumn = col;
                    console.log('通过常用数值列名找到:', colName, '->', col);
                    break;
                }
            }
            if (valueColumn) break;
        }
    }
    
    // 如果没有自动匹配到分组列，尝试常用分组列名
    if (!groupColumn) {
        const categoricalCols = ['区域', '地区', '省', '市', '城市', '产品', '类别', '类型', '部门', '年份'];
        for (const colName of categoricalCols) {
            for (const col of columns) {
                if (col.includes(colName)) {
                    groupColumn = col;
                    console.log('通过常用分组列名找到:', colName, '->', col);
                    break;
                }
            }
            if (groupColumn) break;
        }
    }
    
    // 如果仍然没有分组列，尝试第一个非数值列作为分组列
    if (!groupColumn && columns.length > 0) {
        for (const col of columns) {
            const colLower = col.toLowerCase();
            if (!colLower.includes('销售') && !colLower.includes('金额') && !colLower.includes('收入') &&
                !colLower.includes('价') && !colLower.includes('数') && !colLower.includes('额')) {
                groupColumn = col;
                console.log('使用第一个非数值列作为分组列:', col);
                break;
            }
        }
    }
    
    // 如果仍然没有数值列，尝试第一个数值类型的列
    if (!valueColumn && columns.length > 0) {
        for (const col of columns) {
            const colLower = col.toLowerCase();
            if (colLower.includes('销售') || colLower.includes('金额') || colLower.includes('收入') ||
                colLower.includes('价') || colLower.includes('数') || colLower.includes('额')) {
                valueColumn = col;
                console.log('使用第一个数值类型列作为数值列:', col);
                break;
            }
        }
    }
    
    // 最后回退：如果还没有找到，使用第一列
    if (!valueColumn && columns.length > 0) {
        valueColumn = columns[0];
        console.log('回退使用第一列作为数值列:', columns[0]);
    }
    
    console.log('最终匹配结果:', { groupColumn, valueColumn });
    
    // 确保至少有一列匹配
    if (!groupColumn && !valueColumn) {
        console.log('未能匹配到任何列');
        return null;
    }
    
    // 检查是否包含最大/最高/最多关键词
    const hasMax = lowerInput.includes('最大') || lowerInput.includes('最高') || lowerInput.includes('最多');
    
    // 如果没有分组列，使用查找最大/最小值查询
    if (!groupColumn) {
        console.log('无分组列，使用find_max/find_min查询');
        return {
            queryType: hasMax ? 'find_max' : 'find_min',
            valueColumn: valueColumn || columns[0],
            title: `查找${valueColumn || columns[0]}的${hasMax ? '最大值' : '最小值'}`,
            description: `查找${hasMax ? '最大' : '最小'}的${valueColumn || columns[0]}值`
        };
    }
    
    console.log('使用group_aggregate_find查询:', { groupColumn, valueColumn });
    
    // 如果有分组列和数值列，使用分组聚合查找查询
    return {
        queryType: 'group_aggregate_find',
        groupColumn: groupColumn,
        valueColumn: valueColumn || groupColumn,  // 如果没有数值列，使用分组列作为数值列（计数）
        title: `查找${groupColumn}中${valueColumn ? valueColumn : '数量'}最${hasMax ? '大' : '小'}的项`,
        description: `按${groupColumn}分组，查找${valueColumn ? valueColumn : '数量'}最${hasMax ? '大' : '小'}的${groupColumn}`
    };
}

// 尝试本地生成图表配置（无需调用大模型）
async function tryGenerateChartConfigLocally(userInput, dataInfo, detailedIntent = null, entityExtractionResult = null) {
    const lowerInput = userInput.toLowerCase();
    const columns = dataInfo.columns;
    
    console.log('尝试本地生成图表配置:', { userInput: lowerInput, columns, detailedIntent, entityExtractionResult });
    
    // ========== V5.0新增：调用后端查询配置生成API ==========
    try {
        addProcessingLog('info', 'V5.0新功能', '正在调用智能查询配置生成服务...');
        console.log('V5.0 API调用参数:', {
            user_input: userInput,
            columns: columns,
            data_preview: dataInfo.sampleData || []
        });
    console.log('V5.0 API调用参数 - columns详细信息:', columns);
        
        // 修复：使用API_BASE_URL，确保跨协议请求正常工作
        const apiUrl = `${API_BASE_URL}/api/v1/query/generate-config`;
        console.log('V5.0 API调用URL:', apiUrl);
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_input: userInput,
                    columns: columns,
                    data_preview: dataInfo.sampleData || []
                }),
                // 允许跨域请求
                credentials: 'include',
                // 超时设置
                signal: AbortSignal.timeout(5000)
            });
            
            console.log('V5.0 API响应状态:', response.status);
            console.log('V5.0 API响应头:', response.headers);
            
            if (response.ok) {
                const result = await response.json();
                console.log('V5.0 API响应内容:', result);
                
                // 修复：检查result.configs是否存在，即使没有status字段
                if (result.configs && result.configs.length > 0) {
                    console.log('V5.0后端API生成配置成功:', result.configs);
                    addProcessingLog('success', 'V5.0智能配置生成成功', 
                        `生成 ${result.configs.length} 个配置任务, 方法: ${result.method || 'local_rules'}`);
                    
                    // V5.0新增：检查是否需要追问
                    const needsClarificationConfig = result.configs.find(config => config.needsClarification === true);
                    if (needsClarificationConfig) {
                        console.log('V5.0 需要追问用户:', needsClarificationConfig);
                        addProcessingLog('info', '需要追问用户', needsClarificationConfig.message);
                        
                        // 触发追问机制
                        return {
                            needsClarification: true,
                            clarificationType: needsClarificationConfig.clarificationType,
                            mentionedColumn: needsClarificationConfig.mentionedColumn,
                            availableDimensions: needsClarificationConfig.availableDimensions,
                            chartType: needsClarificationConfig.chartType,
                            message: needsClarificationConfig.message,
                            description: needsClarificationConfig.description
                        };
                    }
                    
                    // 检查配置是否包含乱码
                    const hasGarbageData = result.configs.some(config => {
                        if (config.type === 'filter_aggregate') {
                            return config.filterColumn === '??' || config.valueColumn === '??';
                        } else if (config.type === 'aggregate') {
                            return config.aggregations[0].column === '??' || config.aggregations[0].group_by === '??';
                        } else if (config.type === 'chart') {
                            return config.xAxisColumn === '??' || config.yAxisColumn === '??';
                        }
                        return false;
                    });
                    
                    if (hasGarbageData) {
                        console.log('V5.0 API返回乱码配置，使用本地匹配');
                        addProcessingLog('warning', 'V5.0智能配置生成失败', '返回乱码配置，使用本地匹配');
                    } else {
                        // 转换配置格式以兼容现有代码
                        const convertedConfigs = result.configs.map(config => {
                            // ========== V5.0修复：处理filter_aggregate类型 ==========
                            if (config.type === 'filter_aggregate') {
                                return {
                                    queryType: 'filter_aggregate',
                                    filterColumn: config.filterColumn,
                                    filterValue: config.filterValue,
                                    filterValues: config.filterValues,
                                    valueColumn: config.valueColumn,
                                    aggregateFunction: config.aggregateFunction,
                                    title: config.title,
                                    description: config.description
                                };
                            } else if (config.type === 'aggregate') {
                                return {
                                    queryType: 'aggregate',
                                    aggregateFunction: config.aggregations[0].operation,
                                    valueColumn: config.aggregations[0].column,
                                    groupColumn: config.aggregations[0].group_by,
                                    description: config.description
                                };
                            } else if (config.type === 'filter') {
                                return {
                                    queryType: 'filter',
                                    conditions: config.conditions,
                                    description: config.description
                                };
                            } else if (config.type === 'sort') {
                                return {
                                    queryType: 'sort',
                                    sortColumn: config.column,
                                    sortOrder: config.order,
                                    description: config.description
                                };
                            } else if (config.type === 'chart') {
                                // V5.0新增：处理图表配置（包含排序参数）
                                return {
                                    chartType: config.chartType,
                                    xAxisColumn: config.xAxisColumn,
                                    yAxisColumn: config.yAxisColumn,
                                    labelColumn: config.labelColumn,
                                    valueColumn: config.valueColumn,
                                    title: config.title,
                                    description: config.description,
                                    aggregateFunction: config.aggregateFunction || 'sum',
                                    sortOrder: config.sortOrder || null,
                                    sortBy: config.sortBy || null
                                };
                            }
                            return config;
                        }).filter(config => config.chartType || config.queryType); // 保留chart类型和queryType类型的配置

                        // 如果没有chart类型的配置，尝试从聚合配置生成图表配置
                        if (convertedConfigs.length === 0) {
                            const aggregateConfig = result.configs.find(config => config.type === 'aggregate');
                            if (aggregateConfig) {
                                const aggregation = aggregateConfig.aggregations[0];
                                // 确保xAxisColumn和yAxisColumn是有效的列名
                                let xAxisColumn = aggregation.group_by;
                                let yAxisColumn = aggregation.column;
                                
                                // 如果group_by是无效的，使用columns中的第一个列
                                if (!xAxisColumn || xAxisColumn === '??' || xAxisColumn === '???') {
                                    xAxisColumn = columns[0] || '地区';
                                }
                                
                                // 如果column是无效的，使用columns中的第二个列或第一个列
                                if (!yAxisColumn || yAxisColumn === '??' || yAxisColumn === '???') {
                                    yAxisColumn = columns[1] || columns[0] || '销售额';
                                }
                                
                                // 检测排序需求
                                const hasSortDesc = /从高到低|从大到小|降序|倒序|排序.*高|排序.*大/.test(userInput);
                                const hasSortAsc = /从低到高|从小到大|升序|正序|排序.*低|排序.*小/.test(userInput);
                                const sortOrder = hasSortDesc ? 'desc' : (hasSortAsc ? 'asc' : null);
                                
                                convertedConfigs.push({
                                    chartType: 'bar',
                                    xAxisColumn: xAxisColumn,
                                    yAxisColumn: yAxisColumn,
                                    labelColumn: xAxisColumn,
                                    valueColumn: yAxisColumn,
                                    title: `各${xAxisColumn}的${yAxisColumn}${sortOrder ? (sortOrder === 'desc' ? '从高到低' : '从低到高') : ''}`,
                                    description: `${aggregation.operation}图表: 显示${xAxisColumn}的${yAxisColumn}分布${sortOrder ? (sortOrder === 'desc' ? '（从高到低排序）' : '（从低到高排序）') : ''}`,
                                    aggregateFunction: aggregation.operation,
                                    sortOrder: sortOrder,
                                    sortBy: null
                                });
                            }
                        }
                        
                        // 更新Agent工作流可视化
                        updateAgentWorkflow('generate_config', 'completed', {
                            configs: result.configs,
                            method: result.method || 'local_rules'
                        });
                        
                        return convertedConfigs;
                    }
                } else {
                    console.log('V5.0 API响应格式不正确:', result);
                    addProcessingLog('warning', 'V5.0智能配置生成失败', '响应格式不正确');
                }
            } else {
                console.log('V5.0 API响应失败:', response.status, response.statusText);
                addProcessingLog('warning', 'V5.0智能配置生成失败', `API响应失败: ${response.status}`);
            }
        } catch (error) {
            console.error('V5.0后端API调用失败:', error);
            addProcessingLog('warning', 'V5.0智能配置生成失败', `调用失败: ${error.message}`);
        }
    } catch (error) {
        console.error('V5.0智能配置生成过程出错:', error);
        addProcessingLog('warning', 'V5.0智能配置生成失败', `过程出错: ${error.message}`);
    }
    
    // ========== 第零层：使用QueryConfigGenerator（基于意图类型）==========
    // 如果有详细的意图类型，优先使用queryConfigGenerator生成配置
    if (detailedIntent) {
        try {
            // 添加时间戳参数防止缓存
            const cacheBuster = `?v=${Date.now()}`;
            const { default: queryConfigGenerator } = await import(`./js/queryConfigGenerator.js${cacheBuster}`);
            // V4.0优化：传递实体提取结果，支持高置信度筛选查询
            const config = queryConfigGenerator.generateConfig(detailedIntent, userInput, columns, entityExtractionResult);
            
            if (config) {
                console.log('QueryConfigGenerator生成配置成功:', config);
                addProcessingLog('success', '查询配置生成成功', 
                    `意图: ${detailedIntent}, 配置类型: ${config.chartType || config.queryType}, 耗时: <10ms`);
                
                // 根据配置类型返回不同格式
                // 注意：优先检查aggregateFunction，因为复合查询同时有queryType和aggregateFunction
                if (config.chartType) {
                    // V5.0修复：优先使用对话管理器传来的排序配置
                    let sortOrder = config.sortOrder || null;
                    let sortBy = config.sortBy || null;
                    
                    // 如果没有从配置中获取到排序信息，则重新检测
                    if (!sortOrder) {
                        const hasSortDesc = /从高到低|从大到小|降序|倒序|排序.*高|排序.*大/.test(userInput);
                        const hasSortAsc = /从低到高|从小到大|升序|正序|排序.*低|排序.*小/.test(userInput);
                        sortOrder = hasSortDesc ? 'desc' : (hasSortAsc ? 'asc' : null);
                    }
                    
                    return [{
                        chartType: config.chartType,
                        xAxisColumn: config.xAxisColumn,
                        yAxisColumn: config.yAxisColumn,
                        labelColumn: config.labelColumn,
                        valueColumn: config.valueColumn,
                        title: config.title,
                        description: config.description,
                        aggregateFunction: config.aggregateFunction || 'sum',
                        sortOrder: sortOrder,
                        sortBy: sortBy
                    }];
                } else if (config.aggregateFunction) {
                    // 聚合查询配置（优先于普通查询，因为复合查询也有queryType）
                    return [config];
                } else if (config.queryType) {
                    // 查询配置 - 直接返回配置对象
                    return [config];
                }
            } else {
                console.log('QueryConfigGenerator无法生成配置，尝试其他匹配方式');
            }
        } catch (error) {
            console.warn('QueryConfigGenerator加载失败:', error);
        }
    }
    
    // ========== 第一层：使用智能意图匹配器（基于语义相似度）==========
    try {
        const { default: smartIntentMatcher } = await import('./js/smartIntentMatcher.js');
        const matchResult = smartIntentMatcher.match(userInput, columns);
        
        if (matchResult.matched) {
            console.log('智能意图匹配成功:', matchResult);
            addProcessingLog('success', '智能意图匹配成功', 
                `匹配模板: ${matchResult.template.name}, 耗时: ${matchResult.responseTime.toFixed(0)}ms`);
            
            return matchResult.config;
        } else {
            console.log('智能意图匹配失败');
        }
    } catch (error) {
        console.warn('智能意图匹配器加载失败:', error);
    }
    
    // ========== 第二层：使用旧的意图库匹配（兼容性）==========
    try {
        const { default: intentLibrary } = await import('./js/intentLibrary.js');
        const matchResult = intentLibrary.matchIntent(userInput, columns);
        
        if (matchResult.matched) {
            console.log('意图库匹配成功:', matchResult);
            addProcessingLog('success', '意图库匹配成功', 
                `匹配模板: ${matchResult.template.name}, 相似度: ${(matchResult.score * 100).toFixed(1)}%, 耗时: ${matchResult.responseTime.toFixed(0)}ms`);
            
            const config = intentLibrary.generateChartConfig(matchResult, userInput);
            if (config) {
                return config;
            }
        } else {
            console.log('意图库未匹配，相似度:', matchResult.score);
        }
    } catch (error) {
        console.warn('意图库加载失败:', error);
    }
    
    // 检查排序需求
    const hasSortDesc = /从高到低|从大到小|降序|倒序|排序.*高|排序.*大/.test(userInput);
    const hasSortAsc = /从低到高|从小到大|升序|正序|排序.*低|排序.*小/.test(userInput);
    const sortOrder = hasSortDesc ? 'desc' : (hasSortAsc ? 'asc' : null);
    
    // ========== 第三层：使用正则规则匹配 ==========
    // 规则1: 按XX的YY平均值绘制柱状图
    // 匹配模式: 按{分组列}的{数值列}平均值...绘制柱状图
    // 支持中间有括号内容的情况："按省公司的险情确认时长平均值（需要将单位从秒转换为分钟，保留2位小数）绘制柱状图"
    const avgBarPattern = /按(.+?)的(.+?)平均值[\s\S]*?绘制柱状图|按(.+?)统计(.+?)平均值[\s\S]*?柱状图/;
    const avgMatch = lowerInput.match(avgBarPattern);
    console.log('规则1匹配结果:', avgMatch);
    
    if (avgMatch) {
        const groupCol = (avgMatch[1] || avgMatch[3]).trim();
        const valueCol = (avgMatch[2] || avgMatch[4]).trim();
        
        console.log('提取的列名:', { groupCol, valueCol });
        
        // 查找匹配的列名（模糊匹配）
        const actualGroupCol = columns.find(c => {
            const lowerC = c.toLowerCase();
            const lowerGroup = groupCol.toLowerCase();
            return lowerC.includes(lowerGroup) || lowerGroup.includes(lowerC);
        });
        const actualValueCol = columns.find(c => {
            const lowerC = c.toLowerCase();
            const lowerValue = valueCol.toLowerCase();
            return lowerC.includes(lowerValue) || lowerValue.includes(lowerC);
        });
        
        console.log('匹配的列名:', { actualGroupCol, actualValueCol });
        
        if (actualGroupCol && actualValueCol) {
            // 检查是否需要单位转换
            let dataTransform = null;
            if (lowerInput.includes('秒') && lowerInput.includes('分钟')) {
                dataTransform = {
                    formula: 'value / 60',
                    decimalPlaces: 2,
                    unitConversion: { from: 'second', to: 'minute' }
                };
            }
            
            return [{
                chartType: 'bar',
                xAxisColumn: actualGroupCol,
                yAxisColumn: actualValueCol,
                title: `各省公司${actualValueCol}平均值`,
                description: `按照${actualGroupCol}统计的${actualValueCol}平均值`,
                aggregateFunction: 'avg',
                sortOrder: sortOrder || 'desc',
                dataTransform: dataTransform
            }];
        }
    }
    
    // 规则2: 按XX统计YY绘制柱状图（默认sum）
    const sumBarPattern = /按(.+?)统计(.+?).*绘制柱状图|按(.+?)分组统计(.+?).*柱状图/;
    const sumMatch = lowerInput.match(sumBarPattern);
    if (sumMatch) {
        const groupCol = sumMatch[1] || sumMatch[3];
        const valueCol = sumMatch[2] || sumMatch[4];
        
        const actualGroupCol = columns.find(c => c.includes(groupCol) || groupCol.includes(c));
        const actualValueCol = columns.find(c => c.includes(valueCol) || valueCol.includes(c));
        
        if (actualGroupCol && actualValueCol) {
            return [{
                chartType: 'bar',
                xAxisColumn: actualGroupCol,
                yAxisColumn: actualValueCol,
                title: `按${actualGroupCol}统计${actualValueCol}`,
                description: `按照${actualGroupCol}分组统计${actualValueCol}`,
                aggregateFunction: 'sum',
                sortOrder: sortOrder || 'desc',
                dataTransform: null
            }];
        }
    }
    
    // 规则3: 排序需求（与之前的图表请求关联）
    if (contextManager.hasRecentChartRequest() && sortOrder) {
        // 尝试从历史记录中提取最近的图表请求信息
        const recentChartRequest = contextManager.history.find(item => 
            item.type === 'user' && /柱状图|条形图|饼图|折线图|图表|可视化/.test(item.content)
        );
        
        if (recentChartRequest) {
            // 分析最近的图表请求
            const chartRequest = recentChartRequest.content;
            
            // 尝试提取图表类型和列信息
            let chartType = 'bar'; // 默认柱状图
            let groupCol = null;
            let valueCol = null;
            
            // 匹配柱状图请求
            const barMatch = chartRequest.match(/(柱状图|条形图)/);
            if (barMatch) {
                chartType = 'bar';
                
                // 尝试提取分组列和数值列
                const groupMatch = chartRequest.match(/按(.+?)统计|按(.+?)的/);
                if (groupMatch) {
                    groupCol = (groupMatch[1] || groupMatch[2]).trim();
                }
                
                const valueMatch = chartRequest.match(/统计(.+?)|的(.+?)(?:平均值|总和|数量)/);
                if (valueMatch) {
                    valueCol = (valueMatch[1] || valueMatch[2]).trim();
                }
            }
            
            // 查找匹配的列名
            let actualGroupCol = null;
            let actualValueCol = null;
            
            if (groupCol) {
                actualGroupCol = columns.find(c => {
                    const lowerC = c.toLowerCase();
                    const lowerGroup = groupCol.toLowerCase();
                    return lowerC.includes(lowerGroup) || lowerGroup.includes(lowerC);
                });
            }
            
            if (valueCol) {
                actualValueCol = columns.find(c => {
                    const lowerC = c.toLowerCase();
                    const lowerValue = valueCol.toLowerCase();
                    return lowerC.includes(lowerValue) || lowerValue.includes(lowerC);
                });
            }
            
            // 如果没有找到列，尝试自动匹配
            if (!actualGroupCol && columns.length > 0) {
                // 尝试找到分类列
                const categoryKeywords = ['地区', '省份', '省', '城市', '产品', '类别', '类型'];
                actualGroupCol = columns.find(c => {
                    const lowerC = c.toLowerCase();
                    return categoryKeywords.some(keyword => lowerC.includes(keyword));
                }) || columns[0];
            }
            
            if (!actualValueCol && columns.length > 1) {
                // 尝试找到数值列
                const numericKeywords = ['销售额', '金额', '数量', '数值', '价格', '成本'];
                actualValueCol = columns.find(c => {
                    const lowerC = c.toLowerCase();
                    return numericKeywords.some(keyword => lowerC.includes(keyword));
                }) || columns[1];
            }
            
            if (actualGroupCol && actualValueCol) {
                addProcessingLog('success', '基于历史上下文生成排序图表配置', 
                    `图表类型: ${chartType}, 分组列: ${actualGroupCol}, 数值列: ${actualValueCol}, 排序: ${sortOrder}`);
                
                return [{
                    chartType: chartType,
                    xAxisColumn: actualGroupCol,
                    yAxisColumn: actualValueCol,
                    title: `按${actualValueCol}${sortOrder === 'desc' ? '从高到低' : '从低到高'}排序的${chartType}`,
                    description: `按照${actualValueCol}${sortOrder === 'desc' ? '从高到低' : '从低到高'}排序的${actualGroupCol}${chartType}`,
                    aggregateFunction: 'sum',
                    sortOrder: sortOrder,
                    dataTransform: null
                }];
            }
        }
    }
    
    // 规则4: 单独的排序需求（没有历史图表请求）
    if (sortOrder) {
        // 尝试自动匹配列名
        let actualGroupCol = null;
        let actualValueCol = null;
        
        // 从用户输入中提取排序列
        const sortColumnMatch = userInput.match(/按照(.+?)排序/);
        let sortColumn = sortColumnMatch ? sortColumnMatch[1].trim() : '销售额';
        
        // 尝试找到分类列
        if (columns.length > 0) {
            const categoryKeywords = ['地区', '省份', '省', '城市', '产品', '类别', '类型'];
            actualGroupCol = columns.find(c => {
                const lowerC = c.toLowerCase();
                return categoryKeywords.some(keyword => lowerC.includes(keyword));
            });
        }
        
        // 尝试找到数值列（优先使用排序列）
        if (columns.length > 0) {
            actualValueCol = columns.find(c => {
                const lowerC = c.toLowerCase();
                const lowerSort = sortColumn.toLowerCase();
                return lowerC.includes(lowerSort) || lowerSort.includes(lowerC);
            });
            
            // 如果没有找到，尝试使用常见的数值列
            if (!actualValueCol) {
                const numericKeywords = ['销售额', '金额', '数量', '数值', '价格', '成本'];
                actualValueCol = columns.find(c => {
                    const lowerC = c.toLowerCase();
                    return numericKeywords.some(keyword => lowerC.includes(keyword));
                });
            }
        }
        
        // 如果没有找到合适的分类列或数值列，返回需要追问的配置
        if (!actualGroupCol || !actualValueCol) {
            addProcessingLog('info', '需要追问用户', '无法自动匹配分类列或数值列');
            return {
                needsClarification: true,
                clarificationType: 'dimension',
                mentionedColumn: sortColumn,
                availableDimensions: columns,
                chartType: 'bar',
                message: `您想按哪一列来分组显示${sortColumn}？`,
                description: '需要用户指定分组维度'
            };
        }
        
        // 找到合适的列，生成图表配置
        addProcessingLog('success', '基于排序需求生成图表配置', 
            `图表类型: bar, 分组列: ${actualGroupCol}, 数值列: ${actualValueCol}, 排序: ${sortOrder}`);
        
        return [{
            chartType: 'bar',
            xAxisColumn: actualGroupCol,
            yAxisColumn: actualValueCol,
            title: `按${actualValueCol}${sortOrder === 'desc' ? '从高到低' : '从低到高'}排序的柱状图`,
            description: `按照${actualValueCol}${sortOrder === 'desc' ? '从高到低' : '从低到高'}排序的${actualGroupCol}柱状图`,
            aggregateFunction: 'sum',
            sortOrder: sortOrder,
            dataTransform: null
        }];
    }
    
    // 规则3: XX的占比/分布饼图
    const piePattern = /(.+?)的占比|(.+?)的分布|按(.+?)统计.*饼图/;
    const pieMatch = lowerInput.match(piePattern);
    if (pieMatch && (lowerInput.includes('饼图') || lowerInput.includes('占比'))) {
        const col = pieMatch[1] || pieMatch[2] || pieMatch[3];
        const actualCol = columns.find(c => c.includes(col) || col.includes(c));
        
        if (actualCol) {
            return [{
                chartType: 'pie',
                labelColumn: actualCol,
                valueColumn: null,  // 计数
                title: `${actualCol}分布`,
                description: `${actualCol}的占比分布`,
                aggregateFunction: 'count',
                sortOrder: 'desc',
                dataTransform: null
            }];
        }
    }
    
    // V4.1新增：支持"各XX的YY饼图"模式（如"各个产品的销售额饼图"）
    const pieGroupValuePattern = /各(?:个)?(.+?)的(.+?)饼图|(.+?)的(.+?)饼图/;
    const pieGroupMatch = lowerInput.match(pieGroupValuePattern);
    if (pieGroupMatch && lowerInput.includes('饼图')) {
        // 尝试提取分组列和数值列
        let groupCol, valueCol;
        
        if (pieGroupMatch[1] && pieGroupMatch[2]) {
            // 匹配到"各XX的YY饼图"
            groupCol = pieGroupMatch[1].trim();
            valueCol = pieGroupMatch[2].trim();
        } else if (pieGroupMatch[3] && pieGroupMatch[4]) {
            // 匹配到"XX的YY饼图"
            groupCol = pieGroupMatch[3].trim();
            valueCol = pieGroupMatch[4].trim();
        }
        
        console.log('V4.1饼图模式匹配:', { groupCol, valueCol, columns });
        
        // 在列中查找匹配
        const actualGroupCol = columns.find(c => {
            const lowerC = c.toLowerCase();
            const lowerGroup = groupCol.toLowerCase();
            return lowerC.includes(lowerGroup) || lowerGroup.includes(lowerC);
        });
        
        const actualValueCol = columns.find(c => {
            const lowerC = c.toLowerCase();
            const lowerValue = valueCol.toLowerCase();
            return lowerC.includes(lowerValue) || lowerValue.includes(lowerC);
        });
        
        console.log('匹配的列:', { actualGroupCol, actualValueCol });
        
        if (actualGroupCol && actualValueCol) {
            addProcessingLog('success', 'V4.1本地生成饼图配置成功', 
                `分组: ${actualGroupCol}, 数值: ${actualValueCol}`);
            return [{
                chartType: 'pie',
                labelColumn: actualGroupCol,
                valueColumn: actualValueCol,
                title: `${actualGroupCol}的${actualValueCol}分布`,
                description: `按${actualGroupCol}分组统计${actualValueCol}的饼图`,
                aggregateFunction: 'sum',
                sortOrder: 'desc',
                dataTransform: null
            }];
        }
    }
    
    // V4.1新增：简单饼图模式（只有饼图关键词，自动选择分类列）
    if (lowerInput.includes('饼图') || lowerInput.includes('饼状图') || lowerInput.includes('圆形图')) {
        // 自动寻找合适的分类列（产品、地区、省份等）
        const categoricalKeywords = ['产品', '地区', '省份', '省', '城市', '类别', '类型', '分组'];
        let bestGroupCol = null;
        
        for (const keyword of categoricalKeywords) {
            const matched = columns.find(c => c.includes(keyword));
            if (matched) {
                bestGroupCol = matched;
                break;
            }
        }
        
        // 如果没有找到分类列，使用第一个非数值列
        if (!bestGroupCol && columns.length > 0) {
            bestGroupCol = columns[0];
        }
        
        // 自动寻找数值列（销售额、数量、金额等）
        const numericKeywords = ['销售额', '金额', '数量', '数值', '价格', '成本'];
        let bestValueCol = null;
        
        for (const keyword of numericKeywords) {
            const matched = columns.find(c => c.includes(keyword));
            if (matched) {
                bestValueCol = matched;
                break;
            }
        }
        
        if (bestGroupCol) {
            addProcessingLog('info', 'V4.1自动匹配饼图配置', 
                `分组: ${bestGroupCol}${bestValueCol ? ', 数值: ' + bestValueCol : ' (计数)'}`);
            return [{
                chartType: 'pie',
                labelColumn: bestGroupCol,
                valueColumn: bestValueCol,
                title: `${bestGroupCol}${bestValueCol ? '的' + bestValueCol : '分布'}`,
                description: bestValueCol ? `按${bestGroupCol}统计${bestValueCol}的饼图` : `${bestGroupCol}的占比分布`,
                aggregateFunction: bestValueCol ? 'sum' : 'count',
                sortOrder: 'desc',
                dataTransform: null
            }];
        }
    }
    
    // 无法本地处理，返回null
    return null;
}

// 处理NLP绘图（使用已生成的配置）
async function handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, chartConfigs) {
    startOperationTiming('解析并生成图表');
    setNLPProgress(60, '正在解析图表配置...');
    
    if (!chartConfigs || chartConfigs.length === 0) {
        throw new Error('无法生成图表配置');
    }
    
    addProcessingLog('info', `成功解析 ${chartConfigs.length} 个图表配置`);
    
    // 显示可视化区域
    const dataVisualization = document.getElementById('data-visualization');
    if (dataVisualization) {
        dataVisualization.classList.remove('hidden');
    }
    const chartsContainer = document.querySelector('.charts-container');
    if (chartsContainer) {
        chartsContainer.innerHTML = '';
    } else {
        console.warn('[handleNLPChartWithConfig] 未找到charts-container元素');
    }
    
    // 生成图表
    setNLPProgress(70, '正在生成图表...');
    if (chartsContainer) {
        for (let i = 0; i < chartConfigs.length; i++) {
            const config = chartConfigs[i];
            addProcessingLog('command', `生成图表 ${i + 1}/${chartConfigs.length}`, `${config.title}`);
            const startTime = Date.now();
            createChartFromConfig(config, chartsContainer, null);
            const duration = Date.now() - startTime;
            addProcessingLog('performance', `图表 ${i + 1} 生成完成`, `耗时: ${duration}ms`);
            setNLPProgress(70 + Math.round(((i + 1) / chartConfigs.length) * 20), `正在生成图表 ${i + 1}/${chartConfigs.length}...`);
        }
    } else {
        console.warn('[handleNLPChartWithConfig] 无法生成图表，charts-container元素不存在');
    }
    
    endOperationTiming();
    
    // V5.0: 更新Agent工作流 - 执行查询完成，渲染结果开始
    updateAgentWorkflow('execute_query', 'completed');
    updateAgentWorkflow('render_result', 'running');
    
    // 显示结果摘要
    setNLPProgress(90, '正在完成...');
    displayNLPChartResults(userInput, chartConfigs);
    
    // 记录总耗时
    const totalDuration = Date.now() - totalStartTime;
    addProcessingLog('performance', '图表生成完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
    
    // V5.0: 更新Agent工作流 - 渲染结果完成
    updateAgentWorkflow('render_result', 'completed', {
        resultType: 'chart',
        chartCount: chartConfigs.length,
        duration: totalDuration
    });
    
    // V4.0新增：记录成功查询到历史
    if (window.queryHistoryManager) {
        window.queryHistoryManager.addQuery(userInput, true);
        updateQuerySuggestions();
    }
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
}

// 处理NLP绘图
async function handleNLPChart(userInput, dataInfo, totalStartTime, detailedIntent = null, entityExtractionResult = null) {
    startOperationTiming('生成图表配置');
    
    // 首先尝试本地生成配置
    setNLPProgress(45, '正在尝试本地生成图表配置...');
    const localConfig = await tryGenerateChartConfigLocally(userInput, dataInfo, detailedIntent, entityExtractionResult);
    
    // V5.0新增：检查是否需要追问
    if (localConfig && localConfig.needsClarification) {
        console.log('[handleNLPChart] 需要追问用户:', localConfig);
        endOperationTiming();
        
        // 触发追问机制
        await showClarificationDialog(localConfig, userInput, dataInfo, totalStartTime);
        return;
    }
    
    let chartConfigs;
    let aiResponse = null;
    
    if (localConfig) {
        // 本地生成成功
        chartConfigs = localConfig;
        addProcessingLog('success', '本地生成图表配置成功', `配置: ${JSON.stringify(localConfig[0]).substring(0, 100)}...`);
        endOperationTiming();
        
        // 显示处理中的消息
        const processingMessage = addMessage('system', '正在生成图表...');
        
        // 使用配置生成图表
        await handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, chartConfigs);
        
        // 更新处理消息为完成状态
        if (processingMessage) {
            const messageContent = processingMessage.querySelector('.message-content');
            if (messageContent) {
                messageContent.innerHTML = '<p>图表生成完成，请在下方"数据可视化"区域查看</p>';
            }
        }
        
        return;
    }
    
    // 本地生成失败，调用大模型API
    addProcessingLog('info', '本地无法生成配置，调用大模型API...');
    
    // V4.1新增：如果大模型也未配置，提示用户
    if (!config.ai.apiKey || config.ai.apiKey === 'your-api-key-here') {
        addProcessingLog('warning', '大模型API未配置，无法生成配置');
        
        // 显示用户确认对话框
        const userConfirmed = confirm(
            `系统无法自动理解您的需求："${userInput}"\n\n` +
            `可能原因：\n` +
            `1. 需求表达不够明确\n` +
            `2. 缺少大模型API配置\n\n` +
            `建议：\n` +
            `• 尝试更明确的表达，如"绘制柱状图显示各省份的销售额"\n` +
            `• 在设置中配置大模型API密钥\n\n` +
            `是否查看帮助文档？`
        );
        
        if (userConfirmed) {
            // 显示帮助信息
            showNotification('请尝试使用以下格式：\n1. 绘制[图表类型]显示[列名]的分布\n2. 统计[列名]的[求和/平均值]\n3. 筛选[条件]的数据', 'info', 8000);
        }
        
        hideNLPProgress();
        throw new Error('配置生成失败：本地模型无法理解需求，且大模型API未配置');
    }
    
    // V3.0优化：使用优化的大模型提示词
    let chartPrompt;
    if (window.llmPrompts && window.requirementClassifier) {
        // 构建大模型需要的上下文
        const columnInfo = window.requirementClassifier.getContextForLLM(
            dataInfo.columns,
            dataInfo.sampleData,
            []  // 本地模式没有matchedColumns
        );
        
        // 使用优化的图表配置提示词
        chartPrompt = window.llmPrompts.generateChartConfigPrompt(userInput, columnInfo, dataInfo);
        addProcessingLog('info', '使用优化的图表配置提示词');
    } else {
        // 兜底：使用简单提示词
        chartPrompt = `分析用户需求并生成图表配置。用户输入: "${userInput}"，列名: ${dataInfo.columns.join(', ')}`;
    }
    
    setNLPProgress(50, '正在调用AI生成图表配置...');
    // V4.1修复：增加超时时间到60秒，避免大模型调用超时
    aiResponse = await callLLMAPI(chartPrompt, currentQueryController.signal, 60000);
    endOperationTiming();
    
    // V5.0修复：增强JSON解析逻辑，更健壮地处理大模型返回的JSON
    try {
        // 1. 清理响应内容，移除可能的Markdown代码块和额外文本
        let cleanedResponse = aiResponse.trim();
        
        // 移除Markdown代码块标记
        cleanedResponse = cleanedResponse.replace(/^```json\n|^```\n|\n```$/g, '');
        
        // 2. 尝试解析完整响应
        try {
            const parsed = JSON.parse(cleanedResponse);
            chartConfigs = Array.isArray(parsed) ? parsed : [parsed];
            addProcessingLog('info', `直接解析成功，共${chartConfigs.length}个图表`);
        } catch (e1) {
            // 3. 如果直接解析失败，尝试匹配JSON数组
            const jsonArrayMatch = cleanedResponse.match(/\[[\s\S]*\]/);
            if (jsonArrayMatch) {
                try {
                    const parsed = JSON.parse(jsonArrayMatch[0]);
                    chartConfigs = Array.isArray(parsed) ? parsed : [parsed];
                    addProcessingLog('info', `解析到数组配置，共${chartConfigs.length}个图表`);
                } catch (e2) {
                    // 4. 尝试匹配JSON对象
                    const jsonMatch = cleanedResponse.match(/\{[\s\S]*?\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            chartConfigs = [parsed];
                            addProcessingLog('info', `解析到对象配置，1个图表`);
                        } catch (e3) {
                            // 5. 尝试修复常见的JSON格式问题
                            try {
                                const fixedJson = fixJSON(cleanedResponse);
                                const parsed = JSON.parse(fixedJson);
                                chartConfigs = Array.isArray(parsed) ? parsed : [parsed];
                                addProcessingLog('info', `修复JSON格式后解析成功，共${chartConfigs.length}个图表`);
                            } catch (e4) {
                                throw new Error('无法解析JSON配置');
                            }
                        }
                    } else {
                        throw new Error('未找到JSON配置');
                    }
                }
            } else {
                throw new Error('未找到JSON配置');
            }
        }
        
        // 验证配置有效性
        if (!chartConfigs || chartConfigs.length === 0) {
            throw new Error('配置为空');
        }
        
        // 记录解析后的配置
        addProcessingLog('info', `图表配置解析成功`, JSON.stringify(chartConfigs[0]).substring(0, 200));
    } catch (e) {
        addProcessingLog('error', '图表配置解析失败', e.message);
        console.error('[图表配置解析]', e);
        console.error('[原始响应]', aiResponse);
        throw new Error(`无法解析图表配置: ${e.message}`);
    }

    // 辅助函数：修复常见的JSON格式问题
    function fixJSON(jsonStr) {
        // 移除多余的逗号
        jsonStr = jsonStr.replace(/,\s*}/g, '}');
        jsonStr = jsonStr.replace(/,\s*]/g, ']');
        
        // 修复缺少引号的键
        jsonStr = jsonStr.replace(/([{,\s])([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
        
        // 修复单引号为双引号
        jsonStr = jsonStr.replace(/'([^']+)'/g, '"$1"');
        
        return jsonStr;
    }
    
    // 显示处理中的消息
    const processingMessage = addMessage('system', '正在生成图表...');
    
    // 使用配置生成图表
    await handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, chartConfigs);
    
    // 更新处理消息为完成状态
    if (processingMessage) {
        const messageContent = processingMessage.querySelector('.message-content');
        if (messageContent) {
            messageContent.innerHTML = '<p>图表生成完成，请在下方"数据可视化"区域查看</p>';
        }
    }
}

// 显示NLP查询结果
function displayNLPQueryResults(userInput, results, queryLogics, aiResponse) {
    const nlpResult = document.getElementById('nlp-result');
    
    let html = `
        <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #667eea;">
                <h3 style="margin: 0; color: #667eea;">查询结果</h3>
                <div style="display: flex; gap: 10px;">
                    <button onclick="showQueryProcessingResult()" 
                        style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">查看处理日志</button>
                    <button onclick="exportQueryResult()" 
                        style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">导出结果</button>
                </div>
            </div>
            <div style="background: #f8f9fa; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                <strong style="color: #667eea;">您的查询：</strong>${userInput}
            </div>
    `;
    
    results.forEach((item, index) => {
        html += `
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="color: #667eea; font-weight: 600; margin-bottom: 10px; font-size: 1.05em;">
                    ${index + 1}. ${item.logic.description || '查询任务'}
                </div>
                <div style="line-height: 1.8; color: #333;">
                    ${item.result}
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    nlpResult.innerHTML = html;
    nlpResult.classList.remove('hidden');
}

// 显示NLP绘图结果
function displayNLPChartResults(userInput, chartConfigs) {
    const nlpResult = document.getElementById('nlp-result');
    
    if (!nlpResult) {
        console.warn('[displayNLPChartResults] 未找到nlp-result元素');
        return;
    }
    
    let html = `
        <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #667eea;">
                <h3 style="margin: 0; color: #667eea;">图表生成完成</h3>
                <button onclick="document.getElementById('data-visualization').scrollIntoView({behavior: 'smooth'})" 
                    style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">查看图表</button>
            </div>
            <div style="background: #f8f9fa; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                <strong style="color: #667eea;">您的需求：</strong>${userInput}
            </div>
            <div style="color: #28a745; font-weight: 500;">
                ✓ 成功生成 ${chartConfigs.length} 个图表，请在下方"数据可视化"区域查看
            </div>
        </div>
    `;
    
    nlpResult.innerHTML = html;
}

// ==================== V6.0新增：统一意图识别与需求分类系统 ====================

// 意图类别定义
const INTENT_CATEGORIES = {
    QUERY_FILTER: '筛选查询',          // 筛选特定条件的数据
    QUERY_AGGREGATE: '聚合查询',       // 汇总统计（求和、平均、计数）
    QUERY_EXTRACT: '提取查询',         // 提取特定字段或最大值/最小值
    CHART_BAR: '柱状图需求',           // 创建柱状图
    CHART_PIE: '饼图需求',             // 创建饼图
    CHART_LINE: '折线图需求',          // 创建折线图
    STATS_SUMMARY: '统计分析',         // 数据统计摘要
    PREDICTION: '预测分析',            // 趋势预测
    CLUSTERING: '聚类分析',            // 数据分组分类
    COMPARISON: '对比分析',            // 多维度对比
    TREND_ANALYSIS: '趋势分析'         // 时间趋势分析
};

// 需求优先级定义
const REQUIREMENT_PRIORITY = {
    HIGH: '高优先级',     // 核心业务需求、高频率查询
    MEDIUM: '中优先级',   // 常规分析需求
    LOW: '低优先级'       // 探索性、辅助性需求
};

// 需求复杂度定义  
const REQUIREMENT_COMPLEXITY = {
    SIMPLE: '简单',       // 单一查询，明确列名和条件
    MEDIUM: '中等',       // 组合查询，涉及2-3个维度
    COMPLEX: '复杂'       // 复杂分析，涉及多个维度、聚合、排序和嵌套逻辑
};

/**
 * 统一意图识别与需求分类器
 * 结合本地模型和大模型API，实现精准意图识别和需求分类
 */
class UnifiedIntentClassifier {
    constructor() {
        this.localModelEnabled = true;
        this.llmApiEnabled = false;
        this.lastAnalysis = null;
        
        // 关键词匹配表
        // V6.0优化：修复意图识别问题
        this.keywordPatterns = {
            // 查询类意图 - 注意顺序很重要，先匹配更具体的模式
            [INTENT_CATEGORIES.QUERY_FILTER]: [
                /只显示.*/, /筛选.*/, /过滤.*/, /查找.*满足.*条件/, /筛选.*等于.*/, /属于.*/
            ],
            [INTENT_CATEGORIES.QUERY_AGGREGATE]: [
                /统计.*数量/, /计算.*总和/, /平均.*/, /总共.*/, /合计.*/, /统计.*总和/, /计算.*平均/
            ],
            // 提取查询 - 包含最大值/最小值/最高/最低等
            [INTENT_CATEGORIES.QUERY_EXTRACT]: [
                /最大.*值/, /最小.*值/, /最高.*/, /最低.*/, /哪个.*最/, 
                /最大值/, /最小值/, /找出.*最小/, /找出.*最大/, /找出.*最低/, /找出.*最高/,
                /最大.*记录/, /最小.*记录/, /最低.*记录/, /最高.*记录/
            ],
            
            // 图表类意图
            [INTENT_CATEGORIES.CHART_BAR]: [/柱状图/, /柱图/, /bar.*chart/, /条形图/],
            [INTENT_CATEGORIES.CHART_PIE]: [/饼图/, /pie.*chart/, /比例图/, /占比图/],
            [INTENT_CATEGORIES.CHART_LINE]: [/折线图/, /line.*chart/, /趋势图/],
            
            // 分析类意图
            [INTENT_CATEGORIES.STATS_SUMMARY]: [/统计.*特征/, /数据.*分布/, /描述.*统计/, /分析.*数据/],
            [INTENT_CATEGORIES.PREDICTION]: [/预测.*值/, /未来.*趋势/, /预估.*/],
            [INTENT_CATEGORIES.COMPARISON]: [/比较.*/, /对比.*/, /不同.*之间/],
            [INTENT_CATEGORIES.TREND_ANALYSIS]: [/增长.*趋势/, /变化.*趋势/, /历史.*趋势/]
        };
        
        // 实体提取正则
        this.entityPatterns = {
            column: /"([^"]+)"列|列"([^"]+)"|在([^列]+)列中?|([^，,]+)列(?:中)?/g,
            value: /等于"([^"]+)"|为"([^"]+)"|值"([^"]+)"|([0-9]+)(?:个|项|次)/g,
            comparison: /大(?:于|过)|小(?:于|过)|等于|不等于|包含|不包含/g,
            aggregation: /求和|平均值|平均数|平均|总和|总计|总数|最大|最小|最高|最低|个数|数量/g
        };
    }
    
    /**
     * 检查本地模型可用性
     */
    async checkLocalModelAvailability() {
        try {
            // 检查本地意图模型是否可用
            if (window.intentRecognizer && typeof window.intentRecognizer.checkLocalModelAvailability === 'function') {
                return await window.intentRecognizer.checkLocalModelAvailability();
            }
            return { modelAvailable: false, reason: '本地模型未初始化' };
        } catch (error) {
            console.warn('[UnifiedIntentClassifier] 检查本地模型失败:', error);
            return { modelAvailable: false, reason: error.message };
        }
    }
    
    /**
     * 检查大模型API可用性
     */
    async checkLLMAvailability() {
        try {
            // 检查config配置
            if (typeof config !== 'undefined' && config.api && config.api.llmApiUrl && config.api.llmApiKey) {
                // 尝试调用健康检查接口
                const response = await fetch(`${config.api.llmApiUrl}/health`, { 
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${config.api.llmApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.llmApiEnabled = result.status === 'healthy' || result.message === 'OK';
                    return {
                        available: this.llmApiEnabled,
                        model: config.api.llmModel || 'unknown',
                        url: config.api.llmApiUrl
                    };
                }
            }
            
            this.llmApiEnabled = false;
            return { available: false, reason: '大模型API未配置或不可用' };
        } catch (error) {
            console.warn('[UnifiedIntentClassifier] 检查大模型API失败:', error);
            this.llmApiEnabled = false;
            return { available: false, reason: error.message };
        }
    }
    
    /**
     * 核心：统一意图识别与需求分类
     * @param {string} userInput 用户输入文本
     * @param {Array} columns 数据列名
     * @param {Array} sampleData 样本数据
     * @returns {Object} 包含意图、分类、优先级、复杂度等信息
     */
    async classify(userInput, columns, sampleData = []) {
        const startTime = Date.now();
        const lowerInput = userInput.toLowerCase();
        
        console.log('[UnifiedIntentClassifier] 开始意图识别:', userInput, '列数:', columns.length);
        
        // 步骤1: 本地关键词匹配（快速路径）
        const localResult = await this.localKeywordClassify(lowerInput, columns);
        if (localResult.confidence > 0.8) {
            console.log('[UnifiedIntentClassifier] 本地关键词匹配成功:', localResult);
            this.lastAnalysis = { ...localResult, method: 'local_keyword', time: Date.now() - startTime };
            return localResult;
        }
        
        // 步骤2: 本地模型识别（如果可用）
        if (this.localModelEnabled && window.intentRecognizer) {
            try {
                const localModelResult = await this.localModelClassify(lowerInput, columns);
                if (localModelResult.confidence > 0.7) {
                    console.log('[UnifiedIntentClassifier] 本地模型识别成功:', localModelResult);
                    this.lastAnalysis = { ...localModelResult, method: 'local_model', time: Date.now() - startTime };
                    return localModelResult;
                }
            } catch (error) {
                console.warn('[UnifiedIntentClassifier] 本地模型识别失败:', error);
            }
        }
        
        // 步骤3: 大模型API识别（兜底和复杂场景）
        if (this.llmApiEnabled) {
            try {
                const llmResult = await this.llmClassify(userInput, columns, sampleData);
                console.log('[UnifiedIntentClassifier] 大模型识别成功:', llmResult);
                this.lastAnalysis = { ...llmResult, method: 'llm_api', time: Date.now() - startTime };
                return llmResult;
            } catch (error) {
                console.warn('[UnifiedIntentClassifier] 大模型识别失败，降级到本地增强:', error);
            }
        }
        
        // 步骤4: 本地增强识别（兜底）
        const enhancedResult = this.enhancedLocalClassify(lowerInput, columns, localResult);
        console.log('[UnifiedIntentClassifier] 使用增强本地识别:', enhancedResult);
        this.lastAnalysis = { ...enhancedResult, method: 'enhanced_local', time: Date.now() - startTime };
        
        return enhancedResult;
    }
    
    // ========== 本地识别方法 ==========
    
    async localKeywordClassify(lowerInput, columns) {
        const result = {
            mode: 'accurate',
            confidence: 0,
            reason: '',
            intentCategory: '',
            priority: REQUIREMENT_PRIORITY.MEDIUM,
            complexity: REQUIREMENT_COMPLEXITY.SIMPLE,
            matchedColumns: []
        };
        
        // 检查每个意图类别的关键词
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [category, patterns] of Object.entries(this.keywordPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(lowerInput)) {
                    const score = this.calculateMatchScore(lowerInput, pattern);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = category;
                    }
                }
            }
        }
        
        if (bestMatch) {
            result.intentCategory = bestMatch;
            result.confidence = Math.min(0.5 + bestScore, 0.9); // 关键词匹配置信度在0.5-0.9之间
            result.reason = `关键词匹配到${bestMatch}`;
            
            // 提取匹配到的列名
            result.matchedColumns = this.extractMatchedColumns(lowerInput, columns);
            
            // 设置优先级和复杂度
            result.priority = this.determinePriority(lowerInput, bestMatch, columns);
            result.complexity = this.determineComplexity(lowerInput, columns, result.matchedColumns);
            
            // 添加实体提取
            result.entityExtraction = this.extractEntities(lowerInput, columns);
        }
        
        return result;
    }
    
    async localModelClassify(lowerInput, columns) {
        try {
            if (window.intentRecognizer && typeof window.intentRecognizer.classify === 'function') {
                const recognition = await window.intentRecognizer.classify(lowerInput, columns);
                if (recognition.success) {
                    return {
                        mode: 'accurate',
                        intentCategory: this.mapIntentToCategory(recognition.intent),
                        detailedIntent: recognition.detailedIntent,
                        confidence: recognition.confidence || 0.7,
                        reason: `本地模型识别: ${recognition.reason || '基于语义分析'}`,
                        priority: this.determinePriority(lowerInput, recognition.intent, columns),
                        complexity: recognition.complexity || REQUIREMENT_COMPLEXITY.SIMPLE,
                        matchedColumns: recognition.matchedColumns || [],
                        entityExtraction: recognition.entities || []
                    };
                }
            }
        } catch (error) {
            // 静默失败，返回空结果
        }
        
        return null;
    }
    
    // ========== 大模型API方法 ==========
    
    async llmClassify(userInput, columns, sampleData) {
        try {
            // 构建大模型提示词
            const prompt = this.buildLLMClassificationPrompt(userInput, columns, sampleData);
            
            // 调用大模型API
            const response = await window.callLLMAPI(prompt, null, 30000);
            
            // 解析大模型响应
            const parsedResult = this.parseLLMClassificationResponse(response);
            
            if (parsedResult) {
                return {
                    mode: 'intelligent',
                    ...parsedResult,
                    confidence: parsedResult.confidence || 0.85,
                    useLLM: true // 标记使用了大模型
                };
            }
        } catch (error) {
            console.warn('[llmClassify] 大模型分类失败:', error);
            throw error;
        }
        
        return null;
    }
    
    buildLLMClassificationPrompt(userInput, columns, sampleData) {
        return `请分析用户的查询需求并进行智能分类。

用户查询："${userInput}"
可用字段：${columns.join(', ')}
示例数据：${JSON.stringify(sampleData.slice(0, 3), null, 2)}

请返回JSON格式的识别结果，包含以下字段：
- mode: 处理模式 (accurate/intelligent/exploratory)
- intentCategory: 意图类别 (从下列选择: ${Object.values(INTENT_CATEGORIES).join(', ')})
- priority: 需求优先级 (high/medium/low)
- complexity: 需求复杂度 (simple/medium/complex)
- matchedColumns: 匹配到的列名数组
- entityExtraction: 实体提取结果 {}
- confidence: 置信度 (0.0-1.0)
- reason: 识别理由
- processingStrategy: 建议处理策略

请分析用户意图并返回相应的JSON对象。`;
    }
    
    parseLLMClassificationResponse(response) {
        try {
            // 尝试提取JSON内容
            const jsonMatch = response.match(/{[\s\S]*}/) || response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.warn('[parseLLMClassificationResponse] 解析大模型响应失败:', error);
        }
        return null;
    }
    
    // ========== 辅助方法 ==========
    
    calculateMatchScore(input, pattern) {
        // V6.0优化：改进匹配分数计算
        const match = input.match(pattern);
        if (!match) return 0;
        
        const matchLength = match[0].length;
        const inputLength = input.length;
        
        // 基础分数：匹配部分越长，分数越高
        let score = matchLength / inputLength;
        
        // V6.0新增：给予特定关键词更高的权重
        const highPriorityKeywords = ['最大', '最小', '最高', '最低', '最'];
        const matchedText = match[0];
        
        // 如果匹配内容包含高优先级关键词，加分
        for (const keyword of highPriorityKeywords) {
            if (matchedText.includes(keyword)) {
                score += 0.3; // 高优先级关键词额外加分
                break;
            }
        }
        
        // 如果是完整匹配而非部分匹配，加分
        if (matchedText.length === inputLength) {
            score += 0.2;
        }
        
        return score;
    }
    
    extractMatchedColumns(input, columns) {
        const matched = [];
        for (const column of columns) {
            if (input.includes(column.toLowerCase())) {
                matched.push(column);
            }
        }
        return matched;
    }
    
    determinePriority(input, intent, columns) {
        // 基于常见业务优先级规则
        const businessKeywords = ['销量', '销售额', '收入', '利润', '成本', '客户', '订单'];
        const hasBusinessKeyword = businessKeywords.some(keyword => input.includes(keyword));
        
        if (hasBusinessKeyword) {
            return REQUIREMENT_PRIORITY.HIGH;
        }
        
        if (intent === INTENT_CATEGORIES.PREDICTION || intent === INTENT_CATEGORIES.CLUSTERING) {
            return REQUIREMENT_PRIORITY.MEDIUM;
        }
        
        return REQUIREMENT_PRIORITY.LOW;
    }
    
    determineComplexity(input, columns, matchedColumns) {
        // 分析需求复杂度
        const hasMultipleConditions = (input.match(/并且|同时|另外|还需/g) || []).length > 0;
        const hasNestedQueries = input.includes('其中') || input.includes('中的');
        const hasComparisons = /比较|对比|不同|差异|区别/.test(input);
        
        if (matchedColumns.length >= 3 || hasMultipleConditions || hasNestedQueries || hasComparisons) {
            return REQUIREMENT_COMPLEXITY.COMPLEX;
        }
        
        if (matchedColumns.length >= 2 || /\d+个/.test(input)) {
            return REQUIREMENT_COMPLEXITY.MEDIUM;
        }
        
        return REQUIREMENT_COMPLEXITY.SIMPLE;
    }
    
    extractEntities(input, columns) {
        const entities = {
            columns: [],
            values: [],
            comparisons: [],
            aggregations: [],
            conditions: {}
        };
        
        // 提取列实体
        for (const column of columns) {
            if (input.includes(column)) {
                entities.columns.push(column);
            }
        }
        
        // 提取数值实体
        const valuePatterns = [
            /\d+(?:\.\d+)?/g,  // 数字
            /"[^"]+"/g,        // 引号内的值
            /'[^']+?'/g        // 单引号内的值
        ];
        
        for (const pattern of valuePatterns) {
            const matches = input.match(pattern) || [];
            entities.values.push(...matches.map(m => m.replace(/["']/g, '')));
        }
        
        // 提取比较操作符
        const comparisonMatches = input.match(this.entityPatterns.comparison);
        if (comparisonMatches) {
            entities.comparisons = comparisonMatches;
        }
        
        // 提取聚合函数
        const aggregationMatches = input.match(this.entityPatterns.aggregation);
        if (aggregationMatches) {
            entities.aggregations = aggregationMatches;
        }
        
        return entities;
    }
    
    mapIntentToCategory(intent) {
        const intentMap = {
            'filter': INTENT_CATEGORIES.QUERY_FILTER,
            'aggregate': INTENT_CATEGORIES.QUERY_AGGREGATE,
            'extract': INTENT_CATEGORIES.QUERY_EXTRACT,
            'chart': INTENT_CATEGORIES.CHART_BAR,
            'chart_pie': INTENT_CATEGORIES.CHART_PIE,
            'chart_line': INTENT_CATEGORIES.CHART_LINE,
            'stats': INTENT_CATEGORIES.STATS_SUMMARY,
            'prediction': INTENT_CATEGORIES.PREDICTION,
            'comparison': INTENT_CATEGORIES.COMPARISON,
            'trend': INTENT_CATEGORIES.TREND_ANALYSIS
        };
        
        return intentMap[intent] || INTENT_CATEGORIES.QUERY_FILTER;
    }
    
    enhancedLocalClassify(lowerInput, columns, previousResult = null) {
        // 增强本地分类逻辑
        const result = previousResult || {
            mode: 'accurate',
            confidence: 0.4,  // 基础置信度
            reason: '',
            intentCategory: INTENT_CATEGORIES.QUERY_FILTER,
            priority: REQUIREMENT_PRIORITY.MEDIUM,
            complexity: REQUIREMENT_COMPLEXITY.SIMPLE,
            matchedColumns: [],
            entityExtraction: {}
        };
        
        // 进一步分析输入
        const hasSearch = /查找|查询|搜索|找/.test(lowerInput);
        const hasChart = /图|表|可视化|展示|显示/.test(lowerInput);
        const hasAnalysis = /分析|统计|研究|查看/.test(lowerInput);
        
        if (hasChart && !result.intentCategory.startsWith('CHART')) {
            // 检测到图表关键词
            result.intentCategory = INTENT_CATEGORIES.CHART_BAR;
            result.confidence = Math.max(result.confidence, 0.6);
            result.reason = '检测到图表相关关键词，推测为图表需求';
        } else if (hasAnalysis && result.intentCategory === INTENT_CATEGORIES.QUERY_FILTER) {
            // 检测到分析关键词
            result.intentCategory = INTENT_CATEGORIES.STATS_SUMMARY;
            result.confidence = Math.max(result.confidence, 0.5);
            result.reason = '检测到分析相关关键词，推测为统计分析需求';
        }
        
        // 提取更多列名
        if (result.matchedColumns.length === 0) {
            result.matchedColumns = this.extractMatchedColumns(lowerInput, columns);
        }
        
        // 重新评估复杂度
        if (result.matchedColumns.length > 0) {
            result.complexity = this.determineComplexity(lowerInput, columns, result.matchedColumns);
        }
        
        return result;
    }
    
    /**
     * 获取分类器的状态信息
     */
    getStatus() {
        return {
            localModelEnabled: this.localModelEnabled,
            llmApiEnabled: this.llmApiEnabled,
            lastAnalysis: this.lastAnalysis,
            categories: Object.values(INTENT_CATEGORIES),
            priorities: Object.values(REQUIREMENT_PRIORITY),
            complexities: Object.values(REQUIREMENT_COMPLEXITY)
        };
    }
    
    /**
     * 获取处理建议
     */
    getProcessingSuggestion(classification) {
        const suggestions = {
            [INTENT_CATEGORIES.QUERY_FILTER]: '使用筛选查询处理',
            [INTENT_CATEGORIES.QUERY_AGGREGATE]: '使用聚合函数计算',
            [INTENT_CATEGORIES.QUERY_EXTRACT]: '查找最大值/最小值',
            [INTENT_CATEGORIES.CHART_BAR]: '生成柱状图展示数据',
            [INTENT_CATEGORIES.CHART_PIE]: '生成饼图展示占比',
            [INTENT_CATEGORIES.CHART_LINE]: '生成折线图展示趋势',
            [INTENT_CATEGORIES.STATS_SUMMARY]: '计算数据统计摘要',
            [INTENT_CATEGORIES.PREDICTION]: '使用预测算法进行分析',
            [INTENT_CATEGORIES.CLUSTERING]: '使用聚类算法分组',
            [INTENT_CATEGORIES.COMPARISON]: '进行多维度对比分析',
            [INTENT_CATEGORIES.TREND_ANALYSIS]: '分析历史趋势变化'
        };
        
        return suggestions[classification.intentCategory] || '执行标准数据分析';
    }
}

// 创建全局统一分类器实例
let unifiedIntentClassifier = null;

/**
 * 初始化统一意图分类器
 */
async function initUnifiedIntentClassifier() {
    try {
        unifiedIntentClassifier = new UnifiedIntentClassifier();
        
        // 检查模型可用性（异步执行，不阻塞主流程）
        setTimeout(async () => {
            const localStatus = await unifiedIntentClassifier.checkLocalModelAvailability();
            const llmStatus = await unifiedIntentClassifier.checkLLMAvailability();
            
            console.log('[UnifiedIntentClassifier] 初始化完成:', {
                localModel: localStatus.modelAvailable ? '可用' : '不可用',
                llmApi: llmStatus.available ? '可用' : '不可用'
            });
            
            addProcessingLog('success', '统一意图分类器初始化完成', 
                `本地模型: ${localStatus.modelAvailable ? '✅可用' : '❌不可用'}, 大模型API: ${llmStatus.available ? '✅可用' : '❌不可用'}`);
        }, 1000);
        
        return unifiedIntentClassifier;
    } catch (error) {
        console.error('初始化统一意图分类器失败:', error);
        addProcessingLog('error', '统一意图分类器初始化失败', error.message);
        return null;
    }
}

// ==================== V5.0新增：追问机制 ====================

/**
 * 显示追问对话框
 * 产品意义：当用户需求不明确时，通过追问获取更多信息
 */
async function showClarificationDialog(clarificationInfo, originalInput, dataInfo, totalStartTime) {
    const { clarificationType, mentionedColumn, availableDimensions, chartType, message, choices } = clarificationInfo;
    
    console.log('[showClarificationDialog] 显示追问对话框:', clarificationInfo);
    
    // 隐藏进度条
    hideNLPProgress();
    
    // 获取对话消息容器
    const messagesContainer = document.getElementById('conversation-messages');
    if (!messagesContainer) {
        console.error('[showClarificationDialog] 未找到对话消息容器');
        return;
    }
    
    // 构建选项按钮（优先使用choices，没有则使用availableDimensions）
    let optionsHtml = '';
    let optionsList = [];
    
    if (choices && choices.length > 0) {
        optionsList = choices;
    } else if (availableDimensions && availableDimensions.length > 0) {
        optionsList = availableDimensions;
    }
    
    if (optionsList.length > 0) {
        optionsHtml = optionsList.map((option, index) => {
            const optionId = option.id || index;
            const optionLabel = option.label || option;
            const optionDesc = option.description || '';
            const isHighlighted = option.highlight || false;
            
            return `
                <button class="clarification-option" data-id="${optionId}" title="${optionDesc}" style="
                    background: ${isHighlighted ? 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 25px;
                    margin: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
                    display: flex;
                    align-items: center;
                " onclick="handleClarificationClick('${optionId}')">
                    <span style="margin-right: 8px;">${index + 1}.</span>
                    <span>${optionLabel}</span>
                </button>
            `;
        }).join('');
    }
    
    // 如果没有提供选项或选择"其他"选项的按钮
    optionsHtml += `
        <button class="clarification-option" data-id="__other__" style="
            background: #f8f9fa;
            color: #666;
            border: 2px solid #ddd;
            padding: 12px 24px;
            border-radius: 25px;
            margin: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
        " onclick="handleClarificationClick('__other__')">
            <span style="margin-right: 8px;">${optionsList.length + 1}.</span>
            <span>自定义其他选项...</span>
        </button>
        
        <button class="clarification-option" data-id="__cancel__" style="
            background: #fff;
            color: #dc3545;
            border: 2px solid #dc3545;
            padding: 12px 24px;
            border-radius: 25px;
            margin: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
        " onclick="handleClarificationClick('__cancel__')">
            <span style="margin-right: 8px;">取消</span>
        </button>
    `;
    
    // 构建追问消息卡片
    const clarificationHtml = `
        <div class="message system clarification-message" id="clarification-card" style="
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 25px;
            margin: 15px 0;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
        ">
            <div class="clarification-header" style="
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #667eea;
            ">
                <span style="font-size: 28px; margin-right: 12px; color: #667eea;">🔍</span>
                <div>
                    <div style="font-weight: bold; color: #333; font-size: 18px;">需要确认或提供更多信息</div>
                    <div style="color: #6c757d; font-size: 13px; margin-top: 4px;">为了给您提供最准确的分析结果</div>
                </div>
            </div>
            
            <div class="clarification-body" style="
                color: #495057;
                margin-bottom: 25px;
                line-height: 1.6;
                font-size: 15px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 10px;
                border-left: 4px solid #4CAF50;
            ">
                <strong>📝 问题：</strong> ${message || '请选择您想分析的具体维度'}
            </div>
            
            <div class="clarification-options-header" style="
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                color: #343a40;
                font-size: 14px;
                font-weight: 500;
            ">
                <span style="margin-right: 8px;">👇</span> 请选择下列选项之一：
            </div>
            
            <div class="clarification-options" id="clarification-options-list" style="
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 20px;
            ">
                ${optionsHtml}
            </div>
            
            <div class="clarification-footer" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 15px;
                border-top: 1px solid #dee2e6;
                font-size: 12px;
                color: #6c757d;
            ">
                <div>
                    <span style="margin-right: 10px;">💡 提示：点击选项继续分析</span>
                    <span>🔍 自动识别您的意图中...</span>
                </div>
                <div>
                    交互式AI数据分析助手
                </div>
            </div>
        </div>
    `;
    
    // 添加到消息队列
    window.clarificationContext = {
        clarificationInfo,
        originalInput,
        dataInfo,
        totalStartTime
    };
    
    // 添加到对话窗口
    addMessage('system', clarificationHtml);
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // 绑定全局点击事件处理器
    window.handleClarificationClick = async function(optionId) {
        await handleClarificationSelection(optionId, originalInput, dataInfo, totalStartTime, clarificationInfo);
    };
    
    // 绑定事件监听器（支持直接点击）
    setTimeout(() => {
        const optionButtons = document.querySelectorAll('.clarification-option');
        optionButtons.forEach(btn => {
            if (!btn.hasAttribute('data-bound')) {
                btn.setAttribute('data-bound', 'true');
                const optionId = btn.getAttribute('data-id');
                btn.addEventListener('click', () => window.handleClarificationClick(optionId));
            }
        });
    }, 100);
    
    // 记录追问事件
    addProcessingLog('info', '用户需求不明确，触发追问机制', clarificationType || 'general');
}

/**
 * 处理追问选择
 */
async function handleClarificationSelection(optionId, originalInput, dataInfo, totalStartTime, clarificationInfo) {
    console.log('[handleClarificationSelection] 用户选择选项:', optionId, clarificationInfo);
    
    const { clarificationType, mentionedColumn, chartType, message, choices, availableDimensions } = clarificationInfo;
    
    // 找到追问卡片
    const clarificationCard = document.getElementById('clarification-card');
    if (clarificationCard) {
        clarificationCard.style.opacity = '0.7';
        clarificationCard.style.filter = 'grayscale(60%)';
        // 禁用所有按钮
        const buttons = clarificationCard.querySelectorAll('.clarification-option');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.cursor = 'default';
            btn.style.boxShadow = 'none';
            btn.style.transform = 'none';
        });
    }
    
    // 处理不同的选择
    if (optionId === '__cancel__') {
        // 用户取消
        addMessage('user', '取消分析');
        addMessage('system', '已取消当前分析，您可以输入其他查询需求。');
        completeConversation();
        return;
    }
    
    if (optionId === '__other__') {
        // 用户选择"以上都不是"，触发大模型兜底
        addMessage('user', '以上都不是，让AI帮我理解');
        
        // 显示正在调用大模型的消息
        const processingMsg = addMessage('system', '正在使用AI深度理解您的需求...');
        
        try {
            // 获取原始输入和数据信息
            const clarificationContext = window.clarificationContext || {};
            const userInput = clarificationContext.originalInput || originalInput;
            const dataInfo = clarificationContext.dataInfo || dataInfo;
            
            addProcessingLog('info', '用户选择"以上都不是"，触发大模型兜底', userInput);
            
            // 调用大模型API进行语义理解
            if (window.requirementClassifier && config.ai && config.ai.apiKey) {
                const columnInfo = window.requirementClassifier.getContextForLLM(
                    dataInfo.columns || [],
                    dataInfo.sampleData || [],
                    []
                );
                
                const llmPrompt = `用户的需求是："${userInput}"，但系统无法理解。请根据以下数据列信息：${columnInfo}，生成一个合理的图表配置或查询配置。`;
                
                const llmResponse = await callLLMAPI(llmPrompt);
                
                // 尝试解析大模型返回的配置
                const configMatch = llmResponse.match(/\{[\s\S]*\}/);
                if (configMatch) {
                    const llmConfig = JSON.parse(configMatch[0]);
                    
                    // 检查返回的是否是图表配置
                    if (llmConfig.chartType || llmConfig.type === 'chart') {
                        await handleNLPChartWithConfig(userInput, dataInfo, totalStartTime, [llmConfig]);
                    } else {
                        // 尝试作为查询配置处理
                        await executeLocalQuery(userInput, dataInfo, totalStartTime, llmConfig);
                    }
                    
                    if (processingMsg) processingMsg.remove();
                    addMessage('system', 'AI已理解您的需求并生成了分析结果');
                } else {
                    // 大模型也无法理解，触发拒识
                    if (processingMsg) processingMsg.remove();
                    showRejectionMessage('抱歉，经过AI深度分析仍无法理解您的需求', 
                        '请尝试更明确地描述您的分析需求，如"按省份统计销售额"或"绘制柱状图"');
                }
            } else {
                // 没有配置大模型API，显示友好提示
                if (processingMsg) processingMsg.remove();
                addMessage('system', '大模型API未配置，请在设置中配置API Key后重试，或尝试更明确地描述您的需求。');
            }
        } catch (error) {
            console.error('[handleClarificationSelection] 大模型兜底失败:', error);
            if (processingMsg) processingMsg.remove();
            // 大模型调用失败，触发拒识
            showRejectionMessage('抱歉，AI服务暂时不可用', 
                '请稍后再试，或尝试更明确地描述您的分析需求');
        }
        
        completeConversation();
        return;
    }
    
    // 找到选择的选项
    let selectedOption = null;
    if (choices && choices.length > 0) {
        selectedOption = choices.find(c => (c.id || c.label) === optionId) || choices.find(c => c.label === optionId);
    } else if (availableDimensions && availableDimensions.length > 0) {
        selectedOption = availableDimensions.find(dim => dim === optionId || dim.includes(optionId));
    }
    
    // 添加用户选择消息
    const selectedLabel = selectedOption ? (selectedOption.label || selectedOption) : optionId;
    const selectedDesc = selectedOption ? (selectedOption.description || '') : '';
    addMessage('user', `选择: ${selectedLabel}${selectedDesc ? ` (${selectedDesc})` : ''}`);
    
    // 根据追问类型处理
    switch (clarificationType) {
        case 'missing_dimension':
            // 缺少维度信息（如"按什么分组"）
            await handleMissingDimensionClarification(selectedLabel, originalInput, dataInfo, totalStartTime, clarificationInfo);
            break;
            
        case 'missing_metric':
            // 缺少指标信息（如"分析什么指标"）
            await handleMissingMetricClarification(selectedLabel, originalInput, dataInfo, totalStartTime, clarificationInfo);
            break;
            
        case 'chart_type':
            // 缺少图表类型
            await handleChartTypeClarification(selectedLabel, originalInput, dataInfo, totalStartTime, clarificationInfo);
            break;
            
        case 'filter_value':
            // 缺少筛选值
            await handleFilterValueClarification(selectedLabel, originalInput, dataInfo, totalStartTime, clarificationInfo);
            break;
            
        default:
            // 默认处理：重新分析用户完整需求
            const enhancedInput = originalInput + ' ' + selectedLabel;
            await callGeneralAnalysis(enhancedInput, dataInfo, totalStartTime);
            break;
    }
}

/**
 * 处理缺少维度信息的追问
 */
async function handleMissingDimensionClarification(selectedDimension, originalInput, dataInfo, totalStartTime, clarificationInfo) {
    const { mentionedColumn, chartType } = clarificationInfo;
    
    // 检测排序需求
    const hasSortDesc = /从高到低|从大到小|降序|倒序|排序.*高|排序.*大/.test(originalInput);
    const hasSortAsc = /从低到高|从小到大|升序|正序|排序.*低|排序.*小/.test(originalInput);
    const sortOrder = hasSortDesc ? 'desc' : (hasSortAsc ? 'asc' : null);
    
    // 重新生成图表配置
    const newChartConfig = [{
        chartType: chartType || 'bar',
        xAxisColumn: selectedDimension,
        yAxisColumn: mentionedColumn,
        labelColumn: selectedDimension,
        valueColumn: mentionedColumn,
        title: `各${selectedDimension}的${mentionedColumn}${sortOrder ? (sortOrder === 'desc' ? '从高到低' : '从低到高') : ''}`,
        description: `${chartType || 'bar'}图表: 显示${selectedDimension}的${mentionedColumn}分布${sortOrder ? (sortOrder === 'desc' ? '（从高到低排序）' : '（从低到高排序）') : ''}`,
        aggregateFunction: 'sum',
        sortOrder: sortOrder
    }];
    
    // 添加处理消息
    addProcessingLog('info', '用户选择了分组维度', selectedDimension);
    
    try {
        // 使用新配置生成图表
        await handleNLPChartWithConfig(originalInput, dataInfo, totalStartTime, newChartConfig);
        
        // 图表生成成功，添加完成消息
        addMessage('system', '图表生成完成，请在下方"数据可视化"区域查看');
    } catch (error) {
        console.error('[handleMissingDimensionClarification] 生成图表失败:', error);
        addMessage('system', `生成图表失败: ${error.message}`);
    } finally {
        // 完成对话，更新状态
        completeConversation();
        
        // 滚动到数据可视化区域
        setTimeout(() => {
            const vizSection = document.getElementById('data-visualization');
            if (vizSection) {
                vizSection.scrollIntoView({ behavior: 'smooth' });
            }
        }, 500);
    }
}

/**
 * 通用分析函数（调用主分析流程）
 */
async function callGeneralAnalysis(userInput, dataInfo, totalStartTime) {
    // 直接调用主分析流程
    addProcessingLog('info', '用户完成追问，继续分析', userInput);
    await generalAnalysis(userInput, dataInfo, totalStartTime);
}

// 这是一个废弃的代码块，注释掉以避免语法错误
// 下面这段代码应该是某个函数的残留，但缺少函数定义
// 将其注释掉以解决语法错误
/*
    addMessage('system', clarificationHtml);
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // 绑定选项点击事件
    const optionButtons = messagesContainer.querySelectorAll('.clarification-option:not([data-bound])');
    optionButtons.forEach(btn => {
        btn.setAttribute('data-bound', 'true');
        btn.addEventListener('click', async function() {
            const selectedDimension = this.getAttribute('data-dimension');
            
            if (selectedDimension === '__other__') {
                // 用户选择"其他列"，提示用户输入
                const nlpInput = document.getElementById('nlp-input');
                if (nlpInput) {
                    nlpInput.placeholder = '请输入您想按哪一列分组...';
                    nlpInput.focus();
                }
                return;
            }
            
            // 用户选择了维度列，重新生成图表
            console.log('[showClarificationDialog] 用户选择维度:', selectedDimension);
            
            // 不要移除追问消息，而是将其置灰
            const clarificationMsg = messagesContainer.querySelector('.clarification-message');
            if (clarificationMsg) {
                clarificationMsg.style.opacity = '0.6';
                clarificationMsg.style.filter = 'grayscale(50%)';
                // 禁用所有按钮
                const buttons = clarificationMsg.querySelectorAll('.clarification-option');
                buttons.forEach(btn => {
                    btn.disabled = true;
                    btn.style.cursor = 'default';
                    btn.style.boxShadow = 'none';
                });
            }
            
            // 先添加用户选择的消息（在系统处理完成之前）
            addMessage('user', `按${selectedDimension}分组`);
            
            // 检测排序需求
            const hasSortDesc = /从高到低|从大到小|降序|倒序|排序.*高|排序.*大/.test(originalInput);
            const hasSortAsc = /从低到高|从小到大|升序|正序|排序.*低|排序.*小/.test(originalInput);
            const sortOrder = hasSortDesc ? 'desc' : (hasSortAsc ? 'asc' : null);
            
            // 重新生成图表配置
            const newChartConfig = [{
                chartType: chartType,
                xAxisColumn: selectedDimension,
                yAxisColumn: mentionedColumn,
                labelColumn: selectedDimension,
                valueColumn: mentionedColumn,
                title: `各${selectedDimension}的${mentionedColumn}${sortOrder ? (sortOrder === 'desc' ? '从高到低' : '从低到高') : ''}`,
                description: `${chartType}图表: 显示${selectedDimension}的${mentionedColumn}分布${sortOrder ? (sortOrder === 'desc' ? '（从高到低排序）' : '（从低到高排序）') : ''}`,
                aggregateFunction: 'sum',
                sortOrder: sortOrder
            }];
            
            // 显示处理中的消息
            addProcessingLog('info', '用户选择了分组维度', selectedDimension);
            const processingMessage = addMessage('system', '正在生成图表...');
            
            try {
                // 使用新配置生成图表
                await handleNLPChartWithConfig(originalInput, dataInfo, totalStartTime, newChartConfig);
                
                // 图表生成成功，添加完成消息
                addMessage('system', '图表生成完成，请在下方"数据可视化"区域查看');
            } catch (error) {
                console.error('[showClarificationDialog] 生成图表失败:', error);
                addMessage('system', `生成图表失败: ${error.message}`);
            } finally {
                // 完成对话，更新状态
                completeConversation();
                
                // 滚动到数据可视化区域
                scrollToVisualization();
            }
        });
        
        // 添加悬停效果
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
        });
    });
}
*/
// ==================== 多字段筛选功能 ====================

// 添加筛选条件
function addFilterCondition() {
    const container = document.getElementById('filter-conditions');
    if (!container) return;
    
    // 检查 headers 是否可用
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
        console.warn('[addFilterCondition] 未检测到列信息，请先上传数据文件');
        
        // 显示友好提示
        const existingHint = container.querySelector('.filter-hint');
        if (!existingHint) {
            const hintDiv = document.createElement('div');
            hintDiv.className = 'filter-hint';
            hintDiv.style.cssText = 'padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-bottom: 10px; color: #856404; font-size: 0.9em;';
            hintDiv.innerHTML = '<strong>提示：</strong>请先上传数据文件，然后再添加筛选条件';
            container.appendChild(hintDiv);
            
            // 3秒后自动移除提示
            setTimeout(() => {
                if (hintDiv.parentElement) {
                    hintDiv.remove();
                }
            }, 3000);
        }
        return;
    }
    
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; padding: 10px; background: #f8f9fa; border-radius: 4px;';
    
    // 移除可能存在的提示
    const existingHint = container.querySelector('.filter-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    // 构建列选项
    const columnOptions = headers.map(h => `<option value="${h}">${h}</option>`).join('');
    
    filterRow.innerHTML = `
        <select class="filter-column" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; min-width: 150px; font-size: 0.9em; background: white;">
            <option value="">选择列</option>
            ${columnOptions}
        </select>
        <select class="filter-operator" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; min-width: 100px; font-size: 0.9em; background: white;">
            <option value="eq">等于</option>
            <option value="neq">不等于</option>
            <option value="gt">大于</option>
            <option value="lt">小于</option>
            <option value="gte">大于等于</option>
            <option value="lte">小于等于</option>
            <option value="contains">包含</option>
            <option value="startsWith">开头是</option>
            <option value="endsWith">结尾是</option>
        </select>
        <input type="text" class="filter-value" placeholder="输入筛选值" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; flex: 1; min-width: 150px; font-size: 0.9em;">
        <button class="remove-filter-btn" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9em; white-space: nowrap;">删除</button>
    `;
    
    // 绑定删除按钮事件
    const removeBtn = filterRow.querySelector('.remove-filter-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            filterRow.remove();
        });
    }
    
    // 绑定列选择事件，用于显示建议值
    const columnSelect = filterRow.querySelector('.filter-column');
    if (columnSelect && data && Array.isArray(data) && data.length > 0) {
        columnSelect.addEventListener('change', () => {
            const selectedColumn = columnSelect.value;
            if (selectedColumn) {
                const columnIndex = headers.indexOf(selectedColumn);
                if (columnIndex >= 0) {
                    const uniqueValues = [...new Set(data.map(row => row[columnIndex]))].slice(0, 10);
                    const valueInput = filterRow.querySelector('.filter-value');
                    if (valueInput && uniqueValues.length > 0 && uniqueValues.length <= 10) {
                        valueInput.placeholder = `建议值: ${uniqueValues.join(', ')}`;
                    }
                }
            }
        });
    }
    
    // 添加动画效果
    filterRow.style.opacity = '0';
    filterRow.style.transform = 'translateY(-10px)';
    filterRow.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    container.appendChild(filterRow);
    
    requestAnimationFrame(() => {
        filterRow.style.opacity = '1';
        filterRow.style.transform = 'translateY(0)';
    });
    
    console.log('[addFilterCondition] 筛选条件已添加，当前可用列:', headers);
}

// 更新所有筛选条件的列选项
function updateFilterColumnOptions() {
    const container = document.getElementById('filter-conditions');
    if (!container || !headers || !Array.isArray(headers) || headers.length === 0) return;
    
    const filterRows = container.querySelectorAll('.filter-row');
    filterRows.forEach(row => {
        const columnSelect = row.querySelector('.filter-column');
        if (columnSelect) {
            // 保存当前选中的值
            const currentValue = columnSelect.value;
            
            // 重新构建选项
            const columnOptions = headers.map(h => `<option value="${h}">${h}</option>`).join('');
            columnSelect.innerHTML = `<option value="">选择列</option>${columnOptions}`;
            
            // 恢复之前选中的值（如果仍然存在）
            if (currentValue && headers.includes(currentValue)) {
                columnSelect.value = currentValue;
            }
        }
    });
    
    console.log('[updateFilterColumnOptions] 筛选条件列选项已更新，可用列:', headers);
}

// 应用多字段筛选
function applyMultiFilter() {
    const container = document.getElementById('filter-conditions');
    if (!container) return;
    
    const filterRows = container.querySelectorAll('.filter-row');
    const conditions = [];
    
    filterRows.forEach(row => {
        const column = row.querySelector('.filter-column').value;
        const operator = row.querySelector('.filter-operator').value;
        const value = row.querySelector('.filter-value').value;
        
        if (column && value) {
            conditions.push({ column, operator, value });
        }
    });
    
    if (conditions.length === 0) {
        alert('请至少设置一个筛选条件');
        return;
    }
    
    addProcessingLog('info', '应用多字段筛选', `条件数量: ${conditions.length}`);
    const startTime = Date.now();
    
    // 应用筛选
    data = originalData.filter(row => {
        return conditions.every(condition => {
            const cellValue = row[condition.column];
            if (cellValue === undefined || cellValue === null) return false;
            
            const strValue = cellValue.toString();
            const numValue = parseFloat(cellValue);
            const numConditionValue = parseFloat(condition.value);
            
            switch (condition.operator) {
                case 'eq':
                    return strValue === condition.value;
                case 'neq':
                    return strValue !== condition.value;
                case 'gt':
                    return !isNaN(numValue) && !isNaN(numConditionValue) && numValue > numConditionValue;
                case 'lt':
                    return !isNaN(numValue) && !isNaN(numConditionValue) && numValue < numConditionValue;
                case 'gte':
                    return !isNaN(numValue) && !isNaN(numConditionValue) && numValue >= numConditionValue;
                case 'lte':
                    return !isNaN(numValue) && !isNaN(numConditionValue) && numValue <= numConditionValue;
                case 'contains':
                    return strValue.includes(condition.value);
                default:
                    return true;
            }
        });
    });
    
    const duration = Date.now() - startTime;
    addProcessingLog('performance', '筛选完成', `耗时: ${duration}ms, 结果: ${data.length} 条`);
    
    // 重新显示数据
    showDataPreview();
}

// 清除所有筛选
function clearAllFilters() {
    const container = document.getElementById('filter-conditions');
    if (container) {
        container.innerHTML = '';
        addFilterCondition(); // 添加一个空的筛选条件
    }
    
    data = [...originalData];
    addProcessingLog('info', '清除所有筛选', `恢复数据: ${data.length} 条`);
    showDataPreview();
}

// 处理拖拽经过
function handleDragOver(e) {
    e.preventDefault();
    const dropArea = document.getElementById('drop-area');
    dropArea.classList.add('dragover');
}

// 处理拖拽离开
function handleDragLeave() {
    const dropArea = document.getElementById('drop-area');
    dropArea.classList.remove('dragover');
}

// 处理文件拖拽
function handleDrop(e) {
    e.preventDefault();
    const dropArea = document.getElementById('drop-area');
    dropArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// 处理文件选择
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// 处理文件
function processFile(file) {
    console.log('[文件上传] 开始处理文件:', file.name, file.size);
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    
    // 重置智能查询与可视化区域
    resetNLPAreas();
    
    try {
        // 立即开始文件处理，不延迟
        if (file.name.endsWith('.csv')) {
            parseCSV(file);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            parseExcel(file);
        } else {
            throw new Error('不支持的文件格式，请上传CSV或Excel文件');
        }
    } catch (error) {
        console.error('[文件上传] 处理失败:', error);
        addProcessingLog('error', '文件处理失败', error.message);
        showNotification(`文件处理失败: ${error.message}`, 'error');
        loading.classList.add('hidden');
    }
}

// 更新文件上下文（文件名、Sheet名称、关键词）
function updateFileContext(fileName, sheetName) {
    fileContext.fileName = fileName;
    fileContext.sheetName = sheetName;
    fileContext.fileKeywords = extractFileKeywords(fileName, sheetName);
    
    console.log('[文件上下文] 已更新:', fileContext);
    
    // 在UI上显示文件上下文信息
    const techInfo = document.getElementById('tech-info');
    if (techInfo) {
        const contextText = fileContext.fileKeywords.length > 0 
            ? `${fileName} (${fileContext.fileKeywords.join(', ')})`
            : fileName;
        techInfo.textContent = contextText;
        techInfo.title = `文件: ${fileName}\nSheet: ${sheetName || '无'}\n关键词: ${fileContext.fileKeywords.join(', ')}`;
    }
}

// 从文件名和Sheet名称中提取关键词
function extractFileKeywords(fileName, sheetName) {
    const keywords = [];
    
    // 移除文件扩展名
    const baseName = fileName.replace(/\.(xlsx|csv|xls)$/i, '');
    
    // 提取中文关键词（2-4个字的业务词汇）
    const businessKeywords = baseName.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    
    // 业务词汇白名单（常见的业务实体）
    const businessEntityWhitelist = [
        '事件', '订单', '用户', '客户', '商品', '产品', '销售', '采购',
        '库存', '人员', '员工', '部门', '项目', '任务', '合同', '发票',
        '账单', '流水', '交易', '记录', '明细', '统计', '报表', '数据',
        '险情', '故障', '报警', '预警', '工单', '派单', '调度', '指挥',
        '应急', '值班', '巡查', '检查', '审批', '申请', '投诉', '反馈'
    ];
    
    // 过滤出有意义的业务关键词
    businessKeywords.forEach(kw => {
        if (businessEntityWhitelist.includes(kw) || kw.length >= 2) {
            if (!keywords.includes(kw)) {
                keywords.push(kw);
            }
        }
    });
    
    // 提取时间关键词（如：24年、3季度、2024年等）
    const timeKeywords = baseName.match(/\d{2,4}年|\d{1,2}季度|\d{1,2}月|上半年|下半年/g) || [];
    timeKeywords.forEach(kw => {
        if (!keywords.includes(kw)) {
            keywords.push(kw);
        }
    });
    
    // 从Sheet名称提取关键词
    if (sheetName) {
        const sheetKeywords = sheetName.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
        sheetKeywords.forEach(kw => {
            if (businessEntityWhitelist.includes(kw) && !keywords.includes(kw)) {
                keywords.push(kw);
            }
        });
    }
    
    return keywords;
}

// 重置智能查询与可视化区域
function resetNLPAreas() {
    // 重置页码
    currentPage = 1;
    
    // 清空图表
    charts = [];
    
    // 隐藏数据可视化区域
    const dataVisualization = document.getElementById('data-visualization');
    if (dataVisualization) {
        dataVisualization.classList.add('hidden');
    }
    
    // 清空图表容器
    const chartsContainer = document.querySelector('.charts-container');
    if (chartsContainer) {
        chartsContainer.innerHTML = '';
    }
    
    // 隐藏AI分析区域
    const aiAnalysis = document.getElementById('ai-analysis');
    if (aiAnalysis) {
        aiAnalysis.classList.add('hidden');
    }
    
    // 重置NLP查询结果
    const nlpResult = document.getElementById('nlp-result');
    if (nlpResult) {
        nlpResult.innerHTML = '';
        nlpResult.classList.add('hidden');
    }
    
    // 清空NLP查询输入
    const nlpQueryInput = document.getElementById('nlp-query-input');
    if (nlpQueryInput) {
        nlpQueryInput.value = '';
    }
    
    // 隐藏NLP进度条
    hideNLPProgress();
    
    // 重置筛选条件
    const filterContainer = document.getElementById('filter-conditions');
    if (filterContainer) {
        filterContainer.innerHTML = '';
    }
    
    // 清空对话内容
    const conversationMessages = document.getElementById('conversation-messages');
    if (conversationMessages) {
        // 保留系统欢迎消息
        conversationMessages.innerHTML = `
            <div class="message system">
                <div class="message-content">
                    <p>你好！我是智能数据洞察助手，有什么可以帮助你的吗？</p>
                </div>
            </div>
        `;
    }
    
    // 清空对话输入
    const conversationInput = document.getElementById('conversation-input');
    if (conversationInput) {
        conversationInput.value = '';
    }
    
    // 重置数据库模式
    useDatabaseMode = false;
    if (dbManager) {
        dbManager.close();
    }
    
    addProcessingLog('info', '已重置所有区域', '准备导入新文件');
}

// 解析CSV文件
function parseCSV(file) {
    // 更新文件上下文
    updateFileContext(file.name, '');
    
    // 尝试不同的编码
    const encodings = ['UTF-8', 'GBK', 'GB2312'];
    let currentEncodingIndex = 0;
    
    function tryReadWithEncoding(encoding) {
        console.log(`尝试使用编码 ${encoding} 读取CSV文件...`);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const arrayBuffer = e.target.result;
                
                // 使用TextDecoder进行更可靠的编码解码
                let text;
                try {
                    // 尝试使用TextDecoder解码
                    const decoder = new TextDecoder(encoding);
                    text = decoder.decode(arrayBuffer);
                } catch (decoderError) {
                    // 如果TextDecoder失败，回退到FileReader的readAsText
                    console.warn('TextDecoder失败，使用FileReader.readAsText:', decoderError);
                    // 重新读取为文本
                    const textReader = new FileReader();
                    textReader.onload = function(e2) {
                        try {
                            processText(e2.target.result, encoding);
                        } catch (error) {
                            handleEncodingError(error);
                        }
                    };
                    textReader.onerror = handleEncodingError;
                    textReader.readAsText(file, encoding);
                    return;
                }
                
                processText(text, encoding);
            } catch (error) {
                handleEncodingError(error);
            }
        };
        
        reader.onerror = handleEncodingError;
        
        // 先读取为ArrayBuffer，再使用TextDecoder解码
        reader.readAsArrayBuffer(file);
    }
    
    function processText(text, encoding) {
        // 检测并处理BOM（字节顺序标记）
        let cleanText = text;
        if (text.charCodeAt(0) === 0xFEFF) {
            cleanText = text.substring(1);
        }
        
        // 手动解析CSV
        const lines = cleanText.split(/\r?\n/);
        
        if (lines.length === 0) {
            // 尝试下一个编码
            tryNextEncoding();
            return;
        }
        
        // 第一行作为表头
        const headerLine = lines[0].trim();
        if (!headerLine) {
            // 尝试下一个编码
            tryNextEncoding();
            return;
        }
        
        // 解析表头（支持逗号分隔）
        const headersArray = parseCSVLine(headerLine);
        console.log('解析的表头:', headersArray);
        
        if (headersArray.length === 0) {
            // 尝试下一个编码
            tryNextEncoding();
            return;
        }
        
        // 解析数据行
        const dataArray = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseCSVLine(line);
            if (values.length > 0) {
                const row = {};
                for (let j = 0; j < headersArray.length; j++) {
                    row[headersArray[j]] = values[j] || '';
                }
                dataArray.push(row);
            }
        }
        
        if (dataArray.length === 0) {
            // 尝试下一个编码
            tryNextEncoding();
            return;
        }
        
        // 检查是否有乱码（简单检测：如果包含大量非ASCII字符但不是有效的中文字符）
        const firstRow = dataArray[0];
        const firstValue = Object.values(firstRow)[0];
        if (firstValue && containsInvalidChars(firstValue)) {
            console.warn('检测到可能的乱码，尝试下一个编码');
            tryNextEncoding();
            return;
        }
        
        // 赋值给全局变量
        headers = headersArray;
        originalData = dataArray;
        data = [...originalData];
        
        console.log('成功使用编码:', encoding);
        console.log('表头数量:', headers.length);
        console.log('数据行数:', originalData.length);
        console.log('第一行数据:', originalData[0]);
        
        addProcessingLog('success', 'CSV文件解析完成', `共 ${originalData.length} 行，${headers.length} 列，编码: ${encoding}`);
                
                // 更新筛选列选项
                updateFilterColumns();
                
                // CSV向量化
                if (vectorizationEnabled) {
                    // 更新向量化状态为"正在向量化"
                    updateVectorizationStatus('processing');
                    updateDetailVectorizationStatus('processing');
                    
                    // 准备向量化数据
                    const vectorizationData = {
                        headers: headers,
                        rows: originalData.map(row => {
                            const rowArray = [];
                            for (const header of headers) {
                                rowArray.push(row[header] || '');
                            }
                            return rowArray;
                        })
                    };
                    
                    // 调用向量化API
                    vectorizeExcelData(vectorizationTable, vectorizationData).then(result => {
                        // 更新向量化状态
                        updateVectorizationStatus();
                        updateDetailVectorizationStatus();
                    });
                }
                
                processData();
    }
    
    function handleEncodingError(error) {
        console.error('编码处理失败:', error);
        tryNextEncoding();
    }
    
    function tryNextEncoding() {
        currentEncodingIndex++;
        if (currentEncodingIndex < encodings.length) {
            tryReadWithEncoding(encodings[currentEncodingIndex]);
        } else {
            alert('无法正确解析CSV文件，请检查文件编码或尝试转换为UTF-8编码');
            document.getElementById('loading').classList.add('hidden');
        }
    }
    
    function containsInvalidChars(str) {
        // 检测是否包含大量无效字符（可能是乱码）
        let invalidCount = 0;
        let totalChars = 0;
        
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            totalChars++;
            
            // 检查是否是有效的ASCII或中文字符
            if (charCode < 32 || (charCode > 126 && (charCode < 19968 || charCode > 40869))) {
                invalidCount++;
            }
        }
        
        // 如果无效字符比例超过30%，认为是乱码
        return totalChars > 0 && (invalidCount / totalChars) > 0.3;
    }
    
    // 开始尝试第一个编码
    tryReadWithEncoding(encodings[currentEncodingIndex]);
}

// 辅助函数：解析CSV行（支持引号包围的字段）
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// 解析Excel文件
function parseExcel(file) {
    // 检查XLSX库是否可用
    if (typeof XLSX === 'undefined') {
        console.error('XLSX库未加载');
        alert('Excel解析库加载失败，请刷新页面重试');
        document.getElementById('loading').classList.add('hidden');
        return;
    }
    
    console.log('开始解析Excel文件:', file.name);
    console.log('XLSX库版本:', XLSX.version);
    console.log('文件类型:', file.type);
    
    // 判断是.xlsx还是.xls格式
    const isXLS = file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.xlsx');
    console.log('文件格式:', isXLS ? 'XLS (旧版)' : 'XLSX (新版)');
    
    // 更新文件上下文
    updateFileContext(file.name, '');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const fileData = e.target.result;
            
            let workbook;
            
            // 统一使用array方式读取，尝试不同的codepage选项
            // 对于中文Windows生成的XLS文件，通常使用GBK编码（codepage 936）
            console.log('使用array方式读取Excel文件...');
            
            // 尝试不同的codepage选项
            const readOptions = [
                { type: 'array' },  // 默认
                { type: 'array', codepage: 936 },  // GBK（中文Windows默认编码）
                { type: 'array', codepage: 65001 }  // UTF-8
            ];
            
            for (let i = 0; i < readOptions.length; i++) {
                try {
                    console.log(`尝试读取选项 ${i + 1}:`, readOptions[i]);
                    workbook = XLSX.read(fileData, readOptions[i]);
                    if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
                        console.log(`读取选项 ${i + 1} 成功！`);
                        break;
                    }
                } catch (err) {
                    console.warn(`读取选项 ${i + 1} 失败:`, err);
                    continue;
                }
            }
            
            if (!workbook) {
                alert('Excel文件解析失败，请检查文件格式');
                document.getElementById('loading').classList.add('hidden');
                return;
            }
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                alert('Excel文件没有工作表');
                document.getElementById('loading').classList.add('hidden');
                return;
            }
            
            const firstSheetName = workbook.SheetNames[0];
            console.log('工作表名称:', firstSheetName);
            
            // 更新文件上下文中的Sheet名称
            fileContext.sheetName = firstSheetName;
            console.log('[文件上下文] Sheet名称:', firstSheetName);
            
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 获取所有数据，使用defval选项处理空值
            const allData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1,
                defval: ''
            });
            
            console.log('原始数据预览 (前3行):', allData.slice(0, 3));
            
            if (!allData || allData.length === 0) {
                alert('Excel文件为空');
                document.getElementById('loading').classList.add('hidden');
                return;
            }
            
            // 第一行作为表头
            headers = allData[0] || [];
            console.log('表头:', headers);
            
            // 剩余行作为数据
            originalData = [];
            for (let i = 1; i < allData.length; i++) {
                const rowData = allData[i];
                const row = {};
                let hasData = false;
                
                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j] || `列${j + 1}`;
                    const value = rowData[j];
                    
                    // 直接使用原始值，不强制转换
                    if (value !== null && value !== undefined) {
                        row[header] = value;
                    } else {
                        row[header] = '';
                    }
                    
                    if (row[header] !== '') {
                        hasData = true;
                    }
                }
                
                if (hasData) {
                    originalData.push(row);
                }
            }
            
            data = [...originalData];
            
            console.log('数据行数:', originalData.length);
            console.log('第一行数据:', originalData[0]);
            
            addProcessingLog('success', 'Excel文件解析完成', `共 ${originalData.length} 行，${headers.length} 列，格式: ${isXLS ? 'XLS' : 'XLSX'}`);
            
            // 更新筛选列选项
            updateFilterColumns();
            
            // Excel向量化
            if (vectorizationEnabled) {
                // 更新向量化状态为"正在向量化"
                updateVectorizationStatus('processing');
                updateDetailVectorizationStatus('processing');
                
                // 准备向量化数据
                const vectorizationData = {
                    headers: headers,
                    rows: originalData.map(row => {
                        const rowArray = [];
                        for (const header of headers) {
                            rowArray.push(row[header] || '');
                        }
                        return rowArray;
                    })
                };
                
                // 调用向量化API
                vectorizeExcelData(vectorizationTable, vectorizationData).then(result => {
                    // 更新向量化状态
                    updateVectorizationStatus();
                    updateDetailVectorizationStatus();
                });
            }
            
            processData();
        } catch (error) {
            console.error('Excel解析失败:', error);
            alert('Excel文件解析失败: ' + error.message);
            document.getElementById('loading').classList.add('hidden');
        }
    };
    reader.onerror = function(error) {
        console.error('文件读取失败:', error);
        alert('文件读取失败');
        document.getElementById('loading').classList.add('hidden');
    };
    
    // 统一使用ArrayBuffer方式读取
    reader.readAsArrayBuffer(file);
}

// 处理数据
async function processData() {
    try {
        console.log('[数据处理] 开始处理数据，行数:', originalData.length, '列数:', headers.length);
        
        const loading = document.getElementById('loading');
        
        // 检查数据是否为空
        if (!originalData || originalData.length === 0) {
            throw new Error('没有数据可供处理');
        }
        
        if (!headers || headers.length === 0) {
            throw new Error('没有表头信息');
        }
        
        // 判断是否需要启用数据库模式（数据量大于10000行）
        const LARGE_DATA_THRESHOLD = 10000;
        console.log('检查数据库模式:', {
            dataLength: originalData.length,
            threshold: LARGE_DATA_THRESHOLD,
            dbManagerExists: !!dbManager,
            dbManagerInitialized: dbManager?.isInitialized
        });
        
        if (originalData.length > LARGE_DATA_THRESHOLD && dbManager) {
            useDatabaseMode = true;
            addProcessingLog('info', `数据量较大 (${originalData.length} 行)，启用数据库模式`, '使用SQL.js进行高效查询');
            
            try {
                // 初始化数据库并导入数据
                const initResult = await dbManager.init();
                console.log('数据库初始化结果:', initResult);
                
                if (initResult) {
                    await dbManager.createTableFromData(originalData, headers);
                    addProcessingLog('success', '数据库初始化完成', `已创建数据表，共 ${originalData.length} 行`);
                } else {
                    throw new Error('数据库初始化返回false');
                }
            } catch (error) {
                console.error('数据库初始化失败:', error);
                addProcessingLog('warning', '数据库初始化失败，降级使用内存模式', error.message);
                useDatabaseMode = false;
            }
        } else {
            useDatabaseMode = false;
            if (originalData.length > LARGE_DATA_THRESHOLD && !dbManager) {
                addProcessingLog('warning', `数据量较大 (${originalData.length} 行) 但数据库管理器未初始化`, '使用内存模式');
            } else if (originalData.length > 1000) {
                addProcessingLog('info', `数据量: ${originalData.length} 行，使用内存模式`);
            }
        }
        
        // ========== V4.0新增：生成数据画像 ==========
        generateDataProfile();
        
        // 显示数据预览
        showDataPreview();
        
        // 显示可视化和AI分析区域（但不自动生成图表）
        document.getElementById('data-visualization').classList.remove('hidden');
        document.getElementById('ai-analysis').classList.remove('hidden');
        
        // 隐藏加载动画
        loading.classList.remove('hidden');
        setTimeout(() => {
            loading.classList.add('hidden');
        }, 100);
        
        console.log('[数据处理] 处理完成');
        
    } catch (error) {
        console.error('[数据处理] 失败:', error);
        addProcessingLog('error', '数据处理失败', error.message);
        
        // 确保加载动画被隐藏
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
        
        // 显示错误信息
        showNotification(`数据处理失败: ${error.message}`, 'error');
    }
}

// V4.0新增：生成数据画像
function generateDataProfile() {
    console.log('[V4.0] 开始生成数据画像...');
    
    try {
        const startTime = Date.now();
        const profile = window.dataProfiler.profile(originalData, headers);
        const duration = Date.now() - startTime;
        
        if (profile) {
            window.currentDataProfile = profile;
            addProcessingLog('success', '数据画像生成完成', `${profile.summary}，耗时${duration}ms`);
            console.log('[V4.0] 数据画像:', profile);
            updateDataInfoWithProfile(profile);
            renderDataProfilePanel(profile);
        }
    } catch (error) {
        console.error('[V4.0] 数据画像生成失败:', error);
        addProcessingLog('warning', '数据画像生成失败', error.message);
    }
}

// V5.0重构：渲染数据画像面板
async function renderDataProfilePanel(profile) {
    if (!profile) return;
    
    // V5.0：更新概要信息（只更新数字，不渲染卡片）
    const totalRows = document.getElementById('total-rows');
    const totalCols = document.getElementById('total-cols');
    const numericCols = document.getElementById('numeric-cols');
    const textCols = document.getElementById('text-cols');
    const dateCols = document.getElementById('date-cols');
    const qualityGrade = document.getElementById('quality-grade');
    
    if (totalRows) totalRows.textContent = profile.shape?.rows || 0;
    if (totalCols) totalCols.textContent = profile.shape?.cols || 0;
    if (numericCols) numericCols.textContent = profile.schema?.numericCols?.length || 0;
    if (textCols) textCols.textContent = profile.schema?.textCols?.length || 0;
    if (dateCols) dateCols.textContent = profile.schema?.dateCols?.length || 0;
    if (qualityGrade) qualityGrade.textContent = profile.quality?.grade || 'A';
    
    // 添加向量化状态信息
    const vectorizationStatus = document.getElementById('vectorization-status');
    if (vectorizationStatus) {
        const collections = await getVectorizedCollections();
        const isVectorized = collections.includes(vectorizationTable);
        vectorizationStatus.textContent = isVectorized ? '✅ 已向量化' : '❌ 未向量化';
        vectorizationStatus.style.color = isVectorized ? '#28a745' : '#dc3545';
    }
    
    // V5.0：绑定"查看详情"按钮事件
    const viewDetailBtn = document.getElementById('view-profile-detail-btn');
    if (viewDetailBtn) {
        viewDetailBtn.onclick = () => {
            openProfileDetailModal(profile);
        };
    }
}

// V5.0新增：打开数据画像详细弹窗
async function openProfileDetailModal(profile) {
    const modal = document.getElementById('profile-detail-modal');
    const content = document.getElementById('profile-detail-content');
    if (!modal || !content || !profile) return;
    
    // 渲染详细内容
    content.innerHTML = `
        <div class="profile-detail-section">
            <h4>📊 数据概览</h4>
            <div class="profile-detail-grid">
                <div class="detail-item">
                    <span class="detail-label">总行数</span>
                    <span class="detail-value">${profile.shape?.rows || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">总列数</span>
                    <span class="detail-value">${profile.shape?.cols || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">数值列</span>
                    <span class="detail-value">${profile.schema?.numericCols?.length || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">文本列</span>
                    <span class="detail-value">${profile.schema?.textCols?.length || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">日期列</span>
                    <span class="detail-value">${profile.schema?.dateCols?.length || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">分类列</span>
                    <span class="detail-value">${profile.schema?.categoricalCols?.length || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">向量化状态</span>
                    <span class="detail-value" id="detail-vectorization-status">❌ 未向量化</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">向量化表名</span>
                    <span class="detail-value">${vectorizationTable}</span>
                </div>
            </div>
        </div>
        
        <div class="profile-detail-section">
            <h4>📋 字段类型分布</h4>
            <div class="profile-columns-detail">
                ${renderProfileColumnsDetail(profile)}
            </div>
        </div>
        
        <div class="profile-detail-section">
            <h4>✅ 数据质量评估</h4>
            <div class="profile-quality-detail">
                ${renderProfileQualityDetail(profile)}
            </div>
        </div>
    `;
    
    // 更新向量化状态
    updateDetailVectorizationStatus();
    
    // 显示弹窗
    modal.classList.remove('hidden');
}

// 更新数据画像详情页面的向量化状态
function updateDetailVectorizationStatus(status = 'check') {
    const vectorizationStatus = document.getElementById('detail-vectorization-status');
    if (!vectorizationStatus) return;
    
    if (status === 'processing') {
        vectorizationStatus.textContent = '⏳ 正在向量化';
        vectorizationStatus.style.color = '#ffc107';
    } else if (status === 'check') {
        // 检查实际状态
        getVectorizedCollections().then(collections => {
            const isVectorized = collections.includes(vectorizationTable);
            vectorizationStatus.textContent = isVectorized ? '✅ 已向量化' : '❌ 未向量化';
            vectorizationStatus.style.color = isVectorized ? '#28a745' : '#dc3545';
        });
    }
}

// V5.0新增：渲染字段类型详细列表
function renderProfileColumnsDetail(profile) {
    if (!profile.columns) return '<p>暂无字段信息</p>';
    
    const columns = Object.entries(profile.columns).map(([name, info]) => ({
        name,
        type: info.type,
        isCategorical: info.isCategorical,
        icon: info.type === 'numeric' ? '🔢' : info.type === 'datetime' ? '📅' : info.isCategorical ? '🏷️' : '📝'
    }));
    
    return columns.map(col => `
        <div class="column-detail-item">
            <span class="column-icon">${col.icon}</span>
            <span class="column-name">${col.name}</span>
            <span class="column-type">${col.type}${col.isCategorical ? ' (分类)' : ''}</span>
        </div>
    `).join('');
}

// V5.0新增：渲染数据质量详细信息
function renderProfileQualityDetail(profile) {
    if (!profile.quality) return '<p>暂无质量评估信息</p>';
    
    const quality = profile.quality;
    return `
        <div class="quality-score">
            <span class="quality-grade">${quality.grade || 'A'}</span>
            <span class="quality-label">质量评级</span>
        </div>
        <div class="quality-metrics">
            <div class="quality-metric">
                <span class="metric-label">完整度</span>
                <span class="metric-value">${quality.completeness.toFixed(1)}%</span>
            </div>
            <div class="quality-metric">
                <span class="metric-label">唯一性</span>
                <span class="metric-value">${quality.uniqueness ? quality.uniqueness.toFixed(1) : 'N/A'}%</span>
            </div>
            <div class="quality-metric">
                <span class="metric-label">空值数</span>
                <span class="metric-value">${quality.nullCount || 0}</span>
            </div>
            <div class="quality-metric">
                <span class="metric-label">重复行</span>
                <span class="metric-value">${quality.duplicateCount || 0}</span>
            </div>
        </div>
    `;
}

// V5.0：绑定关闭弹窗事件
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-profile-detail-modal');
    const modal = document.getElementById('profile-detail-modal');
    
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    }
    
    // 点击遮罩关闭
    if (modal) {
        modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
});

// 渲染摘要统计
function renderProfileSummary(profile) {
    const container = document.getElementById('profile-summary');
    if (!container) return;
    
    const stats = [
        { label: '总行数', value: profile.shape?.rows || 0, icon: '📊' },
        { label: '总列数', value: profile.shape?.cols || 0, icon: '📋' },
        { label: '数值列', value: profile.schema?.numericCols?.length || 0, icon: '🔢' },
        { label: '文本列', value: profile.schema?.textCols?.length || 0, icon: '📝' },
        { label: '日期列', value: profile.schema?.dateCols?.length || 0, icon: '📅' },
        { label: '分类列', value: profile.schema?.categoricalCols?.length || 0, icon: '🏷️' }
    ];
    
    container.innerHTML = stats.map(stat => `
        <div class="profile-stat">
            <span class="stat-value">${stat.icon} ${stat.value}</span>
            <span class="stat-label">${stat.label}</span>
        </div>
    `).join('');
}

// 渲染列信息
function renderProfileColumns(profile) {
    const container = document.getElementById('profile-columns');
    if (!container || !profile.columns) return;
    
    // 按类型分组
    const numericCols = Object.entries(profile.columns)
        .filter(([_, col]) => col.type === 'numeric')
        .map(([name, _]) => name);
    
    const textCols = Object.entries(profile.columns)
        .filter(([_, col]) => col.type === 'text' && !col.isCategorical)
        .map(([name, _]) => name);
    
    const dateCols = Object.entries(profile.columns)
        .filter(([_, col]) => col.type === 'datetime')
        .map(([name, _]) => name);
    
    const categoricalCols = Object.entries(profile.columns)
        .filter(([_, col]) => col.isCategorical)
        .map(([name, _]) => name);
    
    container.innerHTML = `
        <h4>字段类型分布</h4>
        <div class="column-list">
            ${numericCols.map(col => `<span class="column-tag numeric"><span class="tag-icon">🔢</span>${col}</span>`).join('')}
            ${textCols.map(col => `<span class="column-tag text"><span class="tag-icon">📝</span>${col}</span>`).join('')}
            ${dateCols.map(col => `<span class="column-tag date"><span class="tag-icon">📅</span>${col}</span>`).join('')}
            ${categoricalCols.map(col => `<span class="column-tag categorical"><span class="tag-icon">🏷️</span>${col}</span>`).join('')}
        </div>
    `;
}

// 渲染数据质量
function renderProfileQuality(profile) {
    const container = document.getElementById('profile-quality');
    if (!container || !profile.quality) return;
    
    const quality = profile.quality;
    const grade = quality.grade || 'N/A';
    const completeness = quality.completeness || 0;
    
    container.innerHTML = `
        <h4>数据质量评估</h4>
        <div class="quality-meter">
            <div class="quality-bar">
                <div class="quality-fill grade-${grade.toLowerCase()}" style="width: ${completeness}%"></div>
            </div>
            <span class="quality-label grade-${grade.toLowerCase()}">${grade}</span>
        </div>
        <div class="quality-details">
            <div class="quality-item">
                <div class="item-value">${completeness}%</div>
                <div class="item-label">完整度</div>
            </div>
            <div class="quality-item">
                <div class="item-value">${quality.uniqueness || 0}%</div>
                <div class="item-label">唯一性</div>
            </div>
            <div class="quality-item">
                <div class="item-value">${quality.emptyCells || 0}</div>
                <div class="item-label">空值数</div>
            </div>
            <div class="quality-item">
                <div class="item-value">${quality.duplicateRows || 0}</div>
                <div class="item-label">重复行</div>
            </div>
        </div>
    `;
}

// V4.0新增：更新数据信息显示（包含画像信息）
function updateDataInfoWithProfile(profile) {
    const dataInfo = document.getElementById('data-info');
    if (!dataInfo || !profile) return;
    
    const qualityGrade = profile.quality?.grade || 'N/A';
    const gradeColors = {
        'A': '#4caf50',
        'B': '#8bc34a', 
        'C': '#ff9800',
        'D': '#ff5722',
        'F': '#f44336'
    };
    const gradeColor = gradeColors[qualityGrade] || '#666';
    
    dataInfo.innerHTML = `
        <span class="data-stat">📊 ${profile.shape.rows} 行 × ${profile.shape.cols} 列</span>
        <span class="data-stat">🔢 数值型 ${profile.schema?.numericCols?.length || 0} 个</span>
        <span class="data-stat">📝 文本型 ${profile.schema?.textCols?.length || 0} 个</span>
        <span class="data-stat">📅 日期型 ${profile.schema?.dateCols?.length || 0} 个</span>
        <span class="data-stat" style="color: ${gradeColor};">✓ 质量 ${profile.quality?.completeness || 0}% (${qualityGrade})</span>
    `;
}

// 更新筛选列选项
function updateFilterColumns() {
    const filterColumn = document.getElementById('filter-column');
    if (filterColumn) {
        // 清空现有选项
        filterColumn.innerHTML = '<option value="">选择列</option>';
        
        // 添加新选项
        headers.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            filterColumn.appendChild(option);
        });
    }
}

// 应用筛选
function applyFilter() {
    const column = document.getElementById('filter-column').value;
    const operator = document.getElementById('filter-operator').value;
    const value = document.getElementById('filter-value').value;
    
    if (!column || !operator || !value) {
        alert('请填写完整的筛选条件');
        return;
    }
    
    // 保存当前筛选条件
    currentFilter = { column, operator, value };
    
    // 应用筛选
    data = originalData.filter(row => {
        const cellValue = row[column];
        
        switch (operator) {
            case 'eq':
                return cellValue === value;
            case 'neq':
                return cellValue !== value;
            case 'gt':
                return parseFloat(cellValue) > parseFloat(value);
            case 'lt':
                return parseFloat(cellValue) < parseFloat(value);
            case 'gte':
                return parseFloat(cellValue) >= parseFloat(value);
            case 'lte':
                return parseFloat(cellValue) <= parseFloat(value);
            case 'contains':
                return cellValue.toString().includes(value);
            default:
                return true;
        }
    });
    
    // 重新显示数据
    showDataPreview();
    showDataStats();
    recommendAndShowCharts();
}

// 清除筛选
function clearFilter() {
    // 重置筛选表单
    document.getElementById('filter-column').value = '';
    document.getElementById('filter-operator').value = '';
    document.getElementById('filter-value').value = '';
    
    // 清除筛选条件
    currentFilter = null;
    
    // 恢复原始数据
    data = [...originalData];
    
    // 重新显示数据
    showDataPreview();
    showDataStats();
    recommendAndShowCharts();
}

// 处理表格排序
function handleTableSort(e) {
    const th = e.target.closest('th');
    if (!th) return;
    
    const column = th.textContent;
    
    // 确定排序方向
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // 应用排序
    data.sort((a, b) => {
        let aValue = a[column];
        let bValue = b[column];
        
        // 尝试转换为数字进行比较
        if (!isNaN(parseFloat(aValue)) && !isNaN(parseFloat(bValue))) {
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
        }
        
        if (aValue < bValue) {
            return currentSort.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return currentSort.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // 重新显示数据
    showDataPreview();
}

// 显示数据预览
function showDataPreview() {
    const previewSection = document.getElementById('data-preview');
    const table = document.getElementById('data-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    // 更新数据信息显示
    const totalRowsEl = document.getElementById('total-rows');
    const totalColsEl = document.getElementById('total-cols');
    const modeBadge = document.getElementById('mode-badge');
    const techInfo = document.getElementById('tech-info');
    
    if (totalRowsEl) totalRowsEl.textContent = originalData.length.toLocaleString();
    if (totalColsEl) totalColsEl.textContent = headers.length;
    if (modeBadge) {
        modeBadge.textContent = useDatabaseMode ? '数据库模式' : '内存模式';
        modeBadge.className = 'info-item mode-badge' + (useDatabaseMode ? ' database' : '');
    }
    if (techInfo) {
        techInfo.textContent = useDatabaseMode ? 'SQL.js 数据库模式' : '内存模式';
    }
    
    // 清空表格
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    // 初始化筛选条件（如果还没有）
    const filterContainer = document.getElementById('filter-conditions');
    if (filterContainer && filterContainer.children.length === 0 && headers.length > 0) {
        addFilterCondition();
    } else if (filterContainer && filterContainer.children.length > 0 && headers.length > 0) {
        // 更新现有筛选条件的列选项
        updateFilterColumnOptions();
    }
    
    // 创建表头
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        
        // 添加排序指示
        if (currentSort.column === header) {
            th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
        
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    
    // 计算分页
    const totalPages = Math.ceil(data.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, data.length);
    
    // 创建表格内容（当前页数据）
    const previewData = data.slice(startIndex, endIndex);
    previewData.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    // 更新分页控件（使用HTML中的固定分页控件）
    updatePaginationControls(totalPages);
    
    previewSection.classList.remove('hidden');
}

// 更新分页控件（使用HTML中的固定分页控件）
function updatePaginationControls(totalPages) {
    const paginationContainer = document.getElementById('table-pagination');
    if (!paginationContainer) return;
    
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const totalRowsEl = document.getElementById('pagination-total-rows');
    
    // 更新页码显示
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (totalRowsEl) totalRowsEl.textContent = data.length.toLocaleString();
    
    // 更新按钮状态
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
        nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.5' : '1';
    }
    
    // 显示/隐藏分页控件
    paginationContainer.style.display = totalPages <= 1 ? 'none' : 'flex';
}

// 初始化分页控件事件
function initPaginationControls() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                showDataPreview();
            }
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            const totalPages = Math.ceil(data.length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                showDataPreview();
            }
        };
    }
    
}

// 显示数据统计
function showDataStats() {
    const statsSection = document.getElementById('data-stats');
    const statsContainer = statsSection.querySelector('.stats-container');
    statsContainer.innerHTML = '';
    
    headers.forEach(header => {
        const stats = calculateStats(header);
        
        // 判断是否为数值列
        const isNumeric = stats.avg !== null;
        
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        
        // 根据是否为数值列显示不同的统计信息
        if (isNumeric) {
            // 数值列显示完整统计信息
            statCard.innerHTML = `
                <h3>${header}</h3>
                <div class="stat-item">
                    <span class="stat-label">数据类型</span>
                    <span class="stat-value">数值</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">有效数据</span>
                    <span class="stat-value">${stats.count - stats.missing}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">平均值</span>
                    <span class="stat-value">${stats.avg.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">最大值</span>
                    <span class="stat-value">${stats.max}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">最小值</span>
                    <span class="stat-value">${stats.min}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">缺失值</span>
                    <span class="stat-value">${stats.missing}</span>
                </div>
            `;
        } else {
            // 非数值列只显示基本信息
            const uniqueCount = new Set(data.map(row => row[header]).filter(val => val !== '' && val !== null && val !== undefined)).size;
            statCard.innerHTML = `
                <h3>${header}</h3>
                <div class="stat-item">
                    <span class="stat-label">数据类型</span>
                    <span class="stat-value">文本</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">有效数据</span>
                    <span class="stat-value">${stats.count - stats.missing}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">唯一值</span>
                    <span class="stat-value">${uniqueCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">缺失值</span>
                    <span class="stat-value">${stats.missing}</span>
                </div>
            `;
        }
        
        statsContainer.appendChild(statCard);
    });
    
    statsSection.classList.remove('hidden');
}

// 计算统计信息
function calculateStats(header) {
    const values = data.map(row => row[header]).filter(val => val !== '' && val !== null && val !== undefined);
    const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
    
    return {
        count: data.length,
        avg: numericValues.length > 0 ? numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length : null,
        max: numericValues.length > 0 ? Math.max(...numericValues) : null,
        min: numericValues.length > 0 ? Math.min(...numericValues) : null,
        missing: data.length - values.length
    };
}

// 智能推荐图表并显示
function recommendAndShowCharts() {
    const vizSection = document.getElementById('data-visualization');
    const chartsContainer = vizSection.querySelector('.charts-container');
    chartsContainer.innerHTML = '';
    
    // 清除之前的图表
    charts.forEach(chart => chart.destroy());
    charts = [];
    
    // 分析数据表特征
    const dataFeatures = analyzeDataFeatures();
    
    // 生成图表推荐
    generateChartRecommendationForDataset(dataFeatures).then(recommendations => {
        // 根据推荐结果生成图表
        recommendations.forEach(recommendation => {
            createRecommendedChart(chartsContainer, recommendation);
        });
        
        vizSection.classList.remove('hidden');
    });
}

// 分析数据表特征
function analyzeDataFeatures() {
    const features = {
        rowCount: data.length,
        columnCount: headers.length,
        columns: [],
        numericColumns: [],
        categoricalColumns: [],
        dateColumns: []
    };
    
    headers.forEach(header => {
        const values = data.map(row => row[header]).filter(val => val !== '' && val !== null && val !== undefined);
        const uniqueCount = new Set(values).size;
        
        let dataType = 'text';
        let min = null;
        let max = null;
        
        // 尝试判断数据类型
        if (values.length > 0) {
            const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
            if (numericValues.length === values.length) {
                dataType = 'numeric';
                min = Math.min(...numericValues);
                max = Math.max(...numericValues);
                features.numericColumns.push(header);
            } else {
                // 尝试判断是否为日期
                const dateValues = values.filter(val => !isNaN(Date.parse(val)));
                if (dateValues.length > 0) {
                    dataType = 'date';
                    const dates = dateValues.map(val => new Date(val));
                    min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                    max = new Date(Math.max(...dates)).toISOString().split('T')[0];
                    features.dateColumns.push(header);
                } else {
                    features.categoricalColumns.push(header);
                }
            }
        }
        
        features.columns.push({
            name: header,
            dataType: dataType,
            uniqueCount: uniqueCount,
            min: min,
            max: max,
            valueCount: values.length
        });
    });
    
    return features;
}

// 为整个数据集生成图表推荐
function generateChartRecommendationForDataset(dataFeatures) {
    // 构建 prompt
    const prompt = `请根据以下数据表特征，推荐最适合的图表类型：

数据表概览：
- 行数：${dataFeatures.rowCount}
- 列数：${dataFeatures.columnCount}
- 数值列：${dataFeatures.numericColumns.join(', ')}
- 分类列：${dataFeatures.categoricalColumns.join(', ')}
- 日期列：${dataFeatures.dateColumns.join(', ')}

列详情：
${dataFeatures.columns.map(col => `
- ${col.name}：${col.dataType}类型，唯一值数量：${col.uniqueCount}，数据范围：${col.min !== null ? col.min : 'N/A'} - ${col.max !== null ? col.max : 'N/A'}`).join('')}

请推荐3-5种最适合的图表类型，并说明理由。

推荐标准：
- 比较数值 → 柱状图
- 显示趋势 → 折线图
- 显示占比 → 饼图
- 显示分布 → 散点图/直方图
- 显示关系 → 热力图/散点图

要求：
1. 基于数据特征推荐最适合的图表类型
2. 说明推荐理由
3. 提供图表使用建议
4. 回答简洁明了`;
    
    console.log('数据集图表推荐使用的 prompt:', prompt);
    
    // 模拟AI API调用
    return new Promise((resolve) => {
        setTimeout(() => {
            const recommendations = generateMockDatasetRecommendation(dataFeatures);
            resolve(recommendations);
        }, 1000);
    });
}

// 生成模拟数据集图表推荐
function generateMockDatasetRecommendation(dataFeatures) {
    const recommendations = [];
    
    // 根据数据特征生成推荐
    if (dataFeatures.numericColumns.length > 0) {
        // 数值列推荐
        if (dataFeatures.numericColumns.length === 1) {
            recommendations.push({
                type: 'bar',
                title: `${dataFeatures.numericColumns[0]} - 柱状图`,
                reason: '数据集中包含单个数值列，适合使用柱状图展示数据分布',
                columns: [dataFeatures.numericColumns[0]]
            });
        } else if (dataFeatures.numericColumns.length > 1) {
            recommendations.push({
                type: 'bar',
                title: '数值列比较 - 柱状图',
                reason: '数据集中包含多个数值列，适合使用柱状图比较不同列的数据',
                columns: dataFeatures.numericColumns.slice(0, 3) // 最多显示3列
            });
        }
    }
    
    if (dataFeatures.categoricalColumns.length > 0 && dataFeatures.categoricalColumns[0]) {
        // 分类列推荐
        const catColumn = dataFeatures.categoricalColumns[0];
        const values = data.map(row => row[catColumn]).filter(val => val !== '' && val !== null && val !== undefined);
        const uniqueCount = new Set(values).size;
        
        if (uniqueCount < 10) {
            recommendations.push({
                type: 'pie',
                title: `${catColumn} - 饼图`,
                reason: `分类列 ${catColumn} 的唯一值数量较少（${uniqueCount}个），适合使用饼图展示各分类的占比`,
                columns: [catColumn]
            });
        } else {
            recommendations.push({
                type: 'bar',
                title: `${catColumn} - 条形图`,
                reason: `分类列 ${catColumn} 的唯一值数量较多（${uniqueCount}个），适合使用条形图展示Top N分类`,
                columns: [catColumn]
            });
        }
    }
    
    if (dataFeatures.dateColumns.length > 0 && dataFeatures.numericColumns.length > 0) {
        // 日期列推荐
        recommendations.push({
            type: 'line',
            title: `${dataFeatures.dateColumns[0]} vs ${dataFeatures.numericColumns[0]} - 折线图`,
            reason: '数据集中包含日期列和数值列，适合使用折线图展示数据随时间的变化趋势',
            columns: [dataFeatures.dateColumns[0], dataFeatures.numericColumns[0]]
        });
    } else if (dataFeatures.numericColumns.length > 1) {
        // 如果没有日期列但有多个数值列，推荐柱状图展示关系
        recommendations.push({
            type: 'bar',
            title: `${dataFeatures.numericColumns[0]} vs ${dataFeatures.numericColumns[1]} - 柱状图`,
            reason: '数据集中包含多个数值列，适合使用柱状图比较不同列的数据',
            columns: [dataFeatures.numericColumns[0], dataFeatures.numericColumns[1]]
        });
    }
    
    // 如果没有推荐，默认推荐一个柱状图
    if (recommendations.length === 0 && dataFeatures.columns.length > 0) {
        recommendations.push({
            type: 'bar',
            title: `${dataFeatures.columns[0].name} - 柱状图`,
            reason: '基于数据特征，推荐使用柱状图展示数据',
            columns: [dataFeatures.columns[0].name]
        });
    }
    
    return recommendations.slice(0, 5); // 最多推荐5个图表
}

// 创建推荐的图表
function createRecommendedChart(container, recommendation) {
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    
    const chartHeader = document.createElement('div');
    chartHeader.className = 'chart-header';
    
    const chartTitle = document.createElement('div');
    chartTitle.className = 'chart-title';
    chartTitle.textContent = recommendation.title;
    
    const chartAction = document.createElement('div');
    chartAction.className = 'chart-action';
    
    const reasonBtn = document.createElement('button');
    reasonBtn.className = 'recommend-btn';
    reasonBtn.textContent = '推荐理由';
    reasonBtn.onclick = () => {
        alert(`推荐理由：${recommendation.reason}`);
    };
    
    chartAction.appendChild(reasonBtn);
    chartHeader.appendChild(chartTitle);
    chartHeader.appendChild(chartAction);
    
    const canvas = document.createElement('canvas');
    
    chartWrapper.appendChild(chartHeader);
    chartWrapper.appendChild(canvas);
    container.appendChild(chartWrapper);
    
    const ctx = canvas.getContext('2d');
    
    if (recommendation.type === 'bar') {
        createBarChartForRecommendation(ctx, recommendation);
    } else if (recommendation.type === 'pie') {
        createPieChartForRecommendation(ctx, recommendation);
    } else if (recommendation.type === 'line') {
        createLineChartForRecommendation(ctx, recommendation);
    }
}

// 为推荐创建柱状图
function createBarChartForRecommendation(ctx, recommendation) {
    const columns = recommendation.columns;
    const chartData = [];
    const labels = [];
    
    // 尝试找到姓名列作为主键标签
    const nameColumn = headers.find(h => 
        h.includes('姓名') || h.includes('名字') || h.includes('name') || h.includes('Name')
    ) || headers[0]; // 如果没有找到姓名列，使用第一列
    
    if (columns.length === 1) {
        // 单数列柱状图
        const column = columns[0];
        const previewData = data.slice(0, 10); // 最多显示10条数据
        
        previewData.forEach(row => {
            const value = row[column];
            const name = row[nameColumn] || '未知';
            if (value !== '' && value !== null && value !== undefined && !isNaN(parseFloat(value))) {
                labels.push(name);
                chartData.push(parseFloat(value));
            }
        });
    } else {
        // 多列柱状图
        const previewData = data.slice(0, 10);
        
        previewData.forEach(row => {
            const name = row[nameColumn] || '未知';
            labels.push(name);
        });
        
        columns.forEach(column => {
            const columnData = [];
            previewData.forEach(row => {
                const value = row[column];
                if (value !== '' && value !== null && value !== undefined && !isNaN(parseFloat(value))) {
                    columnData.push(parseFloat(value));
                } else {
                    columnData.push(0);
                }
            });
            chartData.push(...columnData);
        });
    }
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: columns.map((column, index) => ({
                label: column,
                data: chartData.slice(index * labels.length, (index + 1) * labels.length),
                backgroundColor: `rgba(${102 + index * 20}, ${126 + index * 10}, ${234 - index * 20}, 0.6)`,
                borderColor: `rgba(${102 + index * 20}, ${126 + index * 10}, ${234 - index * 20}, 1)`,
                borderWidth: 1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
    
    charts.push(chart);
}

// 为推荐创建饼图
function createPieChartForRecommendation(ctx, recommendation) {
    const column = recommendation.columns[0];
    const values = data.map(row => row[column]).filter(val => val !== '' && val !== null && val !== undefined);
    
    // 计算每个类别的出现次数
    const categoryCount = {};
    values.forEach(val => {
        categoryCount[val] = (categoryCount[val] || 0) + 1;
    });
    
    const labels = Object.keys(categoryCount);
    const chartData = Object.values(categoryCount);
    
    if (labels.length > 0) {
        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels.slice(0, 8), // 最多显示8个类别
                datasets: [{
                    data: chartData.slice(0, 8),
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        
        charts.push(chart);
    }
}

// 为推荐创建折线图
function createLineChartForRecommendation(ctx, recommendation) {
    const [xColumn, yColumn] = recommendation.columns;
    
    // 获取X轴和Y轴的数据
    const xValues = data.map(row => row[xColumn]).filter(val => val !== '' && val !== null && val !== undefined);
    const yValues = data.map(row => row[yColumn]).filter(val => val !== '' && val !== null && val !== undefined);
    
    // 判断X轴数据类型
    const numericXValues = xValues.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
    const dateXValues = xValues.filter(val => !isNaN(Date.parse(val)));
    
    let labels = [];
    let isDateType = false;
    
    if (dateXValues.length > 0 && dateXValues.length >= numericXValues.length) {
        // X轴是日期类型
        isDateType = true;
        const dates = dateXValues.map(val => new Date(val)).filter(date => !isNaN(date.getTime()));
        const sortedDates = dates.sort((a, b) => a - b);
        labels = sortedDates.slice(0, 10).map(date => date.toISOString().split('T')[0]);
    } else if (numericXValues.length > 0) {
        // X轴是数值类型（如收入）
        labels = numericXValues.slice(0, 10).map(val => val.toString());
    } else {
        // X轴是文本类型
        labels = xValues.slice(0, 10);
    }
    
    // 获取Y轴数值
    const numericYValues = yValues.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
    
    if (labels.length > 0 && numericYValues.length > 0) {
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: yColumn,
                    data: numericYValues.slice(0, labels.length),
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'category',
                        title: {
                            display: true,
                            text: xColumn
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yColumn
                        }
                    }
                }
            }
        });
        
        charts.push(chart);
    }
}

// 生成AI分析报告（V3.2重构：精简概览 + 大模型深度洞察）
async function generateAIReport() {
    const reportContent = document.getElementById('report-content');
    reportContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>正在调用大模型进行深度分析...</p></div>';
    
    // 1. 数据统计概览：精简为一句话（不超过100字）
    const totalRows = data.length;
    const totalCols = headers.length;
    const numericCols = headers.filter(h => {
        const vals = data.slice(0, 100).map(row => row[h]).filter(v => v !== '' && v !== null);
        return vals.length > 0 && vals.every(v => !isNaN(parseFloat(v)));
    }).length;
    const textCols = totalCols - numericCols;
    
    // 计算数据完整性
    let totalCells = totalRows * totalCols;
    let emptyCells = 0;
    data.slice(0, 1000).forEach(row => {
        headers.forEach(h => {
            if (row[h] === '' || row[h] === null || row[h] === undefined) emptyCells++;
        });
    });
    const completeness = ((1 - emptyCells / (Math.min(data.length, 1000) * totalCols)) * 100).toFixed(1);
    
    // 精简概览（不超过100字）
    const summaryText = `数据集共${totalRows}行×${totalCols}列，其中数值型字段${numericCols}个、文本型字段${textCols}个，数据完整度${completeness}%。`;
    
    // 2. 准备数据样本供大模型分析（取前10行作为样本，减少Token消耗）
    const sampleData = data.slice(0, 10).map(row => {
        const obj = {};
        headers.forEach(h => obj[h] = row[h]);
        return obj;
    });
    
    // 3. 构建深度分析提示词（传递业务上下文）
    const analysisPrompt = buildDeepAnalysisPrompt(summaryText, headers, sampleData, fileContext);
    
    console.log('[AI报告] 开始调用大模型进行深度分析...');
    console.log('[AI报告] 提示词长度:', analysisPrompt.length, '字符');
    
    try {
        // 调用大模型API（增加超时时间到120秒，因为分析可能需要较长时间）
        const aiResponse = await callLLMAPI(analysisPrompt, null, 120000);
        
        // 显示精简概览 + AI深度洞察
        reportContent.innerHTML = `
            <div class="report-section">
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 1.1em;">📊 数据概览</h3>
                <p style="color: #666; margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">${summaryText}</p>
            </div>
            <div class="report-section">
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 1.1em;">🤖 AI 深度洞察</h3>
                <div class="ai-insight-content" style="white-space: pre-wrap; line-height: 1.8; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 25px; border-radius: 12px; font-size: 0.95em;">${formatAIResponse(aiResponse)}</div>
            </div>
            <div class="report-footer" style="margin-top: 20px; text-align: right; color: #999; font-size: 0.85em;">
                生成时间：${new Date().toLocaleString()}
            </div>
        `;
        
        console.log('[AI报告] 深度分析完成');
        
    } catch (error) {
        console.error('[AI报告] 大模型调用失败:', error);
        
        // 降级方案：显示错误提示，引导用户检查API配置
        reportContent.innerHTML = `
            <div class="report-section">
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 1.1em;">📊 数据概览</h3>
                <p style="color: #666; margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">${summaryText}</p>
            </div>
            <div class="report-section">
                <h3 style="color: #dc3545; margin-bottom: 15px; font-size: 1.1em;">⚠️ AI分析暂时不可用</h3>
                <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <p style="margin-bottom: 10px;"><strong>原因：</strong>${error.message || '大模型API调用失败'}</p>
                    <p style="margin-bottom: 10px;"><strong>建议：</strong></p>
                    <ul style="margin-left: 20px; color: #666;">
                        <li>检查 config.js 中的 API Key 和 API URL 配置</li>
                        <li>确认网络连接正常</li>
                        <li>稍后重试</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// 构建深度分析提示词（V3.2新增）
function buildDeepAnalysisPrompt(summaryText, columns, sampleData, fileContext) {
    // 提取文件业务上下文
    const businessContext = fileContext && fileContext.fileKeywords && fileContext.fileKeywords.length > 0 
        ? `业务领域：${fileContext.fileKeywords.join('、')}` 
        : '';
    
    // 分析各列的数据特征
    const columnProfiles = columns.map(col => {
        const values = sampleData.map(row => row[col]).filter(v => v !== '' && v !== null && v !== undefined);
        const uniqueValues = [...new Set(values)];
        const isNumeric = values.length > 0 && values.every(v => !isNaN(parseFloat(v)));
        
        if (isNumeric) {
            const nums = values.map(v => parseFloat(v));
            return {
                name: col,
                type: '数值',
                min: Math.min(...nums),
                max: Math.max(...nums),
                avg: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2),
                uniqueCount: uniqueValues.length
            };
        } else {
            return {
                name: col,
                type: '文本',
                uniqueCount: uniqueValues.length,
                topValues: uniqueValues.slice(0, 5)
            };
        }
    });
    
    // 构建精简提示词（减少Token消耗）
    const columnInfo = columnProfiles.map(p => {
        if (p.type === '数值') {
            return `${p.name}:数值,范围${p.min}~${p.max},均值${p.avg}`;
        } else {
            return `${p.name}:文本,${p.uniqueCount}个不同值`;
        }
    }).join('; ');
    
    return `作为数据分析师，请分析以下数据并给出洞察。

数据概况：${summaryText}${businessContext ? ',' + businessContext : ''}
字段：${columnInfo}
样本：${JSON.stringify(sampleData)}

请输出（300字内）：
1.关键发现（2条，用数字支撑）
2.业务洞察（2条）  
3.行动建议（2条）

要求：简洁专业，避免基础统计，重点讲"为什么"和"怎么办"。`;
}

// 格式化AI响应（支持Markdown标题）
function formatAIResponse(text) {
    if (!text) return '';
    
    // 将Markdown标题转换为HTML
    let formatted = text
        .replace(/###\s*(.+)/g, '<h4 style="color: #667eea; margin: 20px 0 10px 0;">$1</h4>')
        .replace(/##\s*(.+)/g, '<h3 style="color: #667eea; margin: 25px 0 15px 0;">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
    return formatted;
}

// 生成图表推荐
function generateChartRecommendation(columnName) {
    // 计算数据特征
    const values = data.map(row => row[columnName]).filter(val => val !== '' && val !== null && val !== undefined);
    const uniqueCount = new Set(values).size;
    
    let dataType = '文本';
    let min = null;
    let max = null;
    
    // 尝试判断数据类型
    if (values.length > 0) {
        const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
        if (numericValues.length === values.length) {
            dataType = '数值';
            min = Math.min(...numericValues);
            max = Math.max(...numericValues);
        } else {
            // 尝试判断是否为日期
            const dateValues = values.filter(val => !isNaN(Date.parse(val)));
            if (dateValues.length > 0) {
                dataType = '日期';
                const dates = dateValues.map(val => new Date(val));
                min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                max = new Date(Math.max(...dates)).toISOString().split('T')[0];
            }
        }
    }
    
    // 获取配置的 prompt 并替换变量
    const prompt = config.ai.prompts.chartRecommendation
        .replace('{{columnName}}', columnName)
        .replace('{{dataType}}', dataType)
        .replace('{{uniqueCount}}', uniqueCount)
        .replace('{{min}}', min !== null ? min : 'N/A')
        .replace('{{max}}', max !== null ? max : 'N/A');
    
    console.log('图表推荐使用的 prompt:', prompt);
    
    // 模拟AI API调用
    return new Promise((resolve) => {
        setTimeout(() => {
            const recommendation = generateMockChartRecommendation(columnName, dataType, uniqueCount, min, max, prompt);
            resolve(recommendation);
        }, 1000);
    });
}

// 生成模拟图表推荐
function generateMockChartRecommendation(columnName, dataType, uniqueCount, min, max, prompt) {
    let recommendation = '';
    
    if (dataType === '数值') {
        if (uniqueCount < 20) {
            recommendation = `推荐图表类型：柱状图、折线图\n\n理由：数据类型为数值，唯一值数量较少（${uniqueCount}个），适合使用柱状图展示具体数值，或折线图展示趋势。\n\n建议：柱状图可清晰展示各数据点的具体值，折线图适合展示数据变化趋势。`;
        } else {
            recommendation = `推荐图表类型：直方图、箱线图\n\n理由：数据类型为数值，唯一值数量较多（${uniqueCount}个），适合使用直方图展示数据分布，或箱线图展示数据统计特征。\n\n建议：直方图可展示数据的分布情况，箱线图可展示数据的四分位数和异常值。`;
        }
    } else if (dataType === '文本') {
        if (uniqueCount < 10) {
            recommendation = `推荐图表类型：饼图、条形图\n\n理由：数据类型为文本，唯一值数量较少（${uniqueCount}个），适合使用饼图展示各分类的占比，或条形图展示各分类的数量。\n\n建议：饼图适合展示分类占比，条形图适合比较不同分类的数量。`;
        } else {
            recommendation = `推荐图表类型：条形图、词云\n\n理由：数据类型为文本，唯一值数量较多（${uniqueCount}个），适合使用条形图展示Top N分类，或词云展示关键词频率。\n\n建议：条形图可展示出现频率最高的几个分类，词云适合展示文本数据的关键词。`;
        }
    } else if (dataType === '日期') {
        recommendation = `推荐图表类型：折线图、面积图\n\n理由：数据类型为日期，适合使用折线图展示时间趋势，或面积图展示时间序列的累积效果。\n\n建议：折线图可清晰展示数据随时间的变化趋势，面积图可展示数据的累积情况。`;
    }
    
    return `图表推荐报告\n\n数据列：${columnName}\n数据类型：${dataType}\n唯一值数量：${uniqueCount}\n数据范围：${min !== null ? min : 'N/A'} - ${max !== null ? max : 'N/A'}\n\n${recommendation}\n\n使用的 Prompt：\n${prompt.substring(0, 200)}...`;
}



// 导出PDF
function exportPDF() {
    alert('PDF导出功能将在后续版本中实现');
}

// 导出图表为图片
function exportChartAsImage(chart, chartTitle) {
    try {
        // 使用Chart.js的toBase64Image方法获取图表的base64编码
        const imageURL = chart.toBase64Image('image/png', 1.0);
        
        // 创建一个下载链接
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = `${chartTitle}_${new Date().toISOString().slice(0, 10)}.png`;
        
        // 触发下载
        link.click();
    } catch (error) {
        console.error('导出图表失败:', error);
        alert('导出图表失败，请重试');
    }
}

// 导出单个图表
function exportImage() {
    if (charts.length === 0) {
        alert('没有图表可导出');
        return;
    }
    
    // 导出第一个图表作为示例
    exportChartAsImage(charts[0], '图表导出');
    
    if (charts.length > 1) {
        alert(`已导出第一个图表，共${charts.length}个图表`);
    }
}

// 导出所有图表
function exportAllCharts() {
    if (charts.length === 0) {
        alert('没有图表可导出');
        return;
    }
    
    // 依次导出所有图表
    charts.forEach((chart, index) => {
        setTimeout(() => {
            exportChartAsImage(chart, `图表${index + 1}`);
        }, index * 500); // 每个图表间隔500ms，避免浏览器阻塞
    });
    
    addProcessingLog('success', '批量导出图表', `共导出 ${charts.length} 个图表`);
}

// 初始化应用
async function init() {
    initEventListeners();
    initSkillManager();
    initIntentRecognizer();
    await initDatabaseManager();
    initPaginationControls();
}

// 处理自然语言查询
async function handleNaturalLanguageQuery() {
    const queryInput = document.getElementById('nlp-query-input');
    const queryResult = document.getElementById('nlp-query-result');
    
    if (!queryInput || !queryResult) return;
    
    const query = queryInput.value.trim();
    if (!query) {
        alert('请输入查询内容');
        return;
    }
    
    // 显示进度条
    showQueryProgress('正在分析查询意图...');
    setQueryProgress(10, '正在分析查询意图...');
    queryResult.innerHTML = '';
    
    // 准备数据信息
    const dataInfo = {
        columns: headers,
        rowCount: data.length,
        sampleData: data.slice(0, 3) // 取前3行作为样本数据
    };
    
    // 步骤1：尝试使用本地逻辑处理
    setQueryProgress(20, '正在尝试本地分析...');
    const localAnswer = generateMockNLPAnswer(query, dataInfo);
    
    if (!localAnswer.includes('我需要分析数据来提供准确回答')) {
        // 本地逻辑可以处理，直接显示结果
        setQueryProgress(100, '分析完成');
        setTimeout(() => {
            hideQueryProgress();
        }, 300);
        queryResult.innerHTML = `
            <div class="nlp-answer">
                <div class="query-text"><strong>查询：</strong>${query}</div>
                <div class="result-text"><strong>分析结果：</strong></div>
                <div class="result-text" style="margin-top: 10px;">${localAnswer}</div>
            </div>
        `;
        return;
    }
    
    // 步骤2：本地逻辑无法处理，调用大模型生成查询语句
    setQueryProgress(30, '正在调用AI生成查询语句...');
    
    // 构建查询 prompt - 要求大模型生成结构化的查询逻辑
    const prompt = `你是一位数据分析专家，请根据用户的自然语言查询，生成结构化的数据查询逻辑。

用户查询："${query}"

数据表结构：
- 表头（列名）：${dataInfo.columns.join(', ')}
- 数据行数：${dataInfo.rowCount}

示例数据（前3行）：
${dataInfo.sampleData.map((row, index) => `行${index + 1}: ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', ')}`).join('\n')}

请生成JSON数组格式的查询逻辑，数组中包含所有需要执行的查询任务。

每个查询任务包含以下字段：
- queryType: 查询类型（filter-筛选, aggregate-聚合, sort-排序, find-查找, group-分组统计）
- filterCondition: 筛选条件（如 {"年龄": ">30"}，或 {"状态": "=正常"}）
- targetColumn: 目标列（如 "收入"）
- groupByColumn: 分组列（如 "管理实体描述"，用于分组统计）
- aggregateFunction: 聚合函数（如 "avg", "sum", "count", "max", "min"）
- description: 查询描述（用中文描述这个查询要做什么）
- resultFormat: 结果格式说明（如 "返回最大值对应的事件详情"）

重要提示：
1. 如果用户的查询包含多个问题（如"找到A，评价B"），请拆分为多个查询任务，用JSON数组返回
2. filterCondition中的列名必须严格使用数据表中的列名，不要修改列名
3. 筛选条件的值格式：">30"、"<50"、"=北京"、"!=删除"等，必须包含操作符
4. 如果要统计某个列的出现次数，使用 groupByColumn 指定分组列，aggregateFunction 使用 "count"
5. 如果不需要筛选，filterCondition 设为 null
6. 对于"删除标志: 0: 未删除, 1: 已删除"这样的列，筛选条件应该写成 {"删除标志: 0: 未删除, 1: 已删除": "=0"} 或 {"删除标志: 0: 未删除, 1: 已删除": "!=1"}
7. 只统计未删除的数据时，使用 {"删除标志: 0: 未删除, 1: 已删除": "=0"}
8. **关键**：如果添加筛选条件会导致没有数据（比如示例数据中该列的值都是0），请不要添加筛选条件，将filterCondition设为null
9. 如果不确定是否需要筛选，优先不添加筛选条件（filterCondition设为null）

请只返回JSON数组格式的查询逻辑，不要返回其他内容。示例格式：
[
  {
    "queryType": "aggregate",
    "filterCondition": null,
    "targetColumn": "险情确认时长",
    "groupByColumn": null,
    "aggregateFunction": "max",
    "description": "找到险情确认时长最长的事件",
    "resultFormat": "返回最大值及对应事件详情"
  },
  {
    "queryType": "group",
    "filterCondition": null,
    "targetColumn": "险情确认时长",
    "groupByColumn": "省公司名称",
    "aggregateFunction": "avg",
    "description": "按省公司分组统计平均险情确认时长",
    "resultFormat": "返回平均时长最长的省公司"
  }
]`;
    
    console.log('自然语言查询使用的 prompt:', prompt);
    
    try {
        // 创建新的AbortController
        currentQueryController = new AbortController();
        
        // 调用大模型API
        setQueryProgress(50, '正在等待AI响应...');
        const response = await callLLMAPI(prompt, currentQueryController.signal);
        currentQueryController = null;
        
        // 步骤3：解析大模型返回的查询逻辑
        setQueryProgress(70, '正在解析查询逻辑...');
        let queryLogics = [];
        try {
            // 尝试从响应中提取JSON数组
            const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
            if (jsonArrayMatch) {
                queryLogics = JSON.parse(jsonArrayMatch[0]);
                if (!Array.isArray(queryLogics)) {
                    queryLogics = [queryLogics];
                }
            } else {
                // 尝试提取单个JSON对象
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    queryLogics = [JSON.parse(jsonMatch[0])];
                } else {
                    throw new Error('无法解析查询逻辑');
                }
            }
        } catch (parseError) {
            console.error('解析查询逻辑失败:', parseError);
            // 如果解析失败，直接显示大模型的回答
            setQueryProgress(100, '分析完成');
            setTimeout(() => {
                hideQueryProgress();
            }, 300);
            queryResult.innerHTML = `
                <div class="nlp-answer">
                    <div class="query-text"><strong>查询：</strong>${query}</div>
                    <div class="result-text"><strong>AI分析结果：</strong></div>
                    <div class="result-text" style="white-space: pre-wrap; margin-top: 10px; line-height: 1.6;">${response}</div>
                </div>
            `;
            return;
        }
        
        // 步骤4：根据查询逻辑执行本地查询
        setQueryProgress(85, '正在执行查询...');
        const results = [];
        for (const queryLogic of queryLogics) {
            const result = executeQueryLogic(queryLogic);
            results.push({
                logic: queryLogic,
                result: result
            });
        }
        
        // 步骤5：显示结果和查询语句
        setQueryProgress(100, '查询完成');
        setTimeout(() => {
            hideQueryProgress();
        }, 300);
        
        // 构建美观的结果展示
        let resultHTML = `
            <div class="nlp-answer" style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #667eea;">
                    <h3 style="margin: 0; color: #667eea;">查询结果</h3>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="showQueryProcessingResult()" 
                            style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">查看处理日志</button>
                        <button onclick="exportQueryResult()" 
                            style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">导出结果</button>
                    </div>
                </div>
                <div class="query-text" style="background: #f8f9fa; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                    <strong style="color: #667eea;">您的查询：</strong>${query}
                </div>
        `;
        
        // 添加每个查询任务的结果
        results.forEach((item, index) => {
            resultHTML += `
                <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="color: #667eea; font-weight: 600; margin-bottom: 10px; font-size: 1.05em;">
                        ${index + 1}. ${item.logic.description || '查询任务'}
                    </div>
                    <div style="line-height: 1.8; color: #333;">
                        ${item.result}
                    </div>
                </div>
            `;
        });
        
        resultHTML += `</div>`;
        queryResult.innerHTML = resultHTML;
        
    } catch (error) {
        currentQueryController = null;
        hideQueryProgress();
        console.error('API调用失败:', error);
        
        const errorMessage = error.message || '未知错误';
        const isTimeout = errorMessage.includes('aborted') || errorMessage.includes('timeout');
        const isCancelled = errorMessage.includes('cancel') || errorMessage.includes('abort');
        
        if (isCancelled) {
            // 用户取消查询，不显示错误
            return;
        }
        
        // API调用失败，尝试使用简化的本地逻辑
        updateProgressText('AI服务不可用，尝试本地分析...');
        
        try {
            // 尝试解析查询意图并执行简单的统计
            const queryLower = query.toLowerCase();
            let localResult = '';
            
            // 检测是否是分组统计查询
            if (queryLower.includes('最多') || queryLower.includes('数量') || queryLower.includes('统计')) {
                // 尝试找到合适的分组列
                const groupColumn = headers.find(h => 
                    queryLower.includes(h.toLowerCase()) || 
                    (h.includes('管理') && queryLower.includes('管理')) ||
                    (h.includes('实体') && queryLower.includes('实体')) ||
                    (h.includes('类型') && queryLower.includes('类型'))
                );
                
                if (groupColumn) {
                    // 执行简单的分组计数
                    const counts = {};
                    data.forEach(row => {
                        const val = row[groupColumn];
                        if (val) {
                            counts[val] = (counts[val] || 0) + 1;
                        }
                    });
                    
                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    if (sorted.length > 0) {
                        localResult = `按"${groupColumn}"统计结果（本地分析）：<br><br>`;
                        localResult += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">';
                        localResult += '<tr style="background: #667eea; color: white;"><th style="padding: 8px; border: 1px solid #ddd;">' + groupColumn + '</th><th style="padding: 8px; border: 1px solid #ddd; text-align: center;">数量</th></tr>';
                        
                        sorted.slice(0, 10).forEach(([key, count], index) => {
                            const bg = index % 2 === 0 ? '#fff' : '#f8f9fa';
                            localResult += `<tr style="background: ${bg};"><td style="padding: 8px; border: 1px solid #ddd;">${key}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${count}</td></tr>`;
                        });
                        
                        localResult += '</table>';
                        localResult += `<br><div style="background: #e8f5e9; padding: 10px; border-radius: 4px; border-left: 3px solid #4caf50;"><strong>最多：</strong>${sorted[0][0]}（${sorted[0][1]}）</div>`;
                    }
                }
            }
            
            if (localResult) {
                queryResult.innerHTML = `
                    <div class="nlp-answer">
                        <div class="query-text"><strong>查询：</strong>${query}</div>
                        <div class="result-text" style="margin-top: 10px; color: #666;">
                            <p>AI服务暂时不可用（${isTimeout ? '超时' : '调用失败'}），已使用本地分析：</p>
                            <p style="color: #999; font-size: 0.85em; margin-top: 5px;">${errorMessage}</p>
                        </div>
                        <div class="result-text" style="margin-top: 15px;">
                            <strong>本地分析结果：</strong>
                            <div style="margin-top: 8px; padding: 10px; background: #f8f9fa; border-radius: 4px;">${localResult}</div>
                        </div>
                    </div>
                `;
            } else {
                // 本地也无法处理，显示错误
                queryResult.innerHTML = `
                    <div class="nlp-answer">
                        <div class="query-text"><strong>查询：</strong>${query}</div>
                        <div class="result-text" style="margin-top: 10px; color: #666;">
                            <p>抱歉，${isTimeout ? 'AI服务响应超时' : 'AI服务调用失败'}。</p>
                            <p style="color: #999; font-size: 0.9em; margin-top: 10px;">错误信息：${errorMessage}</p>
                            ${isTimeout ? '<p style="color: #666; margin-top: 10px;">可能是网络连接较慢或API服务繁忙，请稍后重试。</p>' : ''}
                            <p style="margin-top: 15px;">您可以尝试以下查询方式：</p>
                            <ul style="margin-left: 20px; margin-top: 10px;">
                                <li>张三的收入是多少？</li>
                                <li>李四的年龄是多少？</li>
                                <li>哪个城市的收入最高？</li>
                                <li>平均年龄是多少？</li>
                                <li>年龄最大的是谁？</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
        } catch (localError) {
            console.error('本地分析也失败:', localError);
            queryResult.innerHTML = `
                <div class="nlp-answer">
                    <div class="query-text"><strong>查询：</strong>${query}</div>
                    <div class="result-text" style="margin-top: 10px; color: #666;">
                        <p>抱歉，AI服务调用失败，且本地分析也无法处理该查询。</p>
                        <p style="color: #999; font-size: 0.9em; margin-top: 10px;">错误信息：${errorMessage}</p>
                        <p style="margin-top: 15px;">您可以尝试以下查询方式：</p>
                        <ul style="margin-left: 20px; margin-top: 10px;">
                            <li>张三的收入是多少？</li>
                            <li>李四的年龄是多少？</li>
                            <li>哪个城市的收入最高？</li>
                            <li>平均年龄是多少？</li>
                            <li>年龄最大的是谁？</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    }
}

// 执行查询逻辑
function executeQueryLogic(queryLogic) {
    const { queryType, filterCondition, targetColumn, groupByColumn, aggregateFunction } = queryLogic;
    
    let resultData = [...data];
    
    // 执行筛选
    if (filterCondition && Object.keys(filterCondition).length > 0) {
        console.log('执行筛选:', filterCondition);
        console.log('原始数据量:', resultData.length);
        
        resultData = resultData.filter((row, index) => {
            const result = Object.entries(filterCondition).every(([column, condition]) => {
                // 检查列名是否存在（支持部分匹配）
                let actualColumn = column;
                if (!headers.includes(column)) {
                    // 尝试找到包含该列名的实际列
                    actualColumn = headers.find(h => h.includes(column) || column.includes(h));
                    if (!actualColumn) {
                        console.warn(`列名不存在: ${column}`);
                        return true; // 如果列不存在，跳过该条件
                    }
                }
                
                const value = row[actualColumn];
                
                // 调试前3行
                if (index < 3) {
                    console.log(`第${index}行 - 列${actualColumn}: 值=${value}, 条件=${condition}`);
                }
                
                if (value === undefined || value === null || value === '') {
                    // 对于"!="操作符，空值应该被视为不匹配
                    if (typeof condition === 'string' && condition.startsWith('!=')) {
                        return true;
                    }
                    return false;
                }
                
                // 处理特殊格式的条件值（如 "未删除" 应该匹配 "0"）
                let actualCondition = condition;
                if (condition === '未删除' && actualColumn.includes('删除')) {
                    actualCondition = '=0';
                } else if (condition === '已删除' && actualColumn.includes('删除')) {
                    actualCondition = '=1';
                }
                
                // 解析条件（如 ">30", "=北京" 等）
                const match = actualCondition.toString().match(/^(>=|<=|>|<|=|!=)(.+)$/);
                if (!match) {
                    // 没有操作符，默认包含匹配
                    return value.toString().includes(actualCondition.toString());
                }
                
                const [, operator, targetValue] = match;
                const numValue = parseFloat(value);
                const numTarget = parseFloat(targetValue);
                
                if (!isNaN(numValue) && !isNaN(numTarget)) {
                    // 数值比较 - 使用宽松比较，避免整数和浮点数不匹配
                    const epsilon = 0.0001; // 浮点数比较精度
                    switch (operator) {
                        case '>': return numValue > numTarget;
                        case '<': return numValue < numTarget;
                        case '>=': return numValue >= numTarget;
                        case '<=': return numValue <= numTarget;
                        case '=': return Math.abs(numValue - numTarget) < epsilon;
                        case '!=': return Math.abs(numValue - numTarget) >= epsilon;
                        default: return false;
                    }
                } else {
                    // 字符串比较
                    const strValue = value.toString().trim();
                    const strTarget = targetValue.toString().trim();
                    switch (operator) {
                        case '=': return strValue === strTarget;
                        case '!=': return strValue !== strTarget;
                        default: return strValue.includes(strTarget);
                    }
                }
            });
            
            // 调试前3行的筛选结果
            if (index < 3) {
                console.log(`第${index}行筛选结果:`, result);
            }
            
            return result;
        });
        console.log('筛选后数据量:', resultData.length);
    }
    
    // 分组统计
    if (queryType === 'group' && groupByColumn && aggregateFunction) {
        console.log('执行分组统计:', { groupByColumn, targetColumn, aggregateFunction });
        console.log('可用列名:', headers);
        console.log('数据量:', resultData.length);
        
        // 检查列名是否存在（支持部分匹配）
        let actualGroupByColumn = groupByColumn;
        if (!headers.includes(groupByColumn)) {
            actualGroupByColumn = headers.find(h => h.includes(groupByColumn) || groupByColumn.includes(h));
            console.log(`尝试匹配列名：${groupByColumn} -> ${actualGroupByColumn}`);
            if (!actualGroupByColumn) {
                return `错误：分组列"${groupByColumn}"不存在。<br>可用的列：${headers.join(', ')}`;
            }
        }
        
        console.log(`最终使用的分组列：${actualGroupByColumn}`);
        
        // 同样处理targetColumn
        let actualTargetColumn = targetColumn;
        if (targetColumn && !headers.includes(targetColumn)) {
            actualTargetColumn = headers.find(h => h.includes(targetColumn) || targetColumn.includes(h));
            console.log(`目标列名匹配：${targetColumn} -> ${actualTargetColumn}`);
        }
        
        // 按分组列统计
        const groupStats = {};
        let processedRows = 0;
        let skippedRows = 0;
        
        resultData.forEach((row, index) => {
            const groupValue = row[actualGroupByColumn];
            if (groupValue === undefined || groupValue === null || groupValue === '') {
                skippedRows++;
                if (index < 3) {
                    console.log(`第${index}行跳过：分组列值为空`, row);
                }
                return;
            }
            
            processedRows++;
            const key = groupValue.toString().trim();
            if (!groupStats[key]) {
                groupStats[key] = [];
            }
            
            if (actualTargetColumn && headers.includes(actualTargetColumn)) {
                // 如果有目标列，收集目标列的值
                const targetValue = row[actualTargetColumn];
                if (targetValue !== undefined && targetValue !== null && targetValue !== '') {
                    const numValue = parseFloat(targetValue);
                    if (!isNaN(numValue)) {
                        groupStats[key].push(numValue);
                    } else {
                        // 如果不是数值，对于count操作也算一次
                        groupStats[key].push(1);
                    }
                }
            } else {
                // 没有目标列，只计数
                groupStats[key].push(1);
            }
        });
        
        console.log('分组统计结果:', groupStats);
        console.log(`处理了${processedRows}行，跳过了${skippedRows}行`);
        
        // 计算每个分组的聚合值
        const results = [];
        for (const [group, values] of Object.entries(groupStats)) {
            if (values.length === 0) continue;
            
            let result;
            switch (aggregateFunction.toLowerCase()) {
                case 'count':
                    result = values.length;
                    break;
                case 'sum':
                    result = values.reduce((a, b) => a + b, 0);
                    break;
                case 'avg':
                case 'average':
                    result = values.reduce((a, b) => a + b, 0) / values.length;
                    result = result.toFixed(2);
                    break;
                case 'max':
                    result = Math.max(...values);
                    break;
                case 'min':
                    result = Math.min(...values);
                    break;
                default:
                    result = values.length;
            }
            results.push({ group, value: result, count: values.length });
        }
        
        // 按数量排序，找出最多的
        results.sort((a, b) => b.value - a.value);
        
        if (results.length === 0) {
            return `无有效数据<br><br>调试信息：<br>- 使用的分组列：${actualGroupByColumn}<br>- 数据总行数：${resultData.length}<br>- 有效行数：${processedRows}<br>- 空值行数：${skippedRows}<br>- 分组统计对象：${JSON.stringify(groupStats)}`;
        }
        
        // 显示所有结果（带滚动条）
        let output = `<div style="margin-bottom: 10px;"><strong>共找到 ${results.length} 个分组</strong>，统计结果如下：</div>`;
        
        // 添加可滚动的表格容器
        output += '<div style="max-height: 500px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">';
        output += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">';
        output += '<tr style="background: #667eea; color: white; position: sticky; top: 0; z-index: 10;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">排名</th><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">分组</th><th style="padding: 8px; border: 1px solid #ddd; text-align: center;">统计值</th><th style="padding: 8px; border: 1px solid #ddd; text-align: center;">数量</th></tr>';
        
        results.forEach((item, index) => {
            const bg = index % 2 === 0 ? '#fff' : '#f8f9fa';
            const rank = index + 1;
            const rankStyle = index < 3 ? 'color: #667eea; font-weight: bold;' : '';
            output += `<tr style="background: ${bg};"><td style="padding: 8px; border: 1px solid #ddd; ${rankStyle}">${rank}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.group}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.value}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.count}</td></tr>`;
        });
        
        output += '</table>';
        output += '</div>';
        
        // 显示最多的
        if (results.length > 0) {
            output += `<br><div style="background: #e8f5e9; padding: 10px; border-radius: 4px; border-left: 3px solid #4caf50;"><strong>最多：</strong>${results[0].group}（${results[0].value}）</div>`;
        }
        
        return output;
    }
    
    // 执行普通聚合
    if (aggregateFunction && targetColumn) {
        const values = resultData.map(row => parseFloat(row[targetColumn])).filter(v => !isNaN(v));
        
        if (values.length === 0) {
            return '无有效数据';
        }
        
        let result;
        switch (aggregateFunction.toLowerCase()) {
            case 'avg':
            case 'average':
            case '平均':
                result = values.reduce((a, b) => a + b, 0) / values.length;
                return `平均值：${result.toFixed(2)}`;
            case 'sum':
            case '总和':
                result = values.reduce((a, b) => a + b, 0);
                return `总和：${result}`;
            case 'count':
            case '计数':
                return `数量：${values.length}`;
            case 'max':
            case '最大':
                result = Math.max(...values);
                return `最大值：${result}`;
            case 'min':
            case '最小':
                result = Math.min(...values);
                return `最小值：${result}`;
            default:
                return `聚合结果：${values.join(', ')}`;
        }
    }
    
    // 返回筛选后的数据
    if (resultData.length === 0) {
        return '未找到符合条件的数据';
    } else if (resultData.length <= 5) {
        // 数据量小，显示详细信息
        return resultData.map(row => {
            return Object.entries(row)
                .filter(([k, v]) => v !== '' && v !== undefined)
                .map(([k, v]) => `${k}:${v}`)
                .join(', ');
        }).join('<br>');
    } else {
        // 数据量大，显示统计信息
        return `找到 ${resultData.length} 条符合条件的数据`;
    }
}

// 处理自然语言绘图
async function handleNaturalLanguageChart() {
    const chartInput = document.getElementById('nlp-chart-input');
    const chartsContainer = document.querySelector('.charts-container');
    
    if (!chartInput || !chartsContainer) return;
    
    const chartRequest = chartInput.value.trim();
    if (!chartRequest) {
        alert('请输入绘图需求');
        return;
    }
    
    // 显示进度
    showChartProgress('正在分析绘图需求...');
    setChartProgress(10, '正在分析绘图需求...');
    
    // 准备数据信息
    const dataInfo = {
        columns: headers,
        rowCount: data.length,
        sampleData: data.slice(0, 3)
    };
    
    setChartProgress(20, '正在准备数据...');
    
    // 构建绘图 prompt
    const prompt = `你是一位数据可视化专家，请根据用户的绘图需求，生成图表配置。

用户绘图需求："${chartRequest}"

数据表结构：
- 表头（列名）：${dataInfo.columns.join(', ')}
- 数据行数：${dataInfo.rowCount}

示例数据（前3行）：
${dataInfo.sampleData.map((row, index) => `行${index + 1}: ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', ')}`).join('\n')}

请生成JSON数组格式的图表配置，数组中包含所有需要绘制的图表。

每个图表配置包含以下字段：
- chartType: 图表类型（bar-柱状图, line-折线图, pie-饼图, doughnut-环形图）
- xAxisColumn: X轴列名（用于bar/line图表，分组列）
- yAxisColumn: Y轴列名（用于bar/line图表，数值列，可选，不指定则计数）
- labelColumn: 标签列名（用于pie/doughnut图表）
- valueColumn: 数值列名（用于pie/doughnut图表，可选，不指定则计数）
- title: 图表标题
- description: 图表描述
- aggregateFunction: 聚合函数（avg-平均值, sum-求和, count-计数, max-最大值, min-最小值，默认为avg）
- sortOrder: 排序方式（asc-升序, desc-降序, null-不排序，默认为null）
- dataTransform: 数据预处理配置（可选），包含：
  - column: 需要预处理的列名
  - operation: 操作类型（divide-除法, multiply-乘法, add-加法, subtract-减法, convert-单位转换）
  - value: 操作数值（如除以60表示秒转分钟）
  - unit: 新的单位名称（如"分钟"）

重要提示：
1. 必须返回JSON数组格式，即使只生成一个图表也要用数组包裹
2. 列名必须严格使用数据表中的列名
3. 如果要统计某个列的出现次数，可以不指定yAxisColumn或valueColumn，aggregateFunction使用count
4. 对于饼图/环形图，使用labelColumn指定标签列，valueColumn指定数值列（可选）
5. 如果用户要求生成多个图表（如"柱状图和饼图"），必须在数组中包含所有图表的配置
6. **关键**：如果用户要求进行单位转换（如"秒转分钟"），必须在dataTransform中配置预处理步骤
7. 如果用户要求排序（如"由高到低"），必须设置sortOrder为"desc"或"asc"
8. 如果用户要求计算平均值，aggregateFunction应设为"avg"

请只返回JSON数组格式的图表配置，不要返回其他内容。示例格式：
[
  {
    "chartType": "bar",
    "xAxisColumn": "省公司",
    "yAxisColumn": "险情确认时长",
    "labelColumn": null,
    "valueColumn": null,
    "title": "各省公司平均险情确认时长（分钟）",
    "description": "按省公司分组统计平均险情确认时长，单位已转换为分钟",
    "aggregateFunction": "avg",
    "sortOrder": "desc",
    "dataTransform": {
      "column": "险情确认时长",
      "operation": "divide",
      "value": 60,
      "unit": "分钟"
    }
  }
]`;
    
    console.log('自然语言绘图使用的 prompt:', prompt);
    
    try {
        // 创建新的AbortController
        currentQueryController = new AbortController();
        
        setChartProgress(40, '正在调用AI生成图表配置...');
        const response = await callLLMAPI(prompt, currentQueryController.signal);
        currentQueryController = null;
        
        // 解析图表配置
        setChartProgress(60, '正在解析图表配置...');
        let chartConfigs = [];
        try {
            // 尝试解析为数组（多个图表）
            const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
            if (jsonArrayMatch) {
                chartConfigs = JSON.parse(jsonArrayMatch[0]);
                if (!Array.isArray(chartConfigs)) {
                    chartConfigs = [chartConfigs];
                }
            } else {
                // 尝试解析为单个对象
                const jsonMatch = response.match(/\{[\s\S]*\]/);
                if (jsonMatch) {
                    chartConfigs = [JSON.parse(jsonMatch[0])];
                } else {
                    throw new Error('无法解析图表配置');
                }
            }
        } catch (parseError) {
            console.error('解析图表配置失败:', parseError);
            setChartProgress(100, '解析失败');
            setTimeout(() => {
                hideChartProgress();
            }, 300);
            chartsContainer.innerHTML = `<div style="color: #666; padding: 20px;">无法解析AI返回的图表配置，请重试。<br>AI返回：${response}</div>`;
            return;
        }
        
        // 清空容器
        chartsContainer.innerHTML = '';
        
        // 根据配置生成图表（支持多个）
        const totalCharts = chartConfigs.length;
        for (let i = 0; i < totalCharts; i++) {
            const progress = 60 + Math.round(((i + 1) / totalCharts) * 35);
            setChartProgress(progress, `正在生成图表 ${i + 1}/${totalCharts}...`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 小延迟避免UI卡顿
            createChartFromConfig(chartConfigs[i], chartsContainer, response);
        }
        
        setChartProgress(100, '图表生成完成');
        setTimeout(() => {
            hideChartProgress();
        }, 300);
        
    } catch (error) {
        currentQueryController = null;
        setChartProgress(100, '生成失败');
        setTimeout(() => {
            hideChartProgress();
        }, 300);
        console.error('图表生成失败:', error);
        
        const errorMessage = error.message || '未知错误';
        const isTimeout = errorMessage.includes('aborted') || errorMessage.includes('timeout');
        const isCancelled = errorMessage.includes('cancel') || errorMessage.includes('abort');
        
        if (isCancelled) {
            return;
        }
        
        // API调用失败，尝试本地生成简单图表
        try {
            const chartRequestLower = chartRequest.toLowerCase();
            let localChartConfig = null;
            
            // 尝试匹配列名
            const matchedColumn = headers.find(h => 
                chartRequestLower.includes(h.toLowerCase()) ||
                (h.includes('管理') && chartRequestLower.includes('管理')) ||
                (h.includes('实体') && chartRequestLower.includes('实体')) ||
                (h.includes('类型') && chartRequestLower.includes('类型'))
            );
            
            if (matchedColumn) {
                localChartConfig = {
                    chartType: chartRequestLower.includes('饼') || chartRequestLower.includes('圆') ? 'pie' : 'bar',
                    xAxisColumn: matchedColumn,
                    yAxisColumn: null,
                    labelColumn: matchedColumn,
                    valueColumn: null,
                    title: `${matchedColumn}统计图表`,
                    description: `按${matchedColumn}统计的图表`
                };
                
                createChartFromConfig(localChartConfig, chartsContainer);
                chartsContainer.innerHTML = `<div style="color: #666; margin-bottom: 10px;">AI服务不可用，已使用本地逻辑生成图表</div>` + chartsContainer.innerHTML;
            } else {
                chartsContainer.innerHTML = `<div style="color: #666; padding: 20px;">AI服务调用失败，且无法识别绘图需求。<br>错误：${errorMessage}</div>`;
            }
        } catch (localError) {
            chartsContainer.innerHTML = `<div style="color: #666; padding: 20px;">图表生成失败。<br>错误：${errorMessage}</div>`;
        }
    }
}

// 根据配置创建图表
function createChartFromConfig(config, container, aiResponse = null) {
    // 检查Chart.js是否可用
    if (typeof Chart === 'undefined') {
        console.error('Chart.js未加载');
        container.innerHTML = '<div style="color: #dc3545; padding: 20px;">图表库未加载，请刷新页面重试</div>';
        return;
    }
    
    const { chartType, xAxisColumn, yAxisColumn, labelColumn, valueColumn, title, description, aggregateFunction = 'avg', sortOrder = null, dataTransform = null } = config;
    
    console.log('创建图表:', config);
    
    // 准备数据
    let labels = [];
    let values = [];
    let backgroundColors = [];
    let borderColors = [];
    let transformInfo = '';
    
    // 生成颜色
    const generateColors = (count) => {
        const colors = [];
        const baseColors = [
            'rgba(102, 126, 234, 0.6)',
            'rgba(118, 75, 162, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)'
        ];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    };
    
    // 数据预处理函数 - 支持单位转换和小数位格式化
    const transformValue = (val, transform) => {
        if (val === null || val === undefined) return val;
        
        // 处理千分位逗号、货币符号
        let str = val.toString();
        str = str.replace(/,/g, '').replace(/[￥$€£\s]/g, '');
        
        let result = parseFloat(str);
        if (isNaN(result)) return val;
        
        // 处理formula表达式（如 "value / 60"）
        if (transform && transform.formula) {
            const formula = transform.formula.toLowerCase().replace(/\s/g, '');
            // 解析 value / 60 或 value * 60 等格式
            const match = formula.match(/value([\*\/\+\-])(\d+(?:\.\d+)?)/);
            if (match) {
                const operator = match[1];
                const operand = parseFloat(match[2]);
                switch (operator) {
                    case '/':
                        result = result / operand;
                        break;
                    case '*':
                        result = result * operand;
                        break;
                    case '+':
                        result = result + operand;
                        break;
                    case '-':
                        result = result - operand;
                        break;
                }
            }
        }
        // 处理嵌套的unitConversion结构（带formula，如"秒数/60"）
        else if (transform && transform.unitConversion && transform.unitConversion.formula) {
            const formula = transform.unitConversion.formula.toLowerCase().replace(/\s/g, '');
            // 支持 "秒数/60"、"value/60"、"数值*0.01" 等格式
            const match = formula.match(/(?:value|数值|秒数|分钟数|小时数)([\*\/\+\-])(\d+(?:\.\d+)?)/);
            if (match) {
                const operator = match[1];
                const operand = parseFloat(match[2]);
                switch (operator) {
                    case '/':
                        result = result / operand;
                        break;
                    case '*':
                        result = result * operand;
                        break;
                    case '+':
                        result = result + operand;
                        break;
                    case '-':
                        result = result - operand;
                        break;
                }
            }
        }
        // 处理嵌套的unitConversion结构（带operation和factor）
        else if (transform && transform.unitConversion && transform.unitConversion.operation) {
            const { operation, factor } = transform.unitConversion;
            switch (operation) {
                case 'divide':
                    result = result / factor;
                    break;
                case 'multiply':
                    result = result * factor;
                    break;
                case 'add':
                    result = result + factor;
                    break;
                case 'subtract':
                    result = result - factor;
                    break;
            }
        }
        // 处理直接的operation结构（兼容旧格式）
        else if (transform && transform.operation) {
            const opValue = transform.value || transform.factor || 1;
            switch (transform.operation) {
                case 'divide':
                    result = result / opValue;
                    break;
                case 'multiply':
                    result = result * opValue;
                    break;
                case 'add':
                    result = result + opValue;
                    break;
                case 'subtract':
                    result = result - opValue;
                    break;
            }
        }
        
        // 应用小数位格式化
        if (transform && transform.decimalPlaces !== undefined) {
            result = parseFloat(result.toFixed(transform.decimalPlaces));
        }
        
        return result;
    };
    
    // 格式化数值显示 - 保留指定小数位
    const formatValue = (val, decimalPlaces) => {
        if (val === null || val === undefined || isNaN(val)) return val;
        if (decimalPlaces === undefined || decimalPlaces === null) return val;
        return parseFloat(val.toFixed(decimalPlaces));
    };
    
    // 创建整体统计图表（无分组）
    const createOverallChart = (config, container, aiResponse) => {
        const { yAxisColumn, title, description, aggregateFunction = 'avg', dataTransform = null } = config;
        
        // 找到实际的Y轴列
        let actualYColumn = yAxisColumn;
        if (yAxisColumn && !headers.includes(yAxisColumn)) {
            actualYColumn = headers.find(h => h.includes(yAxisColumn) || (yAxisColumn && yAxisColumn.includes(h)));
        }
        
        if (!actualYColumn) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">错误：数值列"${yAxisColumn}"不存在</div>`;
            return;
        }
        
        // 收集所有数值
        const values = [];
        data.forEach(row => {
            // 处理千分位逗号、货币符号
            let rawVal = row[actualYColumn];
            if (rawVal !== null && rawVal !== undefined) {
                let str = rawVal.toString().replace(/,/g, '').replace(/[￥$€£\s]/g, '');
                let val = parseFloat(str);
                if (!isNaN(val)) {
                    // 应用数据转换
                    if (dataTransform) {
                        val = transformValue(val, dataTransform);
                    }
                    values.push(val);
                }
            }
        });
        
        if (values.length === 0) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">没有有效的数值数据</div>`;
            return;
        }
        
        // 计算聚合值
        let result;
        switch (aggregateFunction.toLowerCase()) {
            case 'avg':
            case 'average':
                result = values.reduce((a, b) => a + b, 0) / values.length;
                break;
            case 'sum':
                result = values.reduce((a, b) => a + b, 0);
                break;
            case 'max':
                result = Math.max(...values);
                break;
            case 'min':
                result = Math.min(...values);
                break;
            case 'count':
                result = values.length;
                break;
            default:
                result = values.reduce((a, b) => a + b, 0) / values.length;
        }
        
        // 格式化结果
        const formattedResult = formatValue(result, dataTransform?.decimalPlaces);
        
        // 创建图表容器
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <div class="chart-header">
                <h3>${title || `${actualYColumn}统计`}</h3>
                <p>${description || `统计所有${actualYColumn}的${aggregateFunction === 'avg' ? '平均值' : '总和'}`}</p>
            </div>
            <div class="chart-wrapper" style="height: 300px; position: relative;">
                <canvas id="overall-chart"></canvas>
            </div>
            <div class="chart-stats" style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${formattedResult.toLocaleString()}</div>
                        <div style="color: #666; font-size: 12px;">${aggregateFunction === 'avg' ? '平均值' : aggregateFunction === 'sum' ? '总和' : '统计值'}</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${values.length.toLocaleString()}</div>
                        <div style="color: #666; font-size: 12px;">数据条数</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${formatValue(Math.max(...values), dataTransform?.decimalPlaces).toLocaleString()}</div>
                        <div style="color: #666; font-size: 12px;">最大值</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${formatValue(Math.min(...values), dataTransform?.decimalPlaces).toLocaleString()}</div>
                        <div style="color: #666; font-size: 12px;">最小值</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(chartContainer);
        
        // 创建Chart.js图表
        const ctx = chartContainer.querySelector('#overall-chart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['整体统计'],
                datasets: [{
                    label: actualYColumn,
                    data: [formattedResult],
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${actualYColumn}: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: actualYColumn
                        }
                    }
                }
            }
        });
        
        charts.push(chart);
    };
    
    // 创建散点图
    const createScatterChart = (config, container, scatterData, xColumn, yColumn, aiResponse) => {
        const { title, description } = config;
        
        // 创建图表容器
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-wrapper';
        chartContainer.style.cssText = 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;';
        
        // 添加标题
        const titleDiv = document.createElement('div');
        titleDiv.style.marginBottom = '15px';
        titleDiv.innerHTML = `
            <h4 style="margin: 0 0 5px 0; color: #333;">${title || `${xColumn}${yColumn ? ' vs ' + yColumn : ''}散点图`}</h4>
            ${description ? `<p style="margin: 0; color: #666; font-size: 0.9em;">${description}</p>` : ''}
            <p style="margin: 5px 0 0 0; color: #667eea; font-size: 0.85em;">共 ${scatterData.length} 个数据点</p>
        `;
        chartContainer.appendChild(titleDiv);
        
        // 创建canvas容器
        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = 'height: 400px; position: relative;';
        chartContainer.appendChild(canvasContainer);
        
        // 创建canvas
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        
        // 添加到容器
        container.appendChild(chartContainer);
        
        // 创建Chart.js散点图
        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: yColumn || '数值',
                    data: scatterData,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return `${xColumn}: ${point.x.toFixed(2)}, ${yColumn || '索引'}: ${point.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: xColumn
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yColumn || '索引'
                        }
                    }
                }
            }
        });
        
        charts.push(chart);
    };
    
    // 处理柱状图和折线图
    if (chartType === 'bar' || chartType === 'line') {
        // 检查是否是整体统计（无分组）
        if (config.isOverall || !xAxisColumn) {
            // 整体统计：计算所有数据的平均值/总和
            return createOverallChart(config, container, aiResponse);
        }
        
        // 找到实际的X轴列
        let actualXColumn = xAxisColumn;
        if (xAxisColumn && !headers.includes(xAxisColumn)) {
            actualXColumn = headers.find(h => h.includes(xAxisColumn) || (xAxisColumn && xAxisColumn.includes(h)));
        }
        
        if (!actualXColumn) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">错误：X轴列"${xAxisColumn}"不存在</div>`;
            return;
        }
        
        // 找到实际的Y轴列
        let actualYColumn = yAxisColumn;
        if (yAxisColumn && !headers.includes(yAxisColumn)) {
            actualYColumn = headers.find(h => h.includes(yAxisColumn) || (yAxisColumn && yAxisColumn.includes(h)));
        }
        
        // 统计数据 - 支持聚合函数
        const groupData = {};
        const groupCounts = {};
        
        data.forEach(row => {
            const key = row[actualXColumn];
            if (key !== undefined && key !== null && key !== '') {
                const keyStr = key.toString().trim();
                
                if (actualYColumn && headers.includes(actualYColumn)) {
                    // 使用Y轴列的值，处理千分位逗号
                    let rawVal = row[actualYColumn];
                    let val = NaN;
                    if (rawVal !== null && rawVal !== undefined) {
                        let str = rawVal.toString().replace(/,/g, '').replace(/[￥$€£\s]/g, '');
                        val = parseFloat(str);
                    }
                    
                    // 应用数据预处理（如果配置了dataTransform）
                    if (dataTransform && (dataTransform.formula || dataTransform.unitConversion || dataTransform.operation)) {
                        val = transformValue(val, dataTransform);
                        transformInfo = `（单位：${dataTransform.unit || dataTransform.unitConversion?.to || '转换后'}）`;
                    }
                    
                    if (!isNaN(val)) {
                        if (!groupData[keyStr]) {
                            groupData[keyStr] = [];
                        }
                        groupData[keyStr].push(val);
                    }
                } else {
                    // 计数
                    groupCounts[keyStr] = (groupCounts[keyStr] || 0) + 1;
                }
            }
        });
        
        // 根据聚合函数计算结果
        const counts = {};
        if (actualYColumn && headers.includes(actualYColumn)) {
            // 有数值列，使用聚合函数
            for (const [key, vals] of Object.entries(groupData)) {
                if (vals.length === 0) continue;
                
                let result;
                switch (aggregateFunction.toLowerCase()) {
                    case 'avg':
                    case 'average':
                        result = vals.reduce((a, b) => a + b, 0) / vals.length;
                        break;
                    case 'sum':
                        result = vals.reduce((a, b) => a + b, 0);
                        break;
                    case 'max':
                        result = Math.max(...vals);
                        break;
                    case 'min':
                        result = Math.min(...vals);
                        break;
                    case 'count':
                        result = vals.length;
                        break;
                    default:
                        result = vals.reduce((a, b) => a + b, 0) / vals.length;
                }
                
                // 应用小数位格式化
                if (dataTransform && dataTransform.decimalPlaces !== undefined) {
                    result = parseFloat(result.toFixed(dataTransform.decimalPlaces));
                }
                
                counts[key] = result;
            }
        } else {
            // 无数值列，使用计数
            Object.assign(counts, groupCounts);
        }
        
        // 排序
        let allEntries = Object.entries(counts);
        if (sortOrder === 'desc') {
            allEntries.sort((a, b) => b[1] - a[1]);
        } else if (sortOrder === 'asc') {
            allEntries.sort((a, b) => a[1] - b[1]);
        }
        
        // 取前30个
        const sorted = allEntries.slice(0, 30);
        labels = sorted.map(([k, v]) => k);
        values = sorted.map(([k, v]) => v);
        
        // 保存总数信息用于显示
        var totalGroups = allEntries.length;
        var showingGroups = sorted.length;
        
    } else if (chartType === 'pie' || chartType === 'doughnut') {
        // 找到实际的标签列（优先使用labelColumn，其次使用xAxisColumn）
        let actualLabelColumn = labelColumn || xAxisColumn;
        if (actualLabelColumn && !headers.includes(actualLabelColumn)) {
            actualLabelColumn = headers.find(h => h.includes(actualLabelColumn) || (actualLabelColumn && actualLabelColumn.includes(h)));
        }
        
        if (!actualLabelColumn) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">错误：标签列不存在</div>`;
            return;
        }
        
        // 找到实际的数值列（优先使用valueColumn，其次使用yAxisColumn）
        let actualValueColumn = valueColumn || yAxisColumn;
        if (actualValueColumn && !headers.includes(actualValueColumn)) {
            actualValueColumn = headers.find(h => h.includes(actualValueColumn) || actualValueColumn.includes(h));
        }
        
        // 统计数据
        const counts = {};
        const aggFunc = (config.aggregateFunction || 'count').toLowerCase();
        
        data.forEach(row => {
            const key = row[actualLabelColumn];
            if (key !== undefined && key !== null && key !== '') {
                const keyStr = key.toString().trim();
                
                // 根据聚合函数类型决定如何统计
                if (aggFunc === 'count') {
                    // 计数模式：只统计出现次数
                    counts[keyStr] = (counts[keyStr] || 0) + 1;
                } else if (aggFunc === 'sum' && actualValueColumn) {
                    // 求和模式：累加数值列，处理千分位逗号
                    let rawVal = row[actualValueColumn];
                    let val = NaN;
                    if (rawVal !== null && rawVal !== undefined) {
                        let str = rawVal.toString().replace(/,/g, '').replace(/[￥$€£\s]/g, '');
                        val = parseFloat(str);
                    }
                    if (!isNaN(val)) {
                        counts[keyStr] = (counts[keyStr] || 0) + val;
                    }
                } else if ((aggFunc === 'avg' || aggFunc === 'average') && actualValueColumn) {
                    // 平均值模式：收集所有值后计算平均，处理千分位逗号
                    let rawVal = row[actualValueColumn];
                    let val = NaN;
                    if (rawVal !== null && rawVal !== undefined) {
                        let str = rawVal.toString().replace(/,/g, '').replace(/[￥$€£\s]/g, '');
                        val = parseFloat(str);
                    }
                    if (!isNaN(val)) {
                        if (!counts[keyStr]) {
                            counts[keyStr] = { sum: 0, count: 0 };
                        }
                        counts[keyStr].sum += val;
                        counts[keyStr].count += 1;
                    }
                } else {
                    // 默认计数
                    counts[keyStr] = (counts[keyStr] || 0) + 1;
                }
            }
        });
        
        // 处理平均值计算
        if (aggFunc === 'avg' || aggFunc === 'average') {
            for (const key in counts) {
                if (counts[key] && typeof counts[key] === 'object') {
                    counts[key] = counts[key].sum / counts[key].count;
                }
            }
        }
        
        // 排序并取前10个
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        labels = sorted.map(([k, v]) => k);
        values = sorted.map(([k, v]) => v);
    } else if (chartType === 'scatter') {
        // 散点图处理
        let actualXColumn = xAxisColumn;
        if (xAxisColumn && !headers.includes(xAxisColumn)) {
            actualXColumn = headers.find(h => h.includes(xAxisColumn) || (xAxisColumn && xAxisColumn.includes(h)));
        }
        
        if (!actualXColumn) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">错误：X轴列"${xAxisColumn}"不存在</div>`;
            return;
        }
        
        // 找到实际的Y轴列（如果有）
        let actualYColumn = yAxisColumn;
        if (yAxisColumn && !headers.includes(yAxisColumn)) {
            actualYColumn = headers.find(h => h.includes(yAxisColumn) || (yAxisColumn && yAxisColumn.includes(h)));
        }
        
        // 准备散点图数据，处理千分位逗号
        const scatterData = [];
        data.forEach((row, index) => {
            let xRaw = row[actualXColumn];
            let yRaw = actualYColumn ? row[actualYColumn] : index;
            
            let xVal = NaN;
            let yVal = NaN;
            
            if (xRaw !== null && xRaw !== undefined) {
                let str = xRaw.toString().replace(/,/g, '').replace(/[￥$€£\s]/g, '');
                xVal = parseFloat(str);
            }
            
            if (actualYColumn) {
                if (yRaw !== null && yRaw !== undefined) {
                    let str = yRaw.toString().replace(/,/g, '').replace(/[￥$€£\s]/g, '');
                    yVal = parseFloat(str);
                }
            } else {
                yVal = index;
            }
            
            if (!isNaN(xVal) && !isNaN(yVal)) {
                scatterData.push({ x: xVal, y: yVal });
            }
        });
        
        if (scatterData.length === 0) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">无有效数据可绘制散点图</div>`;
            return;
        }
        
        // 创建散点图
        return createScatterChart(config, container, scatterData, actualXColumn, actualYColumn, aiResponse);
    }
    
    if (labels.length === 0 && chartType !== 'scatter') {
        container.innerHTML = `<div style="color: #666; padding: 20px;">无有效数据可绘制图表</div>`;
        return;
    }
    
    // 生成颜色
    backgroundColors = generateColors(labels.length);
    borderColors = backgroundColors.map(c => c.replace('0.6', '1'));
    
    // 创建图表容器
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    chartWrapper.style.cssText = 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;';
    
    // 添加标题和描述
    const titleDiv = document.createElement('div');
    titleDiv.style.display = 'flex';
    titleDiv.style.justifyContent = 'space-between';
    titleDiv.style.alignItems = 'center';
    titleDiv.style.marginBottom = '15px';
    
    let countInfo = '';
    if (typeof totalGroups !== 'undefined' && totalGroups > showingGroups) {
        countInfo = `<span style="color: #667eea; font-size: 0.85em;">（显示前${showingGroups}个，共${totalGroups}个）</span>`;
    } else if (typeof totalGroups !== 'undefined') {
        countInfo = `<span style="color: #667eea; font-size: 0.85em;">（共${totalGroups}个）</span>`;
    }
    
    const titleContent = document.createElement('div');
    titleContent.innerHTML = `<h4 style="margin: 0 0 5px 0; color: #333;">${title || '数据图表'} ${countInfo} ${transformInfo}</h4>${description ? `<p style="margin: 0; color: #666; font-size: 0.9em;">${description}</p>` : ''}`;
    
    // 添加按钮容器
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 8px;';
    
    // 添加查看AI处理结果按钮
    const viewAIBtn = document.createElement('button');
    viewAIBtn.textContent = '查看AI处理';
    viewAIBtn.style.cssText = 'background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8em; cursor: pointer; transition: all 0.3s ease;';
    viewAIBtn.onmouseover = function() {
        this.style.background = '#218838';
        this.style.transform = 'translateY(-1px)';
    };
    viewAIBtn.onmouseout = function() {
        this.style.background = '#28a745';
        this.style.transform = 'translateY(0)';
    };
    viewAIBtn.onclick = function() {
        showAIProcessingResult(config, aiResponse);
    };
    
    // 添加导出按钮
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '导出图表';
    exportBtn.style.cssText = 'background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8em; cursor: pointer; transition: all 0.3s ease;';
    exportBtn.onmouseover = function() {
        this.style.background = '#764ba2';
        this.style.transform = 'translateY(-1px)';
    };
    exportBtn.onmouseout = function() {
        this.style.background = '#667eea';
        this.style.transform = 'translateY(0)';
    };
    
    btnContainer.appendChild(viewAIBtn);
    btnContainer.appendChild(exportBtn);
    
    titleDiv.appendChild(titleContent);
    titleDiv.appendChild(btnContainer);
    chartWrapper.appendChild(titleDiv);
    
    // 创建canvas容器（设置固定高度）
    const canvasContainer = document.createElement('div');
    // 根据图表类型设置不同的高度
    if (chartType === 'pie' || chartType === 'doughnut') {
        canvasContainer.style.cssText = 'height: 400px; position: relative;';
    } else {
        canvasContainer.style.cssText = 'height: 350px; position: relative;';
    }
    chartWrapper.appendChild(canvasContainer);
    
    // 创建canvas
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    
    // 添加统计结果表格
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;';
    
    // 准备表格数据
    const decimalPlaces = dataTransform && dataTransform.decimalPlaces !== undefined ? dataTransform.decimalPlaces : 2;
    const tableData = labels.map((label, index) => ({
        rank: index + 1,
        label: label,
        value: typeof values[index] === 'number' ? values[index].toFixed(decimalPlaces) : values[index],
        rawValue: values[index],
        percentage: ((values[index] / values.reduce((a, b) => a + b, 0)) * 100).toFixed(2)
    }));
    
    // 创建统计表格HTML
    let tableHTML = '<h5 style="margin: 0 0 10px 0; color: #333;">统计结果</h5>';
    tableHTML += '<div class="stats-container">';
    tableHTML += '<table>';
    tableHTML += '<thead><tr><th>排名</th><th>名称</th><th>数值</th><th>占比</th></tr></thead>';
    tableHTML += '<tbody>';
    
    tableData.forEach((item, index) => {
        const rankStyle = index < 3 ? 'style="color: #667eea; font-weight: bold;"' : '';
        tableHTML += `<tr><td ${rankStyle}>${item.rank}</td><td>${item.label}</td><td>${item.value}</td><td>${item.percentage}%</td></tr>`;
    });
    
    tableHTML += '</tbody></table></div>';
    const totalValue = values.reduce((a, b) => a + b, 0);
    const formattedTotal = typeof totalValue === 'number' ? totalValue.toFixed(decimalPlaces) : totalValue;
    tableHTML += `<div style="margin-top: 10px; color: #666; font-size: 0.85em;">总计：${formattedTotal}</div>`;
    
    statsDiv.innerHTML = tableHTML;
    chartWrapper.appendChild(statsDiv);
    
    // 添加到容器
    container.appendChild(chartWrapper);
    
    // 创建Chart.js图表
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: yAxisColumn || valueColumn || '数量',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: chartType === 'pie' || chartType === 'doughnut',
                    position: 'right',
                    labels: {
                        boxWidth: 15,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(2);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            scales: chartType === 'bar' || chartType === 'line' ? {
                y: {
                    beginAtZero: true
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: {
                            size: 10
                        }
                    }
                }
            } : {}
        }
    });
    
    // 为导出按钮添加点击事件
    exportBtn.onclick = function() {
        exportChartAsImage(chart, title || '数据图表');
    };
    
    charts.push(chart);
}

// 显示AI处理结果
function showAIProcessingResult(config, aiResponse) {
    // 创建模态框
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    `;
    
    // 构建内容
    let contentHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #667eea;">AI处理结果详情</h3>
            <button id="close-modal-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9em;">关闭</button>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h4 style="color: #333; margin-bottom: 10px;">图表配置（JSON）</h4>
            <pre style="background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.85em; line-height: 1.5;">${JSON.stringify(config, null, 2)}</pre>
        </div>
    `;
    
    // 如果有AI响应，显示原始响应
    if (aiResponse) {
        contentHTML += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #333; margin-bottom: 10px;">AI原始响应</h4>
                <pre style="background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.85em; line-height: 1.5; white-space: pre-wrap;">${aiResponse}</pre>
            </div>
        `;
    }
    
    // 显示配置解释
    contentHTML += `
        <div style="margin-bottom: 20px;">
            <h4 style="color: #333; margin-bottom: 10px;">配置解释</h4>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; border-left: 4px solid #4caf50;">
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>图表类型：</strong>${config.chartType === 'bar' ? '柱状图' : config.chartType === 'line' ? '折线图' : config.chartType === 'pie' ? '饼图' : config.chartType}</li>
                    <li><strong>X轴列（分组列）：</strong>${config.xAxisColumn || '未指定'}</li>
                    <li><strong>Y轴列（数值列）：</strong>${config.yAxisColumn || '未指定（计数）'}</li>
                    <li><strong>聚合函数：</strong>${config.aggregateFunction || 'avg'}</li>
                    <li><strong>排序方式：</strong>${config.sortOrder === 'desc' ? '降序（由高到低）' : config.sortOrder === 'asc' ? '升序（由低到高）' : '不排序'}</li>
                    ${config.dataTransform ? `
                    <li><strong>数据预处理：</strong>
                        <ul style="margin-top: 5px;">
                            <li>列：${config.dataTransform.column}</li>
                            <li>操作：${config.dataTransform.operation === 'divide' ? '除法' : config.dataTransform.operation === 'multiply' ? '乘法' : config.dataTransform.operation}</li>
                            <li>数值：${config.dataTransform.value}</li>
                            <li>新单位：${config.dataTransform.unit || '未指定'}</li>
                        </ul>
                    </li>
                    ` : '<li><strong>数据预处理：</strong>无</li>'}
                </ul>
            </div>
        </div>
    `;
    
    modalContent.innerHTML = contentHTML;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 关闭按钮事件
    document.getElementById('close-modal-btn').onclick = function() {
        document.body.removeChild(modal);
    };
    
    // 点击背景关闭
    modal.onclick = function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

// 显示处理日志弹窗
function showQueryProcessingResult() {
    try {
        // 创建模态框
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: #1e1e1e;
            padding: 20px;
            border-radius: 10px;
            max-width: 900px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
            line-height: 1.6;
        `;
        
        const typeColors = {
            'info': '#569cd6',
            'success': '#4ec9b0',
            'error': '#f44747',
            'warning': '#dcdcaa',
            'performance': '#ce9178',
            'command': '#c586c0'
        };
        
        const typeLabels = {
            'info': '[INFO]',
            'success': '[SUCCESS]',
            'error': '[ERROR]',
            'warning': '[WARN]',
            'performance': '[PERF]',
            'command': '[CMD]'
        };
        
        // 构建处理日志内容
        let logsHTML = '';
        if (processingLogs.length === 0) {
            logsHTML = '<div style="color: #858585; padding: 20px; text-align: center;">暂无处理日志</div>';
        } else {
            processingLogs.forEach(log => {
                const color = typeColors[log.type] || '#d4d4d4';
                const label = typeLabels[log.type] || '[INFO]';
                logsHTML += `<div style="margin-bottom: 10px; font-family: 'Consolas', 'Monaco', monospace;">`;
                logsHTML += `<span style="color: #858585;">${log.timestamp}</span> `;
                logsHTML += `<span style="color: ${color}; font-weight: bold;">${label}</span> `;
                logsHTML += `<span style="color: #d4d4d4;">${escapeHtml(log.message)}</span>`;
                if (log.details) {
                    logsHTML += `<div style="margin-left: 20px; margin-top: 4px; color: #9cdcfe; font-size: 0.9em;">${escapeHtml(log.details)}</div>`;
                }
                logsHTML += `</div>`;
            });
        }
        
        // 构建内容
        let contentHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 15px;">
                <h3 style="margin: 0; color: #d4d4d4; font-family: 'Segoe UI', sans-serif;">处理日志</h3>
                <div style="display: flex; gap: 10px;">
                    <button id="copy-logs-btn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">复制日志</button>
                    <button id="close-query-modal-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">关闭</button>
                </div>
            </div>
            
            <div style="background: #252526; padding: 15px; border-radius: 6px; max-height: 60vh; overflow-y: auto;">
                ${logsHTML}
            </div>
        `;
        
        modalContent.innerHTML = contentHTML;
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 关闭按钮事件
        document.getElementById('close-query-modal-btn').onclick = function() {
            document.body.removeChild(modal);
        };
        
        // 复制日志按钮事件
        document.getElementById('copy-logs-btn').onclick = function() {
            const logText = processingLogs.map(log => {
                const label = typeLabels[log.type] || '[INFO]';
                let text = `${log.timestamp} ${label} ${log.message}`;
                if (log.details) {
                    text += ` - ${log.details}`;
                }
                return text;
            }).join('\n');
            
            navigator.clipboard.writeText(logText).then(() => {
                const btn = document.getElementById('copy-logs-btn');
                const originalText = btn.textContent;
                btn.textContent = '已复制!';
                btn.style.background = '#17a2b8';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '#28a745';
                }, 1500);
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            });
        };
        
        // 点击背景关闭
        modal.onclick = function(e) {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
    } catch (error) {
        console.error('显示处理日志失败:', error);
        alert('无法显示处理日志');
    }
}

// 导出查询结果
function exportQueryResult() {
    const queryResultDiv = document.getElementById('nlp-result');
    if (!queryResultDiv || !queryResultDiv.innerHTML) {
        alert('没有可导出的查询结果');
        return;
    }
    
    // 创建一个新的窗口用于打印/导出
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>查询结果导出</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; }
                h3 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
                .query-text { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #667eea; }
                .result-section { margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
                .result-title { color: #667eea; font-weight: 600; margin-bottom: 10px; font-size: 1.1em; }
                @media print {
                    body { padding: 20px; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #667eea; margin-bottom: 10px;">智能数据洞察助手 - 查询结果</h2>
                <p style="color: #666;">导出时间：${new Date().toLocaleString()}</p>
            </div>
            ${queryResultDiv.innerHTML}
            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
                <button onclick="window.print()" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 5px; font-size: 1em; cursor: pointer; margin-right: 10px;">打印 / 另存为PDF</button>
                <button onclick="window.close()" style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 5px; font-size: 1em; cursor: pointer;">关闭</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// V4.2新增：前端智能匹配配置生成
// 根据用户输入和列值智能生成筛选配置
function generateSmartFilterConfig(userInput, columns, columnValues) {
    console.log('[V4.2] 前端智能匹配:', { userInput, columns, columnValues });
    
    // 从文本中提取可能的筛选值
    // 模式1: XX的YY（上海的销售额）
    const match1 = userInput.match(/(.+?)的/);
    // 模式2: XX是YY时（省份是上海时）
    const match2 = userInput.match(/(.+?)是(.+?)(?:时|的|，)/);
    
    let potentialValues = [];
    if (match1) potentialValues.push(match1[1].trim());
    if (match2) potentialValues.push(match2[2].trim());
    
    console.log('[V4.2] 潜在筛选值:', potentialValues);
    
    // 检查每个潜在值是否在columnValues中
    for (const value of potentialValues) {
        for (const [colName, values] of Object.entries(columnValues)) {
            if (values.includes(value)) {
                console.log(`[V4.2] 智能匹配成功: '${value}' 属于列 '${colName}'`);
                
                // 找到数值列（销售额、数量等）
                let valueCol = null;
                for (const col of columns) {
                    if (col.includes('销售额') || col.includes('金额') || col.includes('数量')) {
                        valueCol = col;
                        break;
                    }
                }
                
                if (valueCol) {
                    return {
                        queryType: 'filter_aggregate',
                        filterColumn: colName,
                        filterValue: value,
                        valueColumn: valueCol,
                        aggregateFunction: 'sum',
                        title: `${value}的${valueCol}总和`,
                        description: `筛选${colName}包含"${value}"的数据，计算${valueCol}的sum`,
                        intentType: 'QUERY_AGGREGATE',
                        userInput: userInput
                    };
                }
            }
        }
    }
    
    return null;
}

// V4.2新增：获取每列的唯一值，用于帮助模型识别筛选列
// V4.2修复：使用sampleData而不是data（dataInfo结构中没有data属性）
function getColumnUniqueValues(dataInfo) {
    // V4.2修复：使用sampleData而不是data
    const data = dataInfo.sampleData || dataInfo.data;
    if (!dataInfo || !data || !dataInfo.columns) {
        console.warn('[V4.2] getColumnUniqueValues: 数据不足', dataInfo);
        return null;
    }
    
    const columnValues = {};
    const maxValues = 10; // 每列最多返回10个值，避免数据过大
    
    dataInfo.columns.forEach(col => {
        const values = new Set();
        data.forEach(row => {
            if (row[col] !== undefined && row[col] !== null) {
                values.add(String(row[col]));
            }
        });
        // 转换为数组并限制数量
        columnValues[col] = Array.from(values).slice(0, maxValues);
    });
    
    console.log('[V4.2] 列唯一值:', columnValues);
    return columnValues;
}

// V4.2改进：调用BERT语义匹配配置生成API
// 关键改进：增加columnValues参数，让模型知道每列有哪些值
async function callBERTConfigAPI(userInput, intent, columns, columnValues = null) {
    const apiUrl = `${API_BASE_URL}/api/generate-config`;
    
    console.log('[V4.2] 调用BERT语义匹配API:', { apiUrl, intent, columns, columnValues });
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: userInput,
                intent: intent,
                columns: columns,
                columnValues: columnValues  // V4.2新增：列的唯一值
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[V3.0] BERT语义匹配结果:', result);
        
        if (result.success && result.config) {
            return result.config;
        }
        
        return null;
    } catch (error) {
        console.error('[V3.0] BERT语义匹配失败:', error);
        throw error;
    }
}

// 调用大模型API（带超时控制）
async function callLLMAPI(prompt, signal = null, timeout = 15000) {
    const apiKey = config.ai.apiKey;
    const apiUrl = config.ai.apiUrl;
    const model = config.ai.model;
    
    console.log('调用API:', { apiUrl, model, apiKey: apiKey ? '已配置' : '未配置', timeout });
    
    if (!apiKey || apiKey === 'your-api-key-here') {
        throw new Error('API密钥未配置');
    }
    
    // V4.0新增：重试机制
    const maxRetries = 2;
    const retryDelay = 3000;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[API调用] 第${attempt}次尝试，超时时间: ${timeout}ms`);
        
        // 创建超时控制
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
            timeoutController.abort();
        }, timeout);
        
        // 合并signal
        let finalSignal = timeoutController.signal;
        if (signal) {
            signal.addEventListener('abort', () => {
                timeoutController.abort();
            });
        }
        
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: config.ai.temperature || 0.7,
                max_tokens: config.ai.maxTokens || 1000
            }),
            signal: finalSignal
        };
        
        try {
            console.log('发送请求到:', `${apiUrl}/chat/completions`);
            const startTime = Date.now();
            const response = await fetch(`${apiUrl}/chat/completions`, fetchOptions);
            const endTime = Date.now();
            console.log(`API响应时间: ${endTime - startTime}ms, 状态: ${response.status}`);
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API错误响应:', errorText);
                
                let errorMessage = `API请求失败: ${response.status}`;
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error && errorData.error.message) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    errorMessage = errorText || `HTTP ${response.status} 错误`;
                }
                
                if (response.status === 503 || response.status === 429) {
                    errorMessage += '，建议稍后重试';
                } else if (response.status === 401) {
                    errorMessage = 'API密钥无效，请检查配置';
                } else if (response.status === 0) {
                    errorMessage = '网络请求失败，请检查网络连接或API地址是否正确';
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('API响应格式不正确');
            }
            
            console.log(`[API调用] 第${attempt}次尝试成功`);
            return data.choices[0].message.content;
            
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            
            console.error(`[API调用] 第${attempt}次尝试失败:`, error.message);
            
            // 如果是超时或网络错误，且还有重试机会，则等待后重试
            if (attempt < maxRetries && (
                error.name === 'AbortError' || 
                error.message.includes('Failed to fetch') ||
                error.message.includes('网络')
            )) {
                console.log(`[API调用] 等待${retryDelay}ms后重试...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            
            // 如果是用户主动取消，不重试
            if (signal && signal.aborted) {
                throw new Error('用户取消了请求');
            }
            
            // 最后一次尝试失败，抛出错误
            if (attempt === maxRetries) {
                if (error.name === 'AbortError') {
                    throw new Error(`请求超时（已重试${maxRetries}次），可能原因：网络连接问题、API服务繁忙或API地址配置错误`);
                }
                if (error.message && error.message.includes('Failed to fetch')) {
                    throw new Error('网络请求失败，请检查：1)网络连接是否正常 2)API地址是否正确 3)是否有跨域限制');
                }
                throw error;
            }
        }
    }
    
    // 所有重试都失败
    throw lastError || new Error('API调用失败');
}

// V3.3新增：测试API连接
async function testAPIConnection() {
    const apiKey = config.ai.apiKey;
    const apiUrl = config.ai.apiUrl;
    const model = config.ai.model;
    
    console.log('[API测试] 开始测试连接:', { apiUrl, model, apiKey: apiKey ? '已配置' : '未配置' });
    
    if (!apiKey || apiKey === 'your-api-key-here') {
        throw new Error('API密钥未配置，请在config.js中设置');
    }
    
    const testPrompt = '你好，请回复"API连接测试成功"'; // 使用简单的测试提示词
    
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: testPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 50
        })
    };
    
    try {
        console.log('[API测试] 发送请求到:', `${apiUrl}/chat/completions`);
        const startTime = Date.now();
        const response = await fetch(`${apiUrl}/chat/completions`, fetchOptions);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`[API测试] 响应时间: ${duration}ms, 状态: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API测试] 错误响应:', errorText);
            
            let errorMessage = `API请求失败: ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } catch (e) {
                errorMessage = errorText || `HTTP ${response.status} 错误`;
            }
            
            if (response.status === 401) {
                errorMessage = 'API密钥无效，请检查config.js中的apiKey配置';
            } else if (response.status === 0) {
                errorMessage = '网络请求失败，请检查网络连接或API地址是否正确';
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API响应格式不正确');
        }
        
        const responseContent = data.choices[0].message.content;
        console.log('[API测试] 响应内容:', responseContent);
        
        return `连接成功 (${duration}ms)`;
    } catch (error) {
        console.error('[API测试] 连接失败:', error);
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('网络请求失败，请检查：1)网络连接 2)API地址是否正确 3)是否有跨域限制(CORS)');
        }
        throw error;
    }
}

// 生成模拟自然语言查询回答
function generateMockNLPAnswer(query, dataInfo) {
    // 简单的关键词匹配
    const queryLower = query.toLowerCase();
    
    // 尝试从查询中提取人名（匹配"XXX的..."模式）
    const nameMatch = query.match(/([\u4e00-\u9fa5]{2,4})的/);
    if (nameMatch) {
        const personName = nameMatch[1];
        // 在数据中查找该人名
        const person = data.find(row => row['姓名'] && row['姓名'].includes(personName));
        
        if (person) {
            // 查询收入
            if (queryLower.includes('收入') || queryLower.includes('工资')) {
                const income = person['收入'];
                if (income !== undefined && income !== '') {
                    return `${person['姓名']}的收入是 ${income} 元`;
                }
                // 未找到收入信息，让大模型处理
                return "我需要分析数据来提供准确回答。";
            }
            // 查询年龄
            else if (queryLower.includes('年龄') || queryLower.includes('几岁')) {
                const age = person['年龄'];
                if (age !== undefined && age !== '') {
                    return `${person['姓名']}的年龄是 ${age} 岁`;
                }
                // 未找到年龄信息，让大模型处理
                return "我需要分析数据来提供准确回答。";
            }
            // 查询地址
            else if (queryLower.includes('地址') || queryLower.includes('来自') || queryLower.includes('哪里')) {
                const address = person['地址'];
                if (address !== undefined && address !== '') {
                    return `${person['姓名']}的地址是 ${address}`;
                }
                // 未找到地址信息，让大模型处理
                return "我需要分析数据来提供准确回答。";
            }
            // 通用查询 - 返回该人的所有信息
            else {
                const info = Object.entries(person)
                    .filter(([key, value]) => value !== '' && value !== undefined)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('，');
                if (info) {
                    return `${person['姓名']}的信息：${info}`;
                }
                // 未找到任何信息，让大模型处理
                return "我需要分析数据来提供准确回答。";
            }
        } else {
            // 未找到人名，让大模型处理
            return "我需要分析数据来提供准确回答。";
        }
    }
    
    // 检查是否包含特定关键词
    if (queryLower.includes('最高') && queryLower.includes('收入')) {
        // 找到收入最高的记录
        let maxIncome = -Infinity;
        let maxIncomePerson = null;
        data.forEach(row => {
            const income = parseFloat(row['收入']);
            if (!isNaN(income) && income > maxIncome) {
                maxIncome = income;
                maxIncomePerson = row;
            }
        });
        if (maxIncomePerson) {
            return `根据数据，收入最高的是 ${maxIncomePerson['姓名']}，收入为 ${maxIncome} 元`;
        }
    } else if (queryLower.includes('平均') && queryLower.includes('年龄')) {
        const ageStats = calculateStats('年龄');
        if (ageStats.avg !== null) {
            return `根据数据，平均年龄为 ${ageStats.avg.toFixed(2)} 岁`;
        }
    } else if (queryLower.includes('年龄') && (queryLower.includes('最大') || queryLower.includes('最高'))) {
        // 找到年龄最大的记录
        let maxAge = -Infinity;
        let maxAgePerson = null;
        data.forEach(row => {
            const age = parseFloat(row['年龄']);
            if (!isNaN(age) && age > maxAge) {
                maxAge = age;
                maxAgePerson = row;
            }
        });
        if (maxAgePerson) {
            return `根据数据，年龄最大的是 ${maxAgePerson['姓名']}，年龄为 ${maxAge} 岁`;
        }
    } else if (queryLower.includes('城市') && queryLower.includes('数量')) {
        if (dataInfo.columns.includes('城市')) {
            const cities = new Set(data.map(row => row['城市']).filter(val => val));
            return `数据中包含 ${cities.size} 个不同的城市`;
        }
    } else if (queryLower.includes('性别') && queryLower.includes('分布')) {
        if (dataInfo.columns.includes('性别')) {
            const genderCount = {};
            data.forEach(row => {
                const gender = row['性别'];
                if (gender) {
                    genderCount[gender] = (genderCount[gender] || 0) + 1;
                }
            });
            const result = Object.entries(genderCount).map(([gender, count]) => `${gender}: ${count}人`).join('，');
            return `性别分布情况：${result}`;
        }
    }
    
    // 所有本地逻辑无法处理的情况，都返回此标记让大模型处理
    return "我需要分析数据来提供准确回答。";
}

// ========== V4.0新增：显示Agent查询结果 ==========
function displayAgentQueryResult(userInput, config, analysisResult, explanationResult, totalStartTime) {
    endOperationTiming();
    
    // 显示结果
    setNLPProgress(90, '正在生成结果...');
    
    const nlpResult = document.getElementById('nlp-result');
    if (!nlpResult) return;
    
    // 构建结果HTML - 简化版，不显示额外标题
    let html = '';
    
    // 显示执行计划（仅复杂查询显示）
    if (analysisResult.plan && analysisResult.plan.complexity !== 'simple') {
        html += `
            <div class="result-section" style="margin-bottom: 15px;">
                <div class="section-title" style="color: #667eea; font-weight: 600; margin-bottom: 8px;">
                    📋 执行计划
                </div>
                <div class="plan-summary" style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 13px;">
                    ${analysisResult.plan.summary || '查询已执行'}
                </div>
            </div>
        `;
    }
    
    // 显示主要结果
    if (analysisResult.summary) {
        html += `
            <div class="result-section" style="margin-bottom: 15px;">
                <div class="section-title" style="color: #4caf50; font-weight: 600; margin-bottom: 8px;">
                    📊 分析结果
                </div>
                <div class="analysis-summary" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 15px; border-radius: 8px; font-size: 15px; font-weight: 500;">
                    ${analysisResult.summary}
                </div>
            </div>
        `;
    }
    
    // 显示详细数据（如果有）
    if (analysisResult.data) {
        html += `
            <div class="result-section" style="margin-bottom: 15px;">
                <div class="section-title" style="color: #2196f3; font-weight: 600; margin-bottom: 8px;">
                    📈 详细数据
                </div>
        `;
        
        // 如果是数组，显示表格
        if (Array.isArray(analysisResult.data) && analysisResult.data.length > 0) {
            const firstItem = analysisResult.data[0];
            
            if (firstItem.group !== undefined && (firstItem.value !== undefined || firstItem.count !== undefined)) {
                // 分组数据
                const valueKey = firstItem.value !== undefined ? 'value' : 'count';
                const valueLabel = firstItem.value !== undefined ? '数值' : '数量';
                
                html += `
                    <div style="overflow-x: auto;">
                        <table class="result-table" style="width: 100%; border-collapse: collapse; min-width: 300px;">
                            <thead>
                                <tr style="background: #667eea; color: white;">
                                    <th style="padding: 10px; text-align: left;">排名</th>
                                    <th style="padding: 10px; text-align: left;">分组</th>
                                    <th style="padding: 10px; text-align: left;">${valueLabel}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${analysisResult.data.slice(0, 10).map((item, index) => `
                                    <tr style="background: ${index === 0 ? '#e8f4f8' : (index % 2 === 0 ? 'white' : '#f8f9fa')};">
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${index === 0 ? 'bold' : 'normal'};">${index + 1}</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${index === 0 ? 'bold' : 'normal'};">${item.group}</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${index === 0 ? 'bold' : 'normal'};">${typeof item[valueKey] === 'number' ? item[valueKey].toFixed(2) : item[valueKey]}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (firstItem.row) {
                // Top N数据
                html += `
                    <div style="overflow-x: auto;">
                        <table class="result-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #667eea; color: white;">
                                    <th style="padding: 10px; text-align: left;">排名</th>
                                    ${Object.keys(firstItem.row).map(key => `<th style="padding: 10px; text-align: left;">${key}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${analysisResult.data.slice(0, 10).map((item, index) => `
                                    <tr style="background: ${index === 0 ? '#e8f4f8' : (index % 2 === 0 ? 'white' : '#f8f9fa')};">
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: ${index === 0 ? 'bold' : 'normal'};">${index + 1}</td>
                                        ${Object.values(item.row).map(val => `<td style="padding: 10px; border-bottom: 1px solid #eee;">${val || ''}</td>`).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } else if (analysisResult.data.row) {
            // 单条记录
            html += `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <table class="result-table" style="width: 100%; border-collapse: collapse;">
                        <tr style="background: #667eea; color: white;">
                            ${Object.keys(analysisResult.data.row).map(key => `<th style="padding: 10px; text-align: left;">${key}</th>`).join('')}
                        </tr>
                        <tr>
                            ${Object.values(analysisResult.data.row).map(val => `<td style="padding: 10px; border-bottom: 1px solid #eee;">${val || ''}</td>`).join('')}
                        </tr>
                    </table>
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    // 显示洞察（如果有）
    if (explanationResult && explanationResult.insights && explanationResult.insights.length > 0) {
        html += `
            <div class="result-section" style="margin-bottom: 15px;">
                <div class="section-title" style="color: #ff9800; font-weight: 600; margin-bottom: 8px;">
                    💡 洞察发现
                </div>
                <ul style="margin: 0; padding-left: 20px; color: #666;">
                    ${explanationResult.insights.map(insight => `<li style="margin-bottom: 5px;">${insight}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // 显示建议（如果有）
    if (explanationResult && explanationResult.suggestions && explanationResult.suggestions.length > 0) {
        html += `
            <div class="result-section" style="margin-bottom: 15px;">
                <div class="section-title" style="color: #9c27b0; font-weight: 600; margin-bottom: 8px;">
                    📌 行动建议
                </div>
                <ul style="margin: 0; padding-left: 20px; color: #666;">
                    ${explanationResult.suggestions.map(suggestion => `<li style="margin-bottom: 5px;">${suggestion}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // 显示执行信息
    const totalDuration = Date.now() - totalStartTime;
    html += `
        <div class="result-footer" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <span>⏱️ 总耗时: ${totalDuration}ms</span>
            <span style="margin-left: 15px;">🤖 Agent: ${analysisResult.agent || 'analysis'}</span>
        </div>
    `;
    
    nlpResult.innerHTML = html;
    nlpResult.classList.remove('hidden');
    
    // 记录日志
    addProcessingLog('performance', 'Agent查询完成', `总耗时: ${totalDuration}ms`);
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
}

// V4.0新增：更新查询建议按钮
function updateQuerySuggestions() {
    if (!window.queryHistoryManager) return;
    
    const suggestions = window.queryHistoryManager.getSuggestions();
    const examplesContainer = document.querySelector('.nlp-examples');
    
    if (!examplesContainer) return;
    
    // 保留"试试这些："标签
    const label = examplesContainer.querySelector('.example-label');
    if (!label) return;
    
    // 清空现有按钮
    const existingButtons = examplesContainer.querySelectorAll('.example-btn');
    existingButtons.forEach(btn => btn.remove());
    
    // 添加新的建议按钮
    suggestions.forEach(suggestion => {
        const btn = document.createElement('button');
        btn.className = 'example-btn';
        btn.textContent = suggestion.label;
        btn.setAttribute('data-query', suggestion.query);
        btn.addEventListener('click', () => {
            const nlpInput = document.getElementById('nlp-input');
            if (nlpInput) {
                nlpInput.value = suggestion.query;
                nlpInput.focus();
            }
        });
        examplesContainer.appendChild(btn);
    });
    
    console.log('[QueryHistory] 更新查询建议:', suggestions.map(s => s.label).join(', '));
}

// V4.0新增：初始化查询历史管理器
async function initQueryHistory() {
    try {
        const { default: queryHistoryManager } = await import('./js/queryHistory.js');
        window.queryHistoryManager = queryHistoryManager;
        console.log('[QueryHistory] 查询历史管理器初始化成功');
        
        // 更新查询建议
        updateQuerySuggestions();
    } catch (error) {
        console.warn('[QueryHistory] 初始化查询历史管理器失败:', error);
    }
}

// 对话窗口消息处理函数
async function handleSendMessage() {
    const conversationInput = document.getElementById('conversation-input');
    const conversationMessages = document.getElementById('conversation-messages');
    const sendMessageBtn = document.getElementById('send-message');
    const conversationProgress = document.getElementById('conversation-progress');
    const conversationStatus = document.getElementById('conversation-status');
    
    if (!conversationInput || !conversationMessages) return;
    
    const userMessage = conversationInput.value.trim();
    if (!userMessage) {
        return;
    }
    
    // 添加用户消息到对话窗口
    addMessage('user', userMessage);
    
    // 清空输入框
    conversationInput.value = '';
    
    // 显示处理状态
    if (conversationStatus) {
        const statusText = conversationStatus.querySelector('.status-text');
        const statusDot = conversationStatus.querySelector('.status-dot');
        if (statusText) {
            statusText.textContent = '处理中';
        }
        if (statusDot) {
            statusDot.style.background = '#ffc107';
        }
    }
    
    // 隐藏外部进度条，使用聊天对话框中的进度展示
    if (conversationProgress) {
        conversationProgress.classList.add('hidden');
    }
    
    // 禁用发送按钮
    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }
    
    try {
        // 检查是否有数据
        if (data.length === 0) {
            addMessage('system', '请先上传数据文件，然后再告诉我您的分析需求。');
            completeConversation();
            return;
        }
        
        // 记录开始时间
        const totalStartTime = Date.now();
        addProcessingLog('info', '开始处理对话消息', `用户输入: "${userMessage}"`);
        
        // V5.0修复：初始化Agent工作流可视化（不自动弹出面板，只更新状态）
        updateAgentWorkflow('intent_recognition', 'running');
        
        // 首先尝试使用原有的本地意图识别逻辑（V4.0修复：优先使用原有的精准模式）
        if (window.requirementClassifier) {
            addProcessingLog('info', '尝试使用原有的需求分类模块');
            
            const dataInfo = {
                columns: headers,
                rowCount: data.length,
                sampleData: data.slice(0, 10)
            };
            
            // 使用需求分类模块进行智能路由
            const classification = await window.requirementClassifier.classify(
                userMessage, 
                dataInfo.columns, 
                dataInfo.sampleData
            );
            
            addProcessingLog('info', `需求分类结果: ${classification.mode}`, 
                `理由: ${classification.reason}, 置信度: ${classification.confidence.toFixed(2)}`);
            
            // 如果是精准模式，直接使用原有的处理逻辑
            if (classification.mode === 'precise') {
                addProcessingLog('info', '进入精准模式，使用原有的本地意图识别');
                
                // 创建临时的输入元素来复用原有的处理逻辑
                const tempInput = document.createElement('input');
                tempInput.id = 'nlp-input';
                tempInput.value = userMessage;
                document.body.appendChild(tempInput);
                
                // 保存原始的 nlp-result 元素
                const originalNlpResult = document.getElementById('nlp-result');
                
                // 创建临时的 nlp-result 元素
                const tempNlpResult = document.createElement('div');
                tempNlpResult.id = 'nlp-result';
                document.body.appendChild(tempNlpResult);
                
                // 调用原有的统一NLP处理函数
                await handleUnifiedNLP();
                
                // 检查是否发生了追问（通过检查是否存在clarification-message）
                const hasClarification = document.querySelector('.clarification-message');
                
                // 如果发生了追问，直接返回，不添加处理完成消息
                if (hasClarification) {
                    // 移除临时元素
                    document.body.removeChild(tempInput);
                    document.body.removeChild(tempNlpResult);
                    
                    // 恢复原始元素
                    if (originalNlpResult) {
                        originalNlpResult.id = 'nlp-result';
                    }
                    
                    return;
                }
                
                // 获取处理结果
                const resultContent = tempNlpResult.innerHTML;
                
                // 移除临时元素
                document.body.removeChild(tempInput);
                document.body.removeChild(tempNlpResult);
                
                // 恢复原始元素
                if (originalNlpResult) {
                    originalNlpResult.id = 'nlp-result';
                }
                
                // 将结果显示在聊天窗口中作为卡片
                if (resultContent) {
                    // 处理结果内容，移除不需要的部分
                    let processedContent = resultContent;
                    
                    // 移除用户需求部分
                    processedContent = processedContent.replace(/您的需求：.*?<\/div>/s, '');
                    
                    // 移除成功提示部分
                    processedContent = processedContent.replace(/✓ 成功生成.*?区域查看/s, '');
                    
                    // 如果是图表生成，只显示图表生成完成和查看按钮
                    if (processedContent.includes('查看图表') || resultContent.includes('图表')) {
                        let cardContent = `
                            <div class="result-card">
                                <div class="result-card-header">
                                    <h4>处理结果</h4>
                                </div>
                                <div class="result-card-body">
                                    <p>图表生成完成</p>
                                    <button class="view-chart-btn" onclick="scrollToVisualization()">查看图表</button>
                                </div>
                            </div>
                        `;
                        addMessage('system', cardContent);
                    } else {
                        let cardContent = `
                            <div class="result-card">
                                <div class="result-card-header">
                                    <h4>处理结果</h4>
                                </div>
                                <div class="result-card-body">
                                    ${processedContent}
                                </div>
                            </div>
                        `;
                        addMessage('system', cardContent);
                    }
                } else {
                    addMessage('system', '处理完成，结果已生成。');
                }
                completeConversation();
                return;
            }
            
            // 如果是智能模式或拒识，使用新的对话管理器
            addProcessingLog('info', '进入智能模式或拒识，使用对话管理器');
            
            // V5.0修复：更新Agent工作流状态
            updateAgentWorkflow('intent_recognition', 'completed', {
                mode: classification.mode,
                confidence: classification.confidence
            });
            updateAgentWorkflow('entity_extraction', 'completed', {
                entities: classification.entityExtraction,
                matchedColumns: classification.matchedColumns
            });
            updateAgentWorkflow('generate_config', 'running');
        }
        
        // 初始化对话管理器（如果还没有）
        if (!window.conversationManager) {
            try {
                const module = await import('./js/conversationManager.js');
                window.conversationManager = module.default;
            } catch (error) {
                console.error('加载对话管理器失败:', error);
                addMessage('system', '系统初始化失败，请刷新页面重试。');
                completeConversation();
                return;
            }
        }
        
        // 设置数据信息
        window.conversationManager.setDataInfo(headers, data);
        
        // 使用对话管理器处理用户输入
        const response = await window.conversationManager.processUserInput(userMessage);
        
        addProcessingLog('info', '对话管理器响应', `类型: ${response.type}`);
        
        // 根据响应类型处理
        if (response.type === 'clarification') {
            // 需要澄清，显示追问消息
            addMessage('system', response.message);
            
            // 生成追问选项
            if (response.missingElements && response.missingElements.length > 0) {
                const missingElement = response.missingElements[0];
                const options = [];
                
                if (missingElement.includes('维度')) {
                    // 生成维度列选项
                    const dimensionColumns = headers.filter(col => {
                        const dimensionKeywords = ['地区', '省份', '省', '城市', '产品', '商品', '客户', '类型', '类别', '状态', '日期', '时间'];
                        return dimensionKeywords.some(kw => col.toLowerCase().includes(kw.toLowerCase()));
                    });
                    dimensionColumns.slice(0, 5).forEach(col => {
                        options.push({ label: col, value: col });
                    });
                } else if (missingElement.includes('指标')) {
                    // 生成度量列选项
                    const measureColumns = headers.filter(col => {
                        const measureKeywords = ['销售额', '金额', '数量', '价格', '成本', '利润', '营收', '收入', '增长', '率', '额', '量'];
                        return measureKeywords.some(kw => col.toLowerCase().includes(kw.toLowerCase()));
                    });
                    measureColumns.slice(0, 5).forEach(col => {
                        options.push({ label: col, value: col });
                    });
                }
                
                options.push({ label: '补充说明更多细节', value: 'more_details' });
                options.push({ label: '以上都不是，让AI帮我理解', value: 'llm_fallback' });
                
                // 显示追问选项
                addConfirmationButtons(options, null, null);
            }
            
            completeConversation();
            
        } else if (response.type === 'column_confirmation') {
            // 需要确认列名映射
            addMessage('system', response.message);
            addConfirmationButtons(response.options, response.term, response.suggested);
            completeConversation();
            
        } else if (response.type === 'column_alternatives') {
            // 显示其他列名选项
            addMessage('system', response.message);
            addConfirmationButtons(response.options, null, null);
            completeConversation();
            
        } else if (response.type === 'choice') {
            // 需要用户选择，显示选项
            addMessage('system', response.message);
            addChoiceButtons(response.choices);
            completeConversation();
            
        } else if (response.type === 'more_details') {
            // 需要用户补充更多细节
            addMessage('system', response.message);
            completeConversation();
            
        } else if (response.type === 'execute') {
            // 直接执行
            addMessage('system', response.message);
            
            // 执行查询或图表生成
            if (response.config) {
                await executeConversationAction(response.config, totalStartTime);
            }
            completeConversation();
            
        } else if (response.type === 'llm_fallback') {
            // V5.0：使用大模型兜底，显示详细原因
            console.log('[V5.0] 本地模型完整度不足，调用大模型:', response);
            
            // 检查属性是否存在
            if (response.completeness !== undefined && response.reason && response.missingElements) {
                addProcessingLog('info', '本地模型完整度不足', `完整度: ${(response.completeness * 100).toFixed(1)}%，原因: ${response.reason}`);
                addProcessingLog('info', '缺失要素', response.missingElements.join(', '));
                addMessage('system', `需求理解完整度 ${(response.completeness * 100).toFixed(0)}%，正在调用大模型进行深度理解...`);
            } else {
                addProcessingLog('info', '本地模型无法理解需求', '正在调用大模型进行深度理解...');
                addMessage('system', '正在调用大模型进行深度理解...');
            }
            
            // 调用大模型
            await handleLLMFallback(userMessage, totalStartTime);
            completeConversation();
            
        } else if (response.type === 'retry') {
            // 重试
            addMessage('system', response.message);
            completeConversation();
        }
        
    } catch (error) {
        addMessage('system', `处理失败: ${error.message}`);
        addProcessingLog('error', '对话处理失败', error.message);
        completeConversation();
    }
}

// 添加列名确认按钮到对话窗口
function addConfirmationButtons(options, term, suggested) {
    const conversationMessages = document.getElementById('conversation-messages');
    if (!conversationMessages) return;
    
    // 移除之前的确认按钮（如果有）
    const existingConfirmation = conversationMessages.querySelector('.confirmation-buttons');
    if (existingConfirmation) {
        existingConfirmation.remove();
    }
    
    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'confirmation-buttons';
    confirmationDiv.style.cssText = 'margin-top: 15px; display: flex; flex-direction: column; gap: 10px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;';
    
    // 添加提示文字
    const hintText = document.createElement('div');
    hintText.style.cssText = 'font-size: 0.9em; color: #666; margin-bottom: 5px;';
    hintText.textContent = '请点击选项或输入编号（1、2、3...）进行选择：';
    confirmationDiv.appendChild(hintText);
    
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'confirmation-btn';
        button.textContent = `${index + 1}. ${option.label}`;
        
        // 根据选项类型设置不同样式
        if (option.value === 'none') {
            // "以上都不是"选项使用不同样式
            button.style.cssText = `
                background: #fff3cd;
                border: 1px solid #ffc107;
                padding: 12px 16px;
                border-radius: 8px;
                cursor: pointer;
                text-align: left;
                transition: all 0.3s ease;
                color: #856404;
                font-size: 0.95em;
            `;
        } else {
            button.style.cssText = `
                background: white;
                border: 2px solid #667eea;
                padding: 12px 16px;
                border-radius: 8px;
                cursor: pointer;
                text-align: left;
                transition: all 0.3s ease;
                color: #333;
                font-size: 0.95em;
            `;
        }
        
        button.addEventListener('click', () => handleConfirmationSelection(option, term));
        button.addEventListener('mouseenter', () => {
            if (option.value === 'none') {
                button.style.background = '#ffeeba';
            } else {
                button.style.background = '#f0f4ff';
                button.style.borderColor = '#764ba2';
                button.style.transform = 'translateX(5px)';
            }
        });
        button.addEventListener('mouseleave', () => {
            if (option.value === 'none') {
                button.style.background = '#fff3cd';
            } else {
                button.style.background = 'white';
                button.style.borderColor = '#667eea';
                button.style.transform = 'translateX(0)';
            }
        });
        
        confirmationDiv.appendChild(button);
    });
    
    conversationMessages.appendChild(confirmationDiv);
    conversationMessages.scrollTop = conversationMessages.scrollHeight;
}

// 处理列名确认选择
async function handleConfirmationSelection(option, originalTerm) {
    // 移除确认按钮
    const conversationMessages = document.getElementById('conversation-messages');
    const confirmationDiv = conversationMessages.querySelector('.confirmation-buttons');
    if (confirmationDiv) {
        confirmationDiv.remove();
    }
    
    // 添加用户选择到对话
    addMessage('user', option.label);
    
    const conversationProgress = document.getElementById('conversation-progress');
    const conversationStatus = document.getElementById('conversation-status');
    const sendMessageBtn = document.getElementById('send-message');
    
    // 显示处理状态
    if (conversationStatus) {
        const statusText = conversationStatus.querySelector('.status-text');
        const statusDot = conversationStatus.querySelector('.status-dot');
        if (statusText) {
            statusText.textContent = '处理中';
        }
        if (statusDot) {
            statusDot.style.background = '#ffc107';
        }
    }
    
    // 显示进度条
    if (conversationProgress) {
        conversationProgress.classList.remove('hidden');
    }
    
    // 禁用发送按钮
    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }
    
    try {
        const totalStartTime = Date.now();
        
        if (option.value === 'none') {
            // 用户说以上都不是，交给大模型处理
            addMessage('system', '好的，我将使用AI深度理解您的需求，请稍候...');
            
            // 获取原始输入（从 currentContext 中保存的 originalInput）
            const originalInput = window.conversationManager.currentContext?.originalInput;
            
            if (originalInput) {
                // 重置状态
                window.conversationManager.resetContext();
                await handleLLMFallback(originalInput, totalStartTime);
            }
        } else if (option.value === 'more_details') {
            // 用户选择补充更多细节
            addMessage('system', '请补充说明您的需求细节，例如：\n- 您想分析哪些数据列？\n- 您希望进行什么操作（统计、图表、筛选）？\n- 有什么筛选条件吗？');
            completeConversation();
            return;
        } else if (option.value === 'llm_fallback') {
            // 用户选择让AI处理
            addMessage('system', '好的，我将使用AI深度理解您的需求...');
            const originalInput = window.conversationManager.currentContext?.originalInput;
            if (originalInput) {
                await handleLLMFallback(originalInput, totalStartTime);
            }
            completeConversation();
            return;
        } else {
            // 检查是否是列名确认
            if (originalTerm) {
                // 用户确认了列名映射
                // 记录确认
                window.conversationManager.semanticMatcher.recordConfirmation(originalTerm, option.value);
                
                // 获取原始输入（从 currentContext 中保存的 originalInput）
                const originalInput = window.conversationManager.currentContext?.originalInput;
                
                if (originalInput) {
                    // 替换术语为确认的列名
                    const updatedInput = originalInput.replace(originalTerm, option.value);
                    
                    addProcessingLog('info', '列名确认后重新处理', `原始输入: "${originalInput}" → 更新后: "${updatedInput}"`);
                    
                    // 重置状态（但保留 currentContext，因为 processUserInput 需要它）
                    window.conversationManager.state = 'idle';
                    window.conversationManager.currentContext.pendingIntent = null;
                    
                    // 直接将更新后的输入作为新的用户消息处理
                    const response = await window.conversationManager.processUserInput(updatedInput);
                    
                    addProcessingLog('info', '重新处理后的响应类型', response.type);
                    
                    // 处理响应
                    if (response.type === 'execute') {
                        addMessage('system', response.message);
                        if (response.config) {
                            await executeConversationAction(response.config, totalStartTime);
                        }
                        completeConversation();
                    } else if (response.type === 'llm_fallback') {
                        addMessage('system', response.message);
                        await handleLLMFallback(updatedInput, totalStartTime);
                        completeConversation();
                    } else if (response.type === 'column_confirmation') {
                        // 还有其他的列名需要确认
                        addMessage('system', response.message);
                        addConfirmationButtons(response.options, response.term, response.suggested);
                        completeConversation();
                    } else if (response.type === 'choice') {
                        // 需要用户选择操作
                        addMessage('system', response.message);
                        if (response.choices && response.choices.length > 0) {
                            addChoiceButtons(response.choices);
                        } else {
                            addMessage('system', '抱歉，没有可用的选项。请尝试重新描述您的需求。');
                        }
                        completeConversation();
                    } else {
                        // 其他类型的响应
                        addMessage('system', response.message || '已收到您的确认，正在处理...');
                        completeConversation();
                    }
                } else {
                    addMessage('system', '抱歉，无法获取原始输入，请重新描述您的需求。');
                    addProcessingLog('error', '列名确认失败', '无法获取原始输入或术语');
                    completeConversation();
                }
            } else {
                // 非列名确认，可能是图表需求的维度选择
                const originalInput = window.conversationManager.currentContext?.originalInput;
                if (originalInput) {
                    // 将选择的维度添加到原始输入中
                    const updatedInput = `${originalInput}，按${option.value}分组`;
                    
                    addProcessingLog('info', '维度选择后重新处理', `原始输入: "${originalInput}" → 更新后: "${updatedInput}"`);
                    
                    // 重置状态（但保留 currentContext，因为 processUserInput 需要它）
                    window.conversationManager.state = 'idle';
                    window.conversationManager.currentContext.pendingIntent = null;
                    
                    // 直接将更新后的输入作为新的用户消息处理
                    const response = await window.conversationManager.processUserInput(updatedInput);
                    
                    addProcessingLog('info', '重新处理后的响应类型', response.type);
                    
                    // 处理响应
                    if (response.type === 'execute') {
                        addMessage('system', response.message);
                        if (response.config) {
                            await executeConversationAction(response.config, totalStartTime);
                        }
                        completeConversation();
                    } else if (response.type === 'llm_fallback') {
                        addMessage('system', response.message);
                        await handleLLMFallback(updatedInput, totalStartTime);
                        completeConversation();
                    } else if (response.type === 'column_confirmation') {
                        // 还有其他的列名需要确认
                        addMessage('system', response.message);
                        addConfirmationButtons(response.options, response.term, response.suggested);
                        completeConversation();
                    } else if (response.type === 'choice') {
                        // 需要用户选择操作
                        addMessage('system', response.message);
                        if (response.choices && response.choices.length > 0) {
                            addChoiceButtons(response.choices);
                        } else {
                            addMessage('system', '抱歉，没有可用的选项。请尝试重新描述您的需求。');
                        }
                        completeConversation();
                    } else {
                        // 其他类型的响应
                        addMessage('system', response.message || '已收到您的确认，正在处理...');
                        completeConversation();
                    }
                } else {
                    // 非列名确认，可能是其他类型的选择
                    addMessage('system', `已选择：${option.label}`);
                    completeConversation();
                }
            }
        }
        
    } catch (error) {
        addMessage('system', `处理失败: ${error.message}`);
        addProcessingLog('error', '确认处理失败', error.message);
        completeConversation();
    }
}

// 添加选择按钮到对话窗口
function addChoiceButtons(choices) {
    const conversationMessages = document.getElementById('conversation-messages');
    if (!conversationMessages) return;
    
    // 如果选项为空，显示默认消息
    if (!choices || choices.length === 0) {
        addMessage('system', '抱歉，没有可用的选项。请尝试重新描述您的需求。');
        return;
    }
    
    const choicesDiv = document.createElement('div');
    choicesDiv.className = 'conversation-choices';
    choicesDiv.style.cssText = 'margin-top: 10px; display: flex; flex-direction: column; gap: 8px;';
    
    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.textContent = `${index + 1}. ${choice.label}`;
        button.style.cssText = `
            background: white;
            border: 1px solid #667eea;
            padding: 10px 15px;
            border-radius: 8px;
            cursor: pointer;
            text-align: left;
            transition: all 0.3s ease;
            color: #333;
        `;
        
        button.addEventListener('click', () => handleChoiceSelection(choice));
        button.addEventListener('mouseenter', () => {
            button.style.background = '#f0f4ff';
            button.style.borderColor = '#764ba2';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'white';
            button.style.borderColor = '#667eea';
        });
        
        choicesDiv.appendChild(button);
    });
    
    conversationMessages.appendChild(choicesDiv);
    conversationMessages.scrollTop = conversationMessages.scrollHeight;
}

// 处理用户选择
async function handleChoiceSelection(choice) {
    addMessage('user', choice.label);
    
    const conversationProgress = document.getElementById('conversation-progress');
    const conversationStatus = document.getElementById('conversation-status');
    const sendMessageBtn = document.getElementById('send-message');
    
    // 显示处理状态
    if (conversationStatus) {
        const statusText = conversationStatus.querySelector('.status-text');
        const statusDot = conversationStatus.querySelector('.status-dot');
        if (statusText) {
            statusText.textContent = '处理中';
        }
        if (statusDot) {
            statusDot.style.background = '#ffc107';
        }
    }
    
    // 显示进度条
    if (conversationProgress) {
        conversationProgress.classList.remove('hidden');
    }
    
    // 禁用发送按钮
    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }
    
    try {
        const totalStartTime = Date.now();
        
        if (choice.id === 'llm_fallback') {
            // 使用大模型兜底
            addMessage('system', '好的，我将使用AI深度理解您的需求，请稍候...');
            await handleLLMFallback(choice.label, totalStartTime);
        } else {
            // 执行选择的操作
            addMessage('system', `好的，我将为您${choice.description}。`);
            await executeConversationAction(choice.config, totalStartTime);
        }
        
    } catch (error) {
        addMessage('system', `处理失败: ${error.message}`);
        addProcessingLog('error', '选择处理失败', error.message);
    } finally {
        completeConversation();
    }
}

// 执行对话操作
async function executeConversationAction(config, totalStartTime) {
    if (!config) {
        addMessage('system', '配置信息不完整，无法执行操作。');
        return;
    }
    
    addProcessingLog('info', '执行对话操作', JSON.stringify(config).substring(0, 100));
    
    // V5.0调试：检查排序参数
    console.log('[executeConversationAction] 配置详情:', {
        chartType: config.chartType,
        sortOrder: config.sortOrder,
        sortBy: config.sortBy,
        description: config.description
    });
    
    // V5.0修复：更新Agent工作流状态
    updateAgentWorkflow('generate_config', 'completed', {
        configType: config.chartType ? 'chart' : (config.queryType || 'unknown'),
        description: config.description || '执行操作'
    });
    updateAgentWorkflow('execute_query', 'running');
    
    const dataInfo = {
        columns: headers,
        rowCount: data.length,
        sampleData: data.slice(0, 10)
    };
    
    // 创建临时的 DOM 元素用于显示结果
    const originalNlpResult = document.getElementById('nlp-result');
    const tempNlpResult = document.createElement('div');
    tempNlpResult.id = 'nlp-result';
    document.body.appendChild(tempNlpResult);
    
    try {
        if (config.chartType) {
            // 显示处理中的消息
            const processingMessage = addMessage('system', '正在生成图表...');
            
            // 生成图表
            await handleNLPChartWithConfig(config.userInput || '用户需求', dataInfo, totalStartTime, [config]);
            
            // 更新处理消息为完成状态
            if (processingMessage) {
                const messageContent = processingMessage.querySelector('.message-content');
                if (messageContent) {
                    messageContent.innerHTML = '<p>图表生成完成，请在下方"数据可视化"区域查看</p>';
                }
            }
        } else if (config.queryType === 'aggregate_groupby') {
            // 执行聚合查询
            await executeAggregateQuery(config.userInput || '用户需求', dataInfo, totalStartTime, config);
        } else if (config.queryType) {
            // 执行其他查询
            await executeLocalQuery(config.userInput || '用户需求', dataInfo, totalStartTime, config);
        }
        
        // 获取处理结果
        const resultContent = tempNlpResult.innerHTML;
        
        // 以卡片形式显示结果在聊天窗口内
            if (resultContent) {
                // 处理结果内容，移除不需要的部分
                let processedContent = resultContent;
                
                // 移除用户需求部分
                processedContent = processedContent.replace(/您的需求：.*?<\/div>/s, '');
                
                // 移除成功提示部分
                processedContent = processedContent.replace(/✓ 成功生成.*?区域查看/s, '');
                
                // 如果是图表生成，只显示图表生成完成和查看按钮
                if (processedContent.includes('查看图表') || config.chartType) {
                    let cardContent = `
                        <div class="result-card">
                            <div class="result-card-header">
                                <h4>处理结果</h4>
                            </div>
                            <div class="result-card-body">
                                <p>图表生成完成</p>
                                <button class="view-chart-btn" onclick="scrollToVisualization()">查看图表</button>
                            </div>
                        </div>
                    `;
                    addMessage('system', cardContent);
                } else {
                    let cardContent = `
                        <div class="result-card">
                            <div class="result-card-header">
                                <h4>处理结果</h4>
                            </div>
                            <div class="result-card-body">
                                ${processedContent}
                            </div>
                        </div>
                    `;
                    addMessage('system', cardContent);
                }
            } else {
                addMessage('system', '查询已完成，但未生成结果。');
            }
        
        // 同时更新原始的 nlp-result 区域（如果存在）
        if (originalNlpResult && resultContent) {
            originalNlpResult.innerHTML = resultContent;
            originalNlpResult.classList.remove('hidden');
        }
        
        // V5.0修复：更新Agent工作流为完成状态
        updateAgentWorkflow('execute_query', 'completed');
        updateAgentWorkflow('render_result', 'completed', {
            resultType: config.chartType ? 'chart' : (config.queryType || 'unknown')
        });
        
    } catch (error) {
        addMessage('system', `执行失败: ${error.message}`);
        addProcessingLog('error', '执行对话操作失败', error.message);
        // V5.0修复：更新Agent工作流为失败状态
        updateAgentWorkflow('execute_query', 'error', { error: error.message });
    } finally {
        // 移除临时元素
        if (tempNlpResult.parentNode) {
            document.body.removeChild(tempNlpResult);
        }
        // 恢复原始元素 ID
        if (originalNlpResult) {
            originalNlpResult.id = 'nlp-result';
        }
    }
}

// 大模型兜底处理
async function handleLLMFallback(userMessage, totalStartTime) {
    addProcessingLog('info', '使用大模型兜底处理', userMessage);
    
    try {
        // 调用现有的统一NLP处理函数
        const tempInput = document.createElement('input');
        tempInput.id = 'nlp-input';
        tempInput.value = userMessage;
        document.body.appendChild(tempInput);
        
        const originalNlpResult = document.getElementById('nlp-result');
        const tempNlpResult = document.createElement('div');
        tempNlpResult.id = 'nlp-result';
        document.body.appendChild(tempNlpResult);
        
        const originalNlpProgress = document.getElementById('nlp-progress');
        const tempNlpProgress = document.createElement('div');
        tempNlpProgress.id = 'nlp-progress';
        tempNlpProgress.className = 'query-progress hidden';
        tempNlpProgress.innerHTML = `
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" id="nlp-progress-fill"></div>
                </div>
                <div class="progress-info">
                    <span class="progress-percent" id="nlp-progress-percent">0%</span>
                    <span class="progress-text">正在分析您的需求...</span>
                </div>
            </div>
        `;
        document.body.appendChild(tempNlpProgress);
        
        await handleUnifiedNLP();
        
        const resultContent = tempNlpResult.innerHTML;
        
        document.body.removeChild(tempInput);
        document.body.removeChild(tempNlpResult);
        document.body.removeChild(tempNlpProgress);
        
        if (originalNlpResult) {
            originalNlpResult.id = 'nlp-result';
        }
        // 不恢复原始nlp-progress元素的ID，始终使用新的进度卡片
        // if (originalNlpProgress) {
        //     originalNlpProgress.id = 'nlp-progress';
        // }
        
        if (resultContent) {
            addMessage('system', 'AI已处理您的需求，结果已显示在下方。');
        } else {
            addMessage('system', '抱歉，AI无法理解您的需求，请尝试换一种表达方式。');
        }
        
    } catch (error) {
        addMessage('system', `AI处理失败: ${error.message}`);
        addProcessingLog('error', '大模型兜底处理失败', error.message);
    }
}

// 显示Toast提示
function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        z-index: 9999;
        max-width: 300px;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 添加消息到对话窗口
function addMessage(type, content) {
    const conversationMessages = document.getElementById('conversation-messages');
    if (!conversationMessages) return null;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `<p>${content}</p>`;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageTime);
    conversationMessages.appendChild(messageDiv);
    
    // 滚动到底部
    conversationMessages.scrollTop = conversationMessages.scrollHeight;
    
    return messageDiv;
}

// 完成对话处理
function completeConversation() {
    const sendMessageBtn = document.getElementById('send-message');
    const conversationProgress = document.getElementById('conversation-progress');
    const conversationStatus = document.getElementById('conversation-status');
    const conversationProgressPercent = document.getElementById('conversation-progress-percent');
    const conversationProgressFill = document.getElementById('conversation-progress-fill');
    
    // 重置进度条
    if (conversationProgressPercent) {
        conversationProgressPercent.textContent = '0%';
    }
    if (conversationProgressFill) {
        conversationProgressFill.style.width = '0%';
    }
    
    // 隐藏进度条
    if (conversationProgress) {
        conversationProgress.classList.add('hidden');
    }
    
    // 启用发送按钮
    if (sendMessageBtn) {
        sendMessageBtn.disabled = false;
    }
    
    // 恢复状态
    if (conversationStatus) {
        const statusText = conversationStatus.querySelector('.status-text');
        const statusDot = conversationStatus.querySelector('.status-dot');
        if (statusText) {
            statusText.textContent = '就绪';
        }
        if (statusDot) {
            statusDot.style.background = '#28a745';
        }
    }
}

// 滚动到数据可视化区域
function scrollToVisualization() {
    const visualizationSection = document.getElementById('data-visualization');
    if (visualizationSection) {
        visualizationSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * 显示拒识消息
 * 当用户输入与数据分析无关或无法理解时调用
 */
function showRejectionMessage(title, suggestion, examples = null) {
    const nlpResult = document.getElementById('nlp-result');
    if (!nlpResult) return;
    
    let examplesHtml = '';
    if (examples) {
        examplesHtml = `
            <div class="rejection-examples">
                <strong>您可以尝试：</strong>
                <ul>
                    ${examples.map(ex => `<li>"${ex}"</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        examplesHtml = `
            <div class="rejection-examples">
                <strong>您可以尝试：</strong>
                <ul>
                    <li>"统计各省份的平均值"</li>
                    <li>"绘制销售额柱状图"</li>
                    <li>"查找最大的险情确认时长"</li>
                    <li>"按地区分组统计数量"</li>
                </ul>
            </div>
        `;
    }
    
    const rejectionHtml = `
        <div class="rejection-notice">
            <div class="rejection-icon">🤔</div>
            <div class="rejection-title">${title}</div>
            <div class="rejection-suggestion">
                <strong>建议：</strong>${suggestion}
            </div>
            ${examplesHtml}
        </div>
    `;
    
    nlpResult.innerHTML = rejectionHtml;
    
    // 同时在对话区域显示
    const rejectionMessage = `
        <div class="message system rejection-message" style="
            background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%);
            border-radius: 12px;
            padding: 20px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
        ">
            <div style="font-size: 24px; margin-bottom: 10px;">🤔</div>
            <div style="font-weight: bold; color: #856404; margin-bottom: 10px;">${title}</div>
            <div style="color: #856404; margin-bottom: 15px;">${suggestion}</div>
            <div style="color: #6c757d; font-size: 13px;">
                <strong>示例：</strong>"统计销售额"、"按地区画柱状图"、"筛选大于1000的数据"
            </div>
        </div>
    `;
    
    addMessage('system', rejectionMessage);
}

/**
 * PRD V5.0: 统一泛分析函数 (General Analysis)
 * 整合意图识别、需求分类、本地模型和LLM API调用
 * 符合PRD要求，完整覆盖所有分析场景
 * 
 * 注意：这是一个简化的实现框架，需要与实际代码中的函数集成
 */
async function generalAnalysis(userInput, dataInfo, totalStartTime) {
    try {
        // 1. 使用统一意图分类器进行意图识别和需求分类
        if (!unifiedIntentClassifier) {
            await initUnifiedIntentClassifier();
        }
        
        // 更新Agent工作流
        updateAgentWorkflow('intent_recognition', 'running');
        
        // 2. 进行分类
        const classification = await unifiedIntentClassifier.classify(
            userInput, 
            dataInfo.columns,
            dataInfo.sampleData || []
        );
        
        // 记录分心结果
        addProcessingLog('success', '统一意图分类完成', 
            `类别: ${classification.intentCategory}, 优先级: ${classification.priority}, 置信度: ${classification.confidence.toFixed(2)}`);
        
        // 3. 根据分类结果选择合适的处理流程
        if (classification.intentCategory.includes('CHART_')) {
            await handleNLPChart(userInput, dataInfo, totalStartTime, classification);
        } else if (classification.intentCategory.includes('QUERY_')) {
            await handleNLPQuery(userInput, dataInfo, totalStartTime, classification);
        } else {
            // 其他分析类型，使用大模型兜底
            await handleLLMFallback(userInput, totalStartTime);
        }
        
    } catch (error) {
        addProcessingLog('error', '通用分析流程失败', error.message);
        addMessage('system', `分析失败: ${error.message}`);
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    init().catch(error => {
        console.error('初始化失败:', error);
        alert('应用初始化失败，请刷新页面重试');
    });

    // V4.0新增：初始化查询历史
    initQueryHistory();
});