// 异常引导 UI 控制器 - 管理错误提示和引导
// 产品意义：当查询失败时，提供友好的错误提示和明确的修正建议

class ErrorGuideUI {
    constructor() {
        this.currentModal = null;
        
        // 错误类型到图标的映射
        this.errorTypeIcons = {
            'COLUMN_ERROR': '📊',
            'PARAM_ERROR': '⚙️',
            'DATA_ERROR': '📁',
            'NETWORK_ERROR': '🌐',
            'TIMEOUT_ERROR': '⏱️',
            'TYPE_ERROR': '🔤',
            'PERMISSION_ERROR': '🔒',
            'UNKNOWN_ERROR': '❓'
        };
        
        // 错误类型到中文名称的映射
        this.errorTypeNames = {
            'COLUMN_ERROR': '列错误',
            'PARAM_ERROR': '参数错误',
            'DATA_ERROR': '数据错误',
            'NETWORK_ERROR': '网络错误',
            'TIMEOUT_ERROR': '超时错误',
            'TYPE_ERROR': '类型错误',
            'PERMISSION_ERROR': '权限错误',
            'UNKNOWN_ERROR': '未知错误'
        };
        
        console.log('[ErrorGuideUI] 异常引导 UI 控制器已初始化');
    }
    
    /**
     * 显示错误引导弹窗
     * @param {Object} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    showErrorGuide(error, context = {}) {
        // 关闭之前的弹窗
        if (this.currentModal) {
            this.closeErrorGuide();
        }
        
        // 创建弹窗 HTML
        const modalHTML = this.createModalHTML(error, context);
        
        // 添加到页面
        const modal = document.createElement('div');
        modal.className = 'error-guide-modal';
        modal.innerHTML = modalHTML;
        
        document.body.appendChild(modal);
        this.currentModal = modal;
        
        // 绑定事件
        this.bindModalEvents(modal);
        
        console.log('[ErrorGuideUI] 错误引导弹窗已显示');
    }
    
    /**
     * 创建弹窗 HTML
     */
    createModalHTML(error, context) {
        const errorType = this.classifyError(error);
        const icon = this.errorTypeIcons[errorType] || '❗';
        const errorName = this.errorTypeNames[errorType] || '错误';
        const errorMessage = error.message || String(error);
        
        // 生成建议列表
        const suggestions = this.generateSuggestions(errorType, context);
        
        return `
            <div class="error-guide-content">
                <div class="error-guide-header">
                    <span class="error-guide-icon">${icon}</span>
                    <h3 class="error-guide-title">${errorName}</h3>
                </div>
                <div class="error-guide-body">
                    <div class="error-message">
                        <p class="error-message-text">
                            <strong>错误信息：</strong>${errorMessage}
                        </p>
                    </div>
                    
                    ${suggestions.length > 0 ? `
                        <div class="error-guide-section">
                            <h4 class="error-guide-section-title">建议操作</h4>
                            <ul class="suggestion-list">
                                ${suggestions.map((suggestion, index) => `
                                    <li class="suggestion-item" data-index="${index}">
                                        <div class="suggestion-item-header">
                                            <span class="suggestion-item-icon">${this.getSuggestionIcon(index)}</span>
                                            <span class="suggestion-item-title">${suggestion.title}</span>
                                        </div>
                                        <p class="suggestion-item-desc">${suggestion.description}</p>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                <div class="error-guide-footer">
                    <button class="quick-action-btn" id="btnRetry">
                        🔄 重试
                    </button>
                    <button class="quick-action-btn" id="btnFeedback">
                        💬 反馈问题
                    </button>
                    <button class="quick-action-btn" id="btnCloseErrorGuide">
                        关闭
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 生成建议列表
     */
    generateSuggestions(errorType, context) {
        const suggestions = [];
        
        switch (errorType) {
            case 'COLUMN_ERROR':
                suggestions.push(
                    {
                        title: '检查列名是否正确',
                        description: '确认您提到的列名在数据集中存在，注意大小写和特殊字符'
                    },
                    {
                        title: '查看可用列列表',
                        description: '点击"查看数据"按钮，查看当前数据集包含的所有列'
                    },
                    {
                        title: '使用更明确的描述',
                        description: '尝试使用完整的列名，避免使用简称或别名'
                    }
                );
                break;
                
            case 'PARAM_ERROR':
                suggestions.push(
                    {
                        title: '检查查询参数',
                        description: '确认您的查询包含所有必要的参数，如数值列、分组列等'
                    },
                    {
                        title: '简化查询语句',
                        description: '尝试将复杂查询拆分为多个简单查询，逐步执行'
                    },
                    {
                        title: '参考示例查询',
                        description: '查看系统提供的示例查询，了解正确的查询格式'
                    }
                );
                break;
                
            case 'DATA_ERROR':
                suggestions.push(
                    {
                        title: '检查数据格式',
                        description: '确认数据格式正确，数值列不包含文本，日期列格式统一'
                    },
                    {
                        title: '重新上传数据',
                        description: '如果数据有问题，尝试重新上传原始数据文件'
                    },
                    {
                        title: '联系数据管理员',
                        description: '如果数据确实有问题，请联系数据管理员进行修正'
                    }
                );
                break;
                
            case 'NETWORK_ERROR':
                suggestions.push(
                    {
                        title: '检查网络连接',
                        description: '确认您的网络连接正常，可以尝试访问其他网站'
                    },
                    {
                        title: '刷新页面',
                        description: '点击浏览器刷新按钮，或按 F5 键刷新页面'
                    },
                    {
                        title: '稍后重试',
                        description: '网络问题可能是暂时的，请等待几分钟后重试'
                    }
                );
                break;
                
            case 'TIMEOUT_ERROR':
                suggestions.push(
                    {
                        title: '减少数据量',
                        description: '如果数据量很大，尝试添加筛选条件减少数据量'
                    },
                    {
                        title: '简化查询',
                        description: '避免同时执行多个复杂查询，拆分为多次简单查询'
                    },
                    {
                        title: '等待系统处理',
                        description: '大数据量查询需要时间，请耐心等待系统处理完成'
                    }
                );
                break;
                
            default:
                suggestions.push(
                    {
                        title: '重试操作',
                        description: '点击"重试"按钮，重新执行查询'
                    },
                    {
                        title: '查看详细日志',
                        description: '打开浏览器控制台（F12），查看详细错误日志'
                    },
                    {
                        title: '联系技术支持',
                        description: '如果问题持续存在，请联系技术支持团队'
                    }
                );
        }
        
        return suggestions;
    }
    
    /**
     * 获取建议图标
     */
    getSuggestionIcon(index) {
        const icons = ['🔍', '📋', '💡', '⚡', '🛠️', '📞'];
        return icons[index] || '💡';
    }
    
    /**
     * 绑定弹窗事件
     */
    bindModalEvents(modal) {
        // 重试按钮
        const btnRetry = modal.querySelector('#btnRetry');
        if (btnRetry) {
            btnRetry.addEventListener('click', () => {
                this.closeErrorGuide();
                this.onRetry?.();
            });
        }
        
        // 反馈按钮
        const btnFeedback = modal.querySelector('#btnFeedback');
        if (btnFeedback) {
            btnFeedback.addEventListener('click', () => {
                this.closeErrorGuide();
                this.onFeedback?.();
            });
        }
        
        // 关闭按钮
        const btnClose = modal.querySelector('#btnCloseErrorGuide');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                this.closeErrorGuide();
            });
        }
        
        // 建议项点击事件
        const suggestionItems = modal.querySelectorAll('.suggestion-item');
        suggestionItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.handleSuggestionClick(index, item);
            });
        });
        
        // 点击弹窗外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeErrorGuide();
            }
        });
        
        // ESC 键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                this.closeErrorGuide();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }
    
    /**
     * 处理建议点击
     */
    handleSuggestionClick(index, item) {
        // 高亮选中的建议
        const items = document.querySelectorAll('.suggestion-item');
        items.forEach(i => i.style.borderColor = '#e0e7ff');
        item.style.borderColor = '#667eea';
        item.style.background = '#eef2ff';
        
        // 根据建议执行操作（这里可以根据具体需求实现）
        console.log('[ErrorGuideUI] 用户点击了建议:', index);
    }
    
    /**
     * 关闭错误引导弹窗
     */
    closeErrorGuide() {
        if (this.currentModal) {
            this.currentModal.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                this.currentModal.remove();
                this.currentModal = null;
            }, 300);
        }
    }
    
    /**
     * 设置重试回调
     */
    setOnRetry(callback) {
        this.onRetry = callback;
    }
    
    /**
     * 设置反馈回调
     */
    setOnFeedback(callback) {
        this.onFeedback = callback;
    }
    
    /**
     * 错误分类
     */
    classifyError(error) {
        const message = (error.message || '').toLowerCase();
        
        if (message.includes('column') || message.includes('列')) return 'COLUMN_ERROR';
        if (message.includes('param') || message.includes('parameter') || message.includes('参数')) return 'PARAM_ERROR';
        if (message.includes('data') || message.includes('数据')) return 'DATA_ERROR';
        if (message.includes('network') || message.includes('network')) return 'NETWORK_ERROR';
        if (message.includes('timeout') || message.includes('超时')) return 'TIMEOUT_ERROR';
        if (message.includes('type') || message.includes('类型')) return 'TYPE_ERROR';
        if (message.includes('permission') || message.includes('权限')) return 'PERMISSION_ERROR';
        
        return 'UNKNOWN_ERROR';
    }
    
    /**
     * 显示简单错误提示（不使用弹窗）
     */
    showSimpleError(message, duration = 5000) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 9999;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">❌</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => errorDiv.remove(), 300);
        }, duration);
    }
}

// 导出单例实例
const errorGuideUI = new ErrorGuideUI();
export default errorGuideUI;
