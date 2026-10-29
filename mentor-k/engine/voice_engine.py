#!/usr/bin/env python3
"""MENTOR.K local AI jobs. No external paid API calls. JSON stdin and stdout."""
from __future__ import annotations
import sys,json,os,wave,uuid,datetime,traceback,re,pathlib,math
# Windows may default to CP949. Force UTF-8 JSON across Electron <-> Python IPC.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, 'reconfigure'):
        _stream.reconfigure(encoding='utf-8', errors='replace')

DATA=pathlib.Path(os.environ.get('MENTOR_K_DATA',str(pathlib.Path.home()/ 'MENTOR_K_DATA')))
for part in ('profiles','outputs'):
    (DATA/part).mkdir(parents=True,exist_ok=True)

def output():
    return str(DATA/'outputs'/('mentor_'+datetime.datetime.now().strftime('%Y%m%d_%H%M%S')+'_'+uuid.uuid4().hex[:5]+'.wav'))
def safe_path(value):
    p=pathlib.Path(value).resolve()
    if not p.is_file() or p.stat().st_size>350_000_000: raise ValueError('유효한 오디오 파일(350MB 이하)을 선택해 주세요.')
    if p.suffix.lower() not in {'.wav','.mp3','.m4a','.flac','.ogg','.opus','.webm','.aac','.mp4','.mov'}:raise ValueError('오디오 또는 동영상 파일만 선택할 수 있습니다.')
    return p
def decode_wav(src,dest):
    import av
    import numpy as np
    source=av.open(str(safe_path(src)))
    out=wave.open(str(dest),'wb');out.setnchannels(1);out.setsampwidth(2);out.setframerate(24000)
    resampler=av.audio.resampler.AudioResampler(format='s16',layout='mono',rate=24000)
    for frame in source.decode(audio=0):
        for f in resampler.resample(frame):
            raw=f.to_ndarray()
            out.writeframes(raw.tobytes())
    for f in resampler.resample(None):
        out.writeframes(f.to_ndarray().tobytes())
    out.close();source.close()
def probe(path):
    import av
    p=safe_path(path);c=av.open(str(p))
    stream=next((s for s in c.streams if s.type=='audio'),None)
    if stream is None:raise ValueError('오디오 트랙이 없습니다.')
    meta={**dict(c.metadata),**dict(stream.metadata)}
    start=meta.get('creation_time') or meta.get('date') or meta.get('recorded_date')
    duration=round(float(c.duration or 0)/1_000_000,3) if c.duration else (float(stream.duration*stream.time_base) if stream.duration else None)
    result=dict(name=p.name,size=p.stat().st_size,duration=duration,sample_rate=stream.sample_rate,
                channels=stream.channels,recorded_at=start,recorded_at_source='녹음 파일 메타데이터' if start else '확인 불가 (파일 생성일을 녹음일로 간주하지 않음)')
    c.close();return result
def profile_add(job):
    if not job.get('consent'):raise ValueError('본인 목소리 또는 사용 허가받은 목소리만 등록할 수 있습니다.')
    name=re.sub(r'[^\w가-힣 .-]','',str(job.get('name','내 목소리')))[:45].strip() or '내 목소리'
    p=safe_path(job['path'])
    ident=uuid.uuid4().hex[:10];directory=DATA/'profiles'/ident;directory.mkdir()
    target=directory/'reference.wav'
    decode_wav(p,target)
    with wave.open(str(target),'rb') as w:duration=w.getnframes()/w.getframerate()
    if duration<3:raise ValueError('목소리 샘플은 최소 3초 이상 필요합니다. 20~60초를 권장합니다.')
    record={'id':ident,'name':name,'sample':str(target),'created_at':datetime.datetime.now().astimezone().isoformat(),
            'sample_seconds':round(duration,2),'consent':True,'type':'zero-shot reference (not fine-tuned)'}
    (directory/'profile.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    return record
def profiles():
    found=[]
    for p in (DATA/'profiles').glob('*/profile.json'):
        try:
            j=json.loads(p.read_text(encoding='utf-8'))
            if pathlib.Path(j['sample']).is_file():found.append(j)
        except Exception:pass
    return sorted(found,key=lambda x:x['created_at'],reverse=True)
def transcribe(job):
    from faster_whisper import WhisperModel
    p=safe_path(job['path']);language=job.get('language')
    if language not in ('ko','en','zh','ja',None):raise ValueError('한국어/영어/중국어/일본어만 선택해 주세요.')
    model=str(job.get('model','base'))
    if model not in ('tiny','base','small'):raise ValueError('지원하지 않는 모델 크기')
    m=WhisperModel(model,device='cpu',compute_type='int8',download_root=str(DATA/'models'/'whisper'))
    segments,info=m.transcribe(str(p),language=language,vad_filter=True,beam_size=4,condition_on_previous_text=False)
    rows=[{'start':round(s.start,3),'end':round(s.end,3),'text':s.text.strip()} for s in segments if s.text.strip()]
    return {'segments':rows,'language':info.language,'file':p.name,'metadata':probe(path=p)}
def synth(job):
    profile=next((x for x in profiles() if x['id']==job.get('profile_id')),None)
    if profile is None:raise ValueError('먼저 학습용 목소리를 등록해 주세요.')
    text=str(job.get('text','')).strip()
    if not (1<=len(text)<=1200):raise ValueError('문장 길이는 1~1200자로 입력해 주세요.')
    language=job.get('language','ko')
    if language not in ('ko','en','zh','ja'):raise ValueError('한국어/영어/중국어/일본어만 지원합니다.')
    try:
        import torch
        import torchaudio
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except Exception as e:
        raise RuntimeError('Chatterbox 엔진을 설치해 주세요. 원인: '+str(e)) from e
    device='cuda' if torch.cuda.is_available() else ('mps' if getattr(torch.backends,'mps',None) and torch.backends.mps.is_available() else 'cpu')
    model=ChatterboxMultilingualTTS.from_pretrained(device=device)
    styles={'natural':(0.50,0.45),'announcer':(0.30,0.55),'lecture':(0.34,0.48),'warm':(0.66,0.36)}
    ex,cfg=styles.get(job.get('style'),styles['natural'])
    import inspect
    kwargs={'audio_prompt_path':profile['sample'],'language_id':language}
    params=inspect.signature(model.generate).parameters
    if 'exaggeration' in params:kwargs['exaggeration']=ex
    if 'cfg_weight' in params:kwargs['cfg_weight']=cfg
    wav=model.generate(text,**kwargs)
    dest=output()
    torchaudio.save(dest,wav.cpu(),model.sr)
    return {'path':dest,'language':language,'style':job.get('style'),'voice':profile['name'],
            'description':'참조 음색을 사용하는 음성 합성입니다. 장기 말투 파인튜닝은 아닙니다.'}
def secs(t,delim='.'):
    ms=max(0,round(float(t)*1000));h,rem=divmod(ms,3600000);m,rem=divmod(rem,60000);s,ms=divmod(rem,1000)
    return f'{h:02}:{m:02}:{s:02}{delim}{ms:03}'
def export(job):
    rows=job.get('segments',[]);format=job.get('format','txt')
    if format=='srt':
        payload='\n\n'.join(f'{i}\n{secs(r["start"],",")} --> {secs(r["end"],",")}\n{r["text"]}' for i,r in enumerate(rows,1))
    else:
        payload='\n'.join(f'[{secs(r["start"])}] {r["text"]}' for r in rows)
    return {'text':payload,'format':format}
def main():
    cmd=sys.argv[1] if len(sys.argv)>1 else ''
    job=json.load(sys.stdin)
    calls={'probe':lambda:probe(job['path']),'profile_add':lambda:profile_add(job),'profiles':profiles,
           'transcribe':lambda:transcribe(job),'synth':lambda:synth(job),'export':lambda:export(job)}
    if cmd not in calls:raise ValueError('Unknown command: '+cmd)
    result=calls[cmd]()
    print(json.dumps({'ok':True,'result':result},ensure_ascii=False))
if __name__=='__main__':
    try: main()
    except Exception as e:
        print(json.dumps({'ok':False,'error':str(e)},ensure_ascii=False))
        sys.exit(1)
