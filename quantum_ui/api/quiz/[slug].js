// Vercel serverless function: serves a quiz's raw backup ONLY if it's unlocked.
// Content (quizContent.js → catalog/*.json) is imported here server-side, so locked quiz
// content never ships in the client bundle. Gates on the Supabase quiz_availability table.
// The client parses the returned backup with parseBuilderBackup.
//   unknown slug          → 404
//   configured && locked  → 403 { error:'locked' }  (no content in body)
//   available / unconfig. → 200 { backup }
import { createClient } from '@supabase/supabase-js';
import { CONTENT } from '../../src/questions/quizContent.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = (req.query.slug || '').toString();
  const backup = CONTENT[slug];
  if (!backup) return res.status(404).json({ error: 'Quiz not found' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('quiz_availability')
      .select('is_available')
      .eq('quiz_slug', slug)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || !data.is_available) return res.status(403).json({ error: 'locked' });
  }
  // Unconfigured → allow (dev fallback).

  return res.status(200).json({ backup });
}
