// 文件上传增强修复脚本
// 解决需要点击两次才能上传成功的问题

console.log('📁 加载文件上传增强修复脚本...');

// 等待页面完全加载后初始化文件上传
document.addEventListener('DOMContentLoaded', function() {
    console.log('📁 DOM已加载，初始化增强的文件上传...');
    setTimeout(initEnhancedFileUpload, 100);
});

// 增强的文件上传初始化
function initEnhancedFileUpload() {
    console.log('📁 开始初始化增强的文件上传功能...');
    
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    
    if (!dropArea || !fileInput) {
        console.error('❌ 找不到上传控件元素');
        setTimeout(initEnhancedFileUpload, 500); // 重试
        return;
    }
    
    console.log('✅ 找到上传控件元素');
    
    // 移除旧的监听器（避免重复绑定）
    dropArea.replaceWith(dropArea.cloneNode(true));
    fileInput.replaceWith(fileInput.cloneNode(true));
    
    // 重新获取元素
    const newDropArea = document.getElementById('drop-area');
    const newFileInput = document.getElementById('file-input');
    
    // 确保文件输入有正确的属性和事件
    setupFileInput(newFileInput);
    setupDropArea(newDropArea, newFileInput);
}

// 设置文件输入元素
function setupFileInput(fileInput) {
    if (!fileInput) return;
    
    console.log('🔧 设置文件输入元素...');
    
    // 确保有正确的属性
    fileInput.setAttribute('accept', '.csv,.xlsx,.xls');
    fileInput.setAttribute('style', 'display: none;');
    
    // 移除旧的change事件监听器
    fileInput.onchange = null;
    
    // 添加新的change事件监听器
    fileInput.addEventListener('change', function(e) {
        console.log('📁 文件选择事件触发，文件数量:', e.target.files.length);
        
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            console.log('📄 选择的文件:', file.name, '大小:', file.size, '类型:', file.type);
            
            // 模拟进度显示
            const loading = document.getElementById('loading');
            if (loading) {
                loading.textContent = `正在处理 ${file.name}...`;
                loading.classList.remove('hidden');
            }
            
            // 调用原有的文件处理函数
            if (typeof processFile === 'function') {
                processFile(file);
            } else {
                console.error('❌ processFile函数未定义');
            }
        } else {
            console.log('⚠️ 文件选择器返回空文件列表');
        }
        
        // 重置文件输入，允许再次选择相同的文件
        fileInput.value = '';
    });
    
    console.log('✅ 文件输入元素设置完成');
}

// 设置拖拽区域
function setupDropArea(dropArea, fileInput) {
    if (!dropArea || !fileInput) return;
    
    console.log('🔧 设置拖拽区域...');
    
    // 移除旧的事件监听器
    dropArea.onmouseenter = null;
    dropArea.onmouseleave = null;
    dropArea.onclick = null;
    
    // 添加点击事件
    dropArea.addEventListener('click', function(e) {
        console.log('🎯 点击上传区域');
        e.preventDefault();
        e.stopPropagation();
        
        // 确保文件输入可用
        if (fileInput) {
            console.log('🖱️ 触发文件输入点击');
            fileInput.click();
        } else {
            console.error('❌ 文件输入元素不可用');
        }
    });
    
    // 添加鼠标悬停效果
    dropArea.addEventListener('mouseenter', function() {
        dropArea.style.borderColor = '#667eea';
        dropArea.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.5)';
        dropArea.style.transform = 'translateY(-1px)';
    });
    
    dropArea.addEventListener('mouseleave', function() {
        dropArea.style.borderColor = '#e2e8f0';
        dropArea.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        dropArea.style.transform = 'translateY(0)';
    });
    
    // 拖拽事件
    dropArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.style.borderColor = '#667eea';
        dropArea.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.7)';
    });
    
    dropArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!dropArea.contains(e.relatedTarget)) {
            dropArea.style.borderColor = '#e2e8f0';
            dropArea.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        }
    });
    
    dropArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('📥 文件拖放事件');
        
        dropArea.style.borderColor = '#e2e8f0';
        dropArea.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            console.log('📄 拖放的文件:', file.name, '大小:', file.size, '类型:', file.type);
            
            // 检查文件类型
            const isValidFileType = file.type.match(/(csv|xlsx|xls|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)/i);
            
            if (!isValidFileType) {
                console.error('❌ 不支持的文件类型:', file.type);
                alert('请上传CSV或Excel文件（.csv, .xlsx, .xls）');
                return;
            }
            
            // 模拟进度显示
            const loading = document.getElementById('loading');
            if (loading) {
                loading.textContent = `正在处理 ${file.name}...`;
                loading.classList.remove('hidden');
            }
            
            // 调用原有的文件处理函数
            if (typeof processFile === 'function') {
                processFile(file);
            } else {
                console.error('❌ processFile函数未定义');
            }
        }
    });
    
    console.log('✅ 拖拽区域设置完成');
}

// 立即尝试初始化（在DOM加载前）
console.log('📁 尝试立即初始化文件上传...');
setTimeout(initEnhancedFileUpload, 100);

// 添加一个全局函数用于手动重新初始化
window.fixFileUpload = function() {
    console.log('🔧 手动调用文件上传修复...');
    initEnhancedFileUpload();
};

console.log('✅ 文件上传增强修复脚本加载完成');