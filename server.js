const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const BOOTHS_FILE = path.join(__dirname, 'data', 'booths.json');
const POINTS_PER_BOOTH = 100;
const TOTAL_BOOTHS = 8;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD 환경변수가 설정되지 않아 기본값(admin1234)을 사용합니다. 배포 시 반드시 환경변수로 지정하세요.');
}

app.use(express.json());
app.use(express.static(__dirname));

// 기본 경로(/) 접속 시 로그인 페이지로 자동 이동
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function readBooths() {
  try {
    return JSON.parse(fs.readFileSync(BOOTHS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeBooths(booths) {
  fs.mkdirSync(path.dirname(BOOTHS_FILE), { recursive: true });
  fs.writeFileSync(BOOTHS_FILE, JSON.stringify(booths, null, 2));
}

function isValidBoothList(booths) {
  return Array.isArray(booths) && booths.length === TOTAL_BOOTHS && booths.every(b =>
    b && typeof b.emoji === 'string' &&
    typeof b.name === 'string' &&
    typeof b.location === 'string' &&
    typeof b.desc === 'string' &&
    Array.isArray(b.tags) && b.tags.every(t => typeof t === 'string')
  );
}

function isValidId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_]{2,20}$/.test(id);
}

function findUser(users, id) {
  return users.find(u => u.id === id);
}

// 아이디 중복 여부 확인
app.get('/api/check', (req, res) => {
  const id = (req.query.id || '').trim();
  if (!isValidId(id)) {
    return res.status(400).json({ error: '아이디는 영문/숫자/밑줄 2~20자로 입력해주세요.' });
  }
  const users = readUsers();
  res.json({ exists: !!findUser(users, id) });
});

// 회원가입
app.post('/api/signup', (req, res) => {
  const id = ((req.body && req.body.id) || '').trim();
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: '아이디는 영문/숫자/밑줄 2~20자로 입력해주세요.' });
  }
  const users = readUsers();
  if (findUser(users, id)) {
    return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다.' });
  }
  users.push({ id, points: 0, completed: [] });
  writeUsers(users);
  res.json({ success: true });
});

// 로그인 (비밀번호 없이 아이디 존재 여부만 확인)
app.post('/api/login', (req, res) => {
  const id = ((req.body && req.body.id) || '').trim();
  const users = readUsers();
  if (!findUser(users, id)) {
    return res.status(404).json({ success: false, message: '존재하지 않는 아이디입니다. 먼저 회원가입해주세요.' });
  }
  res.json({ success: true });
});

// 부스 참여 진행 상황 조회
app.get('/api/progress', (req, res) => {
  const id = (req.query.id || '').trim();
  const users = readUsers();
  const user = findUser(users, id);
  if (!user) {
    return res.status(404).json({ success: false, message: '존재하지 않는 아이디입니다.' });
  }
  res.json({ success: true, points: user.points, completed: user.completed });
});

// 부스 참여 완료 처리 (부스당 100포인트, 중복 적립 방지)
app.post('/api/complete', (req, res) => {
  const id = ((req.body && req.body.id) || '').trim();
  const boothIndex = Number(req.body && req.body.boothIndex);

  if (!Number.isInteger(boothIndex) || boothIndex < 0 || boothIndex >= TOTAL_BOOTHS) {
    return res.status(400).json({ success: false, message: '올바르지 않은 부스입니다.' });
  }

  const users = readUsers();
  const user = findUser(users, id);
  if (!user) {
    return res.status(404).json({ success: false, message: '존재하지 않는 아이디입니다.' });
  }

  if (!user.completed.includes(boothIndex)) {
    user.completed.push(boothIndex);
    user.points += POINTS_PER_BOOTH;
    writeUsers(users);
  }

  res.json({ success: true, points: user.points, completed: user.completed });
});

// 부스 목록 조회 (공개)
app.get('/api/booths', (req, res) => {
  res.json({ success: true, booths: readBooths() });
});

// 관리자 비밀번호 확인
app.post('/api/admin/login', (req, res) => {
  const password = (req.body && req.body.password) || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }
  res.json({ success: true });
});

// 부스 내용 수정 (관리자 전용)
app.put('/api/admin/booths', (req, res) => {
  const password = (req.body && req.body.password) || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }

  const booths = req.body && req.body.booths;
  if (!isValidBoothList(booths)) {
    return res.status(400).json({ success: false, message: '부스 데이터 형식이 올바르지 않습니다.' });
  }

  writeBooths(booths);
  res.json({ success: true, booths });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
