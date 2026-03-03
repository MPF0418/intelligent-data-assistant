# 智能数据洞察助手 (Intelligent Data Insight Assistant)

一款基于AI的自然语言数据分析可视化工具，让非技术用户也能轻松完成数据查询、分析、可视化等操作。

## 功能特性

### 核心功能
- **自然语言查询**: 用日常语言描述需求，AI自动理解并执行
- **智能绘图**: 自动生成柱状图、折线图、饼图等多种图表
- **数据筛选**: 支持多字段叠加筛选，灵活过滤数据
- **AI分析报告**: 自动生成数据分析报告，支持导出

### 技术亮点
- **三层意图识别架构**: 规则匹配 + 本地BERT模型 + 大模型API兜底
- **智能路由**: 根据需求特征自动选择精准模式或智能模式
- **实体提取与链接**: 从用户输入中提取实体并链接到数据列
- **大数据支持**: SQL.js数据库模式，支持百万级数据处理

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/your-username/intelligent-data-insight-assistant.git
cd intelligent-data-insight-assistant
```

### 2. 配置API密钥
复制配置示例文件并填入您的API密钥：
```bash
cp config.example.js config.js
```

编辑 `config.js`，填入您的AI API配置：
```javascript
const config = {
    ai: {
        apiKey: 'your-api-key',
        apiUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo'
    }
};
```

### 3. 启动应用
直接在浏览器中打开 `index.html` 即可使用。

或者使用本地服务器：
```bash
# 使用Python
python -m http.server 8080

# 使用Node.js
npx serve .
```

然后访问 `http://localhost:8080`

## 使用说明

### 数据上传
1. 点击上传区域或拖拽文件
2. 支持 CSV 和 Excel (.xlsx) 格式
3. 系统自动解析数据结构并预览

### 智能查询
输入自然语言查询，例如：
- "广东的销售额是多少"
- "统计各地区的平均工资"
- "工资最高的前5名是谁"
- "绘制销售额柱状图"

## 项目结构

```
├── index.html              # 主页面
├── styles.css              # 样式文件
├── script.js               # 主脚本文件
├── config.example.js       # 配置示例
├── js/                     # JavaScript模块
│   ├── intentRecognizer.js     # 意图识别器
│   ├── requirementClassifier.js # 需求分类器
│   ├── entityExtractor.js      # 实体提取器
│   ├── queryConfigGenerator.js # 查询配置生成器
│   └── dbManager.js            # 数据库管理器
├── skills/                 # 技能模块
│   ├── skillManager.js         # 技能管理器
│   ├── dataAnalysis.js         # 数据分析技能
│   └── chartGenerator.js       # 图表生成技能
├── docs/                   # 文档
│   ├── 架构变更说明_V4.0.md     # 架构变更说明
│   └── ...
└── PRD_智能数据洞察助手.md  # 产品需求文档
```

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (ES6+)
- **图表**: Chart.js
- **数据解析**: PapaParse (CSV) + SheetJS (Excel)
- **大数据**: SQL.js (SQLite WASM)
- **AI**: 本地BERT模型 + 大模型API

## 版本历史

- **V4.0** (2026-03-03): 实体提取与链接系统，路由问题修复
- **V3.0** (2026-03-01): 智能路由架构，需求分类器
- **V2.0** (2026-02-28): 三层意图识别，本地配置生成
- **V1.0** (2026-02-27): 初始版本

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
