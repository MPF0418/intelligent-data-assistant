// 错误处理模块 - V5.0

// 统一错误类
class QueryError extends Error {
    constructor(code, message, suggestion) {
        super(message);
        this.code = code;
        this.suggestion = suggestion;
        this.name = 'QueryError';
    }
}

// 错误码定义
const ErrorCodes = {
    FILE_PARSE_ERROR: 'E001',
    INTENT_RECOGNITION_ERROR: 'E002',
    CONFIG_GENERATION_ERROR: 'E003',
    QUERY_EXECUTION_ERROR: 'E004',
    CHART_RENDER_ERROR: 'E005',
    ENTITY_EXTRACTION_ERROR: 'E006',
    VECTORIZATION_ERROR: 'E007',
    DATABASE_ERROR: 'E008',
    NETWORK_ERROR: 'E009',
    UNKNOWN_ERROR: 'E010'
};

// 错误信息映射
const ErrorMap = new Map([
    [ErrorCodes.FILE_PARSE_ERROR, {
        message: '文件解析失败',
        suggestion: '请检查文件格式是否正确，确保是有效的CSV或Excel文件'
    }],
    [ErrorCodes.INTENT_RECOGNITION_ERROR, {
        message: '意图识别失败',
        suggestion: '请尝试更明确地表达您的需求'
    }],
    [ErrorCodes.CONFIG_GENERATION_ERROR, {
        message: '配置生成失败',
        suggestion: '请尝试更明确地表达您的需求'
    }],
    [ErrorCodes.QUERY_EXECUTION_ERROR, {
        message: '查询执行失败',
        suggestion: '请检查您的查询条件是否正确'
    }],
    [ErrorCodes.CHART_RENDER_ERROR, {
        message: '图表渲染失败',
        suggestion: '请检查数据是否有效'
    }],
    [ErrorCodes.ENTITY_EXTRACTION_ERROR, {
        message: '实体提取失败',
        suggestion: '请尝试更明确地表达您的需求'
    }],
    [ErrorCodes.VECTORIZATION_ERROR, {
        message: '数据向量化失败',
        suggestion: '请检查后端服务是否正常运行'
    }],
    [ErrorCodes.DATABASE_ERROR, {
        message: '数据库操作失败',
        suggestion: '请检查数据是否有效'
    }],
    [ErrorCodes.NETWORK_ERROR, {
        message: '网络连接失败',
        suggestion: '请检查网络连接是否正常'
    }],
    [ErrorCodes.UNKNOWN_ERROR, {
        message: '未知错误',
        suggestion: '请稍后重试'
    }]
]);

// 错误处理函数
function handleError(error) {
    console.error('[ErrorHandler] 处理错误:', error);
    
    let errorInfo;
    if (error instanceof QueryError) {
        errorInfo = ErrorMap.get(error.code) || ErrorMap.get(ErrorCodes.UNKNOWN_ERROR);
    } else {
        errorInfo = ErrorMap.get(ErrorCodes.UNKNOWN_ERROR);
    }
    
    // 显示通知
    showNotification(errorInfo.message, 'error');
    
    // 记录错误日志
    logError(error, errorInfo.suggestion);
    
    return {
        success: false,
        error: {
            code: error.code || ErrorCodes.UNKNOWN_ERROR,
            message: error.message || errorInfo.message,
            suggestion: error.suggestion || errorInfo.suggestion
        }
    };
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

// 记录错误日志
function logError(error, suggestion) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        type: 'error',
        message: error.message || '未知错误',
        code: error.code || ErrorCodes.UNKNOWN_ERROR,
        suggestion: suggestion,
        stack: error.stack
    };
    
    // 添加到处理日志
    if (typeof addProcessingLog === 'function') {
        addProcessingLog('error', logEntry.message, `${logEntry.code} - ${logEntry.suggestion}`);
    }
    
    // 控制台输出
    console.error(`[${timestamp}] [ERROR] ${logEntry.message} - ${logEntry.code}`);
    if (error.stack) {
        console.error(error.stack);
    }
}

// 创建错误
function createError(code, message, suggestion) {
    return new QueryError(code, message, suggestion);
}

// 导出错误处理模块
export {
    QueryError,
    ErrorCodes,
    ErrorMap,
    handleError,
    showNotification,
    logError,
    createError
};
export default {
    QueryError,
    ErrorCodes,
    ErrorMap,
    handleError,
    showNotification,
    logError,
    createError
};