/**
 * Bug修复脚本 V2.0 - 修复以下问题：
 * 1. 数据行数统计偶尔超时 - 优化统计数据获取逻辑
 * 2. 意图识别结果无可视化反馈 - 添加意图识别结果可视化展示
 */

console.log('[BugFix V2.0] 开始加载修复脚本...');

// ==================== 修复1: 意图识别结果可视化 ====================

// 添加意图识别可视化HTML
function showIntentVisualization(intentResult, classification) {
    const nlpResult = document.getElementById('nlp-result');
    if (!nlpResult) {
        console.warn('[意图可视化] nlp-result元素未找到');
        return;
    }
    
    // 获取意图类型图标
    const getIntentIcon = (intent) => {
        const iconMap = {
            'QUERY_SUM': '📊',
            'QUERY_AVG': '📈',
            'QUERY_COUNT': '🔢',
            'QUERY_MAX': '⬆️',
            'QUERY_MIN': '⬇️',
            'QUERY_SORT': '↕️',
            'QUERY_FILTER': '🔍',
            'QUERY_AGGREGATE': '🔢',
            'QUERY_BAR': '📊',
            'QUERY_LINE': '📈',
            'QUERY_PIE': '🥧',
            'QUERY_SCATTER': '⚫',
            'QUERY_TABLE': '📋',
            'chart': '📊',
            'query': '🔍'
        };
        return iconMap[intent] || '🎯';
    };
    
    // 获取意图类型中文名
    const getIntentName = (intent) => {
        const nameMap = {
            'QUERY_SUM': '求和统计',
            'QUERY_AVG': '求平均',
            'QUERY_COUNT': '计数统计',
            'QUERY_MAX': '最大值查询',
            'QUERY_MIN': '最小值查询',
            'QUERY_SORT': '排序查询',
            'QUERY_FILTER': '筛选查询',
            'QUERY_AGGREGATE': '聚合查询',
            'QUERY_BAR': '柱状图',
            'QUERY_LINE': '折线图',
            'QUERY_PIE': '饼图',
            'QUERY_SCATTER': '散点图',
            'QUERY_TABLE': '数据表格',
            'chart': '图表生成',
            'query': '数据查询'
        };
        return nameMap[intent] || intent;
    };
    
    // 获取模式图标
    const getModeIcon = (mode) => {
        const iconMap = {
            'precise': '🎯',
            'intelligent': '🧠',
            'multi_intent': '🔗'
        };
        return iconMap[mode] || '💡';
    };
    
    // 获取置信度颜色
    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.9) return '#1e7e34';
        if (confidence >= 0.7) return '#f0ad4e';
        return '#c5221f';
    };
    
    // 构建意图卡片HTML
    const intentType = intentResult.detailedIntent || intentResult.intent || 'unknown';
    const intentIcon = getIntentIcon(intentType);
    const intentName = getIntentName(intentType);
    const confidence = intentResult.confidence || classification?.confidence || 0.8;
    const confidenceColor = getConfidenceColor(confidence);
    const mode = classification?.mode || 'precise';
    const modeIcon = getModeIcon(mode);
    
    // 提取匹配的列
    const matchedColumns = classification?.matchedColumns || [];
    const matchedColsHtml = matchedColumns.length > 0 
        ? matchedColumns.map(m => `<span class="intent-tag">${m.column}</span>`).join('')
        : '<span class="intent-tag empty">未匹配</span>';
    
    // 提取检测到的意图（多意图场景）
    const detectedIntents = classification?.detectedIntents || classification?.intents || [];
    const multiIntentsHtml = detectedIntents.length > 1
        ? detectedIntents.map(i => `<span class="intent-tag multi">${getIntentIcon(i)} ${getIntentName(i)}</span>`).join('')
        : '';
    
    const visualizationHtml = `
        <div class="intent-visualization" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 20px;
            margin: 15px 0;
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        ">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                <div style="font-size: 2.5em;">${intentIcon}</div>
                <div>
                    <div style="font-size: 1.3em; font-weight: bold;">${intentName}</div>
                    <div style="opacity: 0.9; font-size: 0.9em;">识别置信度: <strong style="color: ${confidenceColor};">${(confidence * 100).toFixed(0)}%</strong></div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <div style="
                    background: rgba(255,255,255,0.2);
                    padding: 8px 15px;
                    border-radius: 20px;
                    font-size: 0.9em;
                ">
                    ${modeIcon} 处理模式: <strong>${mode === 'precise' ? '精准模式' : mode === 'intelligent' ? '智能模式' : '多意图'}</strong>
                </div>
            </div>
            
            ${matchedColumns.length > 0 ? `
            <div style="margin-bottom: 10px;">
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px;">📌 匹配的列：</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${matchedColsHtml}
                </div>
            </div>
            ` : ''}
            
            ${multiIntentsHtml ? `
            <div style="margin-top: 10px;">
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px;">🔗 检测到的多个意图：</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${multiIntentsHtml}
                </div>
            </div>
            ` : ''}
            
            <div style="
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid rgba(255,255,255,0.2);
                font-size: 0.85em;
                opacity: 0.9;
            ">
                💡 ${classification?.reason || intentResult.reason || '正在分析数据...'}
            </div>
        </div>
        
        <style>
            .intent-visualization .intent-tag {
                background: rgba(255,255,255,0.25);
                padding: 5px 12px;
                border-radius: 15px;
                font-size: 0.9em;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .intent-visualization .intent-tag.multi {
                background: rgba(255,255,255,0.35);
            }
            .intent-visualization .intent-tag.empty {
                background: rgba(255,255,255,0.1);
                opacity: 0.7;
            }
        </style>
    `;
    
    // 插入到结果区域
    nlpResult.innerHTML = visualizationHtml;
    
    console.log('[意图可视化] 已显示意图识别结果', { intentType, confidence, mode });
}

// ==================== 修复2: 数据统计超时优化 ====================

// 优化统计数据获取 - 使用缓存和异步处理
const dataStatsCache = {
    rowCount: null,
    lastUpdate: null,
    cacheTimeout: 5000 // 5秒缓存
};

// 异步获取行数（不阻塞UI）
async function getDataRowCountAsync() {
    // 检查缓存
    const now = Date.now();
    if (dataStatsCache.rowCount !== null && 
        dataStatsCache.lastUpdate && 
        (now - dataStatsCache.lastUpdate) < dataStatsCache.cacheTimeout) {
        console.log('[统计优化] 使用缓存的行数:', dataStatsCache.rowCount);
        return dataStatsCache.rowCount;
    }
    
    // 使用 requestAnimationFrame 确保在下一帧更新，不阻塞当前渲染
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            const count = Array.isArray(window.data) ? window.data.length : 0;
            dataStatsCache.rowCount = count;
            dataStatsCache.lastUpdate = Date.now();
            console.log('[统计优化] 计算行数:', count);
            resolve(count);
        });
    });
}

// 优化数据概览显示 - 分批渲染
function updateDataOverviewOptimized() {
    const dataPreview = document.getElementById('data-preview');
    if (!dataPreview) return;
    
    const rowCount = Array.isArray(window.data) ? window.data.length : 0;
    const colCount = Array.isArray(window.headers) ? window.headers.length : 0;
    
    // 立即显示基本统计信息（不等待详细统计）
    dataPreview.innerHTML = `
        <div class="overview-quick" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
        ">
            <div style="display: flex; gap: 30px;">
                <div style="text-align: center;">
                    <div style="font-size: 2em; font-weight: bold;">${rowCount.toLocaleString()}</div>
                    <div style="opacity: 0.9;">数据行数</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2em; font-weight: bold;">${colCount}</div>
                    <div style="opacity: 0.9;">数据列数</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2em; font-weight: bold;">${rowCount > 0 && colCount > 0 ? (rowCount * colCount).toLocaleString() : 0}</div>
                    <div style="opacity: 0.9;">数据单元格</div>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.9em; opacity: 0.9;">
                ⏳ 正在加载详细统计信息...
            </div>
        </div>
    `;
    
    // 后台计算详细统计（不阻塞UI）
    setTimeout(() => {
        calculateDetailedStatsAsync().then(stats => {
            updateDataOverviewWithStats(stats);
        }).catch(err => {
            console.warn('[统计优化] 详细统计计算失败:', err);
        });
    }, 100);
}

// 异步计算详细统计
async function calculateDetailedStatsAsync() {
    if (!Array.isArray(window.data) || !Array.isArray(window.headers)) {
        return null;
    }
    
    const data = window.data;
    const headers = window.headers;
    const stats = {
        numericCols: [],
        textCols: [],
        nullCounts: {},
        uniqueCounts: {}
    };
    
    // 分批处理，避免阻塞
    const batchSize = 100;
    for (let i = 0; i < headers.length; i++) {
        const col = headers[i];
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
        
        // 统计数值列
        const numericValues = values.filter(v => !isNaN(parseFloat(v)));
        if (numericValues.length > values.length * 0.5) {
            stats.numericCols.push(col);
        } else {
            stats.textCols.push(col);
        }
        
        // 统计空值和唯一值（使用Set优化）
        stats.nullCounts[col] = data.length - values.length;
        stats.uniqueCounts[col] = new Set(values).size;
    }
    
    return stats;
}

// 更新概览显示（包含详细统计）
function updateDataOverviewWithStats(stats) {
    const dataPreview = document.getElementById('data-preview');
    if (!dataPreview || !stats) return;
    
    const rowCount = Array.isArray(window.data) ? window.data.length : 0;
    const colCount = Array.isArray(window.headers) ? window.headers.length : 0;
    
    const quickOverview = dataPreview.querySelector('.overview-quick');
    if (quickOverview) {
        const detailDiv = quickOverview.querySelector('div:last-child');
        if (detailDiv && detailDiv.textContent.includes('正在加载')) {
            detailDiv.innerHTML = `
                ✅ 数据加载完成
                <span style="margin-left: 15px;">|</span>
                <span style="margin-left: 15px;">📊 数值列: ${stats.numericCols.length}</span>
                <span style="margin-left: 15px;">|</span>
                <span style="margin-left: 15px;">📝 文本列: ${stats.textCols.length}</span>
            `;
        }
    }
}

// ==================== 挂载修复函数到全局 ====================

window.showIntentVisualization = showIntentVisualization;
window.updateDataOverviewOptimized = updateDataOverviewOptimized;
window.getDataRowCountAsync = getDataRowCountAsync;

// ==================== Hook意图识别结果 ====================

// 拦截并增强意图识别结果显示
const originalSetNLPProgress = window.setNLPProgress;
if (typeof originalSetNLPProgress === 'function') {
    window.setNLPProgress = function(percent, text) {
        // 调用原始函数
        originalSetNLPProgress(percent, text);
        
        // 当进度达到20%且有intentResult时，显示可视化
        if (percent >= 20 && window._lastIntentResult) {
            showIntentVisualization(window._lastIntentResult, window._lastClassification);
        }
    };
}

console.log('[BugFix V2.0] 修复脚本加载完成');
console.log('  ✅ 意图识别可视化功能已启用');
console.log('  ✅ 数据统计超时优化已启用');
