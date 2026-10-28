'use strict';
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const state={audio:null,rows:[],profiles:[],settings:null,recording:false,recorder:null,chunks:[],started:0,selectedPane:'transcribe',busy:false,recent:[]};
  const errorText=e=>e?.message||String(e);
  const toast=msg=>{const el=$('#toast');const raw=String(msg).replace(/^Error invoking remote method '[^']+': Error:\s*/,'');el.textContent=raw.length>190?raw.slice(0,185)+'… (AI 엔진 설정 → 최근 오류 진단에서 확인)':raw;el.hidden=false;clearTimeout(el._timer);el._timer=setTimeout(()=>el.hidden=true,6500);};
  const say=msg=>{$('#aiReply').textContent=msg;};
  const setBusy=on=>{state.busy=on;$$('.work-pane button,.prompts button,#aiSend').forEach(b=>{if(b.id==='recordBtn'&&state.recording)return;b.disabled=on;});};
  const addRecent=(title,detail)=>{state.recent.unshift({title,detail,at:new Date().toLocaleTimeString('ko-KR')});state.recent=state.recent.slice(0,6);$('#recentList').replaceChildren(...state.recent.map(item=>{const d=document.createElement('div');d.textContent=item.title+' · '+item.detail+' ('+item.at+')';return d;}));};
  const fmt=s=>{const v=Math.max(0,Math.round(Number(s)*1000));const h=Math.floor(v/3600000),m=Math.floor(v%3600000/60000),sec=Math.floor(v%60000/1000);return [h,m,sec].map(x=>String(x).padStart(2,'0')).join(':');};
  const rowText=()=>state.rows.map(r=>'['+fmt(r.start)+'] '+r.text).join('\n');
  function work(pane){
    if(pane==='home'){window.scrollTo({top:0,behavior:'smooth'});return;}
    if(!['clone','tts','transcribe','song','settings'].includes(pane))pane='transcribe';
    state.selectedPane=pane;
    const titles={clone:'목소리 학습',tts:'AI 아나운서',transcribe:'녹음 · 텍스트화',song:'노래 보컬 변환',settings:'AI 엔진 설정'};
    const subs={clone:'본인의 음성 샘플을 안전하게 저장해 참조 목소리로 사용합니다.',tts:'내 목소리로 한국어·영어·중국어·일본어를 읽습니다.',transcribe:'녹음·동영상 파일을 시간별 자막과 녹취록으로 정리합니다.',song:'허가받은 보컬 변환을 위한 RVC 통합 계획입니다.',settings:'로컬 음성 모델과 실행환경을 설치·확인합니다.'};
    $('#workTitle').textContent=titles[pane];$('#workSub').textContent=subs[pane];
    $$('.work-pane').forEach(x=>x.hidden=x.id!=='pane-'+pane);
    $$('.tabs [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===pane));
    $$('.nav [data-tab]').forEach(x=>x.classList.toggle('nav-active',x.dataset.tab===pane));
    $('#studio').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function updateSettings(){
    try{const s=await window.mentor.settings();state.settings=s;
      $('#sttState').textContent=s.transcribe?'설치됨':'미설치';$('#ttsState').textContent=s.voice?'설치됨':'미설치';
      $('#sysStt').textContent=s.transcribe?'설치됨 · 실작동 확인 전':'설치 필요';$('#sysTts').textContent=s.voice?'설치됨 · 실작동 확인 전':'설치 필요';
      $('#engineIndicator').textContent=s.transcribe&&s.voice?'● 로컬 AI 준비됨':s.transcribe?'● 전사 AI 준비됨':'● 엔진 설치 필요';
      if(s.transcribe)await refreshProfiles();
    }catch(e){$('#engineIndicator').textContent='● 확인 실패';}
  }
  async function openAudio(){
    if(state.busy)return;
    try{
      const obj=await window.mentor.openAudio();if(!obj)return;
      state.audio=obj;state.rows=[];
      $('#fileInfo').textContent=obj.name+' · '+(obj.size/1024/1024).toFixed(2)+' MB · 원본 보존';
      $('#transcriptRows').textContent='AI 음성 인식을 실행하면 시간별 대화 내용을 표시합니다.';
      $('#summaryText').textContent='전사 후 Codex 요약을 실행해 주세요.';
      try{$('#audioPreview').src=await window.mentor.preview(obj.path);}catch{$('#audioPreview').removeAttribute('src');}
      $('#audioPreview').load();work('transcribe');
      addRecent('파일 불러오기',obj.name);toast('오디오 파일을 선택했습니다.');
      if(state.settings?.transcribe){
        try{
          const meta=await window.mentor.job('probe',{path:obj.path});
          const day=meta.recorded_at||'기록 없음';
          $('#fileInfo').textContent=obj.name+' · '+(meta.duration===null?'길이 확인 불가':meta.duration.toFixed(1)+'초')+' · 녹음 시작 시각: '+day+' ('+meta.recorded_at_source+')';
        }catch(e){toast('파일 메타데이터: '+errorText(e));}
      }
    }catch(e){toast('파일 열기 오류: '+errorText(e));}
  }
  function wavBase64(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=()=>rej(Error('녹음 파일 인코딩 실패'));fr.readAsDataURL(blob);});}
  let timer;
  async function recordToggle(){
    if(state.recording){
      state.recorder?.stop();return;
    }
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw Error('마이크를 사용할 수 없습니다. Windows 마이크 권한을 확인해 주세요.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/webm','audio/ogg','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x));
      if(!mime)throw Error('이 기기에서 지원하는 녹음 형식이 없습니다.');
      const mr=new MediaRecorder(stream,{mimeType:mime});
      state.recorder=mr;state.chunks=[];state.recording=true;state.started=Date.now();
      $('#recordBtn').textContent='■ 녹음 종료';$('#recordBtn').classList.add('recording');
      timer=setInterval(()=>$('#recordTime').textContent=fmt((Date.now()-state.started)/1000),500);
      mr.addEventListener('dataavailable',e=>{if(e.data.size)state.chunks.push(e.data);});
      mr.addEventListener('stop',async()=>{
        clearInterval(timer);state.recording=false;$('#recordBtn').textContent='● 녹음 시작';$('#recordBtn').classList.remove('recording');stream.getTracks().forEach(x=>x.stop());
        try{
          const blob=new Blob(state.chunks,{type:mime});const encoded=await wavBase64(blob);
          if(blob.size>55*1024*1024)throw Error('녹음은 55MB 이내로 제한합니다.');
          state.audio=await window.mentor.recordSave(encoded,mime);
          $('#fileInfo').textContent='새 녹음: '+state.audio.name+' · 약 '+Math.round((Date.now()-state.started)/1000)+'초';
          $('#audioPreview').src=await window.mentor.preview(state.audio.path);$('#audioPreview').load();
          addRecent('마이크 녹음',state.audio.name);toast('녹음이 로컬에 저장됐습니다.');
        }catch(err){toast(errorText(err));}
      },{once:true});
      mr.start(1000);toast('마이크 녹음 중입니다.');
    }catch(e){toast('마이크 사용 오류: '+errorText(e));}
  }
  async function runTranscription(){
    if(!state.audio)return toast('먼저 음성·영상 파일을 불러오세요.');
    if(!state.settings?.transcribe){work('settings');return toast('먼저 Whisper 음성 인식 AI를 설치해 주세요.');}
    setBusy(true);
    try{
      say('녹음 파일을 실제로 분석 중입니다. CPU에서는 시간이 걸릴 수 있습니다.');
      const result=await window.mentor.job('transcribe',{path:state.audio.path,language:$('#sttLanguage').value||null,model:$('#sttModel').value});
      state.rows=result.segments;
      const target=$('#transcriptRows');target.replaceChildren();
      for(const r of state.rows){
        const row=document.createElement('div');row.className='segment';
        const time=document.createElement('time');time.textContent=fmt(r.start);
        const span=document.createElement('span');span.textContent=r.text;row.append(time,span);target.append(row);
      }
      if(!state.rows.length)target.textContent='감지된 음성 문장이 없습니다.';
      const duration=result.metadata?.duration;
      $('#fileInfo').textContent=state.audio.name+' · 인식 언어: '+result.language+' · 길이 '+(duration===null?'확인 불가':duration+'초')+' · 녹음 시작: '+(result.metadata?.recorded_at||'메타데이터 없음');
      addRecent('음성 전사',state.rows.length+'구간');say('실제 Whisper 전사가 완료됐습니다. TXT/SRT로 저장하거나 Codex 요약을 요청할 수 있습니다.');
      toast('시간별 녹취록 생성이 완료됐습니다.');
    }catch(e){toast('전사 실패: '+errorText(e));say('음성 인식 작업에 실패했습니다. 오류 메시지와 모델 설치 상태를 확인해 주세요.');}
    finally{setBusy(false);}
  }
  async function exportText(format){
    if(!state.rows.length)return toast('전사된 내용이 없습니다.');
    const txt=format==='srt'?state.rows.map((r,i)=>[i+1,fmt(r.start).replace('.',',')+',000 --> '+fmt(r.end).replace('.',',')+',000',r.text].join('\n')).join('\n\n'):rowText();
    // Use accurate millisecond formatting for SRT regardless of UI timestamp precision.
    const result=await window.mentor.job('export',{segments:state.rows,format});
    const path=await window.mentor.saveText(result.text,format);
    if(path)toast('저장 완료: '+path);
  }
  async function refreshProfiles(){
    if(!state.settings?.transcribe)return;
    try{state.profiles=await window.mentor.job('profiles',{}); renderProfiles();}
    catch(e){toast('프로필 확인 실패: '+errorText(e));}
  }
  function renderProfiles(){
    $('#profileCount').textContent=state.profiles.length+'개';
    const sel=$('#profileSelect');const previous=sel.value;sel.replaceChildren();
    if(!state.profiles.length){const o=new Option('먼저 목소리 학습을 진행하세요','');sel.add(o);}
    for(const p of state.profiles)sel.add(new Option(p.name+' ('+p.sample_seconds+'초)',p.id));
    if(state.profiles.some(p=>p.id===previous))sel.value=previous;
    const list=$('#profilesList'),right=$('#rightProfiles');list.replaceChildren();right.replaceChildren();
    if(!state.profiles.length){list.textContent='등록된 목소리가 없습니다.';right.textContent='내 목소리를 등록해 보세요.';return;}
    for(const p of state.profiles){
      const x=document.createElement('div');x.className='profile-item';const b=document.createElement('b');b.textContent=p.name;const s=document.createElement('small');s.textContent='참조 음성 · '+p.sample_seconds+'초';x.append(b,s);list.append(x);
      const y=document.createElement('div');y.className='right-voice';const sym=document.createElement('span');sym.className='right-voice-icon';sym.textContent='♪';const info=document.createElement('div');const title=document.createElement('b');title.textContent=p.name;const desc=document.createElement('small');desc.textContent='참조 음성 '+p.sample_seconds+'초';info.append(title,desc);y.append(sym,info);right.append(y);
    }
  }
  async function createProfile(){
    if(!state.audio)return toast('먼저 목소리가 담긴 음성 파일을 열거나 녹음해 주세요.');
    if(!$('#consent').checked)return toast('본인 음성 또는 허가받은 음성이라는 확인이 필요합니다.');
    if(!state.settings?.transcribe){work('settings');return toast('프로필 등록을 위해 먼저 음성 인식 AI 런타임을 설치해 주세요.');}
    setBusy(true);
    try{
      const p=await window.mentor.job('profile_add',{path:state.audio.path,name:$('#profileName').value,consent:true});
      await refreshProfiles();addRecent('목소리 프로필 등록',p.name);
      say('목소리 참조 샘플이 저장되었습니다. 아직 장기 말투 학습을 마친 모델은 아닙니다. 이제 AI 아나운서에서 사용하실 수 있습니다.');
      toast('음성 프로필 저장 완료: '+p.name);
    }catch(e){toast('프로필 생성 실패: '+errorText(e));}
    finally{setBusy(false);}
  }
  async function generateTTS(){
    if(!state.settings?.voice){work('settings');return toast('먼저 Chatterbox AI 음성 합성 엔진을 설치해 주세요.');}
    const profile=$('#profileSelect').value;if(!profile)return toast('사용할 목소리 프로필을 등록해 주세요.');
    setBusy(true);
    try{
      const o=await window.mentor.job('synth',{profile_id:profile,text:$('#ttsText').value,language:$('#ttsLanguage').value,style:$('#ttsStyle').value});
      $('#ttsResult').textContent='완료: '+o.path+' · '+o.description;
      try{$('#ttsAudio').src=await window.mentor.preview(o.path);$('#ttsAudio').load();}
      catch(e){toast('음성 합성 완료, 미리보기에는 표시할 수 없습니다: '+errorText(e));}
      addRecent('AI 음성 합성',o.voice+' / '+o.language);say('참조 목소리 음성 합성을 완료했습니다. 오른쪽 또는 하단의 플레이어에서 확인하세요.');
      toast('음성 생성이 완료됐습니다.');
    }catch(e){toast('음성 생성 실패: '+errorText(e));}
    finally{setBusy(false);}
  }
  async function installEngine(which){
    if(!confirm((which==='voice'?'Chatterbox 음성 합성':'Whisper 음성 인식')+' 모델을 실행하기 위한 Python 라이브러리를 다운로드·설치합니다. 저장 공간과 시간이 필요합니다. 진행하시겠습니까?'))return;
    setBusy(true);work('settings');
    try{say('로컬 AI 실행환경 설치 중입니다. 상태 메시지를 확인해 주세요.');await window.mentor.setup(which);await updateSettings();toast('음성 엔진 설치가 완료됐습니다.');}
    catch(e){toast('설치 실패: '+errorText(e));say('설치 오류: '+errorText(e));}
    finally{setBusy(false);}
  }
  async function codexSummary(){
    if(!state.rows.length)return toast('먼저 녹음을 전사해 주세요.');
    if(!confirm('녹취 텍스트를 본인이 로그인한 Codex CLI로 전송하여 AI 요약을 실행할까요? 녹음 파일 자체는 전송하지 않습니다.'))return;
    setBusy(true);
    try{
      const r=await window.mentor.codexSummary(rowText().slice(0,18000));
      $('#summaryText').textContent=r.text;addRecent('Codex AI 요약','완료');say('Codex CLI 요약이 완료됐습니다. 입력 원문은 작업 요청 시에만 처리되었습니다.');
    }catch(e){toast('Codex 연결 실패: '+errorText(e));say('Codex CLI 로그인이 없거나 지원 환경이 아닐 수 있습니다. 별도 API 키를 강요하지 않습니다.');}
    finally{setBusy(false);}
  }
  async function localAssistant(){
    const message=$('#aiInput').value.trim();
    if(!message)return;
    const intent=/노래|커버|보컬/.test(message)?'song':/요약|정리|핵심/.test(message)?'summary':/전사|텍스트|녹음.*글|자막/.test(message)?'transcribe':/등록|학습|프로필/.test(message)?'clone':/아나운서|말해|읽어|목소리.*만들|음성.*생성/.test(message)?'tts':null;
    $('#aiInput').value='';
    if(!intent){say('가능한 작업: 목소리 프로필 등록, AI 아나운서, 녹음 전사, Codex 요약입니다. 노래 변환은 아직 개발 중입니다.');return;}
    await intentAction(intent);
  }
  async function intentAction(intent){
    if(intent==='summary'){await codexSummary();return;}
    work(intent==='transcribe'?'transcribe':intent);
    if(intent==='transcribe'&&state.audio&&state.settings?.transcribe){await runTranscription();return;}
    if(intent==='tts'&&state.settings?.voice&&$('#profileSelect').value){await generateTTS();return;}
    if(intent==='clone'&&state.audio&&$('#consent').checked){await createProfile();return;}
    const msgs={transcribe:'파일을 선택하고 [AI 녹음 전사 실행]을 누르세요. AI 엔진이 없다면 [AI 엔진 설정]에서 설치해 주세요.',clone:'사용 권한이 있는 목소리 파일을 열고 동의 항목을 선택한 뒤 프로필 등록을 진행하세요.',tts:'목소리 프로필을 선택하고 낭독할 글을 입력하면 실제 음성을 생성합니다.',song:'노래 변환은 현재 준비 중입니다. 완료된 것으로 표시하지 않습니다.'};
    say(msgs[intent]);
  }
  function bind(){
    $$('[data-work]').forEach(b=>b.addEventListener('click',()=>work(b.dataset.work)));
    $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>work(b.dataset.tab)));
    $$('[data-intent]').forEach(b=>b.addEventListener('click',()=>intentAction(b.dataset.intent)));
    $('#heroStart').addEventListener('click',()=>work('transcribe'));
    $('#importBtn').addEventListener('click',openAudio);
    $('#recordBtn').addEventListener('click',recordToggle);
    $('#transcribeBtn').addEventListener('click',runTranscription);
    $('#exportTxt').addEventListener('click',()=>exportText('txt'));
    $('#exportSrt').addEventListener('click',()=>exportText('srt'));
    $('#createProfileBtn').addEventListener('click',createProfile);
    $('#refreshProfiles').addEventListener('click',refreshProfiles);
    $('#ttsBtn').addEventListener('click',generateTTS);
    $('#setupSTT').addEventListener('click',()=>installEngine('transcribe'));
    $('#setupTTS').addEventListener('click',()=>installEngine('voice'));
    $('#summarizeBtn').addEventListener('click',codexSummary);
    $('#diagnosticsBtn').addEventListener('click',async()=>{try{const d=await window.mentor.diagnostics();$('#diagnosticOutput').hidden=false;$('#diagnosticOutput').textContent='진단 파일 위치: '+d.path+'\n\n'+d.text;$('#diagnosticsCopy').hidden=false;}catch(e){toast(errorText(e));}});
    $('#diagnosticsCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#diagnosticOutput').textContent);toast('진단 내용을 복사했습니다.');}catch{toast('진단 내용을 선택한 뒤 Ctrl+C를 누르세요.');}});
    $('#aiSend').addEventListener('click',localAssistant);
    $('#aiInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();localAssistant();}});
    window.mentor.onProgress(s=>{if(s){$('#engineIndicator').textContent='◉ '+s.slice(0,32);$('#ttsResult').textContent=s;}});
  }
  document.addEventListener('DOMContentLoaded',()=>{if(!window.mentor){say('이 화면은 Electron 앱에서 실행해야 실제 음성 엔진에 연결됩니다.');return;}bind();updateSettings();});
})();