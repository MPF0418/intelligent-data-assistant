const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// 全局变量
let mainWindow;
let apiProcesses = [];
let pythonExecutable = 'python';

// 检查Python是否可用
function checkPython() {
    return new Promise((resolve, reject) => {
        const proc = spawn(pythonExecutable, ['--version']);
        let output = '';
        
        proc.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        
        proc.on('error', () => {
            resolve(false);
        });
    });
}

// 启动Python API服务
async function startApiServices() {
    try {
        // 检查Python
        const pythonAvailable = await checkPython();
        if (!pythonAvailable) {
            dialog.showMessageBox({
                type: 'error',
                title: '错误',
                message: '未找到Python环境',
                detail: '请先安装Python 3.8或更高版本'            });
            return false;
        }
        
        console.log('启动API服务...');
        
        // 启动意图识别API
        const intentApi = spawn(pythonExecutable, ['intent_api.py'], {
            cwd: app.getAppPath(),
            stdio: 'inherit'
        });
        
        intentApi.on('error', (error) => {
            console.error('启动意图识别API失败:', error);
        });
        
        intentApi.on('close', (code) => {
            console.log('意图识别API退出，代码:', code);
        });
        
        // 启动分析要素API
        const analysisApi = spawn(pythonExecutable, ['analysis_api.py'], {
            cwd: app.getAppPath(),
            stdio: 'inherit'
        });
        
        analysisApi.on('error', (error) => {
            console.error('启动分析要素API失败:', error);
        });
        
        analysisApi.on('close', (code) => {
            console.log('分析要素API退出，代码:', code);
        });
        
        apiProcesses.push(intentApi);
        apiProcesses.push(analysisApi);
        
        // 等待服务启动
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('API服务启动完成');
        return true;
        
    } catch (error) {
        console.error('启动API服务时出错:', error);
        dialog.showMessageBox({
            type: 'error',
            title: '错误',
            message: '启动API服务失败',
            detail: error.message
        });
        return false;
    }
}

// 停止Python API服务
function stopApiServices() {
    apiProcesses.forEach((proc, index) => {
        try {
            proc.kill();
            console.log(`停止API服务 ${index + 1}`);
        } catch (error) {
            console.error('停止API服务时出错:', error);
        }
    });
    apiProcesses = [];
}

// 创建主窗口
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        title: '智能数据洞察助手',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: true
        }
    });
    
    // 加载本地HTML文件
    mainWindow.loadFile('index.html');
    
    // 打开开发者工具
    // mainWindow.webContents.openDevTools();
    
    mainWindow.on('closed', function () {
        mainWindow = null;
        stopApiServices();
    });
}

// 应用就绪
app.whenReady().then(async () => {
    console.log('应用启动');
    
    // 启动API服务
    const apiStarted = await startApiServices();
    if (!apiStarted) {
        app.quit();
        return;
    }
    
    // 创建窗口
    createWindow();
    
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 应用关闭
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        stopApiServices();
        app.quit();
    }
});

// 处理渲染进程消息
ipcMain.on('get-app-path', (event) => {
    event.returnValue = app.getAppPath();
});

ipcMain.on('restart-services', async (event) => {
    stopApiServices();
    const success = await startApiServices();
    event.returnValue = success;
});

console.log('Electron主进程启动');