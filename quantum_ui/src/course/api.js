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

// Upsert one attempt's live progress (fired on open and after each question).
// payload: { username, quizSlug, attemptNo, totalQuestions, maxPoints, questionsAnswered,
//            points, perQuestion, completed }
export function saveProgress(payload) {
  return postJSON('/api/progress', payload);
}

// For the player: the latest in-progress attempt to resume, plus the highest attempt number so
// far (to compute the next one). → { configured, maxAttemptNo, resume|null } | null
export async function getResume(username, quizSlug) {
  const { data } = await getJSON(
    `/api/progress?username=${encodeURIComponent(username)}&quizSlug=${encodeURIComponent(quizSlug)}`
  );
  return data;
}

// → { status, backup? }  (200 with raw backup, 403 locked, 404 not found)
export async function getQuiz(slug) {
  const { status, data } = await getJSON(`/api/quiz/${encodeURIComponent(slug)}`);
  return { status, ...(data || {}) };
}

// Everything the dashboard needs in one round-trip.
// → { configured, available: [slug…], progress: { slug: {...} } } | null
export async function getDashboard(username) {
  const { data } = await getJSON(`/api/dashboard?username=${encodeURIComponent(username)}`);
  return data;
}
