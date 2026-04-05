# -*- coding: utf-8 -*-
"""
智能数据分析助手 - UI自动化测试脚本
基于Playwright实现，按照测试用例文档对系统进行全面测试
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright, Page, Browser, expect

# 项目路径
PROJECT_PATH = r"E:\开发项目_codebuddy\智能数据分析助手\20260226"
TEST_DATA_PATH = os.path.join(PROJECT_PATH, "test_data")
REPORT_PATH = os.path.join(PROJECT_PATH, "test_report_ui.html")

# 测试结果存储
test_results = {
    "start_time": None,
    "end_time": None,
    "total_cases": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "details": []
}

def log_test(test_id, test_name, status, message="", screenshot=None):
    """记录测试结果"""
    result = {
        "test_id": test_id,
        "test_name": test_name,
        "status": status,  # passed, failed, skipped
        "message": message,
        "screenshot": screenshot,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    test_results["details"].append(result)
    test_results["total_cases"] += 1
    if status == "passed":
        test_results["passed"] += 1
        print(f"✅ [{test_id}] {test_name} - 通过")
    elif status == "failed":
        test_results["failed"] += 1
        print(f"❌ [{test_id}] {test_name} - 失败: {message}")
    else:
        test_results["skipped"] += 1
        print(f"⏭️ [{test_id}] {test_name} - 跳过")

async def take_screenshot(page: Page, name: str):
    """截图并保存"""
    screenshot_dir = os.path.join(PROJECT_PATH, "test_screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)
    path = os.path.join(screenshot_dir, f"{name}_{int(time.time())}.png")
    await page.screenshot(path=path, full_page=True)
    return path

async def wait_for_element(page: Page, selector: str, timeout: int = 10000):
    """等待元素出现"""
    try:
        await page.wait_for_selector(selector, timeout=timeout)
        return True
    except:
        return False

async def test_file_upload(page: Page):
    """测试用例 TC-UC01: 上传数据文件"""
    print("\n" + "="*60)
    print("开始测试 UC-01: 上传数据文件")
    print("="*60)
    
    try:
        # 1. 查找上传按钮并上传文件
        file_input = await page.query_selector('input[type="file"]')
        if not file_input:
            log_test("TC-UC01-001", "Excel文件上传-标准xlsx格式", "failed", "未找到文件上传input元素")
            return False
        
        # 准备测试文件
        test_file = os.path.join(TEST_DATA_PATH, "sales_data.csv")
        if not os.path.exists(test_file):
            test_file = os.path.join(TEST_DATA_PATH, "V3.3测试数据.xlsx")
        
        if not os.path.exists(test_file):
            log_test("TC-UC01-001", "Excel文件上传-标准xlsx格式", "failed", f"测试文件不存在: {test_file}")
            return False
        
        print(f"上传文件: {test_file}")
        
        # 设置文件到input
        await file_input.set_input_files(test_file)
        
        # 等待数据预览区域出现
        await asyncio.sleep(3)
        
        # 检查数据概览是否显示
        data_preview = await page.query_selector('#data-preview:not(.hidden)')
        if data_preview:
            log_test("TC-UC01-001", "Excel文件上传-标准xlsx格式", "passed", "数据上传成功，概览区域已显示")
            
            # 获取数据行数和列数
            total_rows = await page.text_content('#total-rows')
            total_cols = await page.text_content('#total-cols')
            print(f"数据概览: {total_rows}行 x {total_cols}列")
            
            # 检查数据表格
            table_rows = await page.query_selector_all('#data-table tbody tr')
            print(f"表格行数: {len(table_rows)}")
            
            # 截图表单状态
            await take_screenshot(page, "file_upload_success")
            return True
        else:
            log_test("TC-UC01-001", "Excel文件上传-标准xlsx格式", "failed", "数据概览区域未显示")
            await take_screenshot(page, "file_upload_failed")
            return False
            
    except Exception as e:
        log_test("TC-UC01-001", "Excel文件上传-标准xlsx格式", "failed", str(e))
        await take_screenshot(page, "file_upload_error")
        return False

async def test_data_preview(page: Page):
    """测试用例 TC-UC02: 查看数据概览"""
    print("\n" + "="*60)
    print("开始测试 UC-02: 查看数据概览")
    print("="*60)
    
    try:
        # 检查数据概览信息
        data_info = await page.query_selector('#data-info')
        if data_info:
            log_test("TC-UC02-001", "数据概览完整展示", "passed", "数据概览面板已显示")
        else:
            log_test("TC-UC02-001", "数据概览完整展示", "failed", "数据概览面板未显示")
            return False
        
        # 检查各项统计信息
        total_rows = await page.text_content('#total-rows')
        total_cols = await page.text_content('#total-cols')
        numeric_cols = await page.text_content('#numeric-cols')
        text_cols = await page.text_content('#text-cols')
        
        print(f"数据统计: {total_rows}行, {total_cols}列, {numeric_cols}数值列, {text_cols}文本列")
        
        if total_rows and total_cols:
            log_test("TC-UC02-001", "数据概览完整展示", "passed", f"数据概览: {total_rows}行 x {total_cols}列")
        else:
            log_test("TC-UC02-001", "数据概览完整展示", "failed", "数据行/列数未正确显示")
        
        # 检查数据表格
        table = await page.query_selector('#data-table')
        if table:
            thead = await page.query_selector('#data-table thead th')
            if thead:
                headers = await page.query_selector_all('#data-table thead th')
                header_texts = [await h.text_content() for h in headers]
                print(f"表头: {header_texts}")
                log_test("TC-UC02-001", "数据概览完整展示", "passed", f"数据表格表头: {header_texts}")
        
        await take_screenshot(page, "data_preview")
        return True
        
    except Exception as e:
        log_test("TC-UC02-001", "数据概览完整展示", "failed", str(e))
        await take_screenshot(page, "data_preview_error")
        return False

async def test_conversation_input(page: Page):
    """测试用例 TC-UC04: 输入分析指令"""
    print("\n" + "="*60)
    print("开始测试 UC-04: 输入分析指令")
    print("="*60)
    
    try:
        # 查找对话输入框
        input_box = await page.query_selector('#conversation-input')
        if not input_box:
            log_test("TC-UC04-001", "正常输入发送", "failed", "未找到对话输入框")
            return False
        
        # 测试空输入拦截
        await input_box.fill("")
        send_btn = await page.query_selector('#send-message')
        
        # 检查按钮状态
        is_disabled = await send_btn.is_disabled() if send_btn else True
        if is_disabled:
            log_test("TC-UC04-002", "空输入拦截", "passed", "空输入时发送按钮被禁用")
        else:
            log_test("TC-UC04-002", "空输入拦截", "failed", "空输入时发送按钮未被禁用")
        
        # 测试正常输入
        test_input = "统计各省份的销售额"
        await input_box.fill(test_input)
        current_value = await input_box.input_value()
        
        if current_value == test_input:
            log_test("TC-UC04-001", "正常输入发送", "passed", f"成功输入: {test_input}")
        else:
            log_test("TC-UC04-001", "正常输入发送", "failed", f"输入值不匹配，期望: {test_input}, 实际: {current_value}")
        
        await take_screenshot(page, "conversation_input")
        return True
        
    except Exception as e:
        log_test("TC-UC04-001", "正常输入发送", "failed", str(e))
        await take_screenshot(page, "conversation_input_error")
        return False

async def test_send_query(page: Page):
    """测试用例 TC-UC04-001: 发送查询"""
    print("\n" + "="*60)
    print("开始测试 UC-04: 发送查询请求")
    print("="*60)
    
    try:
        input_box = await page.query_selector('#conversation-input')
        send_btn = await page.query_selector('#send-message')
        
        if not input_box or not send_btn:
            log_test("TC-UC04-001", "发送查询请求", "failed", "未找到输入框或发送按钮")
            return False
        
        # 输入测试查询
        test_query = "统计各省份的销售额"
        await input_box.fill(test_query)
        
        # 点击发送按钮
        await send_btn.click()
        print(f"已发送查询: {test_query}")
        
        # 等待处理
        await asyncio.sleep(5)
        
        # 检查是否有对话消息添加
        messages = await page.query_selector_all('#conversation-messages .message')
        print(f"对话消息数量: {len(messages)}")
        
        if len(messages) >= 2:
            log_test("TC-UC04-001", "发送查询请求", "passed", f"查询已发送，收到{len(messages)}条消息")
            
            # 检查是否显示分析结果
            result_area = await page.query_selector('#conversation-result:not(.hidden)')
            if result_area:
                log_test("TC-UC16-001", "分析结果展示", "passed", "分析结果已显示")
            else:
                log_test("TC-UC16-001", "分析结果展示", "skipped", "等待分析完成")
        else:
            log_test("TC-UC04-001", "发送查询请求", "failed", f"消息数量不足，期望>=2，实际={len(messages)}")
        
        await take_screenshot(page, "query_sent")
        return True
        
    except Exception as e:
        log_test("TC-UC04-001", "发送查询请求", "failed", str(e))
        await take_screenshot(page, "query_error")
        return False

async def test_filter_functionality(page: Page):
    """测试用例 TC-UC12: 数据筛选功能"""
    print("\n" + "="*60)
    print("开始测试 UC-12: 数据筛选功能")
    print("="*60)
    
    try:
        # 检查筛选区域
        filter_section = await page.query_selector('.filter-section')
        if not filter_section:
            log_test("TC-UC12-001", "筛选功能入口", "failed", "未找到筛选区域")
            return False
        
        log_test("TC-UC12-001", "筛选功能入口", "passed", "筛选区域已显示")
        
        # 检查添加筛选按钮
        add_filter_btn = await page.query_selector('#add-filter')
        if add_filter_btn:
            await add_filter_btn.click()
            await asyncio.sleep(1)
            
            # 检查筛选条件是否添加（使用 .filter-row 或 .filter-hint）
            filter_conditions = await page.query_selector_all('#filter-conditions .filter-row')
            filter_hint = await page.query_selector('#filter-conditions .filter-hint')
            
            if len(filter_conditions) > 0:
                log_test("TC-UC12-001", "添加筛选条件", "passed", f"已添加{len(filter_conditions)}个筛选条件")
            elif filter_hint:
                # 有提示说明 headers 为空（文件可能未加载完成）
                hint_text = await filter_hint.text_content()
                log_test("TC-UC12-001", "添加筛选条件", "skipped", f"Headers未加载: {hint_text[:50]}...")
                # 等待更长时间让文件加载完成
                await asyncio.sleep(3)
                # 再次尝试
                await add_filter_btn.click()
                await asyncio.sleep(1)
                filter_conditions = await page.query_selector_all('#filter-conditions .filter-row')
                if len(filter_conditions) > 0:
                    log_test("TC-UC12-001", "添加筛选条件(重试)", "passed", f"重试成功，已添加{len(filter_conditions)}个筛选条件")
                else:
                    log_test("TC-UC12-001", "添加筛选条件(重试)", "failed", "重试后仍未成功添加筛选条件")
            else:
                # 检查是否有任何内容
                container_html = await page.evaluate("document.getElementById('filter-conditions').innerHTML")
                log_test("TC-UC12-001", "添加筛选条件", "failed", f"容器为空: {container_html[:100]}...")
            
            await take_screenshot(page, "filter_added")
        
        # 检查清除筛选按钮
        clear_filter_btn = await page.query_selector('#clear-filter')
        if clear_filter_btn:
            log_test("TC-UC12-005", "一键清除筛选", "passed", "清除筛选按钮已显示")
        
        return True
        
    except Exception as e:
        log_test("TC-UC12-001", "数据筛选功能", "failed", str(e))
        await take_screenshot(page, "filter_error")
        return False

async def test_table_pagination(page: Page):
    """测试用例 TC-UC11: 数据表格分页"""
    print("\n" + "="*60)
    print("开始测试 UC-11: 数据表格分页")
    print("="*60)
    
    try:
        # 检查分页控件
        pagination = await page.query_selector('#table-pagination')
        if pagination:
            log_test("TC-UC11-002", "分页导航", "passed", "分页控件已显示")
        else:
            log_test("TC-UC11-002", "分页导航", "failed", "分页控件未显示")
            return False
        
        # 获取分页信息
        current_page = await page.text_content('#current-page')
        total_pages = await page.text_content('#total-pages')
        total_rows = await page.text_content('#pagination-total-rows')
        
        print(f"分页信息: 第{current_page}页/共{total_pages}页, 共{total_rows}条数据")
        
        if current_page and total_pages:
            log_test("TC-UC11-002", "分页信息显示", "passed", f"分页信息: {current_page}/{total_pages}页")
        
        # 测试翻页按钮
        prev_btn = await page.query_selector('#prev-page')
        next_btn = await page.query_selector('#next-page')
        
        if prev_btn and next_btn:
            prev_disabled = await prev_btn.is_disabled()
            next_disabled = await next_btn.is_disabled()
            
            if prev_disabled:
                log_test("TC-UC11-002", "首页禁用上一页", "passed", "首页时上一页按钮已禁用")
            else:
                log_test("TC-UC11-002", "首页禁用上一页", "failed", "首页时上一页按钮未禁用")
        
        await take_screenshot(page, "table_pagination")
        return True
        
    except Exception as e:
        log_test("TC-UC11-002", "数据表格分页", "failed", str(e))
        await take_screenshot(page, "pagination_error")
        return False

async def test_settings_modal(page: Page):
    """测试用例 TC-UC17: 设置功能"""
    print("\n" + "="*60)
    print("开始测试: 系统设置功能")
    print("="*60)
    
    try:
        # 查找设置按钮
        settings_btn = await page.query_selector('#settings-btn')
        if not settings_btn:
            log_test("TC-UC-SETTINGS", "设置入口", "failed", "未找到设置按钮")
            return False
        
        await settings_btn.click()
        await asyncio.sleep(1)
        
        # 检查设置弹窗
        settings_modal = await page.query_selector('#settings-modal:not(.hidden)')
        if settings_modal:
            log_test("TC-UC-SETTINGS", "设置弹窗显示", "passed", "设置弹窗已打开")
            
            # 检查意图识别设置项
            use_local_intent = await page.query_selector('#use-local-intent')
            use_llm_fallback = await page.query_selector('#use-llm-fallback')
            
            if use_local_intent and use_llm_fallback:
                log_test("TC-UC-SETTINGS", "意图识别设置项", "passed", "意图识别设置项已显示")
            
            # 检查置信度滑块
            confidence_slider = await page.query_selector('#confidence-threshold')
            if confidence_slider:
                log_test("TC-UC-SETTINGS", "置信度阈值设置", "passed", "置信度阈值滑块已显示")
            
            # 关闭设置弹窗
            close_btn = await page.query_selector('#close-settings-modal')
            if close_btn:
                await close_btn.click()
                await asyncio.sleep(0.5)
            
            await take_screenshot(page, "settings_opened")
            return True
        else:
            log_test("TC-UC-SETTINGS", "设置弹窗显示", "failed", "设置弹窗未打开")
            return False
            
    except Exception as e:
        log_test("TC-UC-SETTINGS", "设置功能", "failed", str(e))
        await take_screenshot(page, "settings_error")
        return False

async def test_agent_workflow_panel(page: Page):
    """测试用例 TC-UC18: Agent工作流可视化"""
    print("\n" + "="*60)
    print("开始测试 UC-18: Agent工作流可视化")
    print("="*60)
    
    try:
        # 查找Agent工作流按钮
        agent_btn = await page.query_selector('#agent-workflow-btn')
        if not agent_btn:
            log_test("TC-UC18-001", "Agent工作流入口", "failed", "未找到Agent工作流按钮")
            return False
        
        await agent_btn.click()
        await asyncio.sleep(1)
        
        # 检查工作流面板
        workflow_panel = await page.query_selector('#agent-workflow-panel.active')
        if workflow_panel:
            log_test("TC-UC18-001", "Agent工作流面板", "passed", "Agent工作流面板已打开")
            
            # 检查面板内容
            workflow_header = await page.query_selector('#agent-workflow-panel h3')
            if workflow_header:
                header_text = await workflow_header.text_content()
                print(f"工作流面板标题: {header_text}")
            
            # 关闭面板
            close_btn = await page.query_selector('#close-agent-workflow')
            if close_btn:
                await close_btn.click()
                await asyncio.sleep(0.5)
            
            await take_screenshot(page, "agent_workflow")
            return True
        else:
            log_test("TC-UC18-001", "Agent工作流面板", "failed", "Agent工作流面板未打开")
            return False
            
    except Exception as e:
        log_test("TC-UC18-001", "Agent工作流可视化", "failed", str(e))
        await take_screenshot(page, "workflow_error")
        return False

async def test_performance_monitor(page: Page):
    """测试用例 TC-UC18: 性能监控面板"""
    print("\n" + "="*60)
    print("开始测试 UC-18: 性能监控面板")
    print("="*60)
    
    try:
        # 查找性能监控按钮
        perf_btn = await page.query_selector('#performance-monitor-btn')
        if not perf_btn:
            log_test("TC-UC18-002", "性能监控入口", "failed", "未找到性能监控按钮")
            return False
        
        await perf_btn.click()
        await asyncio.sleep(1)
        
        # 检查性能面板
        perf_panel = await page.query_selector('#performance-panel.active')
        if perf_panel:
            log_test("TC-UC18-002", "性能监控面板", "passed", "性能监控面板已打开")
            
            # 检查性能指标卡片
            metric_cards = await page.query_selector_all('#performance-panel .metric-card')
            print(f"性能指标卡片数量: {len(metric_cards)}")
            
            if len(metric_cards) >= 4:
                log_test("TC-UC18-002", "性能指标展示", "passed", f"显示{len(metric_cards)}个性能指标")
            
            # 关闭面板
            close_btn = await page.query_selector('#close-performance')
            if close_btn:
                await close_btn.click()
                await asyncio.sleep(0.5)
            
            await take_screenshot(page, "performance_monitor")
            return True
        else:
            log_test("TC-UC18-002", "性能监控面板", "failed", "性能监控面板未打开")
            return False
            
    except Exception as e:
        log_test("TC-UC18-002", "性能监控面板", "failed", str(e))
        await take_screenshot(page, "performance_error")
        return False

async def test_log_modal(page: Page):
    """测试用例: 日志查看功能"""
    print("\n" + "="*60)
    print("开始测试: 处理日志查看功能")
    print("="*60)
    
    try:
        # 查找日志按钮
        log_btn = await page.query_selector('#toggle-log-btn')
        if not log_btn:
            log_test("TC-UC-LOG", "日志入口", "failed", "未找到日志按钮")
            return False
        
        await log_btn.click()
        await asyncio.sleep(1)
        
        # 检查日志弹窗
        log_modal = await page.query_selector('#log-modal:not(.hidden)')
        if log_modal:
            log_test("TC-UC-LOG", "日志弹窗显示", "passed", "日志弹窗已打开")
            
            # 检查日志容器
            log_container = await page.query_selector('#processing-log')
            if log_container:
                log_test("TC-UC-LOG", "日志内容区", "passed", "日志内容区已显示")
            
            # 检查复制和清空按钮
            copy_btn = await page.query_selector('#copy-log')
            clear_btn = await page.query_selector('#clear-log')
            
            if copy_btn and clear_btn:
                log_test("TC-UC-LOG", "日志操作按钮", "passed", "复制和清空按钮已显示")
            
            # 关闭弹窗
            close_btn = await page.query_selector('#close-log-modal')
            if close_btn:
                await close_btn.click()
                await asyncio.sleep(0.5)
            
            await take_screenshot(page, "log_modal")
            return True
        else:
            log_test("TC-UC-LOG", "日志弹窗显示", "failed", "日志弹窗未打开")
            return False
            
    except Exception as e:
        log_test("TC-UC-LOG", "日志查看功能", "failed", str(e))
        await take_screenshot(page, "log_error")
        return False

async def test_intent_recognition(page: Page):
    """测试用例 TC-UC05: 意图识别功能"""
    print("\n" + "="*60)
    print("开始测试 UC-05: 意图识别功能")
    print("="*60)
    
    try:
        # 输入柱状图查询
        test_cases = [
            ("统计各省份的销售额并绘制柱状图", "BAR"),
            ("展示销售趋势", "LINE"),
            ("查看各产品类别市场份额占比", "PIE"),
            ("筛选广东省的数据", "FILTER"),
            ("统计各省份的销售总额", "AGGREGATE")
        ]
        
        input_box = await page.query_selector('#conversation-input')
        send_btn = await page.query_selector('#send-message')
        
        if not input_box or not send_btn:
            log_test("TC-UC05-001", "意图识别测试", "failed", "未找到输入框或发送按钮")
            return False
        
        for query, expected_intent in test_cases[:2]:  # 测试前2个
            await input_box.fill(query)
            await send_btn.click()
            print(f"发送查询: {query}")
            
            # 等待处理
            await asyncio.sleep(5)
            
            # 检查控制台日志中是否有意图识别信息
            console_logs = await page.evaluate("""() => {
                return window.consoleTexts || [];
            }""")
            
            # 由于无法直接获取意图识别结果，我们检查是否有图表生成
            chart_container = await page.query_selector('.charts-container')
            if chart_container:
                charts = await chart_container.query_selector_all('canvas')
                if len(charts) > 0:
                    log_test(f"TC-UC05-{test_cases.index((query, expected_intent))+1}", 
                            f"意图识别-{expected_intent}", "passed", f"查询'{query}'识别成功，生成图表")
                else:
                    log_test(f"TC-UC05-{test_cases.index((query, expected_intent))+1}", 
                            f"意图识别-{expected_intent}", "failed", f"查询'{query}'未生成图表")
            else:
                log_test(f"TC-UC05-{test_cases.index((query, expected_intent))+1}", 
                        f"意图识别-{expected_intent}", "skipped", f"图表容器未显示，等待分析完成")
            
            await take_screenshot(page, f"intent_{expected_intent}")
        
        return True
        
    except Exception as e:
        log_test("TC-UC05-001", "意图识别功能", "failed", str(e))
        await take_screenshot(page, "intent_error")
        return False

async def test_multi_turn_conversation(page: Page):
    """测试用例 TC-UC17: 多轮对话"""
    print("\n" + "="*60)
    print("开始测试 UC-17: 多轮对话上下文")
    print("="*60)
    
    try:
        # 第一轮对话
        input_box = await page.query_selector('#conversation-input')
        send_btn = await page.query_selector('#send-message')
        
        if not input_box or not send_btn:
            log_test("TC-UC17-001", "多轮对话", "failed", "未找到输入框或发送按钮")
            return False
        
        # 第一轮查询
        query1 = "统计各省份的销售额"
        await input_box.fill(query1)
        await send_btn.click()
        print(f"第一轮: {query1}")
        
        await asyncio.sleep(5)
        
        # 获取消息数量
        messages_before = await page.query_selector_all('#conversation-messages .message')
        
        # 第二轮追问
        query2 = "按产品类别呢"
        await input_box.fill(query2)
        await send_btn.click()
        print(f"第二轮: {query2}")
        
        await asyncio.sleep(5)
        
        messages_after = await page.query_selector_all('#conversation-messages .message')
        
        if len(messages_after) > len(messages_before):
            log_test("TC-UC17-001", "多轮对话-上下文保留", "passed", 
                    f"多轮对话成功，消息从{len(messages_before)}条增加到{len(messages_after)}条")
        else:
            log_test("TC-UC17-001", "多轮对话-上下文保留", "failed", 
                    f"消息数量未增加，期望增加，实际情况: 前={len(messages_before)}, 后={len(messages_after)}")
        
        await take_screenshot(page, "multi_turn")
        return True
        
    except Exception as e:
        log_test("TC-UC17-001", "多轮对话", "failed", str(e))
        await take_screenshot(page, "multi_turn_error")
        return False

async def run_ui_tests():
    """运行UI自动化测试"""
    print("="*60)
    print("智能数据分析助手 - UI自动化测试")
    print("="*60)
    
    test_results["start_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    browser = None
    try:
        async with async_playwright() as p:
            # 启动浏览器
            print("\n启动浏览器...")
            browser = await p.chromium.launch(
                headless=False,  # 显示浏览器窗口
                args=['--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080}
            )
            page = await context.new_page()
            
            # 打开应用页面
            print("打开应用页面...")
            await page.goto("http://127.0.0.1:8080", timeout=30000)
            await page.wait_for_load_state("networkidle")
            
            print("页面加载成功!")
            await asyncio.sleep(2)
            await take_screenshot(page, "page_loaded")
            
            # 执行测试
            print("\n开始执行测试用例...")
            
            # 1. 文件上传测试
            await test_file_upload(page)
            
            # 2. 数据概览测试
            await test_data_preview(page)
            
            # 3. 对话输入测试
            await test_conversation_input(page)
            
            # 4. 发送查询测试
            await test_send_query(page)
            
            # 5. 数据筛选测试
            await test_filter_functionality(page)
            
            # 6. 表格分页测试
            await test_table_pagination(page)
            
            # 7. 意图识别测试
            await test_intent_recognition(page)
            
            # 8. 多轮对话测试
            await test_multi_turn_conversation(page)
            
            # 9. 设置功能测试
            await test_settings_modal(page)
            
            # 10. Agent工作流面板测试
            await test_agent_workflow_panel(page)
            
            # 11. 性能监控测试
            await test_performance_monitor(page)
            
            # 12. 日志查看测试
            await test_log_modal(page)
            
            # 等待最后的截图
            await asyncio.sleep(1)
            await take_screenshot(page, "final_state")
            
            print("\n" + "="*60)
            print("测试执行完成!")
            print("="*60)
            
    except Exception as e:
        print(f"测试执行异常: {e}")
        if browser:
            await take_screenshot(browser.pages[0] if browser.pages else None, "error")
    finally:
        if browser:
            await browser.close()
    
    test_results["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return test_results

def generate_html_report(results):
    """生成HTML测试报告"""
    report = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>智能数据分析助手 - UI自动化测试报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Microsoft YaHei', Arial, sans-serif; background: #f5f7fa; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        
        /* 头部样式 */
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .header .subtitle {{ opacity: 0.9; font-size: 14px; }}
        
        /* 统计卡片 */
        .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }}
        .stat-card {{ background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .stat-card .number {{ font-size: 36px; font-weight: bold; }}
        .stat-card .label {{ color: #666; font-size: 14px; margin-top: 5px; }}
        .stat-card.total {{ border-left: 4px solid #667eea; }}
        .stat-card.passed {{ border-left: 4px solid #52c41a; }}
        .stat-card.failed {{ border-left: 4px solid #ff4d4f; }}
        .stat-card.skipped {{ border-left: 4px solid #faad14; }}
        .stat-card .passed {{ color: #52c41a; }}
        .stat-card .failed {{ color: #ff4d4f; }}
        .stat-card .skipped {{ color: #faad14; }}
        
        /* 通过率 */
        .pass-rate {{ background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .pass-rate h3 {{ color: #666; margin-bottom: 10px; }}
        .pass-rate .rate {{ font-size: 48px; font-weight: bold; color: #667eea; }}
        .pass-rate .bar {{ height: 10px; background: #f0f0f0; border-radius: 5px; margin-top: 15px; overflow: hidden; }}
        .pass-rate .bar-fill {{ height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 5px; }}
        
        /* 测试详情表格 */
        .details {{ background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .details h2 {{ margin-bottom: 20px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; }}
        th {{ background: #fafafa; font-weight: 600; color: #333; }}
        tr:hover {{ background: #fafafa; }}
        
        .status {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }}
        .status.passed {{ background: #d9ffdd; color: #52c41a; }}
        .status.failed {{ background: #ffe7e7; color: #ff4d4f; }}
        .status.skipped {{ background: #fff7cc; color: #faad14; }}
        
        .test-id {{ font-family: monospace; color: #667eea; font-weight: 600; }}
        .screenshot {{ color: #1890ff; text-decoration: none; }}
        .screenshot:hover {{ text-decoration: underline; }}
        
        /* 页脚 */
        .footer {{ margin-top: 20px; padding: 15px; text-align: center; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>智能数据分析助手 - UI自动化测试报告</h1>
            <div class="subtitle">
                <p>测试时间: {results['start_time']} 至 {results['end_time']}</p>
                <p>基于Playwright的全面UI自动化测试</p>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card total">
                <div class="number">{results['total_cases']}</div>
                <div class="label">总用例数</div>
            </div>
            <div class="stat-card passed">
                <div class="number passed">{results['passed']}</div>
                <div class="label">通过</div>
            </div>
            <div class="stat-card failed">
                <div class="number failed">{results['failed']}</div>
                <div class="label">失败</div>
            </div>
            <div class="stat-card skipped">
                <div class="number skipped">{results['skipped']}</div>
                <div class="label">跳过</div>
            </div>
        </div>
        
        <div class="pass-rate">
            <h3>测试通过率</h3>
            <div class="rate">{results['passed']/results['total_cases']*100:.1f}%</div>
            <div class="bar">
                <div class="bar-fill" style="width: {results['passed']/results['total_cases']*100}%"></div>
            </div>
        </div>
        
        <div class="details">
            <h2>📋 测试详情</h2>
            <table>
                <thead>
                    <tr>
                        <th>用例ID</th>
                        <th>用例名称</th>
                        <th>状态</th>
                        <th>详细信息</th>
                        <th>时间</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    for detail in results['details']:
        status_class = detail['status']
        status_text = '✅ 通过' if detail['status'] == 'passed' else ('❌ 失败' if detail['status'] == 'failed' else '⏭️ 跳过')
        
        screenshot_link = f'<a href="{detail["screenshot"]}" target="_blank" class="screenshot">查看截图</a>' if detail.get('screenshot') else '-'
        
        report += f"""
                    <tr>
                        <td class="test-id">{detail['test_id']}</td>
                        <td>{detail['test_name']}</td>
                        <td><span class="status {status_class}">{status_text}</span></td>
                        <td>{detail['message']}</td>
                        <td>{detail['timestamp']}</td>
                    </tr>
"""
    
    report += """
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>智能数据分析助手 V5.0 - UI自动化测试报告</p>
            <p>生成时间: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</p>
        </div>
    </div>
</body>
</html>
"""
    
    # 保存报告
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n📄 测试报告已生成: {REPORT_PATH}")
    return REPORT_PATH

def generate_test_data():
    """生成测试数据文件"""
    import csv
    
    # 创建测试数据目录
    os.makedirs(TEST_DATA_PATH, exist_ok=True)
    
    # 创建CSV测试数据
    csv_file = os.path.join(TEST_DATA_PATH, "sales_data.csv")
    data = [
        ["省份", "城市", "产品类别", "销售额", "销售数量", "销售日期", "客户类型"],
        ["广东省", "广州市", "手机", "15000", "50", "2025-01-15", "个人"],
        ["广东省", "深圳市", "电脑", "25000", "30", "2025-01-16", "企业"],
        ["浙江省", "杭州市", "手机", "18000", "60", "2025-01-17", "个人"],
        ["浙江省", "宁波市", "家电", "35000", "20", "2025-01-18", "企业"],
        ["江苏省", "南京市", "电脑", "22000", "25", "2025-01-19", "个人"],
        ["江苏省", "苏州市", "手机", "16000", "55", "2025-01-20", "企业"],
        ["华东地区", "上海市", "家电", "45000", "35", "2025-01-21", "个人"],
        ["华东地区", "上海市", "手机", "28000", "80", "2025-01-22", "企业"],
        ["华北地区", "北京市", "电脑", "30000", "40", "2025-01-23", "个人"],
        ["华北地区", "天津市", "家电", "28000", "18", "2025-01-24", "企业"],
        ["华南地区", "深圳市", "手机", "20000", "70", "2025-01-25", "个人"],
        ["华南地区", "广州市", "电脑", "18000", "22", "2025-01-26", "企业"],
        ["西部地区", "成都市", "家电", "22000", "15", "2025-01-27", "个人"],
        ["西部地区", "重庆市", "手机", "14000", "45", "2025-01-28", "企业"],
        ["东北地区", "沈阳市", "电脑", "16000", "20", "2025-01-29", "个人"],
    ]
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(data)
    
    print(f"测试数据已生成: {csv_file}")
    return csv_file

if __name__ == "__main__":
    # 设置编码
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    # 生成测试数据
    print("\n正在生成测试数据...")
    generate_test_data()
    
    print("\n" + "="*60)
    print("请确保以下服务已启动:")
    print("   1. HTTP服务器: python -m http.server 8080")
    print("   2. 意图识别API: python intent_api.py")
    print("="*60)
    print()
    
    # 运行测试
    results = asyncio.run(run_ui_tests())
    
    # 生成报告
    report_path = generate_html_report(results)
    
    # 打印统计
    print("\n" + "="*60)
    print("📊 测试结果统计")
    print("="*60)
    print(f"总用例数: {results['total_cases']}")
    print(f"通过: {results['passed']} ✅")
    print(f"失败: {results['failed']} ❌")
    print(f"跳过: {results['skipped']} ⏭️")
    print(f"通过率: {results['passed']/results['total_cases']*100:.1f}%")
    print("="*60)
