const CLIENT_ID = '28404387687-nkprgp2m0ckpto9scjfugs1s2cpmm92t.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1K5Vp3T99kTP5v0kQBdAISnin36HjxAXuPJEa7Q2-DxM';

let tokenClient;
let accessToken = null;

// ── 날짜 유틸 ──
function getLastWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  // 이전 주 월요일: 현재 요일 + 이전 주까지의 거리
  const daysToLastMon = dayOfWeek === 0 ? 6 + 7 : dayOfWeek - 1 + 7;
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - daysToLastMon + 7 - 7);

  // 정확한 계산: 이전 주 월요일
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek - 6); // 지난주 월요일
  if (dayOfWeek === 0) monday.setDate(now.getDate() - 6);
  else monday.setDate(now.getDate() - dayOfWeek + 1 - 7);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  return { monday, friday };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${yyyy}-${mm}-${dd} (${day})`;
}

function formatDateRange(monday, friday) {
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `전주 이벤트: ${fmt(monday)} (월) ~ ${fmt(friday)} (금)`;
}

// ── 초기화 ──
window.addEventListener('load', () => {
  // gapi 로드
  gapi.load('client', async () => {
    await gapi.client.init({});
    await gapi.client.load('calendar', 'v3');
    await gapi.client.load('sheets', 'v4');
  });

  // 날짜 범위 표시
  const { monday, friday } = getLastWeekRange();
  document.getElementById('dateRange').textContent = formatDateRange(monday, friday);

  // GIS 토큰 클라이언트 초기화
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenResponse,
  });

  document.getElementById('loginBtn').addEventListener('click', () => {
    tokenClient.requestAccessToken();
  });

  document.getElementById('selectAll').addEventListener('change', onSelectAllChange);
  document.getElementById('submitBtn').addEventListener('click', onSubmit);
  document.getElementById('cancelBtn').addEventListener('click', onCancel);
});

// ── OAuth 콜백 ──
function onTokenResponse(response) {
  if (response.error) {
    showResult('로그인에 실패했습니다: ' + response.error, false);
    return;
  }
  accessToken = response.access_token;
  gapi.client.setToken({ access_token: accessToken });

  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('loadingSection').classList.remove('hidden');

  loadEvents();
}

// ── 캘린더 이벤트 로드 ──
async function loadEvents() {
  try {
    const { monday, friday } = getLastWeekRange();

    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: monday.toISOString(),
      timeMax: friday.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = response.result.items || [];
    renderEvents(events);

    document.getElementById('loadingSection').classList.add('hidden');
    document.getElementById('eventsSection').classList.remove('hidden');
  } catch (err) {
    document.getElementById('loadingSection').classList.add('hidden');
    showResult('이벤트를 불러오는 데 실패했습니다: ' + (err.result?.error?.message || err.message), false);
  }
}

// ── 이벤트 렌더링 ──
function renderEvents(events) {
  const container = document.getElementById('eventList');
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#888;">전주에 등록된 이벤트가 없습니다.</p>';
    document.getElementById('submitBtn').disabled = true;
    return;
  }

  events.forEach((event, index) => {
    const startDate = event.start.dateTime || event.start.date;
    const row = document.createElement('div');
    row.className = 'event-row';
    row.dataset.index = index;

    row.innerHTML = `
      <label class="toggle-label">
        <input type="checkbox" class="event-toggle" data-index="${index}" checked>
        <span class="toggle-slider"></span>
      </label>
      <span class="event-name">${escapeHtml(event.summary || '(제목 없음)')}</span>
      <span class="event-date">${formatDate(startDate)}</span>
      <input type="text" class="event-comment" placeholder="비고 입력..." data-index="${index}">
    `;

    // 토글 변경 시 행 스타일 업데이트
    const toggle = row.querySelector('.event-toggle');
    toggle.addEventListener('change', () => {
      row.classList.toggle('disabled', !toggle.checked);
      updateSelectAll();
    });

    container.appendChild(row);
  });

  // 원본 이벤트 데이터 저장
  container._events = events;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 전체 선택/해제 ──
function onSelectAllChange() {
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.event-toggle').forEach((toggle) => {
    toggle.checked = checked;
    toggle.closest('.event-row').classList.toggle('disabled', !checked);
  });
}

function updateSelectAll() {
  const toggles = document.querySelectorAll('.event-toggle');
  const allChecked = Array.from(toggles).every((t) => t.checked);
  document.getElementById('selectAll').checked = allChecked;
}

// ── 확인 (Google Sheets에 적재) ──
async function onSubmit() {
  const container = document.getElementById('eventList');
  const events = container._events;
  if (!events) return;

  const selectedRows = [];
  document.querySelectorAll('.event-row').forEach((row) => {
    const toggle = row.querySelector('.event-toggle');
    if (!toggle.checked) return;

    const index = parseInt(row.dataset.index);
    const event = events[index];
    const comment = row.querySelector('.event-comment').value.trim();
    const startDate = event.start.dateTime || event.start.date;

    selectedRows.push([
      event.summary || '(제목 없음)',
      formatDate(startDate),
      comment,
    ]);
  });

  if (selectedRows.length === 0) {
    showResult('선택된 이벤트가 없습니다.', false);
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '전송 중...';

  try {
    // 시트에 헤더가 있는지 확인
    await ensureHeader();

    // 2행에 insert (최신이 상단)
    // 역순으로 insert해야 원래 순서가 유지됨
    const reversedRows = [...selectedRows].reverse();

    for (const row of reversedRows) {
      await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 1,  // 2행 (0-indexed: 1)
                endIndex: 2,
              },
              inheritFromBefore: false,
            },
          }],
        },
      });

      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A2:C2',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [row],
        },
      });
    }

    showResult(`${selectedRows.length}개의 이벤트가 Google Sheets에 저장되었습니다.`, true);
    document.getElementById('eventsSection').classList.add('hidden');
  } catch (err) {
    showResult('저장에 실패했습니다: ' + (err.result?.error?.message || err.message), false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '확인';
  }
}

async function ensureHeader() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:C1',
    });
    if (res.result.values && res.result.values.length > 0) return;
  } catch (e) {
    // 시트가 비어있으면 에러 발생 가능
  }

  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A1:C1',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [['이벤트명', '이벤트 날짜', '비고']],
    },
  });
}

// ── 취소 ──
function onCancel() {
  document.querySelectorAll('.event-toggle').forEach((toggle) => {
    toggle.checked = true;
    toggle.closest('.event-row').classList.remove('disabled');
  });
  document.querySelectorAll('.event-comment').forEach((input) => {
    input.value = '';
  });
  document.getElementById('selectAll').checked = true;
  document.getElementById('resultSection').classList.add('hidden');
}

// ── 결과 메시지 표시 ──
function showResult(message, success) {
  const section = document.getElementById('resultSection');
  const msg = document.getElementById('resultMessage');
  msg.textContent = message;
  msg.className = success ? 'success' : 'error';
  section.classList.remove('hidden');
}
