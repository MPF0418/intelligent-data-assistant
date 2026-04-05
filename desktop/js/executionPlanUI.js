/**
 * 执行计划展示UI组件 - V4.0
 * 功能：展示查询执行计划，让用户了解系统将如何处理请求
 * 
 * 核心能力：
 * 1. 可视化执行步骤
 * 2. 显示预估时间
 * 3. 支持用户确认/修改
 * 4. 实时进度展示
 */

class ExecutionPlanUI {
    constructor() {
        this.currentPlan = null;
        this.isVisible = false;
        this.container = null;
        this.onConfirm = null;
        this.onCancel = null;
    }

    /**
     * 初始化UI容器
     */
    init() {
        // 检查是否已存在容器
        this.container = document.getElementById('execution-plan-container');
        
        if (!this.container) {
            // 创建容器
            this.container = document.createElement('div');
            this.container.id = 'execution-plan-container';
            this.container.className = 'execution-plan-container hidden';
            document.body.appendChild(this.container);
            
            // 添加样式
            this.addStyles();
        }
    }

    /**
     * 显示执行计划
     * @param {Object} plan - 执行计划对象
     * @param {Object} options - 配置选项
     */
    show(plan, options = {}) {
        this.init();
        this.currentPlan = plan;
        this.onConfirm = options.onConfirm || (() => {});
        this.onCancel = options.onCancel || (() => {});
        
        const { steps, summary, plan: planInfo } = plan;
        
        // 构建HTML
        const html = `
            <div class="plan-overlay"></div>
            <div class="plan-content">
                <div class="plan-header">
                    <h3>📋 执行计划</h3>
                    <button class="plan-close" onclick="executionPlanUI.hide()">×</button>
                </div>
                <div class="plan-summary">
                    <span class="plan-badge ${planInfo?.complexity || 'simple'}">${this.getComplexityLabel(planInfo?.complexity)}</span>
                    <span class="plan-info">${summary || ''}</span>
                </div>
                <div class="plan-steps">
                    ${steps.map((step, index) => `
                        <div class="plan-step" data-step="${index}">
                            <div class="step-number">${step.step}</div>
                            <div class="step-content">
                                <div class="step-action">${step.action}</div>
                                <div class="step-description">${step.description}</div>
                                ${step.detail ? `<div class="step-detail">${step.detail}</div>` : ''}
                            </div>
                            <div class="step-time">
                                <span class="time-value">${step.estimatedMs}</span>
                                <span class="time-unit">ms</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="plan-footer">
                    <div class="plan-estimated-time">
                        <span class="time-icon">⏱️</span>
                        <span>预计耗时：<strong>${planInfo?.estimatedTime || 0}</strong> ms</span>
                    </div>
                    <div class="plan-actions">
                        <button class="plan-btn plan-btn-cancel" onclick="executionPlanUI.cancel()">
                            取消
                        </button>
                        <button class="plan-btn plan-btn-confirm" onclick="executionPlanUI.confirm()">
                            确认执行
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.isVisible = true;
        
        // 添加动画
        setTimeout(() => {
            this.container.classList.add('visible');
        }, 10);
    }

    /**
     * 隐藏执行计划
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
            setTimeout(() => {
                this.container.classList.add('hidden');
            }, 300);
        }
        this.isVisible = false;
    }

    /**
     * 确认执行
     */
    confirm() {
        this.hide();
        if (this.onConfirm) {
            this.onConfirm(this.currentPlan);
        }
    }

    /**
     * 取消执行
     */
    cancel() {
        this.hide();
        if (this.onCancel) {
            this.onCancel();
        }
    }

    /**
     * 更新执行进度
     * @param {number} currentStep - 当前步骤
     * @param {string} status - 状态 (running/completed/error)
     */
    updateProgress(currentStep, status = 'running') {
        if (!this.container) return;
        
        const steps = this.container.querySelectorAll('.plan-step');
        steps.forEach((stepEl, index) => {
            stepEl.classList.remove('running', 'completed', 'error');
            
            if (index < currentStep) {
                stepEl.classList.add('completed');
            } else if (index === currentStep) {
                stepEl.classList.add(status);
            }
        });
    }

    /**
     * 显示简化版执行计划（内联显示）
     * @param {Object} plan - 执行计划
     * @param {HTMLElement} targetElement - 目标元素
     */
    showInline(plan, targetElement) {
        if (!targetElement) return;
        
        const { steps, summary } = plan;
        
        const html = `
            <div class="execution-plan-inline">
                <div class="plan-inline-header">
                    <span class="plan-icon">📋</span>
                    <span class="plan-title">执行计划</span>
                    <span class="plan-toggle" onclick="executionPlanUI.toggleInline(this)">▼</span>
                </div>
                <div class="plan-inline-content collapsed">
                    <div class="plan-steps-mini">
                        ${steps.map(step => `
                            <div class="step-mini">
                                <span class="step-num">${step.step}</span>
                                <span class="step-text">${step.action}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // 插入到目标元素
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        targetElement.insertBefore(wrapper.firstElementChild, targetElement.firstChild);
    }

    /**
     * 切换内联计划展开/收起
     */
    toggleInline(toggleEl) {
        const content = toggleEl.closest('.execution-plan-inline').querySelector('.plan-inline-content');
        content.classList.toggle('collapsed');
        toggleEl.textContent = content.classList.contains('collapsed') ? '▼' : '▲';
    }

    /**
     * 获取复杂度标签
     */
    getComplexityLabel(complexity) {
        const labels = {
            simple: '简单查询',
            medium: '中等复杂',
            complex: '复杂查询'
        };
        return labels[complexity] || '简单查询';
    }

    /**
     * 添加样式
     */
    addStyles() {
        if (document.getElementById('execution-plan-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'execution-plan-styles';
        styles.textContent = `
            .execution-plan-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .execution-plan-container.visible {
                opacity: 1;
            }
            
            .execution-plan-container.hidden {
                display: none;
            }
            
            .plan-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
            }
            
            .plan-content {
                position: relative;
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .execution-plan-container.visible .plan-content {
                transform: scale(1);
            }
            
            .plan-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #eee;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .plan-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .plan-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .plan-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .plan-summary {
                padding: 16px 24px;
                background: #f8f9fa;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .plan-badge {
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .plan-badge.simple {
                background: #e8f5e9;
                color: #2e7d32;
            }
            
            .plan-badge.medium {
                background: #fff3e0;
                color: #ef6c00;
            }
            
            .plan-badge.complex {
                background: #ffebee;
                color: #c62828;
            }
            
            .plan-info {
                color: #666;
                font-size: 14px;
            }
            
            .plan-steps {
                padding: 16px 24px;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .plan-step {
                display: flex;
                align-items: flex-start;
                padding: 12px;
                margin-bottom: 8px;
                background: #f8f9fa;
                border-radius: 8px;
                transition: all 0.3s ease;
            }
            
            .plan-step.running {
                background: #e3f2fd;
                border-left: 3px solid #2196f3;
            }
            
            .plan-step.completed {
                background: #e8f5e9;
                border-left: 3px solid #4caf50;
            }
            
            .plan-step.error {
                background: #ffebee;
                border-left: 3px solid #f44336;
            }
            
            .step-number {
                width: 28px;
                height: 28px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 600;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .plan-step.completed .step-number {
                background: #4caf50;
            }
            
            .plan-step.error .step-number {
                background: #f44336;
            }
            
            .step-content {
                flex: 1;
            }
            
            .step-action {
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
            }
            
            .step-description {
                font-size: 13px;
                color: #666;
            }
            
            .step-detail {
                font-size: 12px;
                color: #999;
                margin-top: 4px;
            }
            
            .step-time {
                text-align: right;
                color: #999;
                font-size: 12px;
            }
            
            .time-value {
                font-weight: 600;
                color: #667eea;
            }
            
            .plan-footer {
                padding: 16px 24px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .plan-estimated-time {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #666;
                font-size: 14px;
            }
            
            .plan-estimated-time strong {
                color: #667eea;
                font-size: 16px;
            }
            
            .plan-actions {
                display: flex;
                gap: 12px;
            }
            
            .plan-btn {
                padding: 10px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .plan-btn-cancel {
                background: #f5f5f5;
                border: 1px solid #ddd;
                color: #666;
            }
            
            .plan-btn-cancel:hover {
                background: #eee;
            }
            
            .plan-btn-confirm {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
            }
            
            .plan-btn-confirm:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            /* 内联样式 */
            .execution-plan-inline {
                background: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 12px;
                overflow: hidden;
            }
            
            .plan-inline-header {
                display: flex;
                align-items: center;
                padding: 10px 14px;
                background: #e8f4f8;
                cursor: pointer;
            }
            
            .plan-icon {
                margin-right: 8px;
            }
            
            .plan-title {
                font-weight: 500;
                color: #333;
                flex: 1;
            }
            
            .plan-toggle {
                color: #666;
                font-size: 12px;
            }
            
            .plan-inline-content {
                padding: 12px 14px;
                transition: all 0.3s ease;
            }
            
            .plan-inline-content.collapsed {
                display: none;
            }
            
            .plan-steps-mini {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .step-mini {
                display: flex;
                align-items: center;
                gap: 6px;
                background: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
            }
            
            .step-num {
                background: #667eea;
                color: white;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
            }
            
            .step-text {
                color: #666;
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// 导出单例
const executionPlanUI = new ExecutionPlanUI();
export default executionPlanUI;
