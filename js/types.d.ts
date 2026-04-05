/**
 * 智能数据分析助手 - TypeScript类型定义
 * 用于IDE代码提示和类型检查
 */

// ========== 数据类型 ==========

/** 数据行类型 */
interface DataRow {
    [key: string]: any;
}

/** 数据集类型 */
interface Dataset {
    data: DataRow[];
    columns: string[];
    rowCount: number;
}

// ========== 配置类型 ==========

/** 应用配置 */
interface AppConfig {
    ai: AIConfig;
    app: AppSettings;
}

interface AIConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    prompts?: AIPrompts;
}

interface AIPrompts {
    dataAnalysis?: string;
    dataSummary?: string;
    chartRecommendation?: string;
}

interface AppSettings {
    maxFileSize?: number;
    supportedFormats?: string[];
}

/** 查询配置 */
interface QueryConfig {
    intentType: string;
    queryType: QueryType;
    valueColumn?: string;
    groupColumn?: string;
    filterColumn?: string;
    filterValue?: string;
    filterValues?: string[];
    aggregateFunction?: AggregateFunction;
    limit?: number;
    order?: 'asc' | 'desc';
    rank?: number;
    title?: string;
    description?: string;
}

type QueryType = 
    | 'find_max' 
    | 'find_min' 
    | 'find_top' 
    | 'find_rank'
    | 'aggregate_overall'
    | 'aggregate_groupby'
    | 'aggregate_filter'
    | 'filter_aggregate'
    | 'filter_people'
    | 'filter'
    | 'sort';

type AggregateFunction = 'avg' | 'sum' | 'count' | 'max' | 'min';

/** 图表配置 */
interface ChartConfig {
    chartType: ChartType;
    xAxisColumn?: string;
    yAxisColumn?: string;
    labelColumn?: string;
    valueColumn?: string;
    aggregateFunction?: AggregateFunction;
    title?: string;
    description?: string;
    sortOrder?: 'asc' | 'desc';
    dataTransform?: DataTransform;
    isOverall?: boolean;
}

type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';

// ========== 意图识别类型 ==========

/** 意图识别结果 */
interface IntentResult {
    intent: IntentType;
    confidence: number;
    method: IntentMethod;
    description?: string;
    responseTime?: number;
    isRejected?: boolean;
    rejectionReason?: string;
    suggestion?: string;
}

type IntentType = 
    | 'QUERY_FIND'
    | 'QUERY_AGGREGATE'
    | 'QUERY_FILTER'
    | 'QUERY_SORT'
    | 'CHART_BAR'
    | 'CHART_LINE'
    | 'CHART_PIE'
    | 'CHART_SCATTER'
    | 'CHART_GENERAL';

type IntentMethod = 'rule' | 'local_model' | 'llm_fallback' | 'default';

// ========== 实体提取类型 ==========

/** 实体提取结果 */
interface EntityExtractionResult {
    columns: ExtractedColumn[];
    filters: ExtractedFilter[];
    unknown: ExtractedEntity[];
}

interface ExtractedColumn {
    text: string;
    type: string;
    position: number;
    matchedColumn: string;
}

interface ExtractedFilter {
    text: string;
    type: string;
    position: number;
    linkedColumn: string | null;
    linkedValue: string;
    matchCount: number;
    confidence: number;
}

interface ExtractedEntity {
    text: string;
    type: string;
    position: number;
}

interface DataTransform {
    formula?: string;
    decimalPlaces?: number;
    unitConversion?: { from: string; to: string };
}

// ========== 需求分类类型 ==========

/** 需求分类结果 */
interface ClassificationResult {
    mode: 'precise' | 'intelligent' | 'rejected';
    confidence: number;
    reason: string;
    suggestion?: string;
    matchedColumns: MatchedColumn[];
    ambiguityScore: number;
    hasComplexRequirements: boolean;
    columnMatchScore: number;
    requiredSkills: RequiredSkill[];
    isSimpleQuery: boolean;
    entityExtraction?: EntityExtractionResult;
    hasHighConfidenceFilter?: boolean;
}

interface MatchedColumn {
    column: string;
    matchType: 'exact' | 'partial';
}

interface RequiredSkill {
    name: string;
    priority: number;
    reason: string;
}

// ========== 路由决策类型 ==========

/** Agent路由决策 */
interface RouteDecision {
    shouldUseAgent: boolean;
    skipAgentForQueryType?: string[];
    reason?: string;
}

// ========== 日志类型 ==========

/** 处理日志条目 */
interface LogEntry {
    timestamp: string;
    type: LogType;
    message: string;
    details?: string;
}

type LogType = 'info' | 'success' | 'error' | 'warning' | 'performance' | 'command';

// ========== 数据画像类型 ==========

/** 数据画像 */
interface DataProfile {
    shape: { rows: number; cols: number };
    columns: Record<string, ColumnProfile>;
    schema: SchemaProfile;
    quality: QualityProfile;
    summary: string;
}

interface ColumnProfile {
    name: string;
    type: 'numeric' | 'text' | 'datetime' | 'categorical';
    uniqueCount: number;
    nullCount: number;
}

interface SchemaProfile {
    numericCols: string[];
    textCols: string[];
    dateCols: string[];
    categoricalCols: string[];
}

interface QualityProfile {
    completeness: number;
    grade: 'A' | 'B' | 'C';
}

// ========== 错误类型 ==========

/** 应用错误 */
interface AppError {
    code: string;
    message: string;
    severity: 'error' | 'warn' | 'info';
    details?: any;
    timestamp: string;
}

// 导出所有类型到全局
window.AppTypes = {
    // Data
    DataRow,
    Dataset,
    
    // Config
    AppConfig,
    AIConfig,
    QueryConfig,
    ChartConfig,
    
    // Intent
    IntentResult,
    IntentType,
    IntentMethod,
    
    // Entity
    EntityExtractionResult,
    ExtractedFilter,
    DataTransform,
    
    // Classification
    ClassificationResult,
    RequiredSkill,
    
    // Route
    RouteDecision,
    
    // Log
    LogEntry,
    LogType,
    
    // Profile
    DataProfile,
    ColumnProfile,
    
    // Error
    AppError
};

export default window.AppTypes;
