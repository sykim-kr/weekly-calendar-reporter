# 주간 캘린더 이벤트 → Google Sheets 적재 웹앱 구현 계획

## 아키텍처 변경사항
- ~~Node.js + Express 로컬 서버~~ → **순수 클라이언트 사이드 (정적 사이트)**
- Google Identity Services + gapi로 브라우저에서 직접 OAuth + API 호출
- Netlify 정적 호스팅으로 배포
- GitHub 저장소로 소스 관리

## 프로젝트 구조
```
Claude-Cowork-Test/
├── CLAUDE.md
├── todo.md
├── package.json           # dev server (netlify-cli)
├── netlify.toml           # Netlify 배포 설정
├── .gitignore
├── public/
│   ├── index.html         # 메인 UI 페이지
│   ├── style.css          # 스타일
│   └── app.js             # OAuth + Calendar + Sheets 로직
```

## 체크리스트

- [ ] 1. 프로젝트 초기화 (package.json, netlify.toml, .gitignore)
- [ ] 2. public/index.html — UI 레이아웃
  - 이벤트 리스트 (토글 스위치 + 이벤트명/날짜 + 코멘트 입력란)
  - 하단 확인/취소 버튼
  - Google Identity Services + gapi 스크립트 로드
- [ ] 3. public/style.css — 깔끔한 스타일링
- [ ] 4. public/app.js — 프론트엔드 로직
  - Google OAuth 로그인 (GIS)
  - 전주 월~금 캘린더 이벤트 조회 (Calendar API)
  - 토글/코멘트 상태 관리
  - 확인 → 활성화된 이벤트만 Google Sheets 2행에 insert (최신 상단)
  - 취소 → 전체 토글 초기화
- [ ] 5. GitHub 저장소 생성 및 푸시
- [ ] 6. Netlify 배포 설정
- [ ] 7. 매주 화요일 9시 자동 알림 스케줄 설정
- [ ] 8. 테스트 및 검증

## 핵심 규칙
- Google Sheets ID: 1K5Vp3T99kTP5v0kQBdAISnin36HjxAXuPJEa7Q2-DxM
- Client ID: 28404387687-4dpv1lq0l2atleit02pg2pt8g43sj9of.apps.googleusercontent.com
- 시트 1행: 헤더 (이벤트명, 이벤트 날짜, 비고)
- 새 데이터는 2행에 insert → 최신이 항상 상단
- 매주 같은 시트에 누적 적재

## Google Cloud Console 필요 설정
- Authorized JavaScript origins에 Netlify URL 추가
- Authorized redirect URIs에 Netlify URL 추가
- Calendar API, Sheets API 활성화

## Review
(구현 완료 후 작성)
