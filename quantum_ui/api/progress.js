// Vercel serverless function for per-attempt progress. One row per attempt in the `attempts`
// table (unique on username+quiz_slug+attempt_no); a row is upserted in place as the student
// answers, and a new attempt_no starts a new row. Best score / completion / pct are NOT stored
// here — they are computed at read time (see dashboard.js and the console queries), so nothing
// derivable is duplicated.
//   GET  ?username=&quizSlug=  → { configured, maxAttemptNo, resume|null }  (for resume + next #)
//   POST { username, quizSlug, attemptNo, totalQuestions, maxPoints, questionsAnswered, points,
//          perQuestion, completed } → upsert that attempt's row
// No-ops (200) until Supabase env vars are set.
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
    const quizSlug = (req.query.quizSlug || '').toString().trim();
    if (!username || !quizSlug) return res.status(400).json({ error: 'username and quizSlug required' });
    if (!supabase) return res.status(200).json({ configured: false, maxAttemptNo: 0, resume: null });

    const { data, error } = await supabase
      .from('attempts')
      .select('attempt_no, total_questions, questions_answered, per_question, completed')
      .eq('username', username)
      .eq('quiz_slug', quizSlug)
      .order('attempt_no', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];
    const maxAttemptNo = rows.length ? rows[0].attempt_no : 0;
    const latest = rows[0];
    const resume = latest && !latest.completed && latest.questions_answered < latest.total_questions
      ? {
          attemptNo: latest.attempt_no,
          questionsAnswered: latest.questions_answered,
          totalQuestions: latest.total_questions,
          perQuestion: latest.per_question || [],
        }
      : null;
    return res.status(200).json({ configured: true, maxAttemptNo, resume });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { username, quizSlug, attemptNo } = body || {};
    if (typeof username !== 'string' || !username.trim() ||
        typeof quizSlug !== 'string' || !quizSlug.trim() ||
        !Number.isInteger(attemptNo) || attemptNo < 1) {
      return res.status(400).json({ error: 'username, quizSlug, and integer attemptNo required' });
    }
    if (!supabase) return res.status(200).json({ ok: true, skipped: 'not configured' });

    // Upsert this attempt's row. started_at is omitted so it defaults on insert and is
    // preserved on update.
    const { error } = await supabase.from('attempts').upsert({
      username: username.trim(),
      quiz_slug: quizSlug.trim(),
      attempt_no: attemptNo,
      total_questions: Number(body.totalQuestions) || 0,
      max_points: Number(body.maxPoints) || 0,
      questions_answered: Number(body.questionsAnswered) || 0,
      points: Number(body.points) || 0,
      per_question: Array.isArray(body.perQuestion) ? body.perQuestion : [],
      completed: !!body.completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'username,quiz_slug,attempt_no' });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
