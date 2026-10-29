'use strict';
/* Windows and macOS regression test: native Python stdout → Node UTF-8 JSON
   → on-disk UTF-8 TXT/SRT. No AI weights or audio required. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const script=path.join(root,'engine','voice_engine.py');
const appMain=fs.readFileSync(path.join(root,'electron','main.cjs'),'utf8');
for(const token of ["PYTHONUTF8:'1'","PYTHONIOENCODING:'utf-8'"])
 assert.ok(appMain.includes(token),'Desktop subprocess env must force UTF-8: '+token);
const env={...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONLEGACYWINDOWSSTDIO:'0'};
function runPython(format){
  const segments=[
    {start:1.39,end:4.23,text:'안녕하세요. 제 목소리를 정확하게 기록해 주세요.'},
    {start:5.5,end:8.91,text:'中文：你好，欢迎使用 MENTOR.K。'},
    {start:10.24,end:12.8,text:'日本語：こんにちは。よろしくお願いします。'}
  ];
  const result=cp.spawnSync(process.platform==='win32'?'python':'python3',[script,'export'],{
    input:JSON.stringify({format,segments}),encoding:'utf8',env,timeout:30000
  });
  assert.equal(result.status,0,'Python export failed: '+result.stderr);
  assert.ok(!result.stdout.includes('\uFFFD'),'UTF-8 was damaged before parsing JSON');
  const decoded=JSON.parse(result.stdout.trim());
  assert.equal(decoded.ok,true,'Engine returned failure');
  assert.ok(decoded.result.text.includes(segments[0].text));
  assert.ok(decoded.result.text.includes(segments[1].text));
  assert.ok(decoded.result.text.includes(segments[2].text));
  return decoded.result.text;
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mentor-utf8-'));
try{
  for(const format of ['txt','srt']){
    const content=runPython(format);
    const file=path.join(tmp,'MENTOR_K_Transcript.'+format);
    fs.writeFileSync(file,content,{encoding:'utf8'});
    const loaded=fs.readFileSync(file,'utf8');
    assert.equal(loaded,content,'Saved file does not round trip exactly');
    assert.ok(loaded.includes('제 목소리를 정확하게'));
    assert.ok(loaded.includes('你好'));
    assert.ok(loaded.includes('こんにちは'));
    assert.ok(!loaded.includes('\uFFFD'),'Replacement Unicode codepoint found');
    if(format==='srt')assert.ok(loaded.includes('00:00:01,390 --> 00:00:04,230'));
  }
  process.stdout.write('PASS UTF-8: Korean/Chinese/Japanese Python → Electron Node → TXT/SRT\n');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
