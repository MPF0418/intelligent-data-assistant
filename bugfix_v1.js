/**
 * 智能数据分析助手 - Bug修复脚本 V1.0
 * 修复内容：
 * 1. 空输入拦截：发送按钮在输入为空时应禁用
 * 2. 筛选条件添加：修复添加筛选条件时列选项为空的问题
 */

// 修复1: 空输入拦截 - 添加输入监听器来启用/禁用发送按钮
function initInputValidation() {
    const conversationInput = document.getElementById('conversation-input');
    const sendMessageBtn = document.getElementById('send-message');
    
    if (!conversationInput || !sendMessageBtn) {
        console.warn('[Fix] 输入框或发送按钮未找到');
        return;
    }
    
    // 更新按钮状态函数
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
    
    // 监听粘贴事件
    conversationInput.addEventListener('paste', () => {
        setTimeout(updateSendButtonState, 0);
    });
    
    // 初始化按钮状态
    updateSendButtonState();
    
    console.log('[Fix] 输入验证已初始化');
}

// 修复2: 筛选条件添加问题 - 确保列选项正确更新
function fixFilterCondition() {
    const container = document.getElementById('filter-conditions');
    if (!container) {
        console.warn('[Fix] 筛选条件容器未找到');
        return;
    }
    
    // 检查是否需要添加默认筛选条件
    const existingRows = container.querySelectorAll('.filter-row');
    if (existingRows.length === 0 && typeof headers !== 'undefined' && headers.length > 0) {
        // 自动添加一个默认筛选条件
        addFilterCondition();
        console.log('[Fix] 已自动添加默认筛选条件');
    }
}

// 重写的 addFilterCondition 函数，确保列选项正确
const originalAddFilterCondition = window.addFilterCondition;
window.addFilterCondition = function() {
    const container = document.getElementById('filter-conditions');
    if (!container) {
        console.warn('[Fix] 筛选条件容器未找到');
        return;
    }
    
    // 检查 headers 是否可用
    const availableHeaders = typeof headers !== 'undefined' && Array.isArray(headers) && headers.length > 0 
        ? headers 
        : [];
    
    if (availableHeaders.length === 0) {
        console.warn('[Fix] 未检测到列信息，请先上传数据文件');
        // 显示提示信息
        const hintDiv = document.createElement('div');
        hintDiv.className = 'filter-hint';
        hintDiv.style.cssText = 'padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-bottom: 10px; color: #856404;';
        hintDiv.textContent = '请先上传数据文件，然后再添加筛选条件';
        container.appendChild(hintDiv);
        
        // 3秒后移除提示
        setTimeout(() => {
            hintDiv.remove();
        }, 3000);
        
        return;
    }
    
    // 移除可能存在的提示
    const existingHint = container.querySelector('.filter-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; padding: 10px; background: #f8f9fa; border-radius: 4px;';
    
    // 构建列选项
    const columnOptions = availableHeaders.map(h => `<option value="${h}">${h}</option>`).join('');
    
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
            // 检查是否还有其他筛选条件
            const remainingRows = container.querySelectorAll('.filter-row');
            if (remainingRows.length === 0) {
                // 可以显示一个提示或保持空白
                console.log('[Fix] 所有筛选条件已删除');
            }
        });
    }
    
    // 绑定列选择事件，用于自动获取可选值
    const columnSelect = filterRow.querySelector('.filter-column');
    if (columnSelect) {
        columnSelect.addEventListener('change', () => {
            const selectedColumn = columnSelect.value;
            if (selectedColumn && typeof data !== 'undefined' && Array.isArray(data) && data.length > 0) {
                // 获取该列的唯一值作为建议
                const columnIndex = availableHeaders.indexOf(selectedColumn);
                if (columnIndex >= 0) {
                    const uniqueValues = [...new Set(data.map(row => row[columnIndex]))].slice(0, 20);
                    const valueInput = filterRow.querySelector('.filter-value');
                    if (valueInput && uniqueValues.length > 0) {
                        valueInput.placeholder = `建议值: ${uniqueValues.slice(0, 5).join(', ')}...`;
                    }
                }
            }
        });
    }
    
    container.appendChild(filterRow);
    
    // 添加动画效果
    filterRow.style.opacity = '0';
    filterRow.style.transform = 'translateY(-10px)';
    filterRow.style.transition = 'opacity 0.3s, transform 0.3s';
    
    requestAnimationFrame(() => {
        filterRow.style.opacity = '1';
        filterRow.style.transform = 'translateY(0)';
    });
    
    console.log('[Fix] 筛选条件已添加，当前列:', availableHeaders);
};

// 修复3: 初始化时自动调用修复函数
function applyAllFixes() {
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                initInputValidation();
                fixFilterCondition();
            }, 500);
        });
    } else {
        setTimeout(() => {
            initInputValidation();
            fixFilterCondition();
        }, 500);
    }
    
    // 监听文件上传成功事件
    document.addEventListener('fileUploadSuccess', () => {
        console.log('[Fix] 文件上传成功，更新筛选条件...');
        setTimeout(() => {
            // 更新所有现有筛选条件的列选项
            updateFilterColumnOptions();
        }, 1000);
    });
    
    console.log('[Fix] 所有修复已应用');
}

// 额外修复：更新所有筛选条件的列选项
function updateFilterColumnOptions() {
    const container = document.getElementById('filter-conditions');
    if (!container || typeof headers === 'undefined' || !Array.isArray(headers) || headers.length === 0) {
        return;
    }
    
    const filterRows = container.querySelectorAll('.filter-row');
    filterRows.forEach(row => {
        const columnSelect = row.querySelector('.filter-column');
        if (columnSelect) {
            const currentValue = columnSelect.value;
            const columnOptions = headers.map(h => `<option value="${h}">${h}</option>`).join('');
            columnSelect.innerHTML = `<option value="">选择列</option>${columnOptions}`;
            
            // 如果之前的值还存在，恢复它
            if (currentValue && headers.includes(currentValue)) {
                columnSelect.value = currentValue;
            }
        }
    });
}

// 执行修复
applyAllFixes();

// 导出函数供外部调用
window.initInputValidation = initInputValidation;
window.fixFilterCondition = fixFilterCondition;
window.updateFilterColumnOptions = updateFilterColumnOptions;
