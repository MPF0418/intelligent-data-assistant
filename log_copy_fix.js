// 日志复制功能修复脚本

console.log('📋 加载日志复制修复脚本...');

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM已加载，初始化日志复制功能...');
    setTimeout(initLogCopyFunction, 100);
});

// 初始化日志复制功能
function initLogCopyFunction() {
    console.log('📋 初始化日志复制功能...');
    
    // 查找日志容器和复制按钮
    const logContainer = document.querySelector('.log-output, #log-output, [data-log-container]');
    const copyButton = document.getElementById('copy-logs') || createCopyButton();
    
    if (!logContainer) {
        console.warn('⚠️ 未找到日志容器，将在0.5秒后重试...');
        setTimeout(initLogCopyFunction, 500);
        return;
    }
    
    console.log('✅ 找到日志容器:', logContainer.className || logContainer.id);

    // 添加复制按钮
    if (copyButton) {
        setupCopyButton(copyButton, logContainer);
    }
    
    setupContextMenu(logContainer);
    
    console.log('✅ 日志复制功能初始化完成');
}

// 创建复制按钮
function createCopyButton() {
    console.log('📋 创建复制按钮...');
    
    const copyButton = document.createElement('button');
    copyButton.id = 'copy-logs';
    copyButton.innerHTML = `
        <span class="copy-icon">📋</span>
        <span class="copy-text">复制日志</span>
    `;
    
    copyButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        padding: 8px 16px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    
    copyButton.onmouseenter = function() {
        copyButton.style.transform = 'translateY(-1px)';
        copyButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    };
    
    copyButton.onmouseleave = function() {
        copyButton.style.transform = 'translateY(0)';
        copyButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    };
    
    // 查找合适的容器添加按钮
    const containers = [
        document.querySelector('.log-container'),
        document.querySelector('#logging-panel'),
        document.querySelector('.bottom-panel')
    ];
    
    for (const container of containers) {
        if (container) {
            container.style.position = 'relative';
            container.appendChild(copyButton);
            console.log('✅ 复制按钮添加到容器:', container.className || container.id);
            return copyButton;
        }
    }
    
    // 如果没找到合适的容器，添加到body
    document.body.appendChild(copyButton);
    console.log('⚠️ 复制按钮添加到body');
    return copyButton;
}

// 设置复制按钮
function setupCopyButton(copyButton, logContainer) {
    console.log('📋 设置复制按钮事件...');
    
    copyButton.onclick = async function() {
        try {
            console.log('📋 开始复制日志...');
            
            // 获取日志内容
            const logContent = extractLogContent(logContainer);
            
            if (!logContent || logContent.trim() === '') {
                console.log('⚠️ 没有日志内容可复制');
                showCopyFeedback(copyButton, '无内容', false);
                return;
            }
            
            // 使用Clipboard API复制内容
            await navigator.clipboard.writeText(logContent);
            
            console.log('✅ 日志复制成功，字符数:', logContent.length);
            showCopyFeedback(copyButton, '复制成功!', true);
            
        } catch (error) {
            console.error('❌ 复制日志失败:', error);
            showCopyFeedback(copyButton, '复制失败', false);
            
            // 降级方案
            try {
                fallbackCopy(logContainer);
                showCopyFeedback(copyButton, '已复制(降级)', true);
            } catch (fallbackError) {
                console.error('❌ 降级复制也失败:', fallbackError);
            }
        }
    };
}

// 提取日志内容
function extractLogContent(logContainer) {
    let content = '';
    
    // 尝试不同的提取方式
    if (logContainer.querySelectorAll) {
        // 提取结构化日志条目
        const logEntries = logContainer.querySelectorAll('div, p, span, li');
        const entriesArray = Array.from(logEntries).map(el => {
            // 提取文本和可能的时间戳
            let text = el.textContent || el.innerText || '';
            
            // 清理多余的空白字符
            text = text.replace(/\s+/g, ' ').trim();
            
            // 可能包含时间戳的元素
            const timeEl = el.querySelector('.time, .timestamp, [data-time]');
            if (timeEl) {
                const timeText = timeEl.textContent || timeEl.innerText || '';
                return `${timeText} ${text}`;
            }
            
            return text;
        }).filter(text => text && text.trim() !== '');
        
        content = entriesArray.join('\n');
    }
    
    // 如果没有通过元素提取到内容，尝试直接文本
    if (!content || content.trim() === '') {
        content = logContainer.textContent || logContainer.innerText || '';
        
        // 清理和格式化
        content = content.replace(/\s+/g, ' ').trim();
        content = content.replace(/  +/g, '\n');
    }
    
    // 添加时间戳
    const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    return `====== 日志导出 ======\n导出时间: ${timestamp}\n\n${content}\n\n====== 结束 ======`;
}

// 显示复制反馈
function showCopyButton(copyButton, message, success) {
    const originalHTML = copyButton.innerHTML;
    const originalBackground = copyButton.style.background;
    
    copyButton.innerHTML = `<span>${message}</span>`;
    copyButton.style.background = success ? '#4CAF50' : '#f44336';
    copyButton.disabled = true;
    
    // 2秒后恢复
    setTimeout(() => {
        copyButton.innerHTML = originalHTML;
        copyButton.style.background = originalBackground;
        copyButton.disabled = false;
    }, 2000);
}

// 降级复制方案
function fallbackCopy(logContainer) {
    const textarea = document.createElement('textarea');
    textarea.value = extractLogContent(logContainer);
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (!result) {
        throw new Error('execCommand复制失败');
    }
}

// 设置右键菜单
function setupContextMenu(logContainer) {
    logContainer.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        
        const text = window.getSelection().toString();
        if (text && text.trim()) {
            // 创建右键复制提示
            const hint = document.createElement('div');
            hint.textContent = '已选择文本，按Ctrl+C复制';
            hint.style.cssText = `
                position: fixed;
                top: ${e.pageY - 30}px;
                left: ${e.pageX}px;
                background: #333;
                color: white;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 12px;
                pointer-events: none;
                z-index: 10000;
            `;
            
            document.body.appendChild(hint);
            setTimeout(() => document.body.removeChild(hint), 2000);
        }
    });
}

// 添加全局便捷函数
window.copyAllLogs = function() {
    const logContainer = document.querySelector('.log-output, #log-output, [data-log-container]');
    const copyButton = document.getElementById('copy-logs');
    
    if (copyButton && logContainer) {
        copyButton.click();
    } else {
        console.error('❌ 找不到日志容器或复制按钮');
        alert('请先定位到日志区域');
    }
};

// 立即尝试初始化
console.log('📋 立即尝试初始化日志复制...');
setTimeout(initLogCopyFunction, 50);

console.log('✅ 日志复制修复脚本加载完成');