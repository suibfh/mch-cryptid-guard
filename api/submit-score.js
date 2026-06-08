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

function baseUrl() {
  return SUPABASE_URL.replace(/\/$/, '');
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra
  };
}

async function getTop10() {
  const url = `${baseUrl()}/rest/v1/scores?select=player_name,score,hero_name&order=score.desc&limit=10`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}

async function getCurrentBest(deviceId) {
  const url = `${baseUrl()}/rest/v1/scores?select=score&device_id=eq.${encodeURIComponent(deviceId)}&limit=1`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? Number(rows[0].score || 0) : null;
}

async function submitWithRpc({ deviceId, name, score, hero }) {
  const url = `${baseUrl()}/rest/v1/rpc/submit_score`;
  const r = await fetch(url, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      p_device_id: deviceId,
      p_player_name: name,
      p_score: score,
      p_hero_name: hero
    })
  });
  const data = await r.json().catch(() => []);
  if (!r.ok) {
    const message = data?.message || data?.hint || 'Supabase submit error';
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return send(res, 500, { ok: false, error: 'Supabase env vars are missing' });

  const body = normalizeBody(req.body);
  const name = String(body.name || '').trim().slice(0, 12);
  const score = Number(body.score);
  const hero = String(body.hero || '').trim();
  const deviceId = String(body.deviceId || '').trim().slice(0, 80);

  if (!name) return send(res, 400, { ok: false, error: 'Name is required' });
  if (!deviceId) return send(res, 400, { ok: false, error: 'Device ID is required' });
  if (!Number.isInteger(score) || score < 0 || score > 999999999) return send(res, 400, { ok: false, error: 'Invalid score' });
  if (!HEROES.has(hero)) return send(res, 400, { ok: false, error: 'Invalid hero' });

  try {
    const currentBest = await getCurrentBest(deviceId);
    if (currentBest !== null && score <= currentBest) {
      const rows = await getTop10();
      return send(res, 200, { ok: true, updated: false, bestScore: currentBest, rows });
    }

    const rows = await submitWithRpc({ deviceId, name, score, hero });
    return send(res, 200, { ok: true, updated: true, bestScore: score, rows });
  } catch (e) {
    return send(res, 500, { ok: false, error: e?.message || 'Failed to submit score' });
  }
}
