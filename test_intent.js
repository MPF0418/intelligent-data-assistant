// 意图识别测试脚本
// 运行方式：在浏览器控制台中执行此脚本

// 导入意图识别器
import('./js/intentRecognizer.js').then(module => {
    const recognizer = module.default;
    
    console.log('='.repeat(60));
    console.log('意图识别功能测试');
    console.log('='.repeat(60));
    
    // 测试用例
    const testCases = [
        // 查找类
        '哪个省公司的销售额最高？',
        '找出金额最大的前10条记录',
        '谁的成绩最好',
        '排名第一的是谁',
        '最大值是多少',
        
        // 统计类
        '按地区统计事件数量',
        '计算平均值',
        '总共有多少条记录',
        '分组统计各部门人数',
        '汇总销售数据',
        
        // 筛选类
        '筛选出金额大于1000的记录',
        '只显示北京的数据',
        '过滤掉已删除的数据',
        '只要男性的数据',
        '排除测试数据',
        
        // 排序类
        '按时间排序',
        '从大到小排列',
        '升序排序',
        '按金额从高到低排序',
        
        // 图表类
        '绘制柱状图展示各省数据',
        '画一个折线图',
        '生成饼图',
        '可视化一下数据',
        '图表展示',
        
        // 组合类
        '按地区统计并绘制柱状图',
        '统计各部门人数并画饼图',
        '找出前10名并生成图表'
    ];
    
    console.log('\n测试结果：\n');
    
    let correctCount = 0;
    let totalResponseTime = 0;
    
    testCases.forEach((text, index) => {
        const result = recognizer.recognizeSync(text);
        totalResponseTime += result.responseTime;
        
        const isChart = recognizer.isChartIntent(result.intent);
        const intentType = isChart ? '图表' : '查询';
        
        console.log(`${index + 1}. "${text}"`);
        console.log(`   意图: ${result.intent} (${intentType})`);
        console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   响应时间: ${result.responseTime.toFixed(2)}ms`);
        console.log(`   匹配关键词: ${result.matchedKeywords.join(', ') || '无'}`);
        console.log('');
        
        if (result.confidence >= 0.5) {
            correctCount++;
        }
    });
    
    console.log('='.repeat(60));
    console.log('测试统计：');
    console.log(`总测试数: ${testCases.length}`);
    console.log(`高置信度数: ${correctCount}`);
    console.log(`平均响应时间: ${(totalResponseTime / testCases.length).toFixed(2)}ms`);
    console.log('='.repeat(60));
    
    // 意图分布统计
    const stats = recognizer.getIntentStats(testCases);
    console.log('\n意图分布：');
    Object.entries(stats).forEach(([intent, count]) => {
        console.log(`  ${intent}: ${count}次`);
    });
});
