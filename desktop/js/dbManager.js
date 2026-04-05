// SQL.js 数据库管理模块
// 功能：在浏览器中使用SQLite进行高效数据查询

class DatabaseManager {
    constructor() {
        this.db = null;
        this.SQL = null;
        this.tableName = 'data';
        this.isInitialized = false;
        this.rowCount = 0;
    }
    
    // 初始化SQL.js
    async init() {
        if (this.isInitialized) {
            return true;
        }
        
        try {
            // 动态加载SQL.js
            const sqlJsUrl = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
            
            // 加载SQL.js脚本
            if (typeof window.initSqlJs === 'undefined') {
                await this.loadScript(sqlJsUrl);
            }
            
            // 初始化SQL.js
            this.SQL = await window.initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });
            
            // 创建数据库
            this.db = new this.SQL.Database();
            this.isInitialized = true;
            
            console.log('SQL.js 数据库初始化成功');
            return true;
        } catch (error) {
            console.error('SQL.js 初始化失败:', error);
            return false;
        }
    }
    
    // 动态加载脚本
    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // 从数据数组创建表
    async createTableFromData(data, headers) {
        if (!this.isInitialized) {
            await this.init();
        }
        
        if (!data || data.length === 0) {
            throw new Error('数据为空');
        }
        
        try {
            // 删除旧表
            this.db.run(`DROP TABLE IF EXISTS ${this.tableName}`);
            
            // 处理重复列名 - 为重复的列添加序号后缀
            const uniqueHeaders = [];
            const headerCount = {};
            
            for (const header of headers) {
                let uniqueHeader = header;
                if (headerCount[header]) {
                    // 如果列名已存在，添加序号后缀
                    let suffix = 1;
                    while (headerCount[`${header}_${suffix}`]) {
                        suffix++;
                    }
                    uniqueHeader = `${header}_${suffix}`;
                }
                headerCount[uniqueHeader] = true;
                uniqueHeaders.push(uniqueHeader);
            }
            
            // 如果有重复列名，记录日志
            if (uniqueHeaders.length !== headers.length) {
                console.warn('检测到重复列名，已自动重命名:', 
                    headers.filter((h, i) => h !== uniqueHeaders[i])
                        .map((h, i) => `${h} -> ${uniqueHeaders[headers.indexOf(h)]}`)
                );
            }
            
            // 生成建表SQL
            const columns = uniqueHeaders.map(header => {
                // 使用TEXT类型存储所有数据，避免类型转换问题
                return `"${header}" TEXT`;
            });
            
            const createTableSQL = `CREATE TABLE ${this.tableName} (${columns.join(', ')})`;
            console.log('建表SQL:', createTableSQL);
            this.db.run(createTableSQL);
            
            // 创建原始列名到唯一列名的映射
            const headerMapping = {};
            headers.forEach((h, i) => {
                headerMapping[uniqueHeaders[i]] = h;
            });
            
            // 批量插入数据 - 使用唯一列名
            const placeholders = uniqueHeaders.map(() => '?').join(', ');
            const insertSQL = `INSERT INTO ${this.tableName} VALUES (${placeholders})`;
            
            // 使用事务提升性能
            this.db.run('BEGIN TRANSACTION');
            
            const stmt = this.db.prepare(insertSQL);
            for (const row of data) {
                const values = uniqueHeaders.map((uniqueHeader, index) => {
                    // 使用原始列名从数据中获取值
                    const originalHeader = headers[index];
                    const value = row[originalHeader];
                    if (value === null || value === undefined) {
                        return '';
                    }
                    return String(value);
                });
                stmt.run(values);
            }
            stmt.free();
            
            this.db.run('COMMIT');
            
            this.rowCount = data.length;
            
            // 创建索引
            this.createIndexes(headers);
            
            console.log(`数据表创建成功，共 ${this.rowCount} 行`);
            return true;
        } catch (error) {
            console.error('创建数据表失败:', error);
            throw error;
        }
    }
    
    // 创建索引
    createIndexes(headers) {
        // 为前几列创建索引
        const indexColumns = headers.slice(0, 5);
        for (const column of indexColumns) {
            try {
                const indexName = `idx_${column.replace(/[^a-zA-Z0-9]/g, '_')}`;
                this.db.run(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${this.tableName}("${column}")`);
            } catch (error) {
                console.warn(`创建索引失败 (${column}):`, error);
            }
        }
    }
    
    // 执行SQL查询
    executeQuery(sql) {
        if (!this.isInitialized || !this.db) {
            throw new Error('数据库未初始化');
        }
        
        try {
            const startTime = performance.now();
            const result = this.db.exec(sql);
            const endTime = performance.now();
            
            console.log(`SQL执行耗时: ${(endTime - startTime).toFixed(2)}ms`);
            
            if (result.length === 0) {
                return { columns: [], values: [] };
            }
            
            return {
                columns: result[0].columns,
                values: result[0].values
            };
        } catch (error) {
            console.error('SQL执行失败:', error);
            throw error;
        }
    }
    
    // 将查询结果转换为对象数组
    queryResultToObjects(result) {
        if (!result.columns || result.columns.length === 0) {
            return [];
        }
        
        return result.values.map(row => {
            const obj = {};
            result.columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });
    }
    
    // 筛选数据
    filterData(conditions) {
        const whereClauses = [];
        
        for (const [column, condition] of Object.entries(conditions)) {
            if (typeof condition === 'object') {
                // 复杂条件 {op: '>', value: 100}
                const { op, value } = condition;
                whereClauses.push(`"${column}" ${op} '${value}'`);
            } else {
                // 简单条件，等于
                whereClauses.push(`"${column}" = '${condition}'`);
            }
        }
        
        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const sql = `SELECT * FROM ${this.tableName} ${whereSQL}`;
        
        const result = this.executeQuery(sql);
        return this.queryResultToObjects(result);
    }
    
    // 聚合统计
    aggregateData(config) {
        const { groupBy, aggregations, filter } = config;
        
        let selectClauses = [];
        
        if (groupBy) {
            selectClauses.push(`"${groupBy}"`);
        }
        
        for (const agg of aggregations) {
            const { column, func, alias } = agg;
            const funcSQL = func.toUpperCase() === 'COUNT' && !column ? 'COUNT(*)' : `${func.toUpperCase()}("${column}")`;
            selectClauses.push(`${funcSQL} AS ${alias || `${func}_${column}`}`);
        }
        
        const whereSQL = filter ? `WHERE ${filter}` : '';
        const groupBySQL = groupBy ? `GROUP BY "${groupBy}"` : '';
        
        const sql = `SELECT ${selectClauses.join(', ')} FROM ${this.tableName} ${whereSQL} ${groupBySQL}`;
        
        const result = this.executeQuery(sql);
        return this.queryResultToObjects(result);
    }
    
    // 排序数据
    sortData(column, direction = 'ASC', limit = null) {
        const limitSQL = limit ? `LIMIT ${limit}` : '';
        const sql = `SELECT * FROM ${this.tableName} ORDER BY "${column}" ${direction.toUpperCase()} ${limitSQL}`;
        
        const result = this.executeQuery(sql);
        return this.queryResultToObjects(result);
    }
    
    // 分页查询
    paginateData(page = 1, pageSize = 10, orderBy = null, direction = 'ASC') {
        const offset = (page - 1) * pageSize;
        const orderSQL = orderBy ? `ORDER BY "${orderBy}" ${direction.toUpperCase()}` : '';
        
        const sql = `SELECT * FROM ${this.tableName} ${orderSQL} LIMIT ${pageSize} OFFSET ${offset}`;
        const result = this.executeQuery(sql);
        
        // 获取总数
        const countResult = this.executeQuery(`SELECT COUNT(*) as total FROM ${this.tableName}`);
        const total = countResult.values[0][0];
        
        return {
            data: this.queryResultToObjects(result),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    }
    
    // 查找极值
    findExtreme(column, type = 'max') {
        const func = type === 'max' ? 'MAX' : 'MIN';
        const sql = `SELECT * FROM ${this.tableName} WHERE "${column}" = (SELECT ${func}("${column}") FROM ${this.tableName})`;
        
        const result = this.executeQuery(sql);
        return this.queryResultToObjects(result);
    }
    
    // 获取统计信息
    getStats(columns) {
        const stats = {};
        
        for (const column of columns) {
            const sql = `
                SELECT 
                    COUNT(*) as count,
                    COUNT(DISTINCT "${column}") as unique_count,
                    COUNT(CASE WHEN "${column}" = '' OR "${column}" IS NULL THEN 1 END) as null_count
                FROM ${this.tableName}
            `;
            
            const result = this.executeQuery(sql);
            const row = result.values[0];
            
            stats[column] = {
                count: row[0],
                uniqueCount: row[1],
                nullCount: row[2]
            };
            
            // 尝试数值统计
            try {
                const numSQL = `
                    SELECT 
                        AVG(CAST("${column}" AS REAL)) as avg,
                        MIN(CAST("${column}" AS REAL)) as min,
                        MAX(CAST("${column}" AS REAL)) as max,
                        SUM(CAST("${column}" AS REAL)) as sum
                    FROM ${this.tableName}
                    WHERE "${column}" != '' AND typeof(CAST("${column}" AS REAL)) = 'real'
                `;
                const numResult = this.executeQuery(numSQL);
                if (numResult.values[0][0] !== null) {
                    stats[column].numeric = true;
                    stats[column].avg = numResult.values[0][0];
                    stats[column].min = numResult.values[0][1];
                    stats[column].max = numResult.values[0][2];
                    stats[column].sum = numResult.values[0][3];
                }
            } catch (e) {
                stats[column].numeric = false;
            }
        }
        
        return stats;
    }
    
    // 关闭数据库
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
    
    // 获取数据库状态
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            rowCount: this.rowCount,
            tableName: this.tableName
        };
    }
}

// 导出单例实例
const dbManager = new DatabaseManager();
export default dbManager;
