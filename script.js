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

// 处理日志相关
let processingLogs = [];
let currentOperationStartTime = null;

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
    
    // 显示处理日志区域
    const logSection = document.getElementById('processing-log-section');
    if (logSection) {
        logSection.classList.remove('hidden');
    }
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

// 初始化事件监听器
function initEventListeners() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const generateReportBtn = document.getElementById('generate-report');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportImageBtn = document.getElementById('export-image');
    
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

// 显示NLP进度
function showNLPProgress(text = '正在分析您的需求...') {
    const progressDiv = document.getElementById('nlp-progress');
    const progressText = progressDiv.querySelector('.progress-text');
    const submitBtn = document.getElementById('submit-nlp');
    const stopBtn = document.getElementById('stop-nlp');
    
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
    
    // 清空之前的日志
    clearProcessingLogs();
    
    // 记录开始时间
    const totalStartTime = Date.now();
    addProcessingLog('info', '开始处理用户请求', `输入内容: "${userInput}"`);
    startOperationTiming('AI意图识别');
    
    // 显示进度
    showNLPProgress('正在分析您的需求...');
    setNLPProgress(10, '正在分析您的需求...');
    nlpResult.innerHTML = '';
    
    // 准备数据信息
    const dataInfo = {
        columns: headers,
        rowCount: data.length,
        sampleData: data.slice(0, 3)
    };
    
    setNLPProgress(20, '正在调用AI进行意图识别...');
    
    // 构建意图识别prompt
    const intentPrompt = `你是一位智能助手，请分析用户的输入，判断用户想要执行查询操作还是绘图操作。

用户输入："${userInput}"

数据表结构：
- 表头（列名）：${dataInfo.columns.join(', ')}
- 数据行数：${dataInfo.rowCount}

请返回JSON格式的判断结果：
{
  "intent": "query" 或 "chart",  // query表示查询，chart表示绘图
  "confidence": 0.95,  // 置信度0-1
  "reason": "判断理由"
}

规则：
- 如果用户询问数据内容、统计信息、查找特定记录等，返回 "query"
- 如果用户要求生成图表、可视化、画图等，返回 "chart"
- 如果无法确定，默认返回 "query"

请只返回JSON，不要其他内容。`;
    
    try {
        // 创建AbortController
        currentQueryController = new AbortController();
        
        // 调用AI进行意图识别
        setNLPProgress(30, 'AI正在分析意图...');
        const intentResponse = await callLLMAPI(intentPrompt, currentQueryController.signal, 30000);
        
        // 解析意图
        let intentResult;
        try {
            const jsonMatch = intentResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                intentResult = JSON.parse(jsonMatch[0]);
            } else {
                intentResult = { intent: 'query', confidence: 0.5, reason: '无法解析，默认使用查询' };
            }
        } catch (e) {
            intentResult = { intent: 'query', confidence: 0.5, reason: '解析失败，默认使用查询' };
        }
        
        endOperationTiming();
        addProcessingLog('success', 'AI意图识别完成', `意图: ${intentResult.intent}, 置信度: ${intentResult.confidence}, 理由: ${intentResult.reason}`);
        
        // 根据意图执行相应操作
        if (intentResult.intent === 'chart') {
            setNLPProgress(40, '识别为绘图需求，正在生成图表配置...');
            await handleNLPChart(userInput, dataInfo, totalStartTime);
        } else {
            setNLPProgress(40, '识别为查询需求，正在生成查询配置...');
            await handleNLPQuery(userInput, dataInfo, totalStartTime);
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
async function handleNLPQuery(userInput, dataInfo, totalStartTime) {
    startOperationTiming('生成查询配置');
    
    const queryPrompt = `你是一位数据分析专家，请根据用户的自然语言查询，生成结构化的数据查询逻辑。

用户查询："${userInput}"

数据表结构：
- 表头（列名）：${dataInfo.columns.join(', ')}
- 数据行数：${dataInfo.rowCount}

示例数据（前3行）：
${dataInfo.sampleData.map((row, index) => `行${index + 1}: ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', ')}`).join('\n')}

请生成JSON数组格式的查询逻辑，数组中包含所有需要执行的查询任务。

每个查询任务包含以下字段：
- queryType: 查询类型（filter-筛选, aggregate-聚合, sort-排序, find-查找, group-分组统计）
- filterCondition: 筛选条件（如 {"年龄": ">30"}）
- targetColumn: 目标列
- groupByColumn: 分组列
- aggregateFunction: 聚合函数（avg, sum, count, max, min）
- description: 查询描述
- resultFormat: 结果格式说明

请只返回JSON数组，不要其他内容。`;
    
    setNLPProgress(50, '正在生成查询配置...');
    const response = await callLLMAPI(queryPrompt, currentQueryController.signal, 60000);
    endOperationTiming();
    
    // 解析查询配置
    startOperationTiming('解析并执行查询');
    setNLPProgress(60, '正在解析查询配置...');
    
    let queryLogics = [];
    try {
        const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
            queryLogics = JSON.parse(jsonArrayMatch[0]);
        } else {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                queryLogics = [JSON.parse(jsonMatch[0])];
            }
        }
    } catch (e) {
        throw new Error('无法解析查询配置');
    }
    
    addProcessingLog('info', `成功解析 ${queryLogics.length} 个查询任务`);
    
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
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
}

// 处理NLP绘图
async function handleNLPChart(userInput, dataInfo, totalStartTime) {
    startOperationTiming('生成图表配置');
    
    const chartPrompt = `你是一位数据可视化专家，请根据用户的绘图需求，生成图表配置。

用户绘图需求："${userInput}"

数据表结构：
- 表头（列名）：${dataInfo.columns.join(', ')}
- 数据行数：${dataInfo.rowCount}

示例数据（前3行）：
${dataInfo.sampleData.map((row, index) => `行${index + 1}: ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', ')}`).join('\n')}

请生成JSON数组格式的图表配置，数组中包含所有需要绘制的图表。

每个图表配置包含以下字段：
- chartType: 图表类型（bar-柱状图, line-折线图, pie-饼图, doughnut-环形图）
- xAxisColumn: X轴列名（分组列）
- yAxisColumn: Y轴列名（数值列）
- labelColumn: 标签列名（用于饼图）
- valueColumn: 数值列名（用于饼图）
- title: 图表标题
- description: 图表描述
- aggregateFunction: 聚合函数（avg, sum, count, max, min）
- sortOrder: 排序方式（asc, desc）
- dataTransform: 数据预处理配置（可选）

请只返回JSON数组，不要其他内容。`;
    
    setNLPProgress(50, '正在生成图表配置...');
    const response = await callLLMAPI(chartPrompt, currentQueryController.signal, 60000);
    endOperationTiming();
    
    // 解析图表配置
    startOperationTiming('解析并生成图表');
    setNLPProgress(60, '正在解析图表配置...');
    
    let chartConfigs = [];
    try {
        const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
            chartConfigs = JSON.parse(jsonArrayMatch[0]);
        } else {
            const jsonMatch = response.match(/\{[\s\S]*\]/);
            if (jsonMatch) {
                chartConfigs = [JSON.parse(jsonMatch[0])];
            }
        }
    } catch (e) {
        throw new Error('无法解析图表配置');
    }
    
    addProcessingLog('info', `成功解析 ${chartConfigs.length} 个图表配置`);
    
    // 显示可视化区域
    document.getElementById('data-visualization').classList.remove('hidden');
    const chartsContainer = document.querySelector('.charts-container');
    chartsContainer.innerHTML = '';
    
    // 生成图表
    setNLPProgress(70, '正在生成图表...');
    for (let i = 0; i < chartConfigs.length; i++) {
        const config = chartConfigs[i];
        addProcessingLog('command', `生成图表 ${i + 1}/${chartConfigs.length}`, `${config.title}`);
        const startTime = Date.now();
        createChartFromConfig(config, chartsContainer, response);
        const duration = Date.now() - startTime;
        addProcessingLog('performance', `图表 ${i + 1} 生成完成`, `耗时: ${duration}ms`);
        setNLPProgress(70 + Math.round(((i + 1) / chartConfigs.length) * 20), `正在生成图表 ${i + 1}/${chartConfigs.length}...`);
    }
    
    endOperationTiming();
    
    // 显示结果摘要
    setNLPProgress(90, '正在完成...');
    displayNLPChartResults(userInput, chartConfigs);
    
    // 记录总耗时
    const totalDuration = Date.now() - totalStartTime;
    addProcessingLog('performance', '图表生成完成', `总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}秒)`);
    
    setNLPProgress(100, '完成');
    setTimeout(() => {
        hideNLPProgress();
    }, 500);
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
}

// 显示NLP绘图结果
function displayNLPChartResults(userInput, chartConfigs) {
    const nlpResult = document.getElementById('nlp-result');
    
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

// ==================== 多字段筛选功能 ====================

// 添加筛选条件
function addFilterCondition() {
    const container = document.getElementById('filter-conditions');
    if (!container) return;
    
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;';
    
    // 构建列选项
    const columnOptions = headers.length > 0 
        ? headers.map(h => `<option value="${h}">${h}</option>`).join('')
        : '<option value="">请先上传数据</option>';
    
    filterRow.innerHTML = `
        <select class="filter-column" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; min-width: 150px; font-size: 0.9em;">
            <option value="">选择列</option>
            ${columnOptions}
        </select>
        <select class="filter-operator" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; min-width: 100px; font-size: 0.9em;">
            <option value="eq">等于</option>
            <option value="neq">不等于</option>
            <option value="gt">大于</option>
            <option value="lt">小于</option>
            <option value="gte">大于等于</option>
            <option value="lte">小于等于</option>
            <option value="contains">包含</option>
        </select>
        <input type="text" class="filter-value" placeholder="输入筛选值" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; flex: 1; min-width: 150px; font-size: 0.9em;">
        <button onclick="this.parentElement.remove()" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9em; white-space: nowrap;">删除</button>
    `;
    
    container.appendChild(filterRow);
}

// 更新所有筛选条件的列选项
function updateFilterColumnOptions() {
    const container = document.getElementById('filter-conditions');
    if (!container || headers.length === 0) return;
    
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
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    
    setTimeout(() => {
        if (file.name.endsWith('.csv')) {
            parseCSV(file);
        } else if (file.name.endsWith('.xlsx')) {
            parseExcel(file);
        }
    }, 500);
}

// 解析CSV文件
function parseCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        
        // 使用 PapaParse 解析 CSV
        Papa.parse(text, {
            header: true,           // 第一行作为表头
            skipEmptyLines: true,   // 跳过空行
            trimHeaders: true,      // 去除表头空白
            dynamicTyping: false,   // 保持所有值为字符串类型
            complete: function(results) {
                if (results.errors && results.errors.length > 0) {
                    console.error('CSV 解析错误:', results.errors);
                }
                
                if (!results.data || results.data.length === 0) {
                    alert('CSV文件为空或解析失败');
                    document.getElementById('loading').classList.add('hidden');
                    return;
                }
                
                headers = results.meta.fields;
                originalData = results.data; // 存储原始数据
                data = [...originalData]; // 初始化显示数据
                
                // 更新筛选列选项
                updateFilterColumns();
                
                processData();
            },
            error: function(error) {
                console.error('CSV 解析失败:', error);
                alert('CSV文件解析失败: ' + error.message);
                document.getElementById('loading').classList.add('hidden');
            }
        });
    };
    reader.onerror = function(error) {
        console.error('文件读取失败:', error);
        alert('文件读取失败');
        document.getElementById('loading').classList.add('hidden');
    };
    reader.readAsText(file, 'UTF-8');
}

// 解析Excel文件
function parseExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const fileData = new Uint8Array(e.target.result);
            const workbook = XLSX.read(fileData, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                alert('Excel文件没有工作表');
                document.getElementById('loading').classList.add('hidden');
                return;
            }
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (!jsonData || jsonData.length === 0) {
                alert('Excel文件为空或没有数据');
                document.getElementById('loading').classList.add('hidden');
                return;
            }
            
            headers = Object.keys(jsonData[0]);
            originalData = jsonData; // 存储原始数据
            data = [...originalData]; // 初始化显示数据
            
            // 更新筛选列选项
            updateFilterColumns();
            
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
    reader.readAsArrayBuffer(file);
}

// 处理数据
function processData() {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
    
    // 显示数据预览
    showDataPreview();
    
    // 显示可视化和AI分析区域（但不自动生成图表）
    document.getElementById('data-visualization').classList.remove('hidden');
    document.getElementById('ai-analysis').classList.remove('hidden');
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
    
    // 创建分页控件
    createPaginationControls(previewSection, totalPages);
    
    previewSection.classList.remove('hidden');
}

// 创建分页控件
function createPaginationControls(container, totalPages) {
    // 移除旧的分页控件
    const existingPagination = container.querySelector('.pagination-container');
    if (existingPagination) {
        existingPagination.remove();
    }
    
    if (totalPages <= 1) return;
    
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    paginationContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding: 10px;';
    
    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #667eea; color: white; cursor: pointer; opacity: ' + (currentPage === 1 ? '0.5' : '1') + ';';
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            showDataPreview();
        }
    };
    
    // 页码信息
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页 (共 ${data.length} 条数据)`;
    pageInfo.style.cssText = 'color: #666; font-size: 14px;';
    
    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #667eea; color: white; cursor: pointer; opacity: ' + (currentPage === totalPages ? '0.5' : '1') + ';';
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            showDataPreview();
        }
    };
    
    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextBtn);
    
    // 插入到表格后面
    const table = container.querySelector('#data-table');
    table.parentNode.insertBefore(paginationContainer, table.nextSibling);
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

// 生成AI分析报告
async function generateAIReport() {
    const reportContent = document.getElementById('report-content');
    reportContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>生成分析报告中...</p></div>';
    
    // 准备数据摘要
    const dataSummary = {
        columns: headers,
        rowCount: data.length,
        columnCount: headers.length,
        stats: headers.map(header => ({
            column: header,
            ...calculateStats(header)
        }))
    };
    
    // 生成数据统计表格HTML - 使用紧凑的表格形式
    let statsTableHTML = `
        <div class="stats-table-container" style="margin-bottom: 30px; overflow-x: auto;">
            <table class="stats-table" style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
                <thead>
                    <tr style="background: #667eea; color: white;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">列名</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">类型</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">有效数据</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">平均值</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">最大值</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">最小值</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">唯一值</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">缺失值</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    dataSummary.stats.forEach((stat, index) => {
        const isNumeric = stat.avg !== null;
        const uniqueCount = isNumeric ? '-' : new Set(data.map(row => row[stat.column]).filter(val => val !== '' && val !== null && val !== undefined)).size;
        const rowBg = index % 2 === 0 ? '#fff' : '#f8f9fa';
        
        statsTableHTML += `
            <tr style="background: ${rowBg};">
                <td style="padding: 8px 10px; border: 1px solid #ddd; font-weight: 500; color: #667eea;">${stat.column}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${isNumeric ? '数值' : '文本'}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${stat.count - stat.missing}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${isNumeric ? stat.avg.toFixed(2) : '-'}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${isNumeric ? stat.max : '-'}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${isNumeric ? stat.min : '-'}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${uniqueCount}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">${stat.missing}</td>
            </tr>
        `;
    });
    
    statsTableHTML += '</tbody></table></div>';
    
    // 构建统计信息字符串
    const statsString = dataSummary.stats.map(stat => {
        return `
${stat.column}：
- 平均值：${stat.avg !== null ? stat.avg.toFixed(2) : 'N/A'}
- 最大值：${stat.max !== null ? stat.max : 'N/A'}
- 最小值：${stat.min !== null ? stat.min : 'N/A'}
- 缺失值：${stat.missing}
`;
    }).join('');
    
    // 获取配置的 prompt 并替换变量
    const prompt = config.ai.prompts.dataAnalysis
        .replace('{{rowCount}}', dataSummary.rowCount)
        .replace('{{columnCount}}', dataSummary.columnCount)
        .replace('{{columns}}', dataSummary.columns.join(', '))
        .replace('{{stats}}', statsString);
    
    console.log('使用的 prompt:', prompt);
    
    try {
        // 尝试调用大模型API
        const aiResponse = await callLLMAPI(prompt);
        
        // 显示数据统计和AI分析结果
        reportContent.innerHTML = `
            <h3 style="color: #667eea; margin-bottom: 20px;">数据统计概览</h3>
            ${statsTableHTML}
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <h3 style="color: #667eea; margin-bottom: 20px;">AI 深度分析</h3>
            <div style="white-space: pre-wrap; line-height: 1.8; background: #f8f9fa; padding: 20px; border-radius: 8px;">${aiResponse}</div>
        `;
    } catch (error) {
        console.error('AI API调用失败:', error);
        // API调用失败时，使用本地生成的报告
        const report = generateMockReport(dataSummary, prompt);
        reportContent.innerHTML = `
            <h3 style="color: #667eea; margin-bottom: 20px;">数据统计概览</h3>
            ${statsTableHTML}
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <h3 style="color: #667eea; margin-bottom: 20px;">AI 深度分析（本地生成）</h3>
            <div style="white-space: pre-wrap; line-height: 1.8; background: #f8f9fa; padding: 20px; border-radius: 8px;">${report}</div>
        `;
    }
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

// 生成模拟报告
function generateMockReport(dataSummary, prompt) {
    // 生成数据摘要
    const dataSummaryText = `本数据表包含 ${dataSummary.rowCount} 行数据，${dataSummary.columnCount} 列字段，涵盖了 ${dataSummary.columns.join('、')} 等信息。`;
    
    // 生成整体概况
    const overviewText = `
## 数据整体概况

- 数据总量：${dataSummary.rowCount} 条记录
- 字段数量：${dataSummary.columnCount} 个字段
- 字段名称：${dataSummary.columns.join('、')}
- 数据完整性：
${dataSummary.stats.map(stat => `  - ${stat.column}：缺失值 ${stat.missing} 个，占比 ${((stat.missing / dataSummary.rowCount) * 100).toFixed(2)}%`).join('\n')}
`;
    
    // 生成关键发现
    let keyFindings = `
## 关键发现

`;
    
    // 分析数值列的异常值和趋势
    dataSummary.stats.forEach(stat => {
        if (stat.avg !== null) {
            keyFindings += `- ${stat.column}：平均值 ${stat.avg.toFixed(2)}，最大值 ${stat.max}，最小值 ${stat.min}\n`;
        }
    });
    
    // 生成actionable建议
    const actionableSuggestions = `
##  actionable建议

1. **数据质量优化**：针对缺失值较多的字段，建议进行数据清洗和补充
2. **业务分析**：基于数据分布情况，建议重点关注数值列的变化趋势
3. **可视化改进**：可以使用更多类型的图表来展示数据关系
4. **数据集成**：考虑与其他数据源结合，获得更全面的分析视角
`;
    
    return `# 智能数据洞察报告

## 数据摘要
${dataSummaryText}${overviewText}${keyFindings}${actionableSuggestions}
## 详细统计信息
${dataSummary.stats.map(stat => {
    return `
### ${stat.column}
- 平均值：${stat.avg !== null ? stat.avg.toFixed(2) : 'N/A'}
- 最大值：${stat.max !== null ? stat.max : 'N/A'}
- 最小值：${stat.min !== null ? stat.min : 'N/A'}
- 缺失值：${stat.missing}
`;
}).join('')}

生成时间：${new Date().toLocaleString()}`;
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

// 导出图片（批量导出所有图表）
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

// 初始化应用
function init() {
    initEventListeners();
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
    
    // 数据预处理函数
    const transformValue = (val, transform) => {
        if (!transform || val === null || val === undefined || isNaN(val)) return val;
        
        let result = parseFloat(val);
        const { operation, value: opValue } = transform;
        
        switch (operation) {
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
        
        return result;
    };
    
    // 处理柱状图和折线图
    if (chartType === 'bar' || chartType === 'line') {
        // 找到实际的X轴列
        let actualXColumn = xAxisColumn;
        if (!headers.includes(xAxisColumn)) {
            actualXColumn = headers.find(h => h.includes(xAxisColumn) || xAxisColumn.includes(h));
        }
        
        if (!actualXColumn) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">错误：X轴列"${xAxisColumn}"不存在</div>`;
            return;
        }
        
        // 找到实际的Y轴列
        let actualYColumn = yAxisColumn;
        if (yAxisColumn && !headers.includes(yAxisColumn)) {
            actualYColumn = headers.find(h => h.includes(yAxisColumn) || yAxisColumn.includes(h));
        }
        
        // 统计数据 - 支持聚合函数
        const groupData = {};
        const groupCounts = {};
        
        data.forEach(row => {
            const key = row[actualXColumn];
            if (key !== undefined && key !== null && key !== '') {
                const keyStr = key.toString().trim();
                
                if (actualYColumn && headers.includes(actualYColumn)) {
                    // 使用Y轴列的值
                    let val = parseFloat(row[actualYColumn]);
                    
                    // 应用数据预处理
                    if (dataTransform && (dataTransform.column === actualYColumn || dataTransform.column === yAxisColumn)) {
                        val = transformValue(val, dataTransform);
                        transformInfo = `（单位：${dataTransform.unit || '转换后'}）`;
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
        // 找到实际的标签列
        let actualLabelColumn = labelColumn;
        if (!headers.includes(labelColumn)) {
            actualLabelColumn = headers.find(h => h.includes(labelColumn) || labelColumn.includes(h));
        }
        
        if (!actualLabelColumn) {
            container.innerHTML = `<div style="color: #666; padding: 20px;">错误：标签列"${labelColumn}"不存在</div>`;
            return;
        }
        
        // 统计数据
        const counts = {};
        data.forEach(row => {
            const key = row[actualLabelColumn];
            if (key !== undefined && key !== null && key !== '') {
                const keyStr = key.toString().trim();
                if (valueColumn && headers.includes(valueColumn)) {
                    // 使用数值列的值
                    const val = parseFloat(row[valueColumn]);
                    if (!isNaN(val)) {
                        counts[keyStr] = (counts[keyStr] || 0) + val;
                    }
                } else {
                    // 计数
                    counts[keyStr] = (counts[keyStr] || 0) + 1;
                }
            }
        });
        
        // 排序并取前10个
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        labels = sorted.map(([k, v]) => k);
        values = sorted.map(([k, v]) => v);
    }
    
    if (labels.length === 0) {
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
    const tableData = labels.map((label, index) => ({
        rank: index + 1,
        label: label,
        value: values[index],
        percentage: ((values[index] / values.reduce((a, b) => a + b, 0)) * 100).toFixed(2)
    }));
    
    // 创建统计表格HTML
    let tableHTML = '<h5 style="margin: 0 0 10px 0; color: #333;">统计结果</h5>';
    tableHTML += '<div class="stats-container">';
    tableHTML += '<table>';
    tableHTML += '<thead><tr><th>排名</th><th>名称</th><th>数量</th><th>占比</th></tr></thead>';
    tableHTML += '<tbody>';
    
    tableData.forEach((item, index) => {
        const rankStyle = index < 3 ? 'style="color: #667eea; font-weight: bold;"' : '';
        tableHTML += `<tr><td ${rankStyle}>${item.rank}</td><td>${item.label}</td><td>${item.value}</td><td>${item.percentage}%</td></tr>`;
    });
    
    tableHTML += '</tbody></table></div>';
    tableHTML += `<div style="margin-top: 10px; color: #666; font-size: 0.85em;">总计：${values.reduce((a, b) => a + b, 0)}</div>`;
    
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

// 调用大模型API（带超时控制）
async function callLLMAPI(prompt, signal = null, timeout = 15000) {
    const apiKey = config.ai.apiKey;
    const apiUrl = config.ai.apiUrl;
    const model = config.ai.model;
    
    console.log('调用API:', { apiUrl, model, apiKey: apiKey ? '已配置' : '未配置', timeout });
    
    if (!apiKey || apiKey === 'your-api-key-here') {
        throw new Error('API密钥未配置');
    }
    
    // 创建超时控制
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
        timeoutController.abort();
    }, timeout);
    
    // 合并signal
    let finalSignal = timeoutController.signal;
    if (signal) {
        // 如果外部提供了signal，需要监听两个signal
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
            
            // 解析错误信息，提供更友好的提示
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
            
            // 针对特定错误码提供建议
            if (response.status === 503 || response.status === 429) {
                errorMessage += '，建议稍后重试';
            } else if (response.status === 401) {
                errorMessage = 'API密钥无效，请检查配置';
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API响应格式不正确');
        }
        
        return data.choices[0].message.content;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请稍后重试');
        }
        console.error('API调用详细错误:', error);
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

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);