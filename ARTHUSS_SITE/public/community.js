'use strict';
const button=document.getElementById('downloadBtn'),status=document.getElementById('downloadStatus');
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='현재 회원 권한을 확인하고 있습니다…';
 try{const response=await fetch('/.netlify/functions/auth?action=download',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(response.status===401){status.textContent='자료실에서 먼저 로그인해주세요. 다운로드는 PREMIUM·ADMIN 전용입니다.';return}if(!response.ok)throw Error(data.error||'권한을 확인하지 못했습니다.');status.textContent=data.message||'다운로드 권한이 있습니다. 설치파일은 준비 중입니다.';button.textContent='설치파일 준비 중';}
 catch(error){status.textContent=error.message==='Failed to fetch'?'서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.':error.message}
 finally{button.disabled=false}
});
