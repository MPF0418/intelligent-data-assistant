# -*- coding: utf-8 -*-
"""
V4.2统一API服务器
功能：合并意图识别、分析要素识别、需求分类等多个服务
产品意义：简化架构，减少端口占用，提高维护性

包含功能：
- 意图识别 (原端口5001)
- 分析要素识别 (原端口5002)
- 需求分类
- 配置生成
- 健康检查

特性：
- 模型热更新机制
- 统一日志管理
- 单端口服务 (5001)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import sys
import os
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ========== 模型管理器（支持热更新）==========
class ModelManager:
    """模型管理器 - 支持懒加载和热更新"""
    
    def __init__(self):
        self._models = {}
        self._load_times = {}
        self._lock = threading.RLock()
        self._model_paths = {
            'intent': './intent_model',
            'analysis_aggregate': './analysis_model/aggregate',
            'analysis_output': './analysis_model/output',
            'requirement': './requirement_model'
        }
    
    def get_model(self, name, loader_func):
        """获取模型（线程安全）"""
        with self._lock:
            if name not in self._models:
                logger.info(f"[ModelManager] 首次加载模型: {name}")
                self._models[name] = loader_func()
                self._load_times[name] = time.time()
            return self._models[name]
    
    def reload_model(self, name, loader_func):
        """重新加载模型"""
        with self._lock:
            logger.info(f"[ModelManager] 热更新模型: {name}")
            try:
                self._models[name] = loader_func()
                self._load_times[name] = time.time()
                logger.info(f"[ModelManager] 模型 {name} 更新成功")
                return True
            except Exception as e:
                logger.error(f"[ModelManager] 模型 {name} 更新失败: {e}")
                return False
    
    def get_model_info(self):
        """获取所有模型信息"""
        with self._lock:
            return {
                name: {
                    'loaded': name in self._models,
                    'load_time': self._load_times.get(name),
                    'path': self._model_paths.get(name)
                }
                for name in self._model_paths.keys()
            }

# 全局模型管理器
model_manager = ModelManager()

# ========== 模型加载函数 ==========
def load_intent_classifier():
    """加载意图识别模型"""
    from inference import IntentClassifier
    return IntentClassifier()

def load_analysis_classifier():
    """加载分析要素识别模型"""
    from analysis_inference import get_analysis_classifier
    return get_analysis_classifier()

def load_requirement_classifier():
    """加载需求分类模型"""
    from requirement_inference import get_requirement_classifier
    return get_requirement_classifier()

def load_column_matcher():
    """加载列名匹配器"""
    from column_matcher import get_column_matcher
    return get_column_matcher()

# ========== 热更新监听器 ==========
class ModelReloadHandler(FileSystemEventHandler):
    """模型文件变化监听器"""
    
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self.last_reload = {}
        self.cooldown = 5  # 冷却时间（秒）
    
    def on_modified(self, event):
        if event.is_directory:
            return
        
        # 检查是否是模型文件
        file_path = event.src_path
        current_time = time.time()
        
        # 模型文件映射
        model_mapping = {
            'intent_model': ('intent', load_intent_classifier),
            'analysis_model/aggregate': ('analysis_aggregate', load_analysis_classifier),
            'analysis_model/output': ('analysis_output', load_analysis_classifier),
            'requirement_model': ('requirement', load_requirement_classifier)
        }
        
        for path_key, (model_name, loader) in model_mapping.items():
            if path_key in file_path:
                # 检查冷却时间
                last_time = self.last_reload.get(model_name, 0)
                if current_time - last_time > self.cooldown:
                    logger.info(f"[HotReload] 检测到模型文件变化: {file_path}")
                    self.model_manager.reload_model(model_name, loader)
                    self.last_reload[model_name] = current_time
                break

# 启动热更新监听
def start_hot_reload():
    """启动热更新监听"""
    try:
        observer = Observer()
        handler = ModelReloadHandler(model_manager)
        
        # 监控模型目录
        model_dirs = ['./intent_model', './analysis_model', './requirement_model']
        for model_dir in model_dirs:
            if os.path.exists(model_dir):
                observer.schedule(handler, model_dir, recursive=True)
                logger.info(f"[HotReload] 监控目录: {model_dir}")
        
        observer.start()
        logger.info("[HotReload] 热更新机制已启动")
        return observer
    except Exception as e:
        logger.warning(f"[HotReload] 热更新启动失败: {e}")
        return None

# ========== API路由 ==========

@app.route('/', methods=['GET'])
def root():
    """根路径 - 服务信息"""
    return jsonify({
        'service': '智能数据洞察助手 - 统一API服务',
        'version': '4.2.0',
        'status': 'running',
        'features': [
            '意图识别',
            '分析要素识别',
            '需求分类',
            '配置生成',
            '模型热更新'
        ],
        'endpoints': {
            'health': '/api/health',
            'identify_intent': '/api/identify-intent',
            'analyze_elements': '/api/analyze-elements',
            'classify_requirement': '/api/classify-requirement',
            'generate_config': '/api/generate-config',
            'model_info': '/api/model-info',
            'reload_model': '/api/reload-model'
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'service': 'unified-api',
        'version': '4.2.0',
        'timestamp': time.time()
    })

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """获取模型信息"""
    return jsonify({
        'models': model_manager.get_model_info(),
        'hot_reload': True
    })

@app.route('/api/reload-model', methods=['POST'])
def reload_model():
    """手动重新加载模型"""
    data = request.get_json() or {}
    model_name = data.get('model')
    
    loaders = {
        'intent': load_intent_classifier,
        'analysis': load_analysis_classifier,
        'requirement': load_requirement_classifier
    }
    
    if model_name not in loaders:
        return jsonify({
            'error': f'未知模型: {model_name}',
            'available_models': list(loaders.keys())
        }), 400
    
    success = model_manager.reload_model(model_name, loaders[model_name])
    return jsonify({
        'success': success,
        'model': model_name,
        'timestamp': time.time()
    })

# ========== 意图识别API（原5001端口功能）==========

@app.route('/api/identify-intent', methods=['POST'])
def api_identify_intent():
    """意图识别接口"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': '缺少text参数'}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({'error': 'text不能为空'}), 400
        
        # 获取分类器（懒加载）
        clf = model_manager.get_model('intent', load_intent_classifier)
        
        # 预测意图
        result = clf.predict(text)
        
        logger.info(f"意图识别: '{text}' -> {result['intent']} ({result['confidence']:.2%})")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"意图识别失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch-identify', methods=['POST'])
def api_batch_identify():
    """批量意图识别"""
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({'error': '缺少texts参数'}), 400
        
        texts = data['texts']
        if not isinstance(texts, list):
            return jsonify({'error': 'texts必须是数组'}), 400
        
        clf = model_manager.get_model('intent', load_intent_classifier)
        results = []
        
        for text in texts:
            result = clf.predict(text)
            results.append({
                'text': text,
                'intent': result['intent'],
                'confidence': result['confidence']
            })
        
        return jsonify({
            'results': results,
            'count': len(results)
        })
    
    except Exception as e:
        logger.error(f"批量识别失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/intent-types', methods=['GET'])
def api_intent_types():
    """获取意图类型列表"""
    intent_types = {
        'QUERY_FIND': '查找特定数据（最大值、最小值、排名等）',
        'QUERY_AGGREGATE': '统计汇总（求和、计数、平均值等）',
        'QUERY_FILTER': '筛选过滤',
        'QUERY_SORT': '排序',
        'CHART_BAR': '柱状图',
        'CHART_LINE': '折线图',
        'CHART_PIE': '饼图',
        'CHART_SCATTER': '散点图',
        'PIVOT_TABLE': '数据透视表',
        'DATA_CLEAN': '数据清洗',
        'DATA_EXPORT': '数据导出'
    }
    return jsonify({'intent_types': intent_types})

# ========== 分析要素API（原5002端口功能）==========

@app.route('/api/analyze-elements', methods=['POST'])
def api_analyze_elements():
    """分析要素识别接口"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': '缺少text参数'}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({'error': 'text不能为空'}), 400
        
        clf = model_manager.get_model('analysis', load_analysis_classifier)
        result = clf.predict(text)
        
        logger.info(f"分析要素识别: '{text}' -> 聚合={result['aggregate_function']}, 输出={result['output_type']}")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"分析要素识别失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/aggregate-types', methods=['GET'])
def api_aggregate_types():
    """获取聚合函数类型"""
    return jsonify({
        'aggregate_types': {
            'sum': '求和，计算总和、合计、总计',
            'avg': '求平均，计算平均值、均值、人均',
            'max': '求最大值，找出最高值、峰值',
            'min': '求最小值，找出最低值、谷值',
            'count': '计数，统计数量、个数、频次',
            'median': '中位数，计算中间值',
            'std': '标准差，计算波动、离散程度',
            'distinct_count': '去重计数，统计不同值的数量'
        }
    })

@app.route('/api/output-types', methods=['GET'])
def api_output_types():
    """获取输出目标类型"""
    return jsonify({
        'output_types': {
            'chart_bar': '柱状图，用于对比分析',
            'chart_line': '折线图，用于趋势分析',
            'chart_pie': '饼图，用于占比分析',
            'chart_scatter': '散点图，用于相关性分析',
            'value': '数值输出，直接返回计算结果',
            'table': '表格输出，以表格形式展示数据'
        }
    })

# ========== 需求分类API ==========

@app.route('/api/classify-requirement', methods=['POST'])
def api_classify_requirement():
    """需求分类接口"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': '缺少text参数'}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({'error': 'text不能为空'}), 400
        
        clf = model_manager.get_model('requirement', load_requirement_classifier)
        result = clf.predict(text)
        
        logger.info(f"需求分类: '{text}' -> {result['label']} ({result['confidence']:.2%})")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"需求分类失败: {e}")
        return jsonify({'error': str(e)}), 500

# ========== 配置生成API ==========

# ========== V4.2: 内联配置生成函数（避免模块缓存问题）==========

def generate_config_unified(text, intent, columns, column_values=None):
    """
    V4.2统一配置生成函数
    产品意义：根据用户输入和数据列，生成查询或图表配置
    
    支持的模式：
    1. 筛选聚合：上海的销售额、华东地区的数量
    2. 分组统计：各省份的销售额、各产品的数量
    3. 图表配置：饼图、柱状图、折线图等
    
    V4.2关键改进：使用column_values智能匹配筛选列
    """
    import re
    
    if not text or not columns:
        return None
    
    text_lower = text.lower()
    
    # V4.2关键改进：如果提供了column_values，使用它来智能匹配筛选列
    # 例如：用户说"上海的销售额"，如果column_values中"省份"列包含"上海"，则筛选"省份"
    logger.info(f"[generate_config_unified] 接收到的column_values: {column_values}")
    
    if column_values:
        logger.info(f"[generate_config_unified] 进入V4.2智能匹配逻辑")
        
        # 从文本中提取可能的筛选值（简单的关键词提取）
        # 匹配模式：XX的YY、XX是YY、当XX是YY
        potential_values = []
        
        # 尝试匹配"XX的YY"模式
        match1 = re.search(r'(.+?)的', text)
        if match1:
            potential_values.append(match1.group(1).strip())
            logger.info(f"[generate_config_unified] 匹配到'XX的'模式: {match1.group(1).strip()}")
        
        # 尝试匹配"XX是YY"模式
        match2 = re.search(r'(.+?)是(.+?)(?:时|的|，|,)', text)
        if match2:
            potential_values.append(match2.group(2).strip())
            logger.info(f"[generate_config_unified] 匹配到'XX是YY'模式: {match2.group(2).strip()}")
        
        logger.info(f"[generate_config_unified] 潜在筛选值: {potential_values}")
        
        # 检查每个潜在值是否在column_values中
        for value in potential_values:
            for col_name, values in column_values.items():
                if value in values:
                    logger.info(f"[generate_config_unified] V4.2智能匹配：'{value}' 属于列 '{col_name}'")
                    # 找到了！现在需要找到数值列
                    # 简化处理：假设数值列是"销售额"或包含"额"、"金额"的列
                    value_col = None
                    for col in columns:
                        if '销售额' in col or '金额' in col or '数量' in col:
                            value_col = col
                            break
                    
                    if value_col:
                        return {
                            'queryType': 'filter_aggregate',
                            'filterColumn': col_name,
                            'filterValue': value,
                            'valueColumn': value_col,
                            'aggregateFunction': 'sum',
                            'title': f'{value}的{value_col}总和',
                            'description': f'筛选{col_name}包含"{value}"的数据，计算{value_col}的sum',
                            'intentType': 'QUERY_AGGREGATE',
                            'userInput': text
                        }
    
    # V4.2改进：检测筛选聚合模式
    # 支持模式：
    # 1. XX的YY是多少（上海的销售额）
    # 2. XX是YY时ZZ是多少（省份是上海时销售额）
    # 3. 当XX是YY时ZZ是多少（当省份是上海时销售额）
    
    filter_aggregate_match = None
    region = None
    value_desc = None
    region_col = None
    
    # 模式1: XX是YY时ZZ是多少（省份是上海时销售额是多少）
    # 关键改进：支持"列名=值"的显式筛选
    explicit_filter_match = re.search(r'(省份|地区|城市|产品|类别|类型)是(.+?)(?:时|的|，|,)?(.+?)(?:是)?(?:多少|总和|合计|平均值|有多少)', text)
    if explicit_filter_match:
        filter_aggregate_match = explicit_filter_match
        region_col = explicit_filter_match.group(1).strip()
        region = explicit_filter_match.group(2).strip()
        value_desc = explicit_filter_match.group(3).strip()
        logger.info(f"[generate_config_unified] V4.2显式筛选模式：{region_col}={region}，计算{value_desc}")
    
    # 模式2: XX的YY是多少（上海的销售额是多少）
    if not filter_aggregate_match:
        filter_aggregate_match = re.search(r'(华东|华南|华北|华中|西南|西北|东北|.+?)(?:地区)?的(.+?)(?:是)?(?:多少|总和|合计|平均值|有多少)', text)
        if filter_aggregate_match:
            region = filter_aggregate_match.group(1).strip()
            value_desc = filter_aggregate_match.group(2).strip()
    
    # 如果匹配到任何模式，处理配置生成
    if filter_aggregate_match and region and value_desc:
        # 找到数值列（语义匹配）
        value_col = None
        value_keywords = {
            '销售额': ['销售额', '金额', '收入'],
            '数量': ['数量', '个数', '计数'],
            '平均值': ['平均值', '均值', '平均']
        }
        
        for keyword, synonyms in value_keywords.items():
            if any(s in value_desc for s in synonyms):
                for col in columns:
                    if any(s in col for s in synonyms):
                        value_col = col
                        break
            if value_col:
                break
        
        # 如果没找到，尝试直接匹配
        if not value_col:
            for col in columns:
                if value_desc in col or col in value_desc:
                    value_col = col
                    break
        
        # V4.2关键改进：根据筛选值智能匹配列
        # 定义列类型和对应的值模式
        column_type_patterns = {
            '省份': ['上海', '北京', '广东', '浙江', '江苏', '山东', '河南', '河北', '湖南', '湖北', '四川', '福建', '安徽', '陕西', '辽宁', '江西', '云南', '贵州', '山西', '广西', '吉林', '甘肃', '海南', '青海', '宁夏', '西藏', '新疆', '内蒙古', '黑龙江', '天津', '重庆'],
            '省': ['上海', '北京', '广东', '浙江', '江苏', '山东', '河南', '河北', '湖南', '湖北', '四川', '福建', '安徽', '陕西', '辽宁', '江西', '云南', '贵州', '山西', '广西', '吉林', '甘肃', '海南', '青海', '宁夏', '西藏', '新疆', '内蒙古', '黑龙江', '天津', '重庆'],
            '城市': ['上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '武汉', '西安', '天津', '重庆'],
            '市': ['上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '武汉', '西安', '天津', '重庆'],
            '地区': ['华东', '华南', '华北', '华中', '西南', '西北', '东北']
        }
        
        # 智能匹配：根据筛选值找到最合适的列（仅在模式2时需要）
        if 'region_col' not in dir() or region_col is None:
            region_col = None
            for col_name, patterns in column_type_patterns.items():
                if col_name in columns and region in patterns:
                    region_col = col_name
                    logger.info(f"[generate_config_unified] V4.2智能匹配：'{region}' 匹配到列 '{col_name}'")
                    break
            
            # 如果没匹配到，按原来的逻辑查找
            if not region_col:
                region_col_candidates = ['地区', '省份', '省', '城市', '市', '区域', '大区']
                for candidate in region_col_candidates:
                    if candidate in columns:
                        region_col = candidate
                        logger.info(f"[generate_config_unified] V4.2默认匹配：使用列 '{candidate}'")
                        break
        
        if value_col and region_col:
            # 检测聚合函数类型
            agg_func = 'sum'  # 默认求和
            if '平均' in text or '均值' in text:
                agg_func = 'avg'
            elif '数量' in text or '个数' in text or '多少' in text:
                agg_func = 'count'
            
            logger.info(f"[generate_config_unified] V4.2生成配置：筛选{region_col}={region}，计算{value_col}的{agg_func}")
            return {
                'queryType': 'filter_aggregate',
                'filterColumn': region_col,
                'filterValue': region,
                'valueColumn': value_col,
                'aggregateFunction': agg_func,
                'title': f'{region}的{value_col}{"总和" if agg_func == "sum" else ("平均值" if agg_func == "avg" else "数量")}',
                'description': f'筛选{region_col}包含"{region}"的数据，计算{value_col}的{agg_func}',
                'intentType': 'QUERY_AGGREGATE',
                'userInput': text
            }
    
    # 其他配置生成逻辑...
    # 如果无法生成配置，返回None
    return None

@app.route('/api/generate-config', methods=['POST'])
def api_generate_config():
    """生成查询/图表配置"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': '缺少text参数'}), 400
        
        text = data['text'].strip()
        columns = data.get('columns', [])
        intent = data.get('intent')
        column_values = data.get('columnValues')  # V4.2新增：列的唯一值
        
        if not text:
            return jsonify({'error': 'text不能为空'}), 400
        
        # V4.2: 使用内联配置生成函数，传入列的唯一值
        config = generate_config_unified(text, intent, columns, column_values)
        
        if config:
            logger.info(f"配置生成成功: '{text}' -> {config.get('queryType') or config.get('chartType')}")
            return jsonify({
                'success': True,
                'config': config
            })
        else:
            return jsonify({
                'success': False,
                'message': '无法生成配置，需求可能不够明确'
            })
    
    except Exception as e:
        logger.error(f"配置生成失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ========== 主程序 ==========

if __name__ == '__main__':
    print("=" * 70)
    print("  智能数据洞察助手 - 统一API服务 (V4.2)")
    print("=" * 70)
    print()
    print("特性:")
    print("  • 单端口服务 (5001)")
    print("  • 模型热更新")
    print("  • 统一日志管理")
    print()
    print("包含功能:")
    print("  - 意图识别")
    print("  - 分析要素识别")
    print("  - 需求分类")
    print("  - 配置生成")
    print()
    print("API地址: http://localhost:5001")
    print("文档: http://localhost:5001/")
    print()
    print("=" * 70)
    print()
    
    # 启动热更新
    observer = start_hot_reload()
    
    try:
        # 启动Flask服务
        app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n正在停止服务...")
        if observer:
            observer.stop()
            observer.join()
        print("服务已停止")
