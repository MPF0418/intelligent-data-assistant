/**
 * 数据导出模块
 * 支持导出Excel、CSV格式
 */

const DataExporter = {
    /**
     * 导出为CSV文件
     * @param {Array} data - 数据数组
     * @param {string} filename - 文件名
     * @param {Object} options - 导出选项
     */
    exportToCSV(data, filename = 'data.csv', options = {}) {
        if (!data || data.length === 0) {
            console.warn('没有数据可导出');
            return;
        }
        
        const { columns = null, delimiter = ',', includeHeaders = true } = options;
        const exportColumns = columns || Object.keys(data[0]);
        
        // 构建CSV内容
        let csvContent = '';
        
        // 添加表头
        if (includeHeaders) {
            csvContent += exportColumns.map(col => this.escapeCSVField(col)).join(delimiter) + '\n';
        }
        
        // 添加数据行
        for (const row of data) {
            const values = exportColumns.map(col => {
                const value = row[col];
                return this.escapeCSVField(value);
            });
            csvContent += values.join(delimiter) + '\n';
        }
        
        // 添加BOM以支持中文
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        this.downloadBlob(blob, filename);
    },

    /**
     * 导出为Excel文件（xlsx格式）
     * 使用SheetJS库
     * @param {Array} data - 数据数组
     * @param {string} filename - 文件名
     * @param {Object} options - 导出选项
     */
    async exportToExcel(data, filename = 'data.xlsx', options = {}) {
        if (!data || data.length === 0) {
            console.warn('没有数据可导出');
            return;
        }
        
        const { 
            columns = null, 
            sheetName = 'Sheet1',
            includeHeaders = true,
            formatting = null
        } = options;
        
        const exportColumns = columns || Object.keys(data[0]);
        
        // 检查SheetJS是否可用
        if (typeof XLSX === 'undefined') {
            // 动态加载SheetJS
            await this.loadSheetJS();
        }
        
        // 构建工作表数据
        const wsData = [];
        
        // 添加表头
        if (includeHeaders) {
            wsData.push(exportColumns);
        }
        
        // 添加数据行
        for (const row of data) {
            const values = exportColumns.map(col => row[col]);
            wsData.push(values);
        }
        
        // 创建工作表
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // 设置列宽
        const colWidths = exportColumns.map(col => ({ wch: Math.max(col.length, 15) }));
        ws['!cols'] = colWidths;
        
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // 导出文件
        XLSX.writeFile(wb, filename);
    },

    /**
     * 导出查询结果为Excel
     * @param {Object} result - 查询结果对象
     * @param {string} filename - 文件名
     */
    async exportQueryResult(result, filename = 'query_result.xlsx') {
        const { data, query, stats } = result;
        
        // 检查SheetJS是否可用
        if (typeof XLSX === 'undefined') {
            await this.loadSheetJS();
        }
        
        const wb = XLSX.utils.book_new();
        
        // 添加数据Sheet
        if (data && data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, '数据');
        }
        
        // 添加统计信息Sheet
        if (stats) {
            const statsData = Object.entries(stats).map(([key, value]) => ({
                '统计项': key,
                '值': typeof value === 'object' ? JSON.stringify(value) : value
            }));
            const statsWs = XLSX.utils.json_to_sheet(statsData);
            XLSX.utils.book_append_sheet(wb, statsWs, '统计信息');
        }
        
        // 添加查询信息Sheet
        if (query) {
            const queryData = [
                { '项目': '查询语句', '内容': query }
            ];
            const queryWs = XLSX.utils.json_to_sheet(queryData);
            XLSX.utils.book_append_sheet(wb, queryWs, '查询信息');
        }
        
        XLSX.writeFile(wb, filename);
    },

    /**
     * 导出透视表为Excel
     * @param {Object} pivotResult - 透视表结果
     * @param {string} filename - 文件名
     */
    async exportPivotTable(pivotResult, filename = 'pivot_table.xlsx') {
        const { rowKeys, colKeys, data, rowTotals, colTotals, grandTotal, rows, cols } = pivotResult;
        
        // 检查SheetJS是否可用
        if (typeof XLSX === 'undefined') {
            await this.loadSheetJS();
        }
        
        // 构建透视表数据
        const wsData = [];
        
        // 表头行
        const headerRow = [rows.join(' / '), ...colKeys, '小计'];
        wsData.push(headerRow);
        
        // 数据行
        for (const rowKey of rowKeys) {
            const row = [rowKey];
            for (const colKey of colKeys) {
                const value = data[rowKey][colKey];
                row.push(typeof value === 'number' ? value : value || '-');
            }
            row.push(rowTotals[rowKey] || '-');
            wsData.push(row);
        }
        
        // 总计行
        const totalRow = ['总计'];
        for (const colKey of colKeys) {
            totalRow.push(colTotals[colKey] || '-');
        }
        totalRow.push(grandTotal || '-');
        wsData.push(totalRow);
        
        // 创建工作表
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // 设置样式（合并单元格等）
        ws['!cols'] = [{ wch: 20 }, ...colKeys.map(() => ({ wch: 15 })), { wch: 15 }];
        
        // 创建工作簿并导出
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '透视表');
        XLSX.writeFile(wb, filename);
    },

    /**
     * 导出图表为图片
     * @param {HTMLCanvasElement} canvas - 图表Canvas元素
     * @param {string} filename - 文件名
     */
    exportChartAsImage(canvas, filename = 'chart.png') {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    },

    /**
     * 导出图表为PDF
     * @param {HTMLCanvasElement} canvas - 图表Canvas元素
     * @param {string} filename - 文件名
     * @param {Object} options - PDF选项
     */
    async exportChartAsPDF(canvas, filename = 'chart.pdf', options = {}) {
        const { title = '', orientation = 'landscape' } = options;
        
        // 检查jsPDF是否可用
        if (typeof jspdf === 'undefined') {
            await this.loadJsPDF();
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4'
        });
        
        // 添加标题
        if (title) {
            doc.setFontSize(16);
            doc.text(title, 10, 15);
        }
        
        // 添加图表图片
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgHeight / imgWidth;
        
        const pdfWidth = doc.internal.pageSize.getWidth() - 20;
        const pdfHeight = pdfWidth * ratio;
        
        doc.addImage(imgData, 'PNG', 10, title ? 25 : 10, pdfWidth, pdfHeight);
        
        doc.save(filename);
    },

    /**
     * 转义CSV字段
     * @param {*} value - 字段值
     * @returns {string} 转义后的字符串
     */
    escapeCSVField(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        const str = String(value);
        
        // 如果包含逗号、引号或换行符，需要用引号包围并转义内部引号
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        
        return str;
    },

    /**
     * 下载Blob
     * @param {Blob} blob - Blob对象
     * @param {string} filename - 文件名
     */
    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    /**
     * 动态加载SheetJS库
     */
    async loadSheetJS() {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * 动态加载jsPDF库
     */
    async loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (typeof jspdf !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * 复制数据到剪贴板（表格格式）
     * @param {Array} data - 数据数组
     * @param {Array} columns - 列名数组
     */
    async copyToClipboard(data, columns = null) {
        if (!data || data.length === 0) {
            console.warn('没有数据可复制');
            return;
        }
        
        const exportColumns = columns || Object.keys(data[0]);
        
        // 构建制表符分隔的文本（可直接粘贴到Excel）
        let text = exportColumns.join('\t') + '\n';
        
        for (const row of data) {
            const values = exportColumns.map(col => {
                const value = row[col];
                return value !== null && value !== undefined ? String(value) : '';
            });
            text += values.join('\t') + '\n';
        }
        
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            return false;
        }
    },

    /**
     * 生成数据报告
     * @param {Object} analysisResult - 分析结果
     * @param {string} format - 格式：'html'|'markdown'|'text'
     * @returns {string} 报告内容
     */
    generateReport(analysisResult, format = 'html') {
        const { query, data, stats, chart } = analysisResult;
        
        if (format === 'html') {
            return this.generateHTMLReport(query, data, stats, chart);
        } else if (format === 'markdown') {
            return this.generateMarkdownReport(query, data, stats, chart);
        } else {
            return this.generateTextReport(query, data, stats, chart);
        }
    },

    /**
     * 生成HTML格式报告
     */
    generateHTMLReport(query, data, stats, chart) {
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>数据分析报告</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #667eea; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #667eea; color: white; }
        .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>数据分析报告</h1>
    <p><strong>查询:</strong> ${query}</p>
    <p><strong>生成时间:</strong> ${new Date().toLocaleString()}</p>
`;
        
        if (stats) {
            html += '<div class="stats"><h2>统计信息</h2><ul>';
            for (const [key, value] of Object.entries(stats)) {
                html += `<li><strong>${key}:</strong> ${value}</li>`;
            }
            html += '</ul></div>';
        }
        
        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            html += '<h2>数据预览</h2><table><thead><tr>';
            html += columns.map(col => `<th>${col}</th>`).join('');
            html += '</tr></thead><tbody>';
            
            for (const row of data.slice(0, 10)) {
                html += '<tr>';
                html += columns.map(col => `<td>${row[col] || ''}</td>`).join('');
                html += '</tr>';
            }
            
            html += '</tbody></table>';
            if (data.length > 10) {
                html += `<p>仅显示前10条，共${data.length}条数据</p>`;
            }
        }
        
        html += '</body></html>';
        return html;
    },

    /**
     * 生成Markdown格式报告
     */
    generateMarkdownReport(query, data, stats, chart) {
        let md = `# 数据分析报告\n\n`;
        md += `**查询:** ${query}\n\n`;
        md += `**生成时间:** ${new Date().toLocaleString()}\n\n`;
        
        if (stats) {
            md += `## 统计信息\n\n`;
            for (const [key, value] of Object.entries(stats)) {
                md += `- **${key}:** ${value}\n`;
            }
            md += '\n';
        }
        
        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            md += `## 数据预览\n\n`;
            md += `| ${columns.join(' | ')} |\n`;
            md += `| ${columns.map(() => '---').join(' | ')} |\n`;
            
            for (const row of data.slice(0, 10)) {
                md += `| ${columns.map(col => row[col] || '').join(' | ')} |\n`;
            }
        }
        
        return md;
    },

    /**
     * 生成纯文本格式报告
     */
    generateTextReport(query, data, stats, chart) {
        let text = `数据分析报告\n`;
        text += `${'='.repeat(50)}\n\n`;
        text += `查询: ${query}\n`;
        text += `生成时间: ${new Date().toLocaleString()}\n\n`;
        
        if (stats) {
            text += `统计信息:\n`;
            for (const [key, value] of Object.entries(stats)) {
                text += `  ${key}: ${value}\n`;
            }
            text += '\n';
        }
        
        if (data && data.length > 0) {
            text += `数据预览 (前10条):\n`;
            text += '-'.repeat(50) + '\n';
            
            const columns = Object.keys(data[0]);
            text += columns.join('\t') + '\n';
            
            for (const row of data.slice(0, 10)) {
                text += columns.map(col => row[col] || '').join('\t') + '\n';
            }
        }
        
        return text;
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataExporter;
}
