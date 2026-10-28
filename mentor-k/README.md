# MENTOR.K VOICE STUDIO v0.2.0

독립 Windows/macOS 설치 앱. 요청하신 MK 로고와 인물 사진, 블랙·골드 화면, 실제 작업 도우미를 포함합니다.

## 실제 연결 기능
- WAV/MP3/M4A/FLAC/OGG/WEBM/MP4/MOV 음성 또는 영상 파일 불러오기
- 앱 안에서 마이크 녹음, 개인 PC 로컬 폴더에 원본 저장
- 메타데이터 기반 녹음 시간 확인. 원본 메타데이터에 녹음 시작 시간이 없으면 '확인 불가'로 표시
- 앱 설정에서 무료 로컬 Python 런타임 및 faster-whisper 설치. 최초 모델 다운로드 후 한국어/영어/중국어/일본어 녹취 및 시간 코드
- TXT/SRT 내보내기
- 사용 허락 확인 후 목소리 참조 프로필 등록, PyAV의 WAV 정규화
- 앱 설정에서 Chatterbox Multilingual 설치. 실제 AI WAV 음성 합성(한국어/영어/중국어/일본어), PC 모델·사양 호환 필요
- AI 도우미의 작업 실행(프로필 생성·전사·음성 합성) 및 선택적 Codex CLI 텍스트 요약

## 현재 지원하지 않는 기능
- RVC 노래 보컬 변환과 장기 말투 모델 학습은 개발 전 단계이며, 사용 가능한 기능으로 표시하지 않았습니다.
- Google OAuth 계정 로그인, 자동 Google Drive 동기화
- 외부 프로그램에서 ChatGPT Plus 구독을 무제한 공유하는 기능
- Windows/macOS 모든 장치에서의 실제 모델 합성 품질 검증과 앱 자동 업데이트

## 사용법
1. GitHub Actions의 Build MENTOR.K VOICE STUDIO Installers에서 Windows EXE 또는 Mac DMG 결과물 다운로드
2. 앱 실행 후 AI 엔진 설정에서 '인식 AI 설치' 버튼 클릭. 첫 다운로드는 인터넷과 저장 공간이 필요
3. 녹음 파일을 열거나 마이크로 녹음, 'AI 녹음 전사 실행' 클릭
4. TXT·SRT 저장
5. 음성 복제는 참조 음성을 준비하고 동의 후 프로필 등록. '음성 AI 설치' 후 AI 아나운서에서 실제 합성. GPU 권장

별도의 유료 생성 API 키는 필수가 아닙니다. 음성 모델 설치 파일은 크고 CPU 환경에서 느릴 수 있습니다. Codex 요약은 설치된 공식 Codex CLI를 통해 기존 로그인 상태로 실행하므로, CLI가 없다면 사용 불가하며 계정 구독과 모델/API 사용권이 같다는 뜻은 아닙니다.

## 라이선스/권한
MENTOR.K 자체 UI 소스: MIT. faster-whisper(MIT), Chatterbox(MIT), uv(Apache-2.0 or MIT). 모델 체크포인트의 이용조건은 별도로 확인해야 합니다. 본인 목소리나 명시적 허락을 받은 사람의 목소리만 등록하세요.

## 배포
독립 빌드 브랜치 mentor-k-voice-studio. 홈페이지 main 브랜치 및 NARAE OFFICE는 변경하지 않습니다. Windows 코드 서명 및 Mac 공증이 아직 없습니다.
