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

- [x] 1. 프로젝트 초기화 (package.json, netlify.toml, .gitignore)
- [x] 2. public/index.html — UI 레이아웃
- [x] 3. public/style.css — 깔끔한 스타일링
- [x] 4. public/app.js — 프론트엔드 로직 (OAuth + Calendar + Sheets API)
- [x] 5. GitHub 저장소 생성 및 푸시
- [x] 6. Netlify 배포 설정
- [x] 7. 매주 화요일 9시 자동 알림 스케줄 설정
- [x] 8. 테스트 및 검증

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

## 버그 수정: "전송 중..." 멈춤 현상 (2026-03-24)

### 원인 분석
1. `insertDimension`에서 `sheetId: 0` 하드코딩 → 실제 시트 ID와 불일치 시 API 에러
2. OAuth 토큰 만료 처리 없음 → 만료 후 API 호출 시 hang
3. 에러 디버깅 로그 부재 → 원인 파악 불가

### 수정 체크리스트
- [x] 1. `ensureSheetName()`에서 실제 sheetId를 저장하고, `onSubmit()`의 `insertDimension`에서 동적으로 사용
- [x] 2. `onSubmit()` 내 catch 블록에 console.error 추가 (디버깅용)
- [x] 3. API 호출 전 토큰 유효성 체크 및 자동 갱신 로직 추가
- [ ] 4. 배포 후 테스트 검증

### 변경 요약
- **`actualSheetId` 전역 변수 추가** — `ensureSheetName()`에서 실제 시트 ID를 저장
- **`insertDimension`의 `sheetId: 0` → `sheetId: actualSheetId`** — 시트 ID 불일치 문제 해결
- **`tokenExpiresAt` + `refreshTokenIfNeeded()`** — 토큰 만료 시 자동 갱신 (1분 여유)
- **`console.error` 추가** — catch 블록에서 에러 객체를 콘솔에 출력하여 디버깅 용이

## Review

### 구현 완료 요약 (2026-03-19)

**생성된 파일:**
- `public/index.html` — 메인 UI (토글+이벤트 리스트+코멘트+확인/취소 버튼)
- `public/style.css` — 반응형 스타일링, 토글 스위치 CSS
- `public/app.js` — Google OAuth(GIS) + Calendar API + Sheets API 클라이언트 로직
- `package.json`, `netlify.toml`, `.gitignore` — 프로젝트 설정
- `.claude/launch.json` — 로컬 개발 서버 설정

**배포:**
- GitHub: https://github.com/sykim-kr/weekly-calendar-reporter
- Netlify: https://tiny-panda-1a8f83.netlify.app
- 스케줄: 매주 화요일 9:03 AM 자동 알림

**동작 흐름:**
1. 페이지 접속 → Google 로그인
2. 전주 월~금 캘린더 이벤트 자동 로드
3. 토글로 선택/해제, 비고 입력
4. "확인" 클릭 → 활성화된 이벤트만 Google Sheets 2행에 insert (최신 상단)
5. "취소" 클릭 → 전체 초기화

**사용 전 Google Cloud Console 설정 필요:**
1. OAuth 동의 화면에서 앱 유형을 "웹 애플리케이션"으로 변경 또는 새로 생성
2. Authorized JavaScript origins: `https://tiny-panda-1a8f83.netlify.app`
3. Authorized redirect URIs: `https://tiny-panda-1a8f83.netlify.app`
4. Calendar API, Sheets API 활성화 확인
