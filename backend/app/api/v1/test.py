# -*- coding: utf-8 -*-
"""
测试API
产品意义：测试API端点是否能够正常工作
"""

from flask import Blueprint, jsonify

# 创建蓝图
test_bp = Blueprint('test', __name__)

@test_bp.route('/hello', methods=['GET'])
def hello():
    """
    测试端点
    产品意义：测试API端点是否能够正常工作
    """
    return jsonify({
        'success': True,
        'message': 'Hello, World!'
    })
