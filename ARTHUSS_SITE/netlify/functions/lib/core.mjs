import {handleSkills} from './skills.mjs';
import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback), digest=s=>createHash('sha256').update(s).digest('hex');
const cookieName='__Host-arthus_session',ttl=8*3600*1000;
export async function hashPassword(p){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(p,salt,64)).toString('hex')}
export async function verifyPassword(p,h){try{const [salt,hex]=h.split(':');const b=Buffer.from(hex,'hex'),a=await scrypt(p,salt,64);return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}}
const safeUser=u=>({id:u.id,name:u.name,role:u.role,active:u.active,mustChange:!!u.mustChange});
const failure=(status,msg)=>Object.assign(new Error(msg),{status});
const idOf=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{3,32}$/.test(id))throw failure(400,'아이디는 영문·숫자·밑줄·하이픈 3~32자로 입력해 주세요.');return id.toLowerCase()};
function details(b){const id=idOf(b.id);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>60)throw failure(400,'이름을 입력해 주세요.');if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)throw failure(400,'비밀번호는 8~128자로 입력해 주세요.');return {id,name:b.name.trim(),password:b.password}}
export function makeHandler({store,env,privateConfig,now=Date.now}){
 async function read(){const row=await store.getWithMetadata('members',{type:'json'});return row||{data:{users:{},sessions:{},limits:{}},etag:null}}
 async function transaction(edit){for(let n=0;n<6;n++){const row=await read();const state=row.data;const result=await edit(state);const r=await store.setJSON('members',state,row.etag?{onlyIfMatch:row.etag}:{onlyIfNew:true});if(r.modified)return result}throw failure(409,'다른 변경과 겹쳤습니다. 다시 시도해 주세요.')}
 async function bootstrap(){if(!env.ARTHUS_ADMIN_PASSWORD)throw failure(503,'관리자 초기 설정이 필요합니다. 운영자에게 문의해 주세요.');const row=await read();if(!row.data.users.admin){const hash=await hashPassword(env.ARTHUS_ADMIN_PASSWORD);await transaction(s=>{s.users.admin??={id:'admin',name:'관리자',role:'ADMIN',hash,active:true,version:1,mustChange:false}})}}
 function token(req){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''}
 function authenticate(s,req){const ss=s.sessions[digest(token(req))];const u=ss&&s.users[ss.id];if(!ss||ss.expires<now()||!u||!u.active||u.version!==ss.version)throw failure(401,'로그인이 필요합니다.');return u}
 function admin(u){if(u.role!=='ADMIN')throw failure(403,'ADMIN 등급만 이용할 수 있습니다.')}
 async function throttle(req,b,action){const id=typeof b.id==='string'?b.id.toLowerCase().slice(0,32):'';const ip=req.headers.get('x-nf-client-connection-ip')||'unknown';const keys=[digest(action+':ip:'+ip),digest(action+':id:'+id)];await transaction(s=>{s.limits=Object.fromEntries(Object.entries(s.limits).filter(([,v])=>v.until>now()));for(const k of keys){const limit=s.limits[k]||{n:0,until:now()+15*60000};if(limit.n>=(action==='login'?10:5))throw failure(429,'시도가 많습니다. 15분 뒤 다시 시도해 주세요.');limit.n++;s.limits[k]=limit}})}
 return async req=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
   const action=new URL(req.url).searchParams.get('action')||'me';
   if(!['GET','POST'].includes(req.method))throw failure(405,'지원하지 않는 요청입니다.');
   if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)throw failure(403,'허용되지 않은 요청입니다.');
   if(req.method==='GET'&&!['me','users','private','download','skills-list','skills-file'].includes(action))throw failure(405,'POST 요청이 필요합니다.');
   let b={};if(req.method==='POST'){if(!req.headers.get('content-type')?.includes('application/json'))throw failure(415,'JSON 요청이 필요합니다.');const raw=await req.text();if(raw.length>(action==='skills-upload'?1500000:8192))throw failure(413,'요청이 너무 큽니다.');try{b=JSON.parse(raw)}catch{throw failure(400,'입력 형식이 올바르지 않습니다.')}}
   await bootstrap();
   if(action==='register'||action==='login'){
    await throttle(req,b,action);
    if(action==='register'){const d=details(b),hash=await hashPassword(d.password);await transaction(s=>{if(s.users[d.id])throw failure(409,'이미 사용 중인 아이디입니다.');if(Object.keys(s.users).length>=500)throw failure(409,'가입 가능 인원을 초과했습니다.');s.users[d.id]={id:d.id,name:d.name,role:'FREE',hash,active:true,version:1,mustChange:false}});return send({ok:true})}
    const id=idOf(b.id);if(typeof b.password!=='string'||b.password.length>128)throw failure(400,'비밀번호를 확인해 주세요.');const row=await read(),u=row.data.users[id];const dummy='00000000000000000000000000000000:'+('00'.repeat(64));const valid=await verifyPassword(b.password,u?.hash||dummy);if(!u||!u.active||!valid)throw failure(401,'아이디 또는 비밀번호를 확인해 주세요.');const t=randomBytes(32).toString('hex');await transaction(s=>{const current=s.users[id];if(!current?.active||current.hash!==u.hash)throw failure(401,'다시 로그인해 주세요.');s.sessions=Object.fromEntries(Object.entries(s.sessions).filter(([,v])=>v.expires>now()));s.sessions[digest(t)]={id,version:current.version,expires:now()+ttl}});headers['Set-Cookie']=cookieName+'='+t+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800';return send({user:safeUser(u)})
   }
   const row=await read(),u=authenticate(row.data,req);
   if(action==='me')return send({user:safeUser(u)});
   if(action==='logout'){await transaction(s=>{delete s.sessions[digest(token(req))]});headers['Set-Cookie']=cookieName+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';return send({ok:true})}
   if(action==='password'){if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)throw failure(400,'새 비밀번호는 8~128자로 입력해 주세요.');if(typeof b.currentPassword!=='string'||!await verifyPassword(b.currentPassword,u.hash))throw failure(400,'현재 비밀번호를 확인해 주세요.');const hash=await hashPassword(b.password);await transaction(s=>{const me=authenticate(s,req);if(me.hash!==u.hash)throw failure(409,'다시 로그인해 주세요.');me.hash=hash;me.version++;me.mustChange=false});headers['Set-Cookie']=cookieName+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';return send({ok:true})}
   if(u.mustChange)throw failure(403,'임시 비밀번호를 먼저 변경해 주세요.');
   if(action==='download'){if(!['PREMIUM','ADMIN'].includes(u.role))throw failure(403,'PREMIUM MEMBER와 ADMIN만 다운로드할 수 있습니다.');const files=[{"id":"windows","label":"Windows 다운로드","name":"NaraeOffice-Setup-1.0.0.exe","size":192590884,"url":"https://github.com/narae0930/narae-office/releases/download/v1.0.0/NaraeOffice-Setup-1.0.0.exe"},{"id":"mac-arm64","label":"Mac · Apple Silicon","name":"NaraeOffice-1.0.0-arm64.dmg","size":239115963,"url":"https://github.com/narae0930/narae-office/releases/download/v1.0.0/NaraeOffice-1.0.0-arm64.dmg"},{"id":"mac-intel","label":"Mac · Intel","name":"NaraeOffice-1.0.0-x64.dmg","size":245092467,"url":"https://github.com/narae0930/narae-office/releases/download/v1.0.0/NaraeOffice-1.0.0-x64.dmg"}];const selected=new URL(req.url).searchParams.get('file');if(selected){const file=files.find(f=>f.id===selected);if(!file)throw failure(400,'지원하지 않는 설치파일입니다.');return send({available:true,version:'1.0.0',...file})}return send({available:true,version:'1.0.0',files:files.map(({url,...file})=>file)})}
   if(action==='private'){admin(u);return send({private:privateConfig})}
   admin(u);
   if(action.startsWith('skills-'))return await handleSkills({action,b,req,store,now});
   if(action==='users')return send({users:Object.values(row.data.users).map(safeUser)});
   if(action==='create'){const d=details(b);if(!['FREE','PREMIUM'].includes(b.role))throw failure(400,'등급을 확인해 주세요.');const hash=await hashPassword(d.password);await transaction(s=>{admin(authenticate(s,req));if(s.users[d.id])throw failure(409,'이미 사용 중인 아이디입니다.');s.users[d.id]={id:d.id,name:d.name,role:b.role,hash,active:true,version:1,mustChange:true}});return send({ok:true})}
   if(action==='update'){const id=idOf(b.id);if(id==='admin')throw failure(400,'기본 관리자 계정은 변경할 수 없습니다.');if(!['FREE','PREMIUM'].includes(b.role)||typeof b.active!=='boolean')throw failure(400,'등급과 이용 상태를 확인해 주세요.');let hash;if(b.password){if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)throw failure(400,'임시 비밀번호는 8~128자로 입력해 주세요.');hash=await hashPassword(b.password)}await transaction(s=>{admin(authenticate(s,req));const target=s.users[id];if(!target)throw failure(404,'회원을 찾을 수 없습니다.');target.role=b.role;target.active=b.active;target.version++;if(hash){target.hash=hash;target.mustChange=true}});return send({ok:true})}
   throw failure(404,'요청을 찾을 수 없습니다.');
  }catch(e){return send({error:e.status?e.message:'서버 연결을 확인해 주세요.'},e.status||503)}
 }
}
