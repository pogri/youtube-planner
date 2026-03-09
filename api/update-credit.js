// api/update-credit.js
// 크레딧 사용 후 업데이트 (Vercel KV 사용)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, password } = req.body;

  const KV_REST_API_URL = process.env.KV_REST_API_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    // KV 없으면 그냥 성공 반환 (크레딧 추적 없이)
    return res.status(200).json({ success: true, remaining: 99 });
  }

  // KV에서 사용자 데이터 가져오기
  try {
    const getRes = await fetch(`${KV_REST_API_URL}/get/user:${userId}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const getData = await getRes.json();
    
    let userData;
    if (getData.result) {
      userData = JSON.parse(getData.result);
    } else {
      // KV에 없으면 환경변수에서 초기값 가져오기
      const USERS_DATA = process.env.USERS_DATA;
      const allUsers = JSON.parse(USERS_DATA);
      userData = allUsers.users[userId];
      if (!userData) return res.status(404).json({ error: '사용자 없음' });
      userData.used = userData.used || 0;
    }

    if (userData.password !== password) {
      return res.status(401).json({ error: '인증 오류' });
    }

    userData.used = (userData.used || 0) + 1;
    const remaining = userData.credits - userData.used;

    // KV에 저장
    await fetch(`${KV_REST_API_URL}/set/user:${userId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(userData) })
    });

    return res.status(200).json({ success: true, remaining, used: userData.used });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
