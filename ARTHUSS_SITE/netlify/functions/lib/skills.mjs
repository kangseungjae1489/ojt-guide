import {randomBytes,createHash} from 'node:crypto';
const CHUNK=1024*1024,MAX=100*CHUNK;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const hash=b=>createHash('sha256').update(b).digest('hex');
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||required&&!value.trim())throw fail(400,'자료 정보를 확인해 주세요.');return value.trim()};
const idOf=id=>{if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))throw fail(400,'자료 번호가 올바르지 않습니다.');return id};
export async function handleSkills({action,b,req,store,now}){
 const get=async key=>(await store.getWithMetadata(key,{type:'json'}))?.data;
 const send=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 const catalog=async()=>await get('skills-catalog')||[];
 if(action==='skills-list')return send({files:await catalog(),maxSize:MAX,chunkSize:CHUNK});
 if(action==='skills-start'){
  const name=text(b.name,180,true);if(!/\.(zip|html|md|txt|pdf)$/i.test(name)||/[\/\\\r\n]/.test(name))throw fail(400,'ZIP·HTML·MD·TXT·PDF 파일만 등록할 수 있습니다.');
  if(!Number.isSafeInteger(b.size)||b.size<1||b.size>MAX)throw fail(400,'파일 크기는 1바이트~100MB로 등록해 주세요.');
  if(typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256))throw fail(400,'파일 검증값이 올바르지 않습니다.');
  if((await catalog()).length>=200)throw fail(409,'등록 가능한 자료 수를 초과했습니다.');
  const item={id:randomBytes(16).toString('hex'),name,title:text(b.title,100,true),description:text(b.description,800),category:text(b.category,30,true),version:text(b.version,30),size:b.size,sha256:b.sha256,chunks:Math.ceil(b.size/CHUNK),chunkSize:CHUNK,createdAt:now()};
  await store.setJSON('skills-upload:'+item.id,item,{onlyIfNew:true});return send({id:item.id,chunks:item.chunks,chunkSize:CHUNK});
 }
 if(action==='skills-upload'){
  const id=idOf(b.id),item=await get('skills-upload:'+id);if(!item)throw fail(404,'등록 작업을 찾을 수 없습니다.');
  if(now()-item.createdAt>24*3600000)throw fail(409,'등록 시간이 만료됐습니다. 다시 등록해 주세요.');
  if(!Number.isInteger(b.index)||b.index<0||b.index>=item.chunks)throw fail(400,'파일 조각 번호가 올바르지 않습니다.');
  if(typeof b.data!=='string'||b.data.length>4*Math.ceil(CHUNK/3)||(b.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data)))throw fail(400,'파일 조각 형식이 올바르지 않습니다.');
  const data=Buffer.from(b.data,'base64'),expected=b.index===item.chunks-1?item.size-CHUNK*b.index:CHUNK;
  if(data.length!==expected)throw fail(400,'파일 크기가 일치하지 않습니다.');
  const key='skills-chunk:'+id+':'+b.index,sha256=hash(data),saved=await get(key);if(saved){if(saved.sha256!==sha256)throw fail(409,'이미 저장된 조각과 다릅니다.');return send({ok:true})}
  const result=await store.setJSON(key,{data:b.data,sha256},{onlyIfNew:true});if(!result.modified){const other=await get(key);if(other?.sha256!==sha256)throw fail(409,'다른 업로드와 겹쳤습니다.');}return send({ok:true});
 }
 if(action==='skills-finish'){
  const id=idOf(b.id),item=await get('skills-upload:'+id);if(!item)throw fail(404,'등록 작업을 찾을 수 없습니다.');
  const digest=createHash('sha256');for(let i=0;i<item.chunks;i++){const chunk=await get('skills-chunk:'+id+':'+i);if(!chunk)throw fail(409,'아직 파일 전송이 완료되지 않았습니다.');digest.update(Buffer.from(chunk.data,'base64'))}if(digest.digest('hex')!==item.sha256)throw fail(400,'파일 검증에 실패했습니다. 다시 등록해 주세요.');
  for(let i=0;i<6;i++){const row=await store.getWithMetadata('skills-catalog',{type:'json'}),files=row?.data||[];if(files.some(f=>f.id===id))return send({ok:true});if(files.length>=200)throw fail(409,'등록 가능한 자료 수를 초과했습니다.');files.unshift(item);const result=await store.setJSON('skills-catalog',files,row?.etag?{onlyIfMatch:row.etag}:{onlyIfNew:true});if(result.modified)return send({ok:true})}throw fail(409,'다른 변경과 겹쳤습니다. 다시 시도해 주세요.');
 }
 if(action==='skills-file'){
  const params=new URL(req.url).searchParams,id=idOf(params.get('id')),item=(await catalog()).find(f=>f.id===id);if(!item)throw fail(404,'등록된 자료를 찾을 수 없습니다.');const raw=params.get('index');if(!/^(0|[1-9][0-9]*)$/.test(raw||''))throw fail(400,'파일 조각 번호가 올바르지 않습니다.');const index=Number(raw);if(index>=item.chunks)throw fail(400,'파일 조각 번호가 올바르지 않습니다.');const chunk=await get('skills-chunk:'+id+':'+index);if(!chunk)throw fail(503,'파일을 읽지 못했습니다. 다시 시도해 주세요.');return send(chunk);
 }
 throw fail(404,'요청을 찾을 수 없습니다.');
}
