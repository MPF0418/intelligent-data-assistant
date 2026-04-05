// 测试排序检测正则表达式
const userInput = "绘制各省份的销售额柱状图，按照从高到低排序";
const lowerInput = userInput.toLowerCase();

console.log('输入:', userInput);
console.log('小写:', lowerInput);

// 降序模式（来自 conversationManager.js）
const descPatterns = [
    /从高到低|从大到小|降序|倒序|倒排|由高到低|由大到小/,
    /按.+?(降序|倒序|从高|从大到)/,
    /(最大|最高|最多).+?(优先|在前|排前)/,
];

let sortOrder = null;

// 检测排序方向
for (const pattern of descPatterns) {
    const matches = pattern.test(lowerInput);
    console.log(`正则 ${pattern} 匹配结果:`, matches);
    if (matches) {
        sortOrder = 'desc';
        break;
    }
}

console.log('最终 sortOrder:', sortOrder);

// 测试策略1：匹配"按{列名}排序"
const columns = ['地区', '省份', '产品', '销售额', '数量', '日期', '增长率'];
let sortBy = null;

if (lowerInput.includes('按')) {
    const anIndex = lowerInput.indexOf('按');
    const anzhaoIndex = lowerInput.indexOf('按照');
    const startIndex = anzhaoIndex !== -1 ? anzhaoIndex + 2 : anIndex + 1;
    const afterAn = lowerInput.substring(startIndex);
    
    console.log('"按"后面的文本:', afterAn);
    
    for (const col of columns) {
        const colLower = col.toLowerCase();
        if (afterAn.includes(colLower)) {
            const colIndex = afterAn.indexOf(colLower);
            const directionIndex = Math.min(
                afterAn.indexOf('从高') !== -1 ? afterAn.indexOf('从高') : Infinity,
                afterAn.indexOf('从低') !== -1 ? afterAn.indexOf('从低') : Infinity,
                afterAn.indexOf('降序') !== -1 ? afterAn.indexOf('降序') : Infinity,
                afterAn.indexOf('升序') !== -1 ? afterAn.indexOf('升序') : Infinity,
                afterAn.indexOf('大到') !== -1 ? afterAn.indexOf('大到') : Infinity,
                afterAn.indexOf('小到') !== -1 ? afterAn.indexOf('小到') : Infinity
            );
            
            console.log(`列名 ${col}: colIndex=${colIndex}, directionIndex=${directionIndex}`);
            
            if (colIndex !== -1 && (directionIndex === Infinity || colIndex < directionIndex)) {
                sortBy = col;
                console.log('找到排序字段:', sortBy);
                break;
            }
        }
    }
}

// 策略2：检查度量关键词
if (!sortBy) {
    const measureKeywords = ['销售额', '金额', '数值', '数量', '值', '总数', '总计'];
    for (const keyword of measureKeywords) {
        if (lowerInput.includes(keyword)) {
            for (const col of columns) {
                if (col.toLowerCase().includes(keyword) || keyword.includes(col.toLowerCase())) {
                    sortBy = col;
                    console.log('根据关键词找到排序字段:', sortBy);
                    break;
                }
            }
            if (sortBy) break;
        }
    }
}

console.log('最终 sortBy:', sortBy || 'value');
