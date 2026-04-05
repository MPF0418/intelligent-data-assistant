# 智能数据洞察助手 - Windows桌面应用

## 功能特点
- 📊 智能数据可视化
- 🤖 本地意图识别
- 📈 数据分析工具
- 🔧 大模型API配置

## 系统要求
- Windows 10/11
- Python 3.8+
- 4GB+ 内存

## 安装说明
1. 运行 `智能数据洞察助手-setup.exe` 安装程序
2. 按照向导完成安装
3. 启动应用程序

## 配置说明
- 首次启动会自动启动Python API服务
- 大模型API配置位于 `config.js` 文件

## 开发说明
```bash
# 启动开发模式
npm start

# 构建安装包
npm run build:win

# 构建免安装版本
npm run build:win:portable
```

## 常见问题
1. **Python未找到** - 请安装Python 3.8或更高版本
2. **API服务启动失败** - 检查端口是否被占用
3. **大模型无响应** - 检查网络连接和API配置

## 版本历史
- v4.0.0 - 初始桌面应用版本