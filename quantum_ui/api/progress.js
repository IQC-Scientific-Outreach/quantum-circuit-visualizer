// Vercel serverless function for student progress (one upsert row per username+quiz).
//   GET  ?username=  → { configured, progress: { slug: {...} } }  (dashboard + resume)
//   POST { username, quizSlug, totalQuestions, maxPoints, questionsAnswered, points,
//          perQuestion, completed } → upsert the row IN PLACE (never a new row)
// best_points / ever_completed are maintained by reading the existing row first, so a
// retake never lowers the best score. No-ops (200) until Supabase env vars are set.
import { createClient } from '@supabase/supabase-js';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export default async function handler(req, res) {
  const supabase = getClient();

  if (req.method === 'GET') {
    const username = (req.query.username || '').toString().trim();
    if (!username) return res.status(400).json({ error: 'username required' });
    if (!supabase) return res.status(200).json({ configured: false, progress: {} });

    const { data, error } = await supabase
      .from('progress')
      .select('quiz_slug, total_questions, max_points, questions_answered, points, per_question, in_progress, ever_completed, best_points, best_pct')
      .eq('username', username);
    if (error) return res.status(500).json({ error: error.message });

    const progress = {};
    for (const r of data) {
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
    return res.status(200).json({ configured: true, progress });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { username, quizSlug } = body || {};
    if (typeof username !== 'string' || !username.trim() ||
        typeof quizSlug !== 'string' || !quizSlug.trim()) {
      return res.status(400).json({ error: 'username and quizSlug required' });
    }
    if (!supabase) return res.status(200).json({ ok: true, skipped: 'not configured' });

    const u = username.trim();
    const s = quizSlug.trim();
    const total = Number(body.totalQuestions) || 0;
    const maxP = Number(body.maxPoints) || 0;
    const qa = Number(body.questionsAnswered) || 0;
    const pts = Number(body.points) || 0;
    const pq = Array.isArray(body.perQuestion) ? body.perQuestion : [];
    const done = !!body.completed;

    // Maintain best_points / ever_completed from the existing row.
    const { data: existing, error: readErr } = await supabase
      .from('progress')
      .select('best_points, ever_completed')
      .eq('username', u)
      .eq('quiz_slug', s)
      .maybeSingle();
    if (readErr) return res.status(500).json({ error: readErr.message });

    const bestPoints = Math.max(existing?.best_points ?? 0, pts);
    const everCompleted = (existing?.ever_completed ?? false) || done;

    const { error: upErr } = await supabase.from('progress').upsert({
      username: u,
      quiz_slug: s,
      total_questions: total,
      max_points: maxP,
      questions_answered: qa,
      points: pts,
      per_question: pq,
      in_progress: !done,
      ever_completed: everCompleted,
      best_points: bestPoints,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'username,quiz_slug' });
    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
