const { contextBridge, ipcRenderer } = require('electron');
const XLSX = require('xlsx');

contextBridge.exposeInMainWorld('XLSX', XLSX);
