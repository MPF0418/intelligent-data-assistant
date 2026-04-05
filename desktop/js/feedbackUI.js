// 反馈 UI 控制器 - 管理所有反馈相关的 UI 交互
// 产品意义：提供友好的用户反馈界面，收集用户意见以持续优化系统

class FeedbackUI {
    constructor() {
        this.currentQuery = null;
        this.isModalOpen = false;
        
        console.log('[FeedbackUI] 反馈 UI 控制器已初始化');
    }
    
    /**
     * 初始化反馈 UI
     * 在页面加载完成后调用
     */
    init() {
        this.createFeedbackSection();
        this.createAdminTools();
        this.createErrorReportModal();
        this.bindEvents();
        
        console.log('[FeedbackUI] UI 组件已创建');
    }
    
    /**
     * 创建反馈区域
     */
    createFeedbackSection() {
        // 查找查询结果容器
        const resultContainer = document.getElementById('queryResult') || 
                               document.querySelector('.result-container') ||
                               document.querySelector('#result');
        
        if (!resultContainer) {
            console.warn('[FeedbackUI] 未找到查询结果容器，跳过反馈区域创建');
            return;
        }
        
        // 创建反馈区域 HTML
        const feedbackHTML = `
            <div class="feedback-section" id="feedbackSection" style="display: none;">
                <div class="feedback-header">
                    <h4>反馈与评价</h4>
                </div>
                
                <div class="feedback-buttons">
                    <button class="btn-feedback-incorrect" id="btnFeedbackIncorrect" title="识别有误">
                        🚫 识别有误
                    </button>
                    
                    <div class="rating-group">
                        <span class="rating-label">满意度：</span>
                        <div class="star-rating">
                            <span class="star" data-score="1" title="非常不满意">⭐</span>
                            <span class="star" data-score="2" title="不满意">⭐</span>
                            <span class="star" data-score="3" title="一般">⭐</span>
                            <span class="star" data-score="4" title="满意">⭐</span>
                            <span class="star" data-score="5" title="非常满意">⭐</span>
                        </div>
                    </div>
                </div>
                
                <div class="suggestion-box">
                    <textarea 
                        id="suggestionText" 
                        placeholder="如果您有其他建议或意见，请在这里告诉我们..."
                    ></textarea>
                    <button class="btn-submit-suggestion" id="btnSubmitSuggestion">
                        ✉️ 提交建议
                    </button>
                </div>
            </div>
        `;
        
        // 插入到结果容器后面
        resultContainer.insertAdjacentHTML('afterend', feedbackHTML);
    }
    
    /**
     * 创建管理员工具栏
     * V3.0：在页面底部创建工具栏，包含错误报告、反馈统计、一键修复按钮
     */
    createAdminTools() {
        // 检查是否已存在管理员工具栏
        const existingAdminTools = document.getElementById('adminTools');
        if (existingAdminTools) {
            console.log('[FeedbackUI] 管理员工具栏已存在');
            return;
        }
        
        // 查找页脚区域
        const footerRight = document.querySelector('.footer-right');
        if (!footerRight) {
            console.warn('[FeedbackUI] 未找到页脚区域，跳过管理员工具栏创建');
            return;
        }
        
        // 在页脚中创建管理员工具栏
        const adminToolsHTML = `
            <div class="admin-tools" id="adminTools">
                <button class="footer-btn" id="btnErrorReport" title="查看错误报告">
                    <span class="icon">🐛</span> 错误报告
                </button>
                <button class="footer-btn" id="btnFeedbackReport" title="查看反馈统计">
                    <span class="icon">📊</span> 反馈统计
                </button>
                <button class="footer-btn" id="btnAutoFix" title="自动修复所有问题">
                    <span class="icon">🔧</span> 一键修复
                </button>
            </div>
        `;
        
        footerRight.insertAdjacentHTML('beforeend', adminToolsHTML);
        console.log('[FeedbackUI] 管理员工具栏已创建在页脚');
    }
    
    /**
     * 创建错误报告弹窗
     */
    createErrorReportModal() {
        const modalHTML = `
            <div id="errorReportModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🐛 错误报告</h3>
                        <button class="close-btn" id="btnCloseErrorModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="stats-grid" id="errorStats"></div>
                        <div id="errorListContainer">
                            <div class="empty-state">
                                <div class="empty-state-icon">📭</div>
                                <div class="empty-state-text">暂无错误记录</div>
                                <div class="empty-state-hint">系统运行良好</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="btnDownloadErrorReport">
                            📥 下载错误报告
                        </button>
                        <button class="btn btn-secondary" id="btnClearErrors">
                            🗑️ 清除已处理错误
                        </button>
                        <button class="btn btn-default" id="btnCloseErrorModal2">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 反馈有误按钮
        const btnFeedbackIncorrect = document.getElementById('btnFeedbackIncorrect');
        if (btnFeedbackIncorrect) {
            btnFeedbackIncorrect.addEventListener('click', () => this.handleFeedbackIncorrect());
        }
        
        // 评分星星
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('click', () => this.handleRating(star));
            star.addEventListener('mouseenter', () => this.handleStarHover(star));
            star.addEventListener('mouseleave', () => this.handleStarLeave());
        });
        
        // 提交建议按钮
        const btnSubmitSuggestion = document.getElementById('btnSubmitSuggestion');
        if (btnSubmitSuggestion) {
            btnSubmitSuggestion.addEventListener('click', () => this.handleSubmitSuggestion());
        }
        
        // 错误报告按钮
        const btnErrorReport = document.getElementById('btnErrorReport');
        if (btnErrorReport) {
            btnErrorReport.addEventListener('click', () => this.showErrorReport());
        }
        
        // 反馈统计按钮
        const btnFeedbackReport = document.getElementById('btnFeedbackReport');
        if (btnFeedbackReport) {
            btnFeedbackReport.addEventListener('click', () => this.showFeedbackReport());
        }
        
        // 一键修复按钮
        const btnAutoFix = document.getElementById('btnAutoFix');
        if (btnAutoFix) {
            btnAutoFix.addEventListener('click', () => this.handleAutoFix());
        }
        
        // 关闭弹窗按钮
        const btnCloseModal1 = document.getElementById('btnCloseErrorModal');
        const btnCloseModal2 = document.getElementById('btnCloseErrorModal2');
        if (btnCloseModal1) btnCloseModal1.addEventListener('click', () => this.closeErrorReportModal());
        if (btnCloseModal2) btnCloseModal2.addEventListener('click', () => this.closeErrorReportModal());
        
        // 点击弹窗外部关闭
        const modal = document.getElementById('errorReportModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeErrorReportModal();
                }
            });
        }
        
        // 下载错误报告
        const btnDownloadErrorReport = document.getElementById('btnDownloadErrorReport');
        if (btnDownloadErrorReport) {
            btnDownloadErrorReport.addEventListener('click', () => {
                if (window.errorCollector) {
                    window.errorCollector.downloadReport();
                    this.showToast('错误报告已下载');
                }
            });
        }
        
        // 清除已处理错误
        const btnClearErrors = document.getElementById('btnClearErrors');
        if (btnClearErrors) {
            btnClearErrors.addEventListener('click', () => this.handleClearErrors());
        }
    }
    
    /**
     * 处理"识别有误"反馈
     */
    async handleFeedbackIncorrect() {
        if (!this.currentQuery) {
            this.showToast('请先执行一次查询');
            return;
        }
        
        if (!window.feedbackManager) {
            this.showToast('反馈系统未初始化');
            return;
        }
        
        // 弹出对话框询问期望的意图
        const expectedIntent = prompt(
            '请描述您期望的操作（例如：筛选广东数据、统计各部门人数）：'
        );
        
        if (expectedIntent) {
            // 提交反馈
            window.feedbackManager.quickFeedbackIncorrect(
                this.currentQuery.userInput,
                this.currentQuery.intent,
                expectedIntent
            );
            
            this.showToast('感谢您的反馈！我们将持续改进');
        }
    }
    
    /**
     * 处理评分
     */
    handleRating(star) {
        if (!window.feedbackManager) {
            this.showToast('反馈系统未初始化');
            return;
        }
        
        const score = parseInt(star.dataset.score);
        
        // 提交评分
        window.feedbackManager.submitRating(score, 'query_accuracy');
        
        // 高亮选中的星星
        const stars = document.querySelectorAll('.star');
        stars.forEach((s, i) => {
            if (i < score) {
                s.classList.add('active');
                s.style.opacity = '1';
                s.style.filter = 'grayscale(0%)';
            } else {
                s.classList.remove('active');
                s.style.opacity = '0.5';
                s.style.filter = 'grayscale(100%)';
            }
        });
        
        // 显示感谢提示
        const messages = [
            '非常感谢您的评价！',
            '我们会继续努力！',
            '您的满意是我们的动力！',
            '感谢 5 星好评！',
            '太棒了！感谢您的支持！'
        ];
        this.showToast(messages[score - 1] || '感谢您的评价！');
    }
    
    /**
     * 处理星星悬停
     */
    handleStarHover(star) {
        const score = parseInt(star.dataset.score);
        const stars = document.querySelectorAll('.star');
        
        stars.forEach((s, i) => {
            if (i < score) {
                s.style.opacity = '0.8';
                s.style.filter = 'grayscale(0%)';
            }
        });
    }
    
    /**
     * 处理星星离开
     */
    handleStarLeave() {
        const stars = document.querySelectorAll('.star');
        const activeStars = document.querySelectorAll('.star.active');
        
        stars.forEach((s, i) => {
            if (activeStars[i]) {
                s.style.opacity = '1';
                s.style.filter = 'grayscale(0%)';
            } else {
                s.style.opacity = '0.5';
                s.style.filter = 'grayscale(100%)';
            }
        });
    }
    
    /**
     * 处理提交建议
     */
    handleSubmitSuggestion() {
        const suggestionText = document.getElementById('suggestionText');
        const text = suggestionText?.value.trim();
        
        if (!text) {
            this.showToast('请输入建议内容');
            return;
        }
        
        if (!window.feedbackManager) {
            this.showToast('反馈系统未初始化');
            return;
        }
        
        // 提交建议
        window.feedbackManager.submitSuggestion(text, 'general');
        
        // 清空输入框
        if (suggestionText) {
            suggestionText.value = '';
        }
        
        this.showToast('感谢您的建议！');
    }
    
    /**
     * 显示错误报告
     */
    showErrorReport() {
        if (!window.errorCollector) {
            this.showToast('错误收集器未初始化');
            return;
        }
        
        const modal = document.getElementById('errorReportModal');
        const statsContainer = document.getElementById('errorStats');
        const listContainer = document.getElementById('errorListContainer');
        
        if (!modal || !statsContainer || !listContainer) {
            console.error('[FeedbackUI] 弹窗元素不存在');
            return;
        }
        
        // 获取统计信息
        const stats = window.errorCollector.generateStatistics();
        
        // 显示统计
        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${stats.totalErrors || 0}</div>
                <div class="stat-label">总错误数</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.byType['COLUMN_ERROR'] || 0}</div>
                <div class="stat-label">列错误</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.byType['PARAM_ERROR'] || 0}</div>
                <div class="stat-label">参数错误</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${Object.keys(stats.byModule).length}</div>
                <div class="stat-label">涉及模块</div>
            </div>
        `;
        
        // 获取错误列表
        const errors = window.errorCollector.getAllErrors({ limit: 50 });
        
        if (errors.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-text">暂无错误记录</div>
                    <div class="empty-state-hint">系统运行良好</div>
                </div>
            `;
        } else {
            listContainer.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>类型</th>
                            <th>模块</th>
                            <th>错误信息</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${errors.map(error => `
                            <tr>
                                <td>${error.timestampFormatted || '未知'}</td>
                                <td>${error.type}</td>
                                <td>${error.context.module || '未知'}</td>
                                <td>${error.error.message}</td>
                                <td>
                                    ${error.isFixed ? 
                                        '<span class="badge badge-success">已修复</span>' : 
                                        error.isSubmitted ? 
                                        '<span class="badge badge-info">已提交</span>' : 
                                        '<span class="badge badge-warning">未处理</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        // 显示弹窗
        modal.style.display = 'flex';
        this.isModalOpen = true;
    }
    
    /**
     * 关闭错误报告弹窗
     */
    closeErrorReportModal() {
        const modal = document.getElementById('errorReportModal');
        if (modal) {
            modal.style.display = 'none';
            this.isModalOpen = false;
        }
    }
    
    /**
     * 显示反馈统计
     */
    showFeedbackReport() {
        if (!window.feedbackManager) {
            this.showToast('反馈管理器未初始化');
            return;
        }
        
        const stats = window.feedbackManager.generateStatistics();
        
        const message = `
反馈统计
========
总反馈：${stats.totalFeedback || 0}
平均评分：${stats.averageRating || '无'}

按类型：
${JSON.stringify(stats.byType, null, 2)}

按类别：
${JSON.stringify(stats.byCategory, null, 2)}
        `.trim();
        
        alert(message);
    }
    
    /**
     * 处理自动修复
     */
    async handleAutoFix() {
        if (!window.autoFixer) {
            this.showToast('自动修复器未初始化');
            return;
        }
        
        const btn = document.getElementById('btnAutoFix');
        if (!btn) return;
        
        // 禁用按钮
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> 修复中...';
        
        try {
            const results = await window.autoFixer.fixAll();
            const successCount = results.filter(r => r.success).length;
            
            this.showToast(`自动修复完成！成功：${successCount}，失败：${results.length - successCount}`);
        } catch (e) {
            this.showToast('自动修复失败：' + e.message);
        } finally {
            // 恢复按钮
            btn.disabled = false;
            btn.innerHTML = '🔧 一键修复';
        }
    }
    
    /**
     * 处理清除已处理错误
     */
    handleClearErrors() {
        if (!window.errorCollector) {
            this.showToast('错误收集器未初始化');
            return;
        }
        
        // 获取已提交的错误
        const errors = window.errorCollector.getAllErrors({ isSubmitted: true });
        const ids = errors.map(e => e.id);
        
        if (ids.length > 0) {
            if (confirm(`确定要清除 ${ids.length} 条已处理错误吗？`)) {
                window.errorCollector.clear(ids);
                this.showToast(`已清除 ${ids.length} 条已处理错误`);
                this.showErrorReport(); // 刷新显示
            }
        } else {
            this.showToast('没有可清除的已处理错误');
        }
    }
    
    /**
     * 显示 Toast 提示
     */
    showToast(message, duration = 3000) {
        // 移除已存在的 toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // 创建 toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }
    
    /**
     * 设置当前查询
     */
    setCurrentQuery(query) {
        this.currentQuery = query;
        
        // 显示反馈区域
        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) {
            feedbackSection.style.display = 'block';
        }
    }
    
    /**
     * 隐藏反馈区域
     */
    hideFeedbackSection() {
        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) {
            feedbackSection.style.display = 'none';
        }
    }
}

// 导出单例实例
const feedbackUI = new FeedbackUI();
export default feedbackUI;
