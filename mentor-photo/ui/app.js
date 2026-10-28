/* MENTOR PHOTO v0.1.0
 * Original offline photo editor. Does not use Polarr code or paid algorithms.
 * Image processing runs locally in an HTML Canvas.
 */
'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const DEFAULT = Object.freeze({
    exposure:0,brightness:0,contrast:0,highlights:0,shadows:0,
    temperature:0,tint:0,saturation:0,vibrance:0,hue:0,
    sharpness:0,vignette:0,fade:0,grain:0,
    rotation:0,flipH:false,flipV:false,crop:'free'
  });
  const ADJUST = ['exposure','brightness','contrast','highlights','shadows','temperature','tint','saturation','vibrance','hue','sharpness','vignette','fade','grain'];
  const PRESETS = {
    original:{},
    portrait:{exposure:0.12,brightness:5,contrast:-9,shadows:12,highlights:-16,temperature:9,tint:5,saturation:-4,vibrance:12,fade:3},
    golden:{exposure:0.12,brightness:8,contrast:11,shadows:13,highlights:-11,temperature:31,tint:4,saturation:14,vibrance:18,vignette:12},
    cinema:{exposure:-0.16,brightness:-4,contrast:34,highlights:-29,shadows:-17,temperature:-7,saturation:-20,vibrance:9,vignette:29,grain:9},
    cool:{exposure:0.10,contrast:-6,shadows:19,highlights:-9,temperature:-26,tint:8,saturation:-10,vibrance:12},
    mono:{exposure:0.09,contrast:25,shadows:10,highlights:-15,saturation:-100,vignette:17,grain:13},
    vintage:{exposure:0.07,brightness:4,contrast:-21,highlights:-22,shadows:22,temperature:22,saturation:-25,fade:23,grain:21,vignette:10},
    vivid:{exposure:0.05,contrast:17,temperature:5,saturation:22,vibrance:45,sharpness:12}
  };
  let state={...DEFAULT}, history=[{...DEFAULT}], historyIndex=0;
  let source=null, sourceName='사진', rendering=false, frameRequested=false, showOriginal=false;
  let zoom=1, currentPreset='original', toastTimer=null;

  const clamp=(v,min=0,max=255)=>Math.max(min,Math.min(max,v));
  const px=$('#photoCanvas');
  const openBtn=$('#openBtn'), saveBtn=$('#saveBtn');
  const allEditing=()=>$$('.slider-field input, #rotateLeftBtn,#rotateRightBtn,#flipHBtn,#flipVBtn,#cropMode,#beforeBtn,#fitBtn,#zoomSlider,#savePresetBtn,#resetBtn');

  function notify(text) {
    const el=$('#toast'); el.textContent=text;el.hidden=false;
    if(toastTimer) clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.hidden=true,3900);
  }
  function status(text) {$('#statusText').textContent=text;}
  function syncUI() {
    ADJUST.forEach(k=>{
      const inp=$('#'+k);
      if(!inp) return;
      inp.value=String(state[k]);
      const value=state[k];
      const s=k==='exposure'?Number(value).toFixed(2):k==='hue'?Math.round(value)+'°':String(Math.round(value));
      $('[data-output="'+k+'"]').textContent=s;
      const pct=(Number(value)-Number(inp.min))/(Number(inp.max)-Number(inp.min))*100;
      inp.style.background='linear-gradient(90deg,#a07449 '+pct+'%,#454c55 '+pct+'%)';
    });
    $('#cropMode').value=state.crop;
    $('#undoBtn').disabled=!source||historyIndex<=0;
    $('#redoBtn').disabled=!source||historyIndex>=history.length-1;
    $('#resetBtn').disabled=!source;
    saveBtn.disabled=!source;
    allEditing().forEach(el=>el.disabled=!source);
    if(source){
      $('#zoomValue').textContent=Math.round(zoom*100)+'%';
      const dims=geometry();
      $('#dimensions').textContent=Math.round(dims.outW)+' × '+Math.round(dims.outH)+' px';
    }
  }
  function commit() {
    if(!source) return;
    history=history.slice(0,historyIndex+1);
    history.push({...state});
    if(history.length>40)history.shift();
    historyIndex=history.length-1;
    syncUI();
  }
  function undo(){if(historyIndex>0){historyIndex--;state={...history[historyIndex]};selectPreset('');syncUI();queueRender();}}
  function redo(){if(historyIndex<history.length-1){historyIndex++;state={...history[historyIndex]};selectPreset('');syncUI();queueRender();}}
  function selectPreset(name){currentPreset=name;$$('[data-preset]').forEach(el=>el.classList.toggle('active',el.dataset.preset===name));}
  function geometry() {
    if(!source)return {sx:0,sy:0,sw:0,sh:0,outW:0,outH:0,rotated:false};
    const w=source.naturalWidth,h=source.naturalHeight;
    const rotated=Math.abs((state.rotation/90)%2)===1;
    let sx=0,sy=0,sw=w,sh=h;
    const mode=state.crop;
    if(mode!=='free'){
      const [ra,rb]=mode.split(':').map(Number);
      const ratio=rotated?rb/ra:ra/rb;
      if(w/h>ratio){sw=h*ratio;sx=(w-sw)/2;}
      else{sh=w/ratio;sy=(h-sh)/2;}
    }
    return {sx,sy,sw,sh,outW:rotated?sh:sw,outH:rotated?sw:sh,rotated};
  }
  function beforeState(){return {...DEFAULT,rotation:state.rotation,flipH:state.flipH,flipV:state.flipV,crop:state.crop};}
  function renderTo(canvas, opts={}) {
    if(!source) return;
    const s=opts.before?beforeState():state;
    const g=geometry();
    const naturalPixels=g.outW*g.outH;
    const maxPixels=opts.export?12_000_000:1_650_000;
    const maxSide=opts.export?7000:1600;
    const scale=Math.min(1,Math.sqrt(maxPixels/naturalPixels),maxSide/g.outW,maxSide/g.outH);
    const outW=Math.max(1,Math.round(g.outW*scale)), outH=Math.max(1,Math.round(g.outH*scale));
    canvas.width=outW;canvas.height=outH;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.clearRect(0,0,outW,outH);
    ctx.save();
    ctx.translate(outW/2,outH/2);
    ctx.rotate(s.rotation*Math.PI/180);
    ctx.scale(s.flipH?-1:1,s.flipV?-1:1);
    const bright=Math.pow(2,s.exposure)*(1+s.brightness/200);
    const contrast=(1+s.contrast/110);
    const saturation=(1+s.saturation/100);
    ctx.filter='brightness('+bright+') contrast('+contrast+') saturate('+Math.max(0,saturation)+') hue-rotate('+s.hue+'deg)';
    ctx.drawImage(source,g.sx,g.sy,g.sw,g.sh,-g.sw*scale/2,-g.sh*scale/2,g.sw*scale,g.sh*scale);
    ctx.restore();
    if(opts.before)return;
    const expensive=s.highlights||s.shadows||s.temperature||s.tint||s.vibrance||s.vignette||s.fade||s.grain||s.sharpness;
    if(!expensive)return;
    const pixels=ctx.getImageData(0,0,outW,outH), d=pixels.data;
    const hl=s.highlights/100,sh=s.shadows/100,temp=s.temperature/100,
          tint=s.tint/100,vib=s.vibrance/100,fade=s.fade/100,
          vig=s.vignette/100,grain=s.grain/100;
    const width=outW,height=outH,hasVig=Math.abs(vig)>.001;
    for(let y=0;y<height;y++){
      const dy=(y-height/2)/(height/2);
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4;
        let r=d[i],g=d[i+1],b=d[i+2];
        const luma=(r*.2126+g*.7152+b*.0722);
        if(hl||sh){
          const weightHigh=Math.pow(clamp((luma-105)/150,0,1),1.35);
          const weightLow=Math.pow(clamp((150-luma)/150,0,1),1.35);
          const adjustment=hl*weightHigh+sh*weightLow;
          if(adjustment>0){const f=adjustment*.63;r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f;}
          else{const f=1+adjustment*.63;r*=f;g*=f;b*=f;}
        }
        if(temp){r+=temp*26;g+=temp*5;b-=temp*30;}
        if(tint){r+=tint*12;g-=tint*23;b+=tint*13;}
        if(vib){
          const spread=Math.max(r,g,b)-Math.min(r,g,b);
          const strength=vib*(1-spread/510);
          const avg=(r+g+b)/3;
          r+=(r-avg)*strength;g+=(g-avg)*strength;b+=(b-avg)*strength;
        }
        if(fade){r=r*(1-fade*.45)+211*fade*.45;g=g*(1-fade*.45)+203*fade*.45;b=b*(1-fade*.45)+193*fade*.45;}
        if(hasVig){
          const dx=(x-width/2)/(width/2);
          const dist=Math.sqrt(dx*dx+dy*dy)/1.414;
          const weight=Math.pow(clamp((dist-.21)/.79,0,1),1.7);
          if(vig>0){const factor=1-vig*weight*.76;r*=factor;g*=factor;b*=factor;}
          else{const f=-vig*weight*.5;r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f;}
        }
        if(grain){
          const noise=(((x*73856093^y*19349663)>>>0)%239)/239-.5;
          const a=noise*grain*67;
          r+=a;g+=a;b+=a;
        }
        d[i]=clamp(r);d[i+1]=clamp(g);d[i+2]=clamp(b);
      }
    }
    if(s.sharpness){
      const strength=s.sharpness/100*.55;
      const src=new Uint8ClampedArray(d);
      for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
        let i=(y*width+x)*4;
        for(let c=0;c<3;c++){
          const diff=4*src[i+c]-src[i-4+c]-src[i+4+c]-src[i-width*4+c]-src[i+width*4+c];
          d[i+c]=clamp(src[i+c]+strength*diff);
        }
      }
    }
    ctx.putImageData(pixels,0,0);
  }
  function queueRender(){
    if(!source)return;
    if(frameRequested)return;
    frameRequested=true;
    requestAnimationFrame(()=>{
      frameRequested=false;
      if(rendering)return;
      rendering=true;
      try{renderTo(px,{before:showOriginal});}
      catch(err){console.error(err);notify('사진 보정 중 오류: '+err.message);}
      finally{rendering=false;}
    });
  }
  async function openImage(name,dataUrl){
    try{
      const img=new Image();
      img.decoding='async';
      const loaded=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('이 파일의 이미지를 읽을 수 없습니다.'));});
      img.src=dataUrl;
      await loaded;
      if(!img.naturalWidth||!img.naturalHeight)throw Error('이미지 크기를 확인할 수 없습니다.');
      source=img;
      sourceName=name||'사진';
      state={...DEFAULT};history=[{...state}];historyIndex=0;zoom=1;selectPreset('original');
      $('#projectName').textContent=sourceName;
      $('#imageMeta').textContent=(img.naturalWidth+' × '+img.naturalHeight+' px');
      $('#emptyState').hidden=true;$('#canvasWrap').hidden=false;
      $('#zoomSlider').value='100';
      syncUI();queueRender();status(sourceName+' · 원본 불러오기 완료');notify('사진을 불러왔습니다. 오른쪽에서 보정해 보세요.');
    }catch(err){notify(err.message);}
  }
  async function openNative(){
    try{
      if(window.mentorDesktop){
        const selected=await window.mentorDesktop.openImage();
        if(selected)await openImage(selected.name,selected.dataUrl);
      }else $('#fileInput').click();
    }catch(err){notify('파일 열기 실패: '+err.message);}
  }
  async function loadFile(file){
    if(!file) return;
    if(!file.type.startsWith('image/'))return notify('이미지 파일만 열 수 있습니다.');
    if(file.size>65*1024*1024)return notify('65MB 이하의 파일만 열 수 있습니다.');
    const reader=new FileReader();
    const dataUrl=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
    await openImage(file.name,dataUrl);
  }
  async function saveImage(){
    if(!source)return;
    saveBtn.disabled=true;
    status('고해상도 이미지 렌더링 및 저장 중...');
    try{
      const work=document.createElement('canvas');
      renderTo(work,{export:true});
      const format=$('#formatSelect').value;
      const mime=format==='jpeg'?'image/jpeg':'image/png';
      const quality=Number($('#qualitySlider').value)/100;
      const dataUrl=work.toDataURL(mime,quality);
      if(dataUrl==='data:,')throw Error('이미지를 생성할 수 없습니다.');
      const name=sourceName.replace(/\.[^.]+$/,'')+'_MENTOR.'+(format==='jpeg'?'jpg':'png');
      if(window.mentorDesktop){
        const result=await window.mentorDesktop.saveImage({dataUrl,format,suggestedName:name});
        if(result?.saved){notify('저장했습니다: '+result.location);status('저장 완료 · '+result.location);}
        else status('이미지 저장이 취소되었습니다.');
      }else{
        const link=document.createElement('a');link.href=dataUrl;link.download=name;
        document.body.appendChild(link);link.click();link.remove();
        notify(name+' 다운로드를 시작했습니다.');status('사진 내보내기 완료');
      }
      work.width=0;work.height=0;
    }catch(err){notify('내보내기 오류: '+err.message);status('저장 실패');}
    finally{saveBtn.disabled=false;}
  }
  function reset(){if(!source)return;state={...DEFAULT};zoom=1;$('#zoomSlider').value='100';selectPreset('original');commit();syncUI();queueRender();notify('보정을 초기화했습니다.');}
  function preset(name){
    if(!source){notify('먼저 사진을 열어 주세요.');return;}
    const p=PRESETS[name]||customPreset(name);
    if(!p)return;
    const geom={rotation:state.rotation,flipH:state.flipH,flipV:state.flipV,crop:state.crop};
    state={...DEFAULT,...p,...geom};
    selectPreset(name);commit();queueRender();
    status('프리셋 적용: '+name);
  }
  function customPreset(name){
    try{return JSON.parse(localStorage.getItem('mentor:custom:' + name))||null;}
    catch{return null;}
  }
  function drawCustomPresets(){
    const el=$('#customPresets');el.innerHTML='';
    let names=[];
    try{names=JSON.parse(localStorage.getItem('mentor:presets')||'[]');}
    catch{names=[];}
    if(!Array.isArray(names))return;
    names.slice(0,10).forEach((name)=>{
      if(typeof name!=='string')return;
      const b=document.createElement('button');b.className='custom-preset';b.textContent='✦ '+name;
      b.addEventListener('click',()=>preset('custom:'+name));el.appendChild(b);
    });
  }
  // Custom preset lookup is intentionally separate from built-ins; no remote filter sync.
  const oldPreset=customPreset;
  function normalizedCustom(name){
    return name.startsWith('custom:')?oldPreset(name.slice(7)):oldPreset(name);
  }

  function init(){
    openBtn.addEventListener('click',openNative);
    $('#emptyOpenBtn').addEventListener('click',openNative);
    $('#fileInput').addEventListener('change',async e=>{await loadFile(e.target.files[0]);e.target.value='';});
    saveBtn.addEventListener('click',saveImage);
    $('#undoBtn').addEventListener('click',undo);
    $('#redoBtn').addEventListener('click',redo);
    $('#resetBtn').addEventListener('click',reset);
    $$('[data-key]').forEach(el=>{
      const key=el.dataset.key;
      el.addEventListener('input',()=>{state[key]=Number(el.value);selectPreset('');syncUI();queueRender();});
      el.addEventListener('change',()=>commit());
      el.addEventListener('dblclick',()=>{state[key]=DEFAULT[key];selectPreset('');commit();queueRender();});
    });
    $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
    [['rotateLeftBtn',-90],['rotateRightBtn',90]].forEach(([id,v])=>$('#'+id).addEventListener('click',()=>{
      state.rotation=(state.rotation+v+360)%360;commit();queueRender();
    }));
    $('#flipHBtn').addEventListener('click',()=>{state.flipH=!state.flipH;commit();queueRender();});
    $('#flipVBtn').addEventListener('click',()=>{state.flipV=!state.flipV;commit();queueRender();});
    $('#cropMode').addEventListener('change',e=>{state.crop=e.target.value;commit();queueRender();});
    $('#zoomSlider').addEventListener('input',e=>{zoom=Number(e.target.value)/100;$('#zoomValue').textContent=e.target.value+'%';px.style.transform='scale('+zoom+')';});
    $('#fitBtn').addEventListener('click',()=>{zoom=1;$('#zoomSlider').value='100';$('#zoomValue').textContent='100%';px.style.transform='scale(1)';});
    const btn=$('#beforeBtn');
    const originalOn=()=>{if(!source)return;showOriginal=true;btn.classList.add('pressed');queueRender();};
    const originalOff=()=>{if(!showOriginal)return;showOriginal=false;btn.classList.remove('pressed');queueRender();};
    btn.addEventListener('pointerdown',e=>{btn.setPointerCapture(e.pointerId);originalOn();});
    btn.addEventListener('pointerup',originalOff);btn.addEventListener('pointercancel',originalOff);
    window.addEventListener('keydown',e=>{
      const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();openNative();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveImage();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
      if(!editing&&e.key.toLowerCase()==='b'&&!e.repeat)originalOn();
    });
    window.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='b')originalOff();});
    window.addEventListener('blur',originalOff);
    $('#formatSelect').addEventListener('change',e=>{
      $('#qualitySlider').disabled=e.target.value==='png';
      $('#qualityLabel').style.opacity=e.target.value==='png'?'0.4':'1';
    });
    $('#qualitySlider').addEventListener('input',e=>$('#qualityValue').textContent=e.target.value+'%');
    const zone=$('#dropZone'),over=$('#dropOverlay');
    for(let ev of ['dragenter','dragover'])zone.addEventListener(ev,e=>{e.preventDefault();over.hidden=false;});
    zone.addEventListener('dragleave',e=>{e.preventDefault();if(!zone.contains(e.relatedTarget))over.hidden=true;});
    zone.addEventListener('drop',async e=>{e.preventDefault();over.hidden=true;const f=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));await loadFile(f);});
    $('#savePresetBtn').addEventListener('click',async ()=>{
      const name=window.prompt('프리셋 이름을 입력하세요 (최대 25자)','내 사진 스타일');
      if(!name?.trim())return;
      const safe=name.trim().slice(0,25);
      const values=Object.fromEntries(ADJUST.map(k=>[k,state[k]]));
      try{
        const names=JSON.parse(localStorage.getItem('mentor:presets')||'[]');
        const unique=[...new Set([safe,...(Array.isArray(names)?names:[])])].slice(0,10);
        localStorage.setItem('mentor:presets',JSON.stringify(unique));
        localStorage.setItem('mentor:custom:'+safe,JSON.stringify(values));
        drawCustomPresets();
        if(window.mentorDesktop){
          await window.mentorDesktop.exportPreset(JSON.stringify({app:'MENTOR PHOTO',version:1,name:safe,adjustments:values},null,2));
        }
        notify('프리셋을 저장했습니다: '+safe);
      }catch(err){notify('프리셋 저장 실패: '+err.message);}
    });
    drawCustomPresets();syncUI();
    // In a normal web browser the same files run without the Electron bridge.
    if(!window.mentorDesktop)status('브라우저 미리보기 모드 · 모든 사진 보정은 로컬에서 작동합니다.');
  }
  // Override custom lookup to read namespaced settings correctly.
  function presetFromCustom(name) {return normalizedCustom(name);}
  // Use one canonical resolver in the preset handler:
  const originalClick=preset;
  preset=function(name) {
    if(name.startsWith('custom:')){
      if(!source)return notify('먼저 사진을 열어 주세요.');
      const p=presetFromCustom(name);
      if(!p)return;
      const geom={rotation:state.rotation,flipH:state.flipH,flipV:state.flipV,crop:state.crop};
      state={...DEFAULT,...p,...geom};selectPreset(name);commit();queueRender();
      return;
    }
    return originalClick(name);
  };
  document.addEventListener('DOMContentLoaded',init);
})();
