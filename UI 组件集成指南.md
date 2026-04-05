# UI 组件集成指南

**文档版本**: V1.0  
**创建日期**: 2026-02-28  
**适用版本**: V3.0+

---

## 一、UI 组件概览

### 1.1 新增 UI 组件

| 组件名称 | 文件 | 功能描述 |
|----------|------|----------|
| 反馈组件 CSS | css/feedback-ui.css | 反馈区域、评分星星、Toast 提示等样式 |
| 反馈 UI 控制器 | js/feedbackUI.js | 管理反馈交互、错误报告查看器等 |
| 异常引导 CSS | css/error-guide-ui.css | 错误引导弹窗样式 |
| 异常引导 JS | js/errorGuideUI.js | 错误提示和引导交互 |

### 1.2 依赖关系

```
index.html
├── css/feedback-ui.css
├── css/error-guide-ui.css
├── js/chartRecommender.js
├── js/errorCollector.js
├── js/feedbackManager.js
├── js/dataPreprocessor.js
├── js/autoFixer.js
├── js/feedbackUI.js
└── js/errorGuideUI.js
```

---

## 二、集成步骤

### 步骤 1：在 index.html 中引入 CSS

在 `<head>` 标签中添加：

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智能数据洞察助手</title>
    
    <!-- 现有样式 -->
    <link rel="stylesheet" href="css/style.css">
    
    <!-- 【新增】V3.0 UI 组件样式 -->
    <link rel="stylesheet" href="css/feedback-ui.css">
    <link rel="stylesheet" href="css/error-guide-ui.css">
</head>
```

### 步骤 2：在 index.html 中引入 JS 模块

在 `<body>` 结束标签前添加：

```html
<body>
    <!-- 现有 HTML 内容 -->
    
    <!-- 【新增】V3.0 UI 组件脚本 -->
    <script type="module">
        // 导入核心模块
        import chartRecommender from './js/chartRecommender.js';
        import errorCollector from './js/errorCollector.js';
        import feedbackManager from './js/feedbackManager.js';
        import dataPreprocessor from './js/dataPreprocessor.js';
        import autoFixer from './js/autoFixer.js';
        
        // 导入 UI 组件
        import feedbackUI from './js/feedbackUI.js';
        import errorGuideUI from './js/errorGuideUI.js';
        
        // 挂载到全局对象
        window.chartRecommender = chartRecommender;
        window.errorCollector = errorCollector;
        window.feedbackManager = feedbackManager;
        window.dataPreprocessor = dataPreprocessor;
        window.autoFixer = autoFixer;
        window.feedbackUI = feedbackUI;
        window.errorGuideUI = errorGuideUI;
        
        // 初始化 UI 组件
        feedbackUI.init();
        
        // 启动自动修复（每 60 分钟）
        autoFixer.scheduleAutoFix(60);
        
        console.log('[系统] V3.0 UI 组件已初始化');
    </script>
</body>
```

### 步骤 3：在 script.js 中集成 UI 组件

#### 3.1 在查询处理函数中集成

```javascript
// script.js

// 全局当前查询
window.currentQuery = null;

async function handleUserInput(userInput) {
    try {
        // 显示加载状态
        showLoading(true);
        
        // 意图识别
        const intent = await intentRecognizer.recognize(userInput, {
            columns: headers,
            rowCount: data.length
        });
        
        // 保存当前查询
        window.currentQuery = {
            userInput,
            intent,
            timestamp: new Date().toISOString()
        };
        
        // 执行查询或图表生成
        if (intent.intent.startsWith('CHART_')) {
            await executeChartQuery(intent, userInput);
        } else {
            await executeQuery(intent, userInput);
        }
        
        // 【新增】通知反馈 UI 查询已完成
        window.feedbackUI.setCurrentQuery(window.currentQuery);
        
    } catch (error) {
        // 【新增】记录错误
        if (window.errorCollector) {
            window.errorCollector.record(error, {
                userInput: userInput,
                module: 'handleUserInput',
                action: 'process_request'
            });
        }
        
        // 【新增】显示错误引导弹窗
        if (window.errorGuideUI) {
            window.errorGuideUI.showErrorGuide(error, {
                userInput: userInput,
                module: 'handleUserInput'
            });
        } else {
            // 降级处理：简单错误提示
            showError(`处理失败：${error.message}`);
        }
        
    } finally {
        showLoading(false);
    }
}
```

#### 3.2 在图表生成函数中集成

```javascript
async function executeChartQuery(intent, userInput) {
    try {
        // ...现有代码...
        
        // 【新增】使用图表推荐器
        if (window.chartRecommender) {
            const dataInfo = {
                columns: headers,
                sampleData: data.slice(0, 10),
                rowCount: data.length
            };
            
            const recommendations = window.chartRecommender.recommend(
                dataInfo, 
                intent, 
                userInput
            );
            
            if (recommendations.length > 0) {
                const recommendedChartType = recommendations[0].chartType;
                console.log(`[推荐] 使用${recommendedChartType}图表：${recommendations[0].reason}`);
                
                // 如果原配置没有指定图表类型，使用推荐的
                if (chartConfigs[0].chartType === 'bar') {
                    chartConfigs[0].chartType = recommendedChartType;
                }
            }
        }
        
        // ...继续执行图表生成...
        
    } catch (error) {
        // 记录错误
        if (window.errorCollector) {
            window.errorCollector.record(error, {
                userInput: userInput,
                intent: intent,
                module: 'chartGenerator',
                action: 'executeChartQuery'
            });
        }
        throw error;
    }
}
```

#### 3.3 在数据查询函数中集成

```javascript
async function executeQuery(intent, userInput) {
    try {
        // ...现有代码获取数据...
        
        // 【新增】数据预处理
        if (window.dataPreprocessor) {
            const transformConfig = window.dataPreprocessor.inferTransformConfig(userInput, headers);
            
            if (transformConfig) {
                console.log('[预处理] 应用数据转换:', transformConfig);
                data = window.dataPreprocessor.transform(data, transformConfig, headers);
            }
        }
        
        // ...继续执行查询...
        
    } catch (error) {
        // 记录错误
        if (window.errorCollector) {
            window.errorCollector.record(error, {
                userInput: userInput,
                intent: intent,
                module: 'queryExecutor',
                action: 'executeQuery'
            });
        }
        throw error;
    }
}
```

### 步骤 4：设置错误引导回调

```javascript
// 在页面加载完成后设置回调
document.addEventListener('DOMContentLoaded', () => {
    // 设置重试回调
    window.errorGuideUI.setOnRetry(() => {
        console.log('[UI] 用户点击了重试');
        // 重新执行上一次查询
        if (window.currentQuery) {
            handleUserInput(window.currentQuery.userInput);
        }
    });
    
    // 设置反馈回调
    window.errorGuideUI.setOnFeedback(() => {
        console.log('[UI] 用户点击了反馈');
        // 打开反馈区域
        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) {
            feedbackSection.style.display = 'block';
        }
    });
});
```

---

## 三、完整示例

### index.html 完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智能数据洞察助手 V3.0</title>
    
    <!-- 基础样式 -->
    <link rel="stylesheet" href="css/style.css">
    
    <!-- V3.0 新增样式 -->
    <link rel="stylesheet" href="css/feedback-ui.css">
    <link rel="stylesheet" href="css/error-guide-ui.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 智能数据洞察助手 V3.0</h1>
        </header>
        
        <main>
            <!-- 数据上传区域 -->
            <section class="upload-section">
                <h2>1. 上传数据</h2>
                <input type="file" id="fileInput" accept=".csv,.xlsx,.xls">
            </section>
            
            <!-- 查询输入区域 -->
            <section class="query-section">
                <h2>2. 输入查询</h2>
                <input type="text" id="userInput" placeholder="请输入您的问题，例如：统计各省公司的平均金额">
                <button id="submitBtn">查询</button>
            </section>
            
            <!-- 结果展示区域 -->
            <section class="result-section">
                <h2>3. 查看结果</h2>
                <div id="queryResult" class="result-container">
                    <!-- 查询结果将在这里显示 -->
                </div>
            </section>
        </main>
    </div>
    
    <!-- V3.0 UI 组件脚本 -->
    <script type="module">
        // 导入核心模块
        import chartRecommender from './js/chartRecommender.js';
        import errorCollector from './js/errorCollector.js';
        import feedbackManager from './js/feedbackManager.js';
        import dataPreprocessor from './js/dataPreprocessor.js';
        import autoFixer from './js/autoFixer.js';
        
        // 导入 UI 组件
        import feedbackUI from './js/feedbackUI.js';
        import errorGuideUI from './js/errorGuideUI.js';
        
        // 挂载到全局
        window.chartRecommender = chartRecommender;
        window.errorCollector = errorCollector;
        window.feedbackManager = feedbackManager;
        window.dataPreprocessor = dataPreprocessor;
        window.autoFixer = autoFixer;
        window.feedbackUI = feedbackUI;
        window.errorGuideUI = errorGuideUI;
        
        // 初始化
        feedbackUI.init();
        autoFixer.scheduleAutoFix(60);
        
        console.log('[系统] V3.0 UI 组件已初始化');
    </script>
    
    <!-- 主程序脚本 -->
    <script src="js/script.js"></script>
</body>
</html>
```

---

## 四、UI 组件使用说明

### 4.1 反馈组件

**自动显示**：查询完成后，反馈区域会自动显示在查询结果下方

**手动控制**：
```javascript
// 显示反馈区域
window.feedbackUI.setCurrentQuery({
    userInput: '统计各省金额',
    intent: { intent: 'QUERY_AGGREGATE' }
});

// 隐藏反馈区域
window.feedbackUI.hideFeedbackSection();
```

### 4.2 错误引导弹窗

**自动显示**：查询失败时自动显示错误引导弹窗

**手动调用**：
```javascript
try {
    // 可能出错的代码
} catch (error) {
    window.errorGuideUI.showErrorGuide(error, {
        userInput: userInput,
        module: 'test'
    });
}
```

### 4.3 错误报告查看器

**打开方式**：点击右下角"🐛 错误报告"按钮

**功能**：
- 查看错误统计
- 查看错误列表
- 下载错误报告（JSON 格式）
- 清除已处理错误

### 4.4 自动修复功能

**打开方式**：点击右下角"🔧 一键修复"按钮

**功能**：
- 自动修复所有未处理错误
- 显示修复结果统计

---

## 五、自定义样式

### 修改主题色

```css
/* 在自定义 CSS 文件中覆盖 */
.feedback-section {
    background: linear-gradient(135deg, #your-color1 0%, #your-color2 100%);
}

.btn-primary {
    background: linear-gradient(135deg, #your-color1 0%, #your-color2 100%);
}
```

### 调整组件位置

```css
/* 调整管理员工具栏位置 */
.admin-tools {
    bottom: 30px;
    right: 30px;
}

/* 调整反馈区域位置 */
.feedback-section {
    margin-top: 30px;
}
```

---

## 六、常见问题

### Q1: UI 组件不显示？

**A**: 检查以下几点：
1. CSS 文件是否正确引入
2. JS 模块是否成功加载（查看控制台）
3. feedbackUI.init() 是否调用

### Q2: 点击按钮没有反应？

**A**: 检查事件绑定是否成功，在控制台查看是否有错误信息

### Q3: 弹窗无法关闭？

**A**: 检查关闭按钮的事件绑定，或手动调用 `errorGuideUI.closeErrorGuide()`

---

**文档结束**
