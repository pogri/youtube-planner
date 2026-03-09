// api/claude.js
// Anthropic API 프록시 - API 키를 서버에서만 보관

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, password, systemPrompt, userMessage } = req.body;

  // 사용자 인증
  const USERS_DATA = process.env.USERS_DATA;
  if (!USERS_DATA) return res.status(500).json({ error: '서버 설정 오류' });

  let data;
  try { data = JSON.parse(USERS_DATA); } catch { return res.status(500).json({ error: '서버 데이터 오류' }); }

  // 관리자는 무제한
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin1234';
  const isAdmin = password === ADMIN_KEY && userId === 'admin';

  if (!isAdmin) {
    const user = data.users[userId];
    if (!user || user.password !== password || !user.active) {
      return res.status(401).json({ error: '인증 오류' });
    }
    const remaining = user.credits - user.used;
    if (remaining <= 0) {
      return res.status(403).json({ error: '크레딧이 소진되었습니다.' });
    }
  }

  // Anthropic API 호출
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API 키 설정 오류' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `API 오류 (${response.status})`);
    }

    const result = await response.json();
    return res.status(200).json({ success: true, text: result.content[0].text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
