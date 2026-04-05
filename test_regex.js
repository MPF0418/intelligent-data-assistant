// 测试排序正则表达式
const userInput = "绘制各省份的销售额柱状图，按照从高到低排序";
const lowerInput = userInput.toLowerCase();

console.log('输入:', userInput);
console.log('小写:', lowerInput);

// 降序模式
const descPatterns = [
    /从高到低|从大到小|降序|倒序|倒排|由高到低|由大到小/,
    /按.+?(降序|倒序|从高|从大到)/,
    /(最大|最高|最多).+?(优先|在前|排前)/,
];

console.log('降序模式测试:');
descPatterns.forEach((pattern, i) => {
    const result = pattern.test(lowerInput);
    console.log(`  模式${i+1} ${pattern}: ${result}`);
});

// 测试第一个模式
const pattern1 = /从高到低|从大到小|降序|倒序|倒排|由高到低|由大到小/;
console.log('\n第一个模式详细测试:');
console.log('  pattern.test(lowerInput):', pattern1.test(lowerInput));
console.log('  lowerInput.includes("从高到低"):', lowerInput.includes('从高到低'));
