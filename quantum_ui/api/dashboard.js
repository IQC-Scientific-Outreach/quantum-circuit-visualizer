// Vercel serverless function: everything the student dashboard needs in ONE round-trip —
// unlocked quiz slugs + this student's per-quiz summary, aggregated from the `attempts` rows.
// "best pct" / "ever completed" are computed here (not stored), so nothing derivable is
// duplicated in the DB. No-ops (configured:false) until Supabase env vars are set.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = (req.query.username || '').toString().trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ configured: false, available: [], progress: {} });

  const supabase = createClient(url, key);
  const [availRes, attRes] = await Promise.all([
    supabase.from('quiz_availability').select('quiz_slug').eq('is_available', true),
    username
      ? supabase
          .from('attempts')
          .select('quiz_slug, attempt_no, total_questions, max_points, questions_answered, points, completed')
          .eq('username', username)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (availRes.error) return res.status(500).json({ error: availRes.error.message });
  if (attRes.error) return res.status(500).json({ error: attRes.error.message });

  // Aggregate attempts per quiz: best pct, ever-completed, attempt count, and the latest attempt
  // (for the in-progress marker). Per-user row counts are small, so JS aggregation is fine.
  const byQuiz = {};
  for (const r of attRes.data || []) {
    const g = byQuiz[r.quiz_slug] || (byQuiz[r.quiz_slug] = { bestPct: 0, everCompleted: false, attemptsCount: 0, latest: null });
    const pct = r.max_points > 0 ? Math.round((100 * r.points) / r.max_points) : 0;
    if (pct > g.bestPct) g.bestPct = pct;
    if (r.completed) g.everCompleted = true;
    g.attemptsCount += 1;
    if (!g.latest || r.attempt_no > g.latest.attempt_no) g.latest = r;
  }

  const progress = {};
  for (const [slug, g] of Object.entries(byQuiz)) {
    const l = g.latest;
    progress[slug] = {
      bestPct: g.bestPct,
      everCompleted: g.everCompleted,
      attemptsCount: g.attemptsCount,
      inProgress: !!l && !l.completed && l.questions_answered < l.total_questions,
      questionsAnswered: l ? l.questions_answered : 0,
      totalQuestions: l ? l.total_questions : 0,
    };
  }

  return res.status(200).json({
    configured: true,
    available: (availRes.data || []).map((r) => r.quiz_slug),
    progress,
  });
}
