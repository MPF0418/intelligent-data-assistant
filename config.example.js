// 配置文件示例
// 复制此文件为 config.js 并填入你的API密钥

const config = {
    ai: {
        // API密钥 - 请替换为你的实际API密钥
        apiKey: 'your-api-key-here',
        
        // API地址
        apiUrl: 'https://api.openai.com/v1',
        
        // 模型名称
        model: 'gpt-3.5-turbo',
        
        // 温度参数 (0-1，越高越创造性)
        temperature: 0.7,
        
        // 最大token数
        maxTokens: 2000
    }
};
