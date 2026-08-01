// Best-effort client wrappers for the course endpoints. Failures are swallowed so a quiz
// always plays, even before Supabase env vars are set or when `vercel dev` isn't running.

async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok ? await res.json().catch(() => ({})) : null;
  } catch {
    return null;
  }
}

async function getJSON(url) {
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

// Upsert the student's live progress for one quiz (fired on open and after each question).
// payload: { username, quizSlug, totalQuestions, maxPoints, questionsAnswered, points,
//            perQuestion, completed }
export function saveProgress(payload) {
  return postJSON('/api/progress', payload);
}

// → { configured, progress: { slug: { bestPct, everCompleted, inProgress,
//     questionsAnswered, totalQuestions, points, maxPoints, perQuestion } } } | null
export async function getProgress(username) {
  const { data } = await getJSON(`/api/progress?username=${encodeURIComponent(username)}`);
  return data;
}

// → { status, backup? }  (200 with raw backup, 403 locked, 404 not found)
export async function getQuiz(slug) {
  const { status, data } = await getJSON(`/api/quiz/${encodeURIComponent(slug)}`);
  return { status, ...(data || {}) };
}

// → { configured, available: [slug…] } | null
export async function getAvailableQuizzes() {
  const { data } = await getJSON('/api/quizzes');
  return data;
}
