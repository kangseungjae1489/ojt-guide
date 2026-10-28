# MENTOR PHOTO 0.1.0

Independent, offline photo editor for Windows and macOS.
Original UI and image processing based on web Canvas. It does not contain code, models, filters, branding, or paid assets from Polarr Photo Editor Pro.

## 기능
- JPG/PNG/WEBP/BMP/GIF/AVIF 이미지 열기(형식별 OS/Chromium 지원 범위 적용)
- 노출, 밝기, 대비, 하이라이트, 그림자, 온도, 색조, 채도, 생동감, 색상 이동
- 선명도, 비네팅, 페이드, 필름 입자
- 오리지널 프리셋 8종 및 사용자 지정 프리셋 저장
- 실행 취소/다시 실행, 원본 비교(B), 회전, 반전, 중앙 비율 크롭
- JPEG/PNG 내보내기, 품질 설정, 로컬 데이터 처리
- 이미지 렌더링은 Chromium Canvas API. 인터넷, 회원가입, 외부 AI 연결 불필요
- Windows 설치 EXE 및 Mac DMG 자동 빌드

## 앱이 제공하지 않는 기능
Polarr Pro의 원본 알고리즘, 인물 인식 AI, 객체 분할, 정교한 브러시/반경 마스크, 배치 내보내기, RAW 현상 및 3D LUT 기능은 현재 제공하지 않습니다. 프리셋은 Polarr 유료 필터를 복제한 것이 아니라 독자적으로 정의한 값입니다.

## 개발 실행
Node.js 22 이상 설치 후, 이 폴더에서:
    npm install
    npm start

## 수동 설치파일 제작
    npm run check
    npm run dist:win     # Windows에서
    npm run dist:mac     # macOS에서
완성된 파일: dist/

## GitHub Actions
GitHub 저장소의 mentor-photo-editor 브랜치에서 Build MENTOR PHOTO Installer 워크플로우가 자동으로 Windows EXE와 macOS DMG를 빌드합니다. 각 작업의 Artifacts에서 다운로드하십시오. 홈페이지의 main 브랜치는 변경하지 않습니다.

## 제한과 주의
편집본은 앱에 업로드/전송되지 않습니다. 보정한 출력은 최대 12MP로 저장해 메모리 과부하를 방지합니다. 원본 사진은 수정되지 않습니다.
배포 전 Windows/macOS에서 실제 사진 열기·편집·내보내기 테스트가 필요하며, 서명되지 않은 설치파일은 OS 보안 경고를 표시할 수 있습니다.

License: MIT for original MENTOR source only. Third-party packages follow their own licenses.
