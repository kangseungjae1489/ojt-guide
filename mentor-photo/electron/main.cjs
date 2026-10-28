'use strict';
const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const TYPES = [
  { name: 'Images', extensions: ['jpg','jpeg','png','webp','bmp','gif','avif'] }
];
const MIME = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.bmp':'image/bmp','.gif':'image/gif','.avif':'image/avif'};
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500, height: 950, minWidth: 1010, minHeight: 650,
    backgroundColor: '#10141a',
    title: 'MENTOR PHOTO',
    show: false,
    webPreferences: {
      preload: path.join(__dirname,'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.loadFile(path.join(__dirname,'../ui/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
}
app.whenReady().then(() => {
  nativeTheme.themeSource='dark';
  ipcMain.handle('mentor:open', async () => {
    const selected=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],filters:TYPES});
    if(selected.canceled||!selected.filePaths?.length) return null;
    const filePath=selected.filePaths[0];
    const ext=path.extname(filePath).toLowerCase();
    if(!MIME[ext]) throw Error('지원하지 않는 이미지 형식입니다.');
    const st=await fs.stat(filePath);
    if(st.size>65*1024*1024) throw Error('65MB 이하의 사진만 열 수 있습니다.');
    const bytes=await fs.readFile(filePath);
    return {name:path.basename(filePath),dataUrl:'data:'+MIME[ext]+';base64,'+bytes.toString('base64')};
  });
  ipcMain.handle('mentor:save',async (_evt, payload)=>{
    if(typeof payload?.dataUrl!=='string'||payload.dataUrl.length>105_000_000) throw Error('이미지 용량을 확인해 주세요.');
    const ext=payload.format==='jpeg'?'jpg':'png';
    const type=ext==='jpg'?'image/jpeg':'image/png';
    if(!payload.dataUrl.startsWith('data:'+type+';base64,')) throw Error('이미지 형식이 올바르지 않습니다.');
    const result=await dialog.showSaveDialog(mainWindow,{
      title:'MENTOR PHOTO · 이미지 저장',
      defaultPath:payload.suggestedName||('MENTOR_edit.'+ext),
      filters:[{name:ext==='jpg'?'JPEG image':'PNG image',extensions:[ext]}]
    });
    if(result.canceled||!result.filePath) return {saved:false};
    const base64=payload.dataUrl.slice(payload.dataUrl.indexOf(',')+1);
    await fs.writeFile(result.filePath,Buffer.from(base64,'base64'),{flag:'w'});
    return {saved:true,location:result.filePath};
  });
  ipcMain.handle('mentor:save-presets',async (_evt,payload)=>{
    const out=await dialog.showSaveDialog(mainWindow,{defaultPath:'MENTOR-PHOTO-preset.json',filters:[{name:'MENTOR preset',extensions:['json']}]});
    if(out.canceled||!out.filePath) return false;
    if(typeof payload!=='string'||payload.length>10000) throw Error('프리셋 데이터 크기가 올바르지 않습니다.');
    await fs.writeFile(out.filePath,payload,'utf8');
    return true;
  });
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});
  createWindow();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
