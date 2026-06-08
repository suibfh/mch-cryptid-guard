const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const HEROES = new Set(['グリム兄弟', 'ジャックザリッパー', 'スパルタクス', 'ライト兄弟']);

function send(res, status, body) {
  res.status(status).json(body);
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body;
}

async function getTop10() {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/scores?select=player_name,score,hero_name&order=score.desc&limit=10`;
  const r = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return send(res, 500, { ok: false, error: 'Supabase env vars are missing' });

  const body = normalizeBody(req.body);
  const name = String(body.name || '').trim().slice(0, 12);
  const score = Number(body.score);
  const hero = String(body.hero || '').trim();

  if (!name) return send(res, 400, { ok: false, error: 'Name is required' });
  if (!Number.isInteger(score) || score < 0 || score > 999999999) return send(res, 400, { ok: false, error: 'Invalid score' });
  if (!HEROES.has(hero)) return send(res, 400, { ok: false, error: 'Invalid hero' });

  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/scores`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ player_name: name, score, hero_name: hero })
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return send(res, r.status, { ok: false, error: data?.message || 'Supabase insert error' });
    }
    const rows = await getTop10();
    return send(res, 200, { ok: true, rows });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'Failed to submit score' });
  }
}
