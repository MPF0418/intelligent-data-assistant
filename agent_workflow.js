# -*- coding: utf-8 -*-
"""
Agent工作流可视化组件
产品意义：可视化展示Agent的执行流程，帮助用户理解系统的工作原理
"""

class AgentWorkflowVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.workflowSteps = [];
        this.currentStep = 0;
        this.isAnimating = false;
    }

    /**
     * 初始化工作流可视化
     * 产品意义：创建工作流的基本结构
     */
    init() {
        if (!this.container) {
            console.error('容器元素不存在');
            return;
        }

        this.container.innerHTML = `
            <div class="workflow-container">
                <div class="workflow-header">
                    <h3>Agent工作流</h3>
                    <div class="workflow-controls">
                        <button id="play-workflow" class="btn btn-primary">▶ 播放</button>
                        <button id="reset-workflow" class="btn btn-secondary">↺ 重置</button>
                        <button id="export-workflow" class="btn btn-secondary">⬇ 导出</button>
                    </div>
                </div>
                <div class="workflow-steps" id="workflow-steps"></div>
                <div class="workflow-details" id="workflow-details"></div>
            </div>
        `;

        this.bindEvents();
    }

    /**
     * 绑定事件监听器
     * 产品意义：支持用户交互
     */
    bindEvents() {
        const playBtn = document.getElementById('play-workflow');
        const resetBtn = document.getElementById('reset-workflow');
        const exportBtn = document.getElementById('export-workflow');

        if (playBtn) {
            playBtn.addEventListener('click', () => this.play());
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.export());
        }
    }

    /**
     * 添加工作流步骤
     * 产品意义：定义工作流的执行步骤
     */
    addStep(step) {
        this.workflowSteps.push({
            id: step.id,
            name: step.name,
            type: step.type || 'process',
            description: step.description || '',
            duration: step.duration || 0,
            status: 'pending',
            details: step.details || {}
        });

        this.renderSteps();
    }

    /**
     * 渲染工作流步骤
     * 产品意义：在界面上显示工作流步骤
     */
    renderSteps() {
        const stepsContainer = document.getElementById('workflow-steps');
        if (!stepsContainer) return;

        let html = '';
        this.workflowSteps.forEach((step, index) => {
            const statusClass = this.getStatusClass(step.status);
            const icon = this.getStepIcon(step.type);

            html += `
                <div class="workflow-step ${statusClass}" data-step="${index}">
                    <div class="step-connector ${index === 0 ? 'first' : ''}"></div>
                    <div class="step-content">
                        <div class="step-icon">${icon}</div>
                        <div class="step-info">
                            <div class="step-name">${step.name}</div>
                            <div class="step-description">${step.description}</div>
                            ${step.duration > 0 ? `<div class="step-duration">${step.duration}ms</div>` : ''}
                        </div>
                        <div class="step-status">${this.getStatusText(step.status)}</div>
                    </div>
                    <div class="step-connector ${index === this.workflowSteps.length - 1 ? 'last' : ''}"></div>
                </div>
            `;
        });

        stepsContainer.innerHTML = html;
    }

    /**
     * 获取步骤状态样式类
     * 产品意义：根据步骤状态应用不同的样式
     */
    getStatusClass(status) {
        const statusMap = {
            'pending': 'pending',
            'running': 'running',
            'completed': 'completed',
            'error': 'error',
            'skipped': 'skipped'
        };
        return statusMap[status] || 'pending';
    }

    /**
     * 获取步骤图标
     * 产品意义：根据步骤类型显示不同的图标
     */
    getStepIcon(type) {
        const iconMap = {
            'start': '▶',
            'process': '⚙',
            'decision': '◇',
            'end': '■',
            'agent': '🤖',
            'llm': '🧠',
            'database': '💾',
            'rag': '📚',
            'analysis': '📊',
            'visualization': '📈'
        };
        return iconMap[type] || '⚙';
    }

    /**
     * 获取状态文本
     * 产品意义：将状态代码转换为可读文本
     */
    getStatusText(status) {
        const statusMap = {
            'pending': '待执行',
            'running': '执行中',
            'completed': '已完成',
            'error': '失败',
            'skipped': '已跳过'
        };
        return statusMap[status] || '未知';
    }

    /**
     * 播放工作流动画
     * 产品意义：逐步展示工作流执行过程
     */
    async play() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const playBtn = document.getElementById('play-workflow');
        if (playBtn) {
            playBtn.disabled = true;
            playBtn.textContent = '⏸ 播放中...';
        }

        for (let i = 0; i < this.workflowSteps.length; i++) {
            this.currentStep = i;
            await this.executeStep(i);
        }

        this.isAnimating = false;

        if (playBtn) {
            playBtn.disabled = false;
            playBtn.textContent = '▶ 播放';
        }
    }

    /**
     * 执行单个步骤
     * 产品意义：模拟步骤执行过程
     */
    async executeStep(index) {
        const step = this.workflowSteps[index];
        step.status = 'running';
        this.renderSteps();
        this.showStepDetails(index);

        // 模拟执行时间
        const duration = step.duration || Math.random() * 1000 + 500;
        await new Promise(resolve => setTimeout(resolve, duration));

        step.status = 'completed';
        this.renderSteps();
    }

    /**
     * 显示步骤详情
     * 产品意义：展示步骤的详细信息
     */
    showStepDetails(index) {
        const detailsContainer = document.getElementById('workflow-details');
        if (!detailsContainer) return;

        const step = this.workflowSteps[index];
        const details = step.details;

        let html = `
            <div class="step-details">
                <h4>${step.name}</h4>
                <div class="detail-section">
                    <h5>描述</h5>
                    <p>${step.description}</p>
                </div>
        `;

        if (details && Object.keys(details).length > 0) {
            html += `
                <div class="detail-section">
                    <h5>详细信息</h5>
                    <ul>
            `;

            for (const [key, value] of Object.entries(details)) {
                html += `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`;
            }

            html += `
                    </ul>
                </div>
            `;
        }

        html += '</div>';
        detailsContainer.innerHTML = html;
    }

    /**
     * 重置工作流
     * 产品意义：将工作流恢复到初始状态
     */
    reset() {
        this.workflowSteps.forEach(step => {
            step.status = 'pending';
        });
        this.currentStep = 0;
        this.renderSteps();

        const detailsContainer = document.getElementById('workflow-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = '';
        }
    }

    /**
     * 导出工作流
     * 产品意义：将工作流导出为图片或文档
     */
    export() {
        const workflowData = {
            steps: this.workflowSteps,
            timestamp: new Date().toISOString()
        };

        const dataStr = JSON.stringify(workflowData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `workflow_${Date.now()}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * 加载工作流配置
     * 产品意义：从后端加载工作流配置
     */
    async loadWorkflow(workflowType) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/agent/workflow/${workflowType}`);
            const data = await response.json();

            if (data.success && data.workflow) {
                this.workflowSteps = data.workflow.steps;
                this.renderSteps();
            }
        } catch (error) {
            console.error('加载工作流失败:', error);
        }
    }

    /**
     * 创建分析Agent工作流
     * 产品意义：定义分析Agent的执行步骤
     */
    createAnalysisWorkflow() {
        this.workflowSteps = [
            {
                id: 'analyze_query',
                name: '分析查询',
                type: 'agent',
                description: '理解用户查询意图，提取关键信息',
                duration: 500,
                status: 'pending',
                details: {
                    input: '用户查询',
                    output: '查询意图和参数'
                }
            },
            {
                id: 'retrieve_memory',
                name: '检索记忆',
                type: 'rag',
                description: '从历史查询中查找相似案例',
                duration: 300,
                status: 'pending',
                details: {
                    source: 'ChromaDB',
                    method: '向量相似性搜索'
                }
            },
            {
                id: 'execute_analysis',
                name: '执行分析',
                type: 'analysis',
                description: '执行数据分析任务',
                duration: 1000,
                status: 'pending',
                details: {
                    methods: ['聚合', '筛选', '排序']
                }
            },
            {
                id: 'generate_insight',
                name: '生成洞察',
                type: 'llm',
                description: '基于分析结果生成智能洞察',
                duration: 800,
                status: 'pending',
                details: {
                    model: 'GPT-4',
                    temperature: 0.7
                }
            },
            {
                id: 'format_result',
                name: '格式化结果',
                type: 'process',
                description: '将结果格式化为用户友好的格式',
                duration: 200,
                status: 'pending',
                details: {
                    format: 'JSON/HTML'
                }
            }
        ];

        this.renderSteps();
    }

    /**
     * 创建图表Agent工作流
     * 产品意义：定义图表Agent的执行步骤
     */
    createChartWorkflow() {
        this.workflowSteps = [
            {
                id: 'understand_request',
                name: '理解需求',
                type: 'agent',
                description: '理解用户的可视化需求',
                duration: 400,
                status: 'pending',
                details: {
                    input: '用户描述',
                    output: '图表类型和配置'
                }
            },
            {
                id: 'prepare_data',
                name: '准备数据',
                type: 'database',
                description: '从数据源提取和转换数据',
                duration: 600,
                status: 'pending',
                details: {
                    operations: ['筛选', '聚合', '排序']
                }
            },
            {
                id: 'generate_chart',
                name: '生成图表',
                type: 'visualization',
                description: '根据配置生成可视化图表',
                duration: 800,
                status: 'pending',
                details: {
                    library: 'Chart.js',
                    chartTypes: ['柱状图', '折线图', '饼图']
                }
            },
            {
                id: 'optimize_layout',
                name: '优化布局',
                type: 'process',
                description: '优化图表的布局和样式',
                duration: 300,
                status: 'pending',
                details: {
                    aspects: ['颜色', '标签', '图例']
                }
            }
        ];

        this.renderSteps();
    }

    /**
     * 创建报告Agent工作流
     * 产品意义：定义报告Agent的执行步骤
     */
    createReportWorkflow() {
        this.workflowSteps = [
            {
                id: 'collect_data',
                name: '收集数据',
                type: 'database',
                description: '收集报告所需的所有数据',
                duration: 500,
                status: 'pending',
                details: {
                    sources: ['主数据', '统计数据', '图表数据']
                }
            },
            {
                id: 'analyze_data',
                name: '分析数据',
                type: 'analysis',
                description: '对收集的数据进行深度分析',
                duration: 1200,
                status: 'pending',
                details: {
                    techniques: ['趋势分析', '对比分析', '异常检测']
                }
            },
            {
                id: 'generate_content',
                name: '生成内容',
                type: 'llm',
                description: '使用大模型生成报告内容',
                duration: 1500,
                status: 'pending',
                details: {
                    sections: ['摘要', '分析', '结论', '建议']
                }
            },
            {
                id: 'format_report',
                name: '格式化报告',
                type: 'process',
                description: '将内容格式化为专业报告',
                duration: 400,
                status: 'pending',
                details: {
                    format: 'PDF/Word',
                    template: '企业报告模板'
                }
            }
        ];

        this.renderSteps();
    }
}

// 导出到全局作用域
window.AgentWorkflowVisualizer = AgentWorkflowVisualizer;
