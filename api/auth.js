// api/auth.js
// 사용자 인증 및 크레딧 관리

// 사용자 데이터 (Vercel KV 없이 환경변수로 관리)
// 형식: USER_data = JSON {"users": {"id": {"pw":"...","credits":4,"used":0,"active":true}}}
function getUsers() {
  try {
    const raw = process.env.USERS_DATA;
    if (!raw) return { users: {} };
    return JSON.parse(raw);
  } catch {
    return { users: {} };
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, userId, password, adminKey } = req.body;

  // 관리자 키 확인
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin1234';

  if (action === 'login') {
    const data = getUsers();
    const user = data.users[userId];

    if (!user) return res.status(401).json({ error: '아이디가 존재하지 않습니다.' });
    if (!user.active) return res.status(401).json({ error: '비활성화된 계정입니다.' });
    if (user.password !== password) return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });

    const remaining = user.credits - user.used;
    if (remaining <= 0) return res.status(403).json({ error: '크레딧이 소진되었습니다. 관리자에게 문의하세요.' });

    return res.status(200).json({
      success: true,
      userId,
      role: user.role || 'guest',
      credits: user.credits,
      used: user.used,
      remaining
    });
  }

  if (action === 'use_credit') {
    // 크레딧 사용 기록 (실제로는 KV store 필요, 여기선 응답만)
    // Vercel 환경변수는 런타임에 수정 불가 → 사용 카운트는 클라이언트 세션에서 관리
    const data = getUsers();
    const user = data.users[userId];
    if (!user) return res.status(401).json({ error: '사용자 없음' });
    if (user.password !== password) return res.status(401).json({ error: '인증 오류' });

    const remaining = user.credits - user.used;
    if (remaining <= 0) return res.status(403).json({ error: '크레딧 소진' });

    return res.status(200).json({ success: true, remaining: remaining - 1 });
  }

  if (action === 'admin_login') {
    if (adminKey !== ADMIN_KEY) return res.status(401).json({ error: '관리자 키가 틀렸습니다.' });
    const data = getUsers();
    return res.status(200).json({ success: true, users: data.users });
  }

  return res.status(400).json({ error: '알 수 없는 액션' });
}
