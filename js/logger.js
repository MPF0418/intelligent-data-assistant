// 日志管理模块 - V5.0

// 日志级别定义
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    OFF: 4
};

// 默认日志级别
let currentLogLevel = LogLevel.INFO;

// 日志颜色配置
const LogColors = {
    DEBUG: '#569cd6',
    INFO: '#4ec9b0',
    WARN: '#dcdcaa',
    ERROR: '#f44747'
};

// 日志标签配置
const LogLabels = {
    DEBUG: '[DEBUG]',
    INFO: '[INFO]',
    WARN: '[WARN]',
    ERROR: '[ERROR]'
};

/**
 * 设置日志级别
 * @param {number} level - 日志级别
 */
export function setLogLevel(level) {
    if (Object.values(LogLevel).includes(level)) {
        currentLogLevel = level;
        console.log(`[Logger] 日志级别已设置为: ${Object.keys(LogLevel).find(key => LogLevel[key] === level)}`);
    } else {
        console.error('[Logger] 无效的日志级别');
    }
}

/**
 * 获取当前日志级别
 * @returns {number} 当前日志级别
 */
export function getLogLevel() {
    return currentLogLevel;
}

/**
 * 调试日志
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
export function debug(message, data = null) {
    if (currentLogLevel <= LogLevel.DEBUG) {
        log('DEBUG', message, data);
    }
}

/**
 * 信息日志
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
export function info(message, data = null) {
    if (currentLogLevel <= LogLevel.INFO) {
        log('INFO', message, data);
    }
}

/**
 * 警告日志
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
export function warn(message, data = null) {
    if (currentLogLevel <= LogLevel.WARN) {
        log('WARN', message, data);
    }
}

/**
 * 错误日志
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
export function error(message, data = null) {
    if (currentLogLevel <= LogLevel.ERROR) {
        log('ERROR', message, data);
    }
}

/**
 * 通用日志函数
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
function log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const color = LogColors[level];
    const label = LogLabels[level];
    
    // 构建日志消息
    let logMessage = `%c[${timestamp}] ${label} ${message}`;
    let logArgs = [`color: ${color}`];
    
    // 如果有附加数据，添加到日志中
    if (data !== null) {
        logMessage += ' %o';
        logArgs.push(data);
    }
    
    // 根据级别调用不同的console方法
    switch (level) {
        case 'DEBUG':
        case 'INFO':
            console.log(logMessage, ...logArgs);
            break;
        case 'WARN':
            console.warn(logMessage, ...logArgs);
            break;
        case 'ERROR':
            console.error(logMessage, ...logArgs);
            break;
    }
    
    // 添加到处理日志（如果存在）
    if (typeof addProcessingLog === 'function') {
        addProcessingLog(level.toLowerCase(), message, data ? JSON.stringify(data) : null);
    }
}

/**
 * 性能日志
 * @param {string} operation - 操作名称
 * @param {number} duration - 执行时间（毫秒）
 */
export function performance(operation, duration) {
    if (currentLogLevel <= LogLevel.INFO) {
        const timestamp = new Date().toLocaleTimeString();
        const message = `${operation} 完成，耗时: ${duration}ms (${(duration/1000).toFixed(2)}秒)`;
        console.log(`%c[${timestamp}] [PERF] ${message}`, 'color: #ce9178');
        
        // 添加到处理日志
        if (typeof addProcessingLog === 'function') {
            addProcessingLog('performance', message);
        }
    }
}

/**
 * 批量日志
 * @param {Array} logs - 日志数组，每个元素包含 {level, message, data}
 */
export function batchLog(logs) {
    logs.forEach(logItem => {
        const { level, message, data } = logItem;
        switch (level.toUpperCase()) {
            case 'DEBUG':
                debug(message, data);
                break;
            case 'INFO':
                info(message, data);
                break;
            case 'WARN':
                warn(message, data);
                break;
            case 'ERROR':
                error(message, data);
                break;
        }
    });
}

// 导出日志模块
export default {
    LogLevel,
    setLogLevel,
    getLogLevel,
    debug,
    info,
    warn,
    error,
    performance,
    batchLog
};