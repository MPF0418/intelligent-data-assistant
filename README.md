# 智能数据洞察助手

基于AI的数据分析可视化工具，支持自然语言查询、智能绘图、数据筛选等功能。

## 功能特性

- 📊 **数据上传**：支持 CSV 和 Excel (.xlsx) 文件
- 🤖 **智能查询**：使用自然语言查询数据，AI自动理解意图
- 📈 **智能绘图**：通过自然语言描述生成图表（柱状图、折线图、饼图等）
- 🔍 **数据筛选**：支持多字段叠加筛选
- 📄 **AI分析报告**：生成数据分析报告并支持导出
- 📝 **处理日志**：详细的处理过程记录和性能统计

## 快速开始

1. 克隆仓库
```bash
git clone https://github.com/yourusername/data-insight-assistant.git
cd data-insight-assistant
```

2. 配置API密钥
```bash
cp config.example.js config.js
# 编辑 config.js，填入你的 OpenAI API 密钥
```

3. 启动本地服务器
```bash
# 使用 Python
python -m http.server 8000

# 或使用 Node.js
npx serve .
```

4. 打开浏览器访问 `http://localhost:8000`

## 配置说明

编辑 `config.js` 文件配置AI服务：

```javascript
const config = {
    ai: {
        apiKey: 'your-api-key-here',  // 你的API密钥
        apiUrl: 'https://api.openai.com/v1',  // API地址
        model: 'gpt-3.5-turbo',  // 模型名称
        temperature: 0.7,  // 温度参数
        maxTokens: 2000  // 最大token数
    }
};
```

## 使用指南

### 1. 上传数据
点击上传区域或拖拽文件到上传区域，支持 CSV 和 Excel 格式。

### 2. 智能查询
在"智能查询与可视化"输入框中输入自然语言查询，例如：
- "哪个省公司的险情确认时长最长？"
- "统计各个省公司的平均处理时长"
- "找出处理时间超过30天的事件"

### 3. 智能绘图
输入绘图需求，AI会自动生成图表：
- "按省公司统计事件数量并绘制柱状图"
- "绘制各类事件的饼图"
- "按时间趋势绘制折线图"

### 4. 数据筛选
使用"数据筛选"区域添加多个筛选条件，支持：
- 等于、不等于
- 大于、小于、大于等于、小于等于
- 包含

### 5. 查看处理日志
点击"查看处理日志"按钮，可以查看：
- AI处理过程记录
- 查询/绘图命令执行过程
- 性能统计（各环节耗时）

## 技术栈

- 纯前端实现（HTML + CSS + JavaScript）
- Chart.js 用于图表绘制
- PapaParse 用于CSV解析
- SheetJS 用于Excel解析

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 许可证

MIT License
