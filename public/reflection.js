const CLIENT_ID = '28404387687-nkprgp2m0ckpto9scjfugs1s2cpmm92t.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/documents';
const DRAFT_PREFIX = 'reflection:draft:';
const DOC_ID_KEY = 'reflection:docId';

let tokenClient;
let accessToken = null;
let tokenExpiresAt = 0;
let currentMode = 'daily';
let draftSaveTimer = null;

// ── 회고 템플릿 정의 ──
const TEMPLATES = {
  daily: {
    title: '평일 회고 (월~금)',
    purpose: ['하루 감정 정리', '행동 개선', '머릿속 정리 (Mental RAM 정리)', '더 좋은 의사결정 학습'],
    duration: '7~10분',
    sections: [
      {
        color: 'green',
        h2: '🟢 1. 오늘 좋았던 3가지 (3 Good Things)',
        items: [
          { type: 'h3', text: '① 오늘 가장 좋았던 순간' },
          { type: 'text', label: '무엇이 좋았나?', key: 'd_good1_what' },
          { type: 'text', label: '왜 좋았나?', key: 'd_good1_why' },
          { type: 'text', label: '다음에도 반복하려면?', key: 'd_good1_repeat' },
          { type: 'h3', text: '② 감사한 일 / 운이 좋았던 일' },
          { type: 'text', label: '오늘 감사했던 사람 또는 상황은?', key: 'd_grateful_who' },
          { type: 'text', label: '당연하게 여겼지만 사실 감사한 것은?', key: 'd_grateful_taken' },
          { type: 'h3', text: '③ 오늘 스스로 칭찬할 점' },
          { type: 'text', label: '오늘 내가 잘한 선택', key: 'd_self_choice' },
          { type: 'text', label: '오늘 내가 잘한 태도', key: 'd_self_attitude' },
          { type: 'text', label: '오늘 내가 잘한 행동', key: 'd_self_action' },
        ],
      },
      {
        color: 'yellow',
        h2: '🟡 2. Start / Stop / Continue',
        items: [
          { type: 'h3', text: 'Start (내일부터 시작할 것)' },
          { type: 'text', label: '새롭게 시도할 행동 1가지', key: 'd_start' },
          { type: 'h3', text: 'Stop (그만둘 것)' },
          { type: 'text', label: '비효율적이거나 감정 소모가 큰 행동', key: 'd_stop' },
          { type: 'h3', text: 'Continue (계속 유지할 것)' },
          { type: 'text', label: '효과 있었던 행동 또는 습관', key: 'd_continue' },
        ],
      },
      {
        color: 'blue',
        h2: '🔵 3. GTD Daily Review (머릿속 비우기)',
        items: [
          { type: 'h3', text: '오늘 새롭게 생긴 To-do' },
          { type: 'todo', count: 3, key: 'd_todos' },
          { type: 'h3', text: '열린 루프 (Open Loop)' },
          { type: 'text', label: '계속 머릿속에 남아 있는 고민이나 미완료 이슈', key: 'd_open_loop' },
          { type: 'h3', text: '다음 액션 정의' },
          { type: 'text', label: '내일 가장 먼저 할 Action', hint: '"생각"이 아니라 실행 가능한 행동 단위(Action)로 적는다.', key: 'd_next_action' },
          { type: 'h3', text: '아직 말 안 했지만 신경 쓰이는 것' },
          { type: 'text', label: '', key: 'd_unspoken' },
        ],
      },
      {
        color: 'purple',
        h2: '🟣 4. Stoic Reflection (의사결정 회고)',
        items: [
          { type: 'h3', text: '오늘 내가 잘한 선택은?' },
          { type: 'text', label: '왜 좋은 선택이었는가?', key: 'd_stoic_good' },
          { type: 'h3', text: '후회되는 선택은?' },
          { type: 'text', label: '왜 그런 행동/판단을 했는가?', key: 'd_stoic_regret' },
          { type: 'h3', text: '오늘 나는 어떤 사람이었는가?' },
          { type: 'text', label: '(리더 / 동료 / 사업 책임자 / 가족 / 친구 등)', key: 'd_stoic_person' },
          { type: 'h3', text: '내일 어떤 사람이 되고 싶은가?' },
          { type: 'text', label: '한 문장으로 정의', key: 'd_stoic_tomorrow' },
        ],
      },
      {
        color: 'sparkle',
        h2: '✨ 오늘 하루 한 줄 요약',
        items: [
          { type: 'h3', text: '오늘의 점수' },
          { type: 'score', key: 'd_score' },
          { type: 'h3', text: '오늘의 한 문장' },
          { type: 'quote', key: 'd_one_line' },
        ],
      },
    ],
  },
  weekend: {
    title: '주말 심층 회고 (토 or 일)',
    purpose: ['한 주 학습 정리', '행동 패턴 발견', '의사결정 리뷰', '다음 주 전략 설계'],
    duration: '30~45분',
    sections: [
      {
        color: 'green',
        h2: '🟢 1. 이번 주 하이라이트 TOP 3',
        items: [
          { type: 'h3', text: '가장 의미 있었던 순간' },
          { type: 'text', label: '무엇이 있었는가?', key: 'w_meaning_what' },
          { type: 'text', label: '왜 중요했는가?', key: 'w_meaning_why' },
          { type: 'h3', text: '가장 아쉬웠던 순간' },
          { type: 'text', label: '무엇이 아쉬웠는가?', key: 'w_regret_what' },
          { type: 'text', label: '무엇을 배웠는가?', key: 'w_regret_learn' },
          { type: 'h3', text: '가장 자랑스러웠던 순간' },
          { type: 'text', label: '왜 잘했다고 생각하는가?', key: 'w_proud' },
        ],
      },
      {
        color: 'orange',
        h2: '🟠 2. AAR (After Action Review)',
        items: [
          { type: 'h3', text: '이번 주 목표' },
          { type: 'text', label: '원래 무엇을 하려 했는가?', key: 'w_goal' },
          { type: 'h3', text: '실제 결과' },
          { type: 'text', label: '실제로 어떤 일이 벌어졌는가?', key: 'w_actual' },
          { type: 'h3', text: 'Gap 분석 — 내부 원인' },
          { type: 'hinted_text', hints: ['우선순위 문제', '집중력', '감정 상태', '의사결정 방식', '기타'], key: 'w_gap_internal' },
          { type: 'h3', text: 'Gap 분석 — 외부 원인' },
          { type: 'hinted_text', hints: ['고객', '일정', '예상치 못한 변수', '협업 이슈', '기타'], key: 'w_gap_external' },
          { type: 'h3', text: '다음 주 개선점 (Top 3)' },
          { type: 'numbered', count: 3, key: 'w_improve' },
        ],
      },
      {
        color: 'blue',
        h2: '🔵 3. 나의 행동 패턴 분석 (Behavior Analytics for Me)',
        items: [
          { type: 'h3', text: '에너지가 가장 높았던 순간' },
          { type: 'text', label: '언제였는가?', key: 'w_energy_high_when' },
          { type: 'text', label: '누구와 있었는가?', key: 'w_energy_high_who' },
          { type: 'text', label: '무엇을 하고 있었는가?', key: 'w_energy_high_what' },
          { type: 'h3', text: '에너지가 가장 떨어졌던 순간' },
          { type: 'text', label: '왜 그랬는가?', key: 'w_energy_low' },
          { type: 'h3', text: '가장 생산성이 높았던 업무 유형' },
          { type: 'check', options: ['전략', '고객 미팅', '글쓰기', '데이터 분석', '세일즈', '팀 코칭'], allowOther: true, key: 'w_productive_type' },
          { type: 'h3', text: '반복 실수 패턴' },
          { type: 'text', label: '이번 주 또 반복된 실수는?', key: 'w_mistake_pattern' },
          { type: 'h3', text: '반복 성공 패턴' },
          { type: 'text', label: '잘 되었던 행동 중 반복되는 것은?', key: 'w_success_pattern' },
        ],
      },
      {
        color: 'purple',
        h2: '🟣 4. 의사결정 리뷰 (Decision Journal)',
        items: [
          { type: 'h3', text: '이번 주 가장 좋은 결정' },
          { type: 'text', label: '왜 좋은 결정이었는가?', key: 'w_best_decision' },
          { type: 'h3', text: '가장 아쉬운 결정' },
          { type: 'text', label: '왜 아쉬웠는가?', key: 'w_worst_decision' },
          { type: 'h3', text: '어떤 인지 편향(Bias)이 있었는가?' },
          { type: 'check', options: ['성급함', '낙관 편향', '감정적 반응', '확증 편향', '과도한 책임감', '회피'], allowOther: true, key: 'w_biases' },
        ],
      },
      {
        color: 'brown',
        h2: '🟤 5. 사람 회고',
        items: [
          { type: 'h3', text: '에너지를 준 사람' },
          { type: 'text', label: '', key: 'w_people_energizer' },
          { type: 'h3', text: '에너지를 소모시킨 사람 또는 상황' },
          { type: 'text', label: '', key: 'w_people_drainer' },
          { type: 'h3', text: '내가 더 잘했어야 했던 관계' },
          { type: 'text', label: '', key: 'w_people_regret' },
        ],
      },
      {
        color: 'red',
        h2: '🔴 6. 다음 주 설계',
        items: [
          { type: 'h3', text: '다음 주 가장 중요한 3가지' },
          { type: 'numbered', count: 3, key: 'w_next_priority' },
          { type: 'h3', text: '하지 않을 것 (Not-to-do List)' },
          { type: 'numbered', count: 3, key: 'w_not_to_do' },
          { type: 'h3', text: '다음 주 나의 한 문장' },
          { type: 'quote', key: 'w_one_line' },
        ],
      },
    ],
  },
  monthly: {
    title: '장기 패턴 분석 (월 1회 추천)',
    purpose: ['한 달에 한 번 아래 질문을 돌아본다.'],
    duration: '월 1회',
    sections: [
      {
        color: 'sparkle',
        h2: '📈 장기 패턴 분석',
        items: [
          { type: 'h3', text: '나는 어떤 상황에서 최고의 성과를 내는가?' },
          { type: 'text', label: '', key: 'm_best_situation' },
          { type: 'h3', text: '나는 어떤 상황에서 흔들리는가?' },
          { type: 'text', label: '', key: 'm_weak_situation' },
          { type: 'h3', text: '반복적으로 맞는 의사결정 패턴은?' },
          { type: 'text', label: '', key: 'm_right_pattern' },
          { type: 'h3', text: '반복적으로 틀리는 의사결정 패턴은?' },
          { type: 'text', label: '', key: 'm_wrong_pattern' },
          { type: 'h3', text: '앞으로 더 강화할 강점은?' },
          { type: 'text', label: '', key: 'm_strength_to_grow' },
          { type: 'h3', text: '줄여야 할 습관은?' },
          { type: 'text', label: '', key: 'm_habit_to_reduce' },
        ],
      },
    ],
  },
};

const MODE_LABEL = { daily: '평일 회고', weekend: '주말 심층 회고', monthly: '장기 패턴 분석' };

// ── 유틸 ──
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function getDateKey() {
  return document.getElementById('targetDate').value || isoToday();
}

function draftKey(mode, date) {
  return `${DRAFT_PREFIX}${mode}:${date}`;
}

// ── 폼 렌더링 ──
function renderForm(mode) {
  const tpl = TEMPLATES[mode];
  const container = document.getElementById('formContainer');
  container.innerHTML = '';

  const intro = document.createElement('div');
  intro.className = 'form-intro';
  intro.innerHTML =
    `<p><strong>목적:</strong></p>` +
    `<ul>${tpl.purpose.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` +
    `<p><strong>권장 시간:</strong> ${escapeHtml(tpl.duration)}</p>`;
  container.appendChild(intro);

  for (const sec of tpl.sections) {
    const secEl = document.createElement('section');
    secEl.className = 'section';
    secEl.dataset.color = sec.color;

    const titleEl = document.createElement('div');
    titleEl.className = 'section-title';
    titleEl.textContent = sec.h2;
    secEl.appendChild(titleEl);

    for (const item of sec.items) {
      secEl.appendChild(renderItem(item));
    }

    container.appendChild(secEl);
  }
}

function renderItem(item) {
  switch (item.type) {
    case 'h3': {
      const h = document.createElement('h3');
      h.className = 'subsection-title';
      h.textContent = item.text;
      return h;
    }
    case 'text': {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      if (item.label) {
        const lbl = document.createElement('label');
        lbl.className = 'field-label';
        lbl.textContent = item.label;
        wrap.appendChild(lbl);
      }
      if (item.hint) {
        const hint = document.createElement('blockquote');
        hint.className = 'field-hint';
        hint.textContent = item.hint;
        wrap.appendChild(hint);
      }
      const ta = document.createElement('textarea');
      ta.className = 'field-input';
      ta.dataset.key = item.key;
      ta.addEventListener('input', scheduleDraftSave);
      wrap.appendChild(ta);
      return wrap;
    }
    case 'todo': {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const list = document.createElement('div');
      list.className = 'todo-list';
      list.dataset.key = item.key;
      for (let i = 0; i < item.count; i++) {
        const row = document.createElement('div');
        row.className = 'todo-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = i;
        cb.addEventListener('change', scheduleDraftSave);
        const tx = document.createElement('input');
        tx.type = 'text';
        tx.dataset.idx = i;
        tx.placeholder = `할 일 ${i + 1}`;
        tx.addEventListener('input', scheduleDraftSave);
        row.appendChild(cb);
        row.appendChild(tx);
        list.appendChild(row);
      }
      wrap.appendChild(list);
      return wrap;
    }
    case 'numbered': {
      const wrap = document.createElement('div');
      wrap.className = 'field numbered-list';
      wrap.dataset.numberedKey = item.key;
      for (let i = 0; i < item.count; i++) {
        const row = document.createElement('div');
        row.className = 'numbered-item';
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = `${i + 1}.`;
        const ta = document.createElement('textarea');
        ta.className = 'field-input';
        ta.dataset.key = `${item.key}__${i}`;
        ta.rows = 1;
        ta.addEventListener('input', scheduleDraftSave);
        row.appendChild(num);
        row.appendChild(ta);
        wrap.appendChild(row);
      }
      return wrap;
    }
    case 'check': {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const list = document.createElement('div');
      list.className = 'checklist';
      list.dataset.key = item.key;
      for (const opt of item.options) {
        const lbl = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.opt = opt;
        cb.addEventListener('change', scheduleDraftSave);
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + opt));
        list.appendChild(lbl);
      }
      if (item.allowOther) {
        const lbl = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.opt = '__other__';
        cb.addEventListener('change', scheduleDraftSave);
        const tx = document.createElement('input');
        tx.type = 'text';
        tx.placeholder = '기타...';
        tx.dataset.optOther = '1';
        tx.addEventListener('input', scheduleDraftSave);
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' 기타: '));
        lbl.appendChild(tx);
        list.appendChild(lbl);
      }
      wrap.appendChild(list);
      return wrap;
    }
    case 'score': {
      const wrap = document.createElement('div');
      wrap.className = 'field score-row';
      const tx = document.createElement('input');
      tx.type = 'number';
      tx.min = 0;
      tx.max = 10;
      tx.className = 'field-input';
      tx.dataset.key = item.key;
      tx.addEventListener('input', scheduleDraftSave);
      const slash = document.createElement('span');
      slash.className = 'slash';
      slash.textContent = '/ 10';
      wrap.appendChild(tx);
      wrap.appendChild(slash);
      return wrap;
    }
    case 'quote': {
      const wrap = document.createElement('div');
      wrap.className = 'field quote-box';
      const ta = document.createElement('textarea');
      ta.className = 'field-input';
      ta.dataset.key = item.key;
      ta.placeholder = '한 문장으로...';
      ta.addEventListener('input', scheduleDraftSave);
      wrap.appendChild(ta);
      return wrap;
    }
    case 'hinted_text': {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const hints = document.createElement('ul');
      hints.className = 'field-hint-list';
      for (const h of item.hints) {
        const li = document.createElement('li');
        li.textContent = h;
        hints.appendChild(li);
      }
      wrap.appendChild(hints);
      const ta = document.createElement('textarea');
      ta.className = 'field-input';
      ta.dataset.key = item.key;
      ta.addEventListener('input', scheduleDraftSave);
      wrap.appendChild(ta);
      return wrap;
    }
  }
  return document.createTextNode('');
}

// ── 값 수집 / 복원 ──
function getValues() {
  const values = {};

  document.querySelectorAll('textarea[data-key], input[data-key]').forEach((el) => {
    values[el.dataset.key] = el.value;
  });

  document.querySelectorAll('.todo-list[data-key]').forEach((list) => {
    const items = [];
    list.querySelectorAll('.todo-item').forEach((row) => {
      const cb = row.querySelector('input[type="checkbox"]');
      const tx = row.querySelector('input[type="text"]');
      items.push({ done: cb.checked, text: tx.value });
    });
    values[list.dataset.key] = items;
  });

  document.querySelectorAll('.checklist[data-key]').forEach((list) => {
    const checked = [];
    list.querySelectorAll('label').forEach((lbl) => {
      const cb = lbl.querySelector('input[type="checkbox"]');
      const opt = cb.dataset.opt;
      if (opt === '__other__') {
        const tx = lbl.querySelector('input[type="text"]');
        checked.push({ value: '__other__', checked: cb.checked, otherText: tx.value });
      } else {
        checked.push({ value: opt, checked: cb.checked });
      }
    });
    values[list.dataset.key] = checked;
  });

  return values;
}

function setValues(values) {
  document.querySelectorAll('textarea[data-key], input[data-key]').forEach((el) => {
    if (values[el.dataset.key] !== undefined) el.value = values[el.dataset.key];
  });

  document.querySelectorAll('.todo-list[data-key]').forEach((list) => {
    const v = values[list.dataset.key];
    if (!Array.isArray(v)) return;
    list.querySelectorAll('.todo-item').forEach((row, i) => {
      if (!v[i]) return;
      row.querySelector('input[type="checkbox"]').checked = !!v[i].done;
      row.querySelector('input[type="text"]').value = v[i].text || '';
    });
  });

  document.querySelectorAll('.checklist[data-key]').forEach((list) => {
    const v = values[list.dataset.key];
    if (!Array.isArray(v)) return;
    list.querySelectorAll('label').forEach((lbl) => {
      const cb = lbl.querySelector('input[type="checkbox"]');
      const opt = cb.dataset.opt;
      const found = v.find((x) => x.value === opt);
      if (!found) return;
      cb.checked = !!found.checked;
      if (opt === '__other__') {
        const tx = lbl.querySelector('input[type="text"]');
        tx.value = found.otherText || '';
      }
    });
  });
}

// ── 마크다운 직렬화 ──
function serializeToMarkdown(mode, values) {
  const tpl = TEMPLATES[mode];
  let out = '';
  out += `# ${tpl.title}\n\n`;
  out += `**목적:**\n` + tpl.purpose.map((p) => `- ${p}`).join('\n') + '\n\n';
  out += `**권장 시간:** ${tpl.duration}\n\n---\n\n`;

  for (const sec of tpl.sections) {
    out += `## ${sec.h2}\n\n`;
    for (const item of sec.items) {
      out += renderItemMd(item, values);
    }
    out += '---\n\n';
  }
  return out;
}

function renderItemMd(item, values) {
  const v = values;
  switch (item.type) {
    case 'h3':
      return `### ${item.text}\n\n`;
    case 'text': {
      let s = '';
      if (item.label) s += `**${item.label}**\n\n`;
      if (item.hint) s += `> ${item.hint}\n\n`;
      const val = (v[item.key] || '').trim();
      s += (val || '✍️') + '\n\n';
      return s;
    }
    case 'todo': {
      const items = v[item.key] || [];
      if (!items.length) return '- [ ]\n- [ ]\n- [ ]\n\n';
      return items.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text || ''}`).join('\n') + '\n\n';
    }
    case 'numbered': {
      const lines = [];
      for (let i = 0; i < item.count; i++) {
        const val = (v[`${item.key}__${i}`] || '').trim();
        lines.push(`${i + 1}. ${val || '✍️'}`);
      }
      return lines.join('  \n') + '\n\n';
    }
    case 'check': {
      const opts = v[item.key] || [];
      if (!opts.length) return '';
      return opts
        .map((o) => {
          if (o.value === '__other__') {
            return `- [${o.checked ? 'x' : ' '}] 기타: ${o.otherText || '________'}`;
          }
          return `- [${o.checked ? 'x' : ' '}] ${o.value}`;
        })
        .join('\n') + '\n\n';
    }
    case 'score': {
      const val = (v[item.key] || '').toString().trim();
      return `**${val || '__'}/10**\n\n`;
    }
    case 'quote': {
      const val = (v[item.key] || '').trim();
      return `> ${val || '✍️'}\n\n`;
    }
    case 'hinted_text': {
      let s = item.hints.map((h) => `- ${h}`).join('\n') + '\n\n';
      const val = (v[item.key] || '').trim();
      s += (val || '✍️') + '\n\n';
      return s;
    }
  }
  return '';
}

// ── 초안 자동 저장 ──
function scheduleDraftSave() {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveDraft, 500);
}

function saveDraft() {
  const values = getValues();
  const key = draftKey(currentMode, getDateKey());
  try {
    localStorage.setItem(key, JSON.stringify(values));
    document.getElementById('draftStatus').textContent = `자동 저장됨 ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error('Draft save failed', e);
  }
}

function loadDraft() {
  const key = draftKey(currentMode, getDateKey());
  const raw = localStorage.getItem(key);
  if (!raw) {
    document.getElementById('draftStatus').textContent = '';
    return;
  }
  try {
    setValues(JSON.parse(raw));
    document.getElementById('draftStatus').textContent = '저장된 초안 불러옴';
  } catch (e) {
    console.error('Draft load failed', e);
  }
}

// ── 마크다운 다운로드 ──
function downloadMarkdown() {
  const md = serializeToMarkdown(currentMode, getValues());
  const filename = `reflection-${currentMode}-${getDateKey()}.md`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Google Docs 저장 (최신이 상단) ──
async function saveToDocs() {
  const docId = document.getElementById('docId').value.trim();
  if (!docId) {
    showResult('Google Docs ID를 입력해주세요. (문서 URL의 d/{ID}/edit 부분)', false);
    return;
  }
  if (!accessToken) {
    showResult('먼저 Google에 로그인해주세요.', false);
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = '저장 중...';

  try {
    await refreshTokenIfNeeded();
    localStorage.setItem(DOC_ID_KEY, docId);

    const md = serializeToMarkdown(currentMode, getValues());
    const date = getDateKey();
    const stamp = new Date().toLocaleString('ko-KR');
    const header = `[${date}] ${MODE_LABEL[currentMode]} (작성: ${stamp})\n${'='.repeat(60)}\n\n`;
    const footer = `\n${'─'.repeat(60)}\n\n`;
    const block = header + md + footer;

    await gapi.client.docs.documents.batchUpdate({
      documentId: docId,
      resource: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: block,
            },
          },
        ],
      },
    });

    showResult(`Google Docs에 저장되었습니다. 최신 회고가 문서 최상단에 추가되었습니다.`, true);
  } catch (err) {
    console.error('Docs 저장 실패:', err);
    const msg = err.result?.error?.message || err.message || '알 수 없는 오류';
    showResult('저장 실패: ' + msg, false);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}

// ── 초기화 ──
function resetForm() {
  if (!confirm('현재 폼의 모든 입력을 지우시겠습니까? (저장된 초안도 함께 삭제됩니다)')) return;
  localStorage.removeItem(draftKey(currentMode, getDateKey()));
  renderForm(currentMode);
  document.getElementById('draftStatus').textContent = '';
  document.getElementById('resultSection').classList.add('hidden');
}

// ── OAuth ──
function onTokenResponse(response) {
  if (response.error) {
    showResult('로그인 실패: ' + response.error, false);
    return;
  }
  accessToken = response.access_token;
  tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000 - 60000;
  gapi.client.setToken({ access_token: accessToken });

  const status = document.getElementById('authStatus');
  status.textContent = '로그인됨';
  status.classList.add('connected');
  const btn = document.getElementById('loginBtn');
  btn.textContent = '재로그인';
  btn.classList.add('connected');
}

function refreshTokenIfNeeded() {
  if (Date.now() < tokenExpiresAt) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const orig = tokenClient.callback;
    tokenClient.callback = (resp) => {
      tokenClient.callback = orig;
      if (resp.error) return reject(new Error('토큰 갱신 실패: ' + resp.error));
      accessToken = resp.access_token;
      tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
      gapi.client.setToken({ access_token: accessToken });
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// ── 결과 표시 ──
function showResult(message, success) {
  const section = document.getElementById('resultSection');
  const msg = document.getElementById('resultMessage');
  msg.textContent = message;
  msg.className = success ? 'success' : 'error';
  section.classList.remove('hidden');
}

// ── 부팅 ──
window.addEventListener('load', () => {
  gapi.load('client', async () => {
    await gapi.client.init({});
    await gapi.client.load('docs', 'v1');
  });

  const cachedDocId = localStorage.getItem(DOC_ID_KEY);
  if (cachedDocId) document.getElementById('docId').value = cachedDocId;

  document.getElementById('targetDate').value = isoToday();
  document.getElementById('targetDate').addEventListener('change', () => {
    renderForm(currentMode);
    loadDraft();
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      renderForm(currentMode);
      loadDraft();
    });
  });

  renderForm(currentMode);
  loadDraft();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenResponse,
  });

  document.getElementById('loginBtn').addEventListener('click', () => {
    tokenClient.requestAccessToken();
  });
  document.getElementById('saveBtn').addEventListener('click', saveToDocs);
  document.getElementById('downloadBtn').addEventListener('click', downloadMarkdown);
  document.getElementById('resetBtn').addEventListener('click', resetForm);
});
