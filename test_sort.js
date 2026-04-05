// 测试改进后的排序正则表达式
const input = '绘制各省份的销售额柱状图，按照从高到低排序';
const lowerInput = input.toLowerCase();

console.log('输入:', input);
console.log('小写:', lowerInput);

// 模拟列名
const columns = ['地区', '省份', '产品', '销售额', '数量', '日期', '增长率'];

// 策略1：尝试匹配"按{列名}排序"或"按照{列名}排序"
// 先找出所有可能的列名位置
let sortBy = null;

// 检查是否包含"按"或"按照"
if (lowerInput.includes('按')) {
    // 找出"按"或"按照"的位置
    const anIndex = lowerInput.indexOf('按');
    const anzhaoIndex = lowerInput.indexOf('按照');
    const startIndex = anzhaoIndex !== -1 ? anzhaoIndex + 2 : anIndex + 1;
    
    // 提取"按"后面的文本（直到排序方向词）
    const afterAn = lowerInput.substring(startIndex);
    console.log('"按"后面的文本:', afterAn);
    
    // 尝试匹配列名
    for (const col of columns) {
        const colLower = col.toLowerCase();
        // 检查"按"后面是否跟着列名
        if (afterAn.includes(colLower)) {
            // 确保列名在排序方向词之前
            const colIndex = afterAn.indexOf(colLower);
            const directionIndex = Math.min(
                afterAn.indexOf('从高') !== -1 ? afterAn.indexOf('从高') : Infinity,
                afterAn.indexOf('从低') !== -1 ? afterAn.indexOf('从低') : Infinity,
                afterAn.indexOf('降序') !== -1 ? afterAn.indexOf('降序') : Infinity,
                afterAn.indexOf('升序') !== -1 ? afterAn.indexOf('升序') : Infinity
            );
            
            if (colIndex !== -1 && (directionIndex === Infinity || colIndex < directionIndex)) {
                sortBy = col;
                console.log('找到排序字段:', sortBy);
                break;
            }
        }
    }
}

// 如果没找到，默认按数值排序
if (!sortBy) {
    sortBy = 'value';
    console.log('默认按数值排序');
}

console.log('最终排序字段:', sortBy);
