// Vercel serverless function: returns the slugs of currently-unlocked quizzes for the
// dashboard's lock state. Reads the Supabase quiz_availability table. No-ops (configured:
// false) until Supabase env vars are set, so the dashboard shows everything unlocked in dev.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ configured: false, available: [] });

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('quiz_availability')
    .select('quiz_slug')
    .eq('is_available', true);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ configured: true, available: data.map((r) => r.quiz_slug) });
}
