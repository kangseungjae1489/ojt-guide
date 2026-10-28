'use strict';
const { contextBridge,ipcRenderer }=require('electron');
const api={
 openAudio:()=>ipcRenderer.invoke('mentor:open'),
 recordSave:(base64,mime)=>ipcRenderer.invoke('mentor:recordSave',{base64,mime}),
 preview:(path)=>ipcRenderer.invoke('mentor:preview',path),
 setup:(which)=>ipcRenderer.invoke('mentor:setup',which),
 job:(command,payload)=>ipcRenderer.invoke('mentor:job',command,payload),
 saveText:(text,format)=>ipcRenderer.invoke('mentor:saveText',{text,format}),
 settings:()=>ipcRenderer.invoke('mentor:settings'),
 codexSummary:(text)=>ipcRenderer.invoke('mentor:codexSummary',text),
 onProgress:(cb)=>{const listener=(_e,status)=>cb(status);ipcRenderer.on('mentor:progress',listener);return()=>ipcRenderer.removeListener('mentor:progress',listener)}
};
contextBridge.exposeInMainWorld('mentor',Object.freeze(api));