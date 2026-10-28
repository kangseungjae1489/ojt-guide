'use strict';
const { contextBridge,ipcRenderer }=require('electron');
contextBridge.exposeInMainWorld('mentorDesktop',Object.freeze({
  openImage:()=>ipcRenderer.invoke('mentor:open'),
  saveImage:(payload)=>ipcRenderer.invoke('mentor:save',payload),
  exportPreset:(json)=>ipcRenderer.invoke('mentor:save-presets',json)
}));
