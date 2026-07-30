// Vercel serverless function: records a funnel event (opened/started/finished)
// into the Supabase `events` table. No-ops safely (200) until Supabase env vars
// are configured, so the client never errors while tracking is still being set up.
import { createClient } from '@supabase/supabase-js';

const VALID_EVENTS = new Set(['opened', 'started', 'finished']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { username, quizSlug, event } = body || {};

  if (typeof username !== 'string' || !username.trim() ||
      typeof quizSlug !== 'string' || !quizSlug.trim() ||
      !VALID_EVENTS.has(event)) {
    return res.status(400).json({ error: 'username, quizSlug, and a valid event are required' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Not configured yet — accept and skip so the client stays quiet.
    return res.status(200).json({ ok: true, skipped: 'not configured' });
  }

  const supabase = createClient(url, key);
  const { error } = await supabase
    .from('events')
    .insert({ username: username.trim(), quiz_slug: quizSlug.trim(), event });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
