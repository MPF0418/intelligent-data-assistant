// 简化版文件上传修复脚本 - V6.0
// 解决点击上传无反应的问题
(function() {
    console.log('[V6.0] 简化版上传修复脚本加载中...');
    
    // 等待DOM和script.js加载完成
    function init() {
        const dropArea = document.getElementById('drop-area');
        const fileInput = document.getElementById('file-input');
        
        if (!dropArea || !fileInput) {
            console.log('[V6.0] 等待DOM元素...');
            setTimeout(init, 200);
            return;
        }
        
        console.log('[V6.0] 找到上传元素，绑定事件...');
        
        // 移除可能存在的旧事件（通过克隆节点）
        const newDropArea = dropArea.cloneNode(true);
        dropArea.parentNode.replaceChild(newDropArea, dropArea);
        
        const newFileInput = document.getElementById('file-input');
        
        // 绑定点击事件 - 点击drop-area时触发文件选择
        newDropArea.addEventListener('click', function(e) {
            console.log('[V6.0] 点击上传区域');
            // 直接调用fileInput.click()
            if (newFileInput) {
                newFileInput.click();
            }
        });
        
        // 绑定文件选择事件
        newFileInput.addEventListener('change', function(e) {
            const files = e.target.files;
            console.log('[V6.0] 文件选择:', files[0]?.name);
            
            if (files.length > 0 && typeof window.processFile === 'function') {
                window.processFile(files[0]);
            } else if (files.length > 0) {
                // 如果processFile不存在，手动处理
                const file = files[0];
                console.log('[V6.0] 手动处理文件:', file.name);
                
                // 显示加载
                const loading = document.getElementById('loading');
                if (loading) {
                    loading.classList.remove('hidden');
                }
                
                // 根据文件类型调用解析
                if (file.name.endsWith('.csv')) {
                    if (typeof window.parseCSV === 'function') {
                        window.parseCSV(file);
                    }
                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    if (typeof window.parseExcel === 'function') {
                        window.parseExcel(file);
                    }
                }
            }
        });
        
        // 绑定拖拽事件
        newDropArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.backgroundColor = '#e9ecef';
            this.style.borderColor = '#667eea';
        });
        
        newDropArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.backgroundColor = '';
            this.style.borderColor = '';
        });
        
        newDropArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.backgroundColor = '';
            this.style.borderColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && typeof window.processFile === 'function') {
                console.log('[V6.0] 拖拽上传:', files[0].name);
                window.processFile(files[0]);
            }
        });
        
        console.log('[V6.0] 上传事件绑定完成!');
    }
    
    // 延迟初始化，确保script.js加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 500);
        });
    } else {
        setTimeout(init, 500);
    }
})();
