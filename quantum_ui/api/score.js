// Vercel serverless function: records a completed attempt (score/max) into the
// Supabase `attempts` table. No-ops safely (200) until Supabase env vars are
// configured, so the client never errors while tracking is still being set up.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { username, quizSlug, score, maxScore } = body || {};

  if (typeof username !== 'string' || !username.trim() ||
      typeof quizSlug !== 'string' || !quizSlug.trim() ||
      typeof score !== 'number' || typeof maxScore !== 'number') {
    return res.status(400).json({ error: 'username, quizSlug, score, and maxScore are required' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Not configured yet — accept and skip so the client stays quiet.
    return res.status(200).json({ ok: true, skipped: 'not configured' });
  }

  const supabase = createClient(url, key);
  const { error } = await supabase
    .from('attempts')
    .insert({ username: username.trim(), quiz_slug: quizSlug.trim(), score, max_score: maxScore });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
