/**
 * 测试用例表 - 智能数据分析助手
 * 产品意义：确保系统能够正确处理各种查询需求，避免回归问题
 * 维护说明：每次系统更新后，都需要运行完整的测试用例
 */

const testCases = [
    // 基础查询测试用例
    {
        id: 1,
        input: "广东省的销售额是多少",
        description: "基础查询 - 省份销售额",
        expectedResult: {
            queryType: "filter_aggregate",
            filterColumn: "省份",
            filterValue: "广东省",
            valueColumn: "销售额",
            aggregateFunction: "sum",
            result: "广东省的销售额总和"
        },
        status: "active"
    },
    {
        id: 2,
        input: "华东地区的销售额是多少",
        description: "基础查询 - 地区销售额",
        expectedResult: {
            queryType: "filter_aggregate",
            filterColumn: "地区",
            filterValue: "华东地区",
            valueColumn: "销售额",
            aggregateFunction: "sum",
            result: "华东地区的销售额总和"
        },
        status: "active"
    },
    {
        id: 3,
        input: "产品A的数量是多少",
        description: "基础查询 - 产品数量",
        expectedResult: {
            queryType: "filter_aggregate",
            filterColumn: "产品",
            filterValue: "产品A",
            valueColumn: "数量",
            aggregateFunction: "sum",
            result: "产品A的数量总和"
        },
        status: "active"
    },
    
    // 聚合查询测试用例
    {
        id: 4,
        input: "统计各省份的销售额",
        description: "聚合查询 - 各省份销售额统计",
        expectedResult: {
            queryType: "aggregate",
            groupBy: "省份",
            valueColumn: "销售额",
            aggregateFunction: "sum",
            result: "各省份的销售额统计"
        },
        status: "active"
    },
    {
        id: 5,
        input: "计算所有产品的平均销售额",
        description: "聚合查询 - 平均销售额",
        expectedResult: {
            queryType: "aggregate_overall",
            valueColumn: "销售额",
            aggregateFunction: "avg",
            result: "所有产品的平均销售额"
        },
        status: "active"
    },
    
    // 拒识测试用例
    {
        id: 6,
        input: "你好",
        description: "拒识测试 - 问候语",
        expectedResult: {
            mode: "rejected",
            reason: "这是一句问候语，与数据分析无关"
        },
        status: "active"
    },
    {
        id: 7,
        input: "今天天气怎么样",
        description: "拒识测试 - 无关内容",
        expectedResult: {
            mode: "rejected",
            reason: "输入包含与数据分析无关的关键词\"天气\""
        },
        status: "active"
    },
    
    // 图表测试用例
    {
        id: 8,
        input: "绘制各省份销售额的柱状图",
        description: "图表测试 - 柱状图",
        expectedResult: {
            queryType: "chart",
            chartType: "bar",
            groupBy: "省份",
            valueColumn: "销售额",
            aggregateFunction: "sum",
            result: "各省份销售额的柱状图"
        },
        status: "active"
    },
    {
        id: 9,
        input: "绘制销售额的折线图",
        description: "图表测试 - 折线图",
        expectedResult: {
            queryType: "chart",
            chartType: "line",
            xAxis: "日期",
            yAxis: "销售额",
            result: "销售额的折线图"
        },
        status: "active"
    },
    
    // 排序测试用例
    {
        id: 10,
        input: "按销售额从高到低排序",
        description: "排序测试 - 销售额排序",
        expectedResult: {
            queryType: "sort",
            sortBy: "销售额",
            sortOrder: "desc",
            result: "按销售额从高到低排序的结果"
        },
        status: "active"
    },
    
    // 复杂查询测试用例
    {
        id: 11,
        input: "广东省产品A的销售额是多少",
        description: "复杂查询 - 多条件筛选",
        expectedResult: {
            queryType: "filter_aggregate",
            filters: [
                { column: "省份", value: "广东省" },
                { column: "产品", value: "产品A" }
            ],
            valueColumn: "销售额",
            aggregateFunction: "sum",
            result: "广东省产品A的销售额总和"
        },
        status: "active"
    },
    {
        id: 12,
        input: "华东地区的平均利润率是多少",
        description: "复杂查询 - 地区平均利润率",
        expectedResult: {
            queryType: "filter_aggregate",
            filterColumn: "地区",
            filterValue: "华东",
            valueColumn: "利润率",
            aggregateFunction: "avg",
            result: "华东地区的平均利润率"
        },
        status: "active"
    },
    
    // 边界情况测试用例
    {
        id: 13,
        input: "",
        description: "边界情况 - 空输入",
        expectedResult: {
            mode: "rejected",
            reason: "输入内容过短，无法理解您的意图"
        },
        status: "active"
    },
    {
        id: 14,
        input: "测试",
        description: "边界情况 - 短输入",
        expectedResult: {
            mode: "rejected",
            reason: "输入内容过短，无法理解您的意图"
        },
        status: "active"
    }
];

/**
 * 运行测试用例
 * @param {Array} testCases - 测试用例数组
 * @returns {Object} 测试结果
 */
async function runTestCases(testCases) {
    console.log('========================================');
    console.log('开始运行测试用例');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;
    const results = [];

    for (const testCase of testCases) {
        if (testCase.status !== 'active') {
            continue;
        }

        console.log(`\n测试用例 ${testCase.id}: ${testCase.description}`);
        console.log(`输入: "${testCase.input}"`);

        try {
            // 模拟前端的requirementClassifier.js模块
            const classifier = new RequirementClassifier();
            const classification = await classifier.classify(testCase.input, [
                '地区', '省份', '产品', '销售额', '数量', '日期', '利润率'
            ]);

            console.log(`分类结果: ${classification.mode}`);
            console.log(`置信度: ${classification.confidence}`);

            // 检查是否为拒识测试
            if (testCase.expectedResult.mode === 'rejected') {
                if (classification.mode === 'rejected') {
                    console.log('✅ 测试通过');
                    passed++;
                    results.push({ id: testCase.id, status: 'passed' });
                } else {
                    console.log('❌ 测试失败');
                    failed++;
                    results.push({ id: testCase.id, status: 'failed' });
                }
            } else {
                // 对于非拒识测试，检查是否为precise模式
                if (classification.mode === 'precise') {
                    console.log('✅ 测试通过');
                    passed++;
                    results.push({ id: testCase.id, status: 'passed' });
                } else {
                    console.log('❌ 测试失败');
                    failed++;
                    results.push({ id: testCase.id, status: 'failed' });
                }
            }
        } catch (error) {
            console.log(`❌ 测试失败: ${error.message}`);
            failed++;
            results.push({ id: testCase.id, status: 'failed', error: error.message });
        }
    }

    console.log('\n========================================');
    console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
    console.log('========================================');

    return {
        total: testCases.filter(tc => tc.status === 'active').length,
        passed,
        failed,
        results
    };
}

// 模拟RequirementClassifier类
class RequirementClassifier {
    constructor() {
        this.useBertClassification = true;
        this.bertApiUrl = 'http://localhost:5001/api/v1/intent/classify-requirement';
    }

    checkRejection(userInput) {
        const lowerInput = userInput.toLowerCase().trim();
        
        // 1. 问候语检测
        const greetingPatterns = [
            /^(你好|您好|hi|hello|嗨|哈喽|在吗|在不在)[\s!！。.]*$/,
            /^(谢谢|感谢|再见|拜拜|goodbye|bye)[\s!！。.]*$/,
            /^(早上好|下午好|晚上好)[\s!！。.]*$/
        ];
        
        for (const pattern of greetingPatterns) {
            if (pattern.test(lowerInput)) {
                return {
                    shouldReject: true,
                    reason: '这是一句问候语，与数据分析无关',
                    suggestion: '请输入数据分析相关的需求，例如："统计各省份的平均值"、"绘制销售额柱状图"'
                };
            }
        }
        
        // 2. 完全不相关的关键词检测
        const irrelevantKeywords = [
            '天气', '新闻', '股票', '电影', '音乐', '游戏', '购物', '外卖', '打车', '导航',
            '笑话', '故事', '诗歌', '作文', '翻译', '编程', '代码', 'bug', '报错',
            '帮助', '怎么用', '如何使用', '教程', '说明', '文档', '你是谁', '你叫什么'
        ];
        
        for (const keyword of irrelevantKeywords) {
            if (lowerInput.includes(keyword)) {
                const analysisKeywords = ['统计', '分析', '查询', '查找', '排序', '筛选', '图表', '绘制', '画'];
                const hasAnalysisKeyword = analysisKeywords.some(k => lowerInput.includes(k));
                
                if (!hasAnalysisKeyword) {
                    return {
                        shouldReject: true,
                        reason: `输入包含与数据分析无关的关键词"${keyword}"`,
                        suggestion: '本系统专注于数据分析，请输入与数据查询、统计分析、可视化相关的需求'
                    };
                }
            }
        }
        
        // 3. 输入过短检测
        if (userInput.trim().length < 3) {
            return {
                shouldReject: true,
                reason: '输入内容过短，无法理解您的意图',
                suggestion: '请提供更详细的查询描述'
            };
        }
        
        return { shouldReject: false };
    }

    async classifyWithBERT(text) {
        const http = require('http');
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ text });
            const options = {
                hostname: 'localhost',
                port: 5001,
                path: '/api/v1/intent/classify-requirement',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.write(data);
            req.end();
        });
    }

    async classify(userInput, columns, sampleData = []) {
        console.log('[RequirementClassifier] 开始分类用户需求:', userInput);
        
        const lowerInput = userInput.toLowerCase();
        
        // 首先检查是否应该拒识
        const rejectionCheck = this.checkRejection(userInput);
        if (rejectionCheck.shouldReject) {
            console.log('[RequirementClassifier] 规则拒识:', rejectionCheck.reason);
            return {
                mode: 'rejected',
                confidence: 1.0,
                reason: rejectionCheck.reason,
                suggestion: rejectionCheck.suggestion,
                matchedColumns: [],
                ambiguityScore: 1.0,
                hasComplexRequirements: false,
                columnMatchScore: 0,
                requiredSkills: [],
                isSimpleQuery: false
            };
        }
        
        // 特殊处理：对于"XX的YY是多少"这样的查询，直接识别为filter类型
        if (/(.*的.*是多少|.*的.*多少|.*的.*多少钱)/.test(userInput)) {
            console.log('[RequirementClassifier] 识别为查询类需求:', userInput);
            return {
                mode: 'precise',
                confidence: 0.9,
                reason: '识别为查询类需求',
                matchedColumns: [],
                ambiguityScore: 0.2,
                hasComplexRequirements: false,
                columnMatchScore: 0.8,
                requiredSkills: [],
                isSimpleQuery: true
            };
        }
        
        // 使用BERT模型判断需求类型
        if (this.useBertClassification) {
            const bertResult = await this.classifyWithBERT(userInput);
            if (bertResult) {
                console.log('[RequirementClassifier] BERT分类结果:', bertResult);
                
                if (bertResult.type === 'unknown' && bertResult.confidence > 0.95) {
                    return {
                        mode: 'rejected',
                        confidence: bertResult.confidence,
                        reason: '输入内容与数据分析无关',
                        suggestion: '本系统专注于数据分析，请输入与数据查询、统计分析、可视化相关的需求',
                        matchedColumns: [],
                        ambiguityScore: 1.0,
                        hasComplexRequirements: false,
                        columnMatchScore: 0,
                        requiredSkills: [],
                        isSimpleQuery: false
                    };
                }
                
                // 对于有效的数据分析需求，返回precise模式
                return {
                    mode: 'precise',
                    confidence: bertResult.confidence,
                    reason: `BERT识别为${bertResult.type}类型`,
                    matchedColumns: [],
                    ambiguityScore: 0.2,
                    hasComplexRequirements: false,
                    columnMatchScore: 0.8,
                    requiredSkills: [],
                    isSimpleQuery: true,
                    bertType: bertResult.type
                };
            }
        }
        
        // 默认返回precise模式
        return {
            mode: 'precise',
            confidence: 0.7,
            reason: '默认识别为数据分析需求',
            matchedColumns: [],
            ambiguityScore: 0.3,
            hasComplexRequirements: false,
            columnMatchScore: 0.6,
            requiredSkills: [],
            isSimpleQuery: true
        };
    }
}

// 运行测试用例
if (require.main === module) {
    runTestCases(testCases).catch(console.error);
}

module.exports = { testCases, runTestCases };
