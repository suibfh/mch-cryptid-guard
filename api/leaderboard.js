const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

function send(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return send(res, 500, { ok: false, error: 'Supabase env vars are missing' });
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/scores?select=player_name,score,hero_name&order=score.desc&limit=10`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await r.json().catch(() => []);
    if (!r.ok) return send(res, r.status, { ok: false, error: data?.message || 'Supabase error' });
    return send(res, 200, { ok: true, rows: data });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'Failed to load leaderboard' });
  }
}
