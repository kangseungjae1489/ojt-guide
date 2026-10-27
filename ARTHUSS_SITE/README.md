# ARTHUSS 자료실 회원 기능

기존 도서관 화면을 유지하면서 회원가입(아이디·비밀번호·이름), 로그인, FREE / PREMIUM / ADMIN, 관리자 회원 추가·등급 변경·정지·임시 비밀번호 발급을 제공합니다. PRIVATE ACCESS 설정 데이터는 서버가 ADMIN에게만 반환합니다.

## Netlify 활성화

기존 `arthuss` 프로젝트에만 적용합니다. `arthus-home`은 변경하지 않습니다.

1. Project configuration → Environment variables → Add a variable.
2. Key: `ARTHUS_ADMIN_PASSWORD`. Value: 사용자가 지정한 관리자 초기 비밀번호. Secret으로 표시하고 Functions 실행 환경에 적용합니다. 공개 코드에는 입력하지 않습니다.
3. Build settings에서 Base directory를 `ARTHUSS_SITE`, Build command는 빈칸, Publish directory는 `public`, Functions directory는 `netlify/functions`로 설정합니다. 경로는 Base directory 기준입니다.
4. 새 배포를 실행합니다. 프로젝트 초기 기본 관리자 아이디는 `admin`입니다. 환경변수는 최초 계정 생성 때만 비밀번호로 사용됩니다. 이후 변경은 로그인 화면의 내 비밀번호 변경에서 처리합니다.
5. 관리자 로그인 후 회원 관리에서 FREE/PREMIUM 회원을 추가합니다. 직접 가입한 회원은 FREE가 됩니다. 관리자가 발급한 임시 비밀번호는 첫 로그인 후 변경해야 합니다.

이름은 회원 확인용입니다. 이메일·휴대폰을 수집하지 않으므로 비밀번호를 잊은 회원은 관리자에게 초기화를 요청합니다. 초기 관리자 비밀번호는 로그인 후 8자 이상으로 변경하는 것을 권장합니다.

## 저장 및 보호 범위

회원 정보는 해당 Netlify 사이트의 Netlify Blobs 저장소에 보관합니다. 비밀번호는 scrypt 해시로만 저장합니다. 세션은 HttpOnly·Secure·SameSite 쿠키와 서버 저장소로 관리하며 8시간 후 만료됩니다. 회원 정지/등급 변경/비밀번호 변경 시 이전 세션은 무효화됩니다. 서버 설정이 없거나 연결에 실패하면 입장을 허용하지 않습니다.

현재 8개 공개 방의 자료 분류/유료 자료 지정은 이 버전에 추가하지 않았습니다. PRIVATE ACCESS의 실제 자료 URL은 아직 비어 있습니다. 서버가 숨겨주는 비공개 링크를 연결하더라도 목적지 파일이 공개 URL이면 그 파일 자체는 보호되지 않습니다. 민감한 실제 문서는 별도의 서버 다운로드 권한 검사와 비공개 저장소가 필요합니다. 이 코드는 기존 외부 공개 파일을 자동으로 비공개 전환하지 않습니다.

기존 원본 root index.html은 시연본으로 남아 있습니다. 실제 비공개 자료를 연결하기 전에 원본 시연본과 GitHub 공개 저장소에 자료나 비밀값이 포함되지 않는지 점검해야 합니다. ADMIN만 변경할 수 있는 기존 링크 설정은 원래처럼 브라우저별 저장 방식입니다. 여러 기기 공유와 파일 업로드는 별도 작업입니다.

동작 검사: `node --test tests/auth.test.mjs`. 실제 Netlify 배포·저장소 연결·쿠키 동작은 활성화 이후 확인해야 합니다.

## AI SKILLS 관리자 자료실

ARCHIVE 자리는 AI SKILLS로 연결됩니다. `/skills.html`은 ADMIN API 확인 이후 콘텐츠를 표시합니다. FREE/PREMIUM은 목록·업로드·다운로드 API에서 403을 받습니다.

실제 자료는 GitHub 또는 `public/`에 넣지 않습니다. ADMIN 로그인 → AI SKILLS → 비공개 자료 등록에서 ZIP/HTML/MD/TXT/PDF(100MiB 이하)를 선택해 등록합니다. 첨부 통합팩은 별도 최초 등록이 필요합니다. 이후 같은 화면에서 새 자료와 새 버전을 추가할 수 있습니다. 공개 GitHub Releases 연결은 하지 않습니다.

파일은 기존 사이트의 `arthus-members-v1` Netlify Blobs 저장소에 `skills-upload:*`, `skills-chunk:*`, `skills-catalog` 키로 저장합니다. 파일을 1MiB 조각으로 전송해 Functions 요청/응답 크기 제한을 피합니다. 목록 공개 전 서버에서 전체 SHA-256을 검증하고, 내려받을 때도 브라우저가 조각/전체 해시를 검증합니다. 다운로드 조각마다 기존 ADMIN 세션을 다시 검사합니다. 파일은 브라우저 메모리에 합친 뒤 저장하므로 큰 파일은 데스크톱 사용을 권장합니다. 등록 실패 시 파일을 다시 등록할 수 있고, 미완료 조각은 목록에 노출되지 않습니다. 미완료 조각 자동 청소/삭제 UI는 아직 없습니다. 원본은 별도로 보관하세요.
