// Vercel serverless function: everything the student dashboard needs in ONE round-trip —
// unlocked quiz slugs + this student's progress. Both Supabase queries run in parallel in a
// single function invocation (one cold start instead of two). No-ops (configured:false) until
// Supabase env vars are set, so the dashboard shows all quizzes unlocked with no badges in dev.
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
  const [availRes, progRes] = await Promise.all([
    supabase.from('quiz_availability').select('quiz_slug').eq('is_available', true),
    username
      ? supabase
          .from('progress')
          .select('quiz_slug, total_questions, max_points, questions_answered, points, per_question, in_progress, ever_completed, best_points, best_pct')
          .eq('username', username)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (availRes.error) return res.status(500).json({ error: availRes.error.message });
  if (progRes.error) return res.status(500).json({ error: progRes.error.message });

  const progress = {};
  for (const r of progRes.data || []) {
    progress[r.quiz_slug] = {
      bestPct: r.best_pct,
      bestPoints: r.best_points,
      everCompleted: r.ever_completed,
      inProgress: r.in_progress,
      questionsAnswered: r.questions_answered,
      totalQuestions: r.total_questions,
      points: r.points,
      maxPoints: r.max_points,
      perQuestion: r.per_question || [],
    };
  }

  return res.status(200).json({
    configured: true,
    available: (availRes.data || []).map((r) => r.quiz_slug),
    progress,
  });
}
