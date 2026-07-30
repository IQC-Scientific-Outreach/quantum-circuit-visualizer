// Best-effort client wrappers for the course tracking endpoints. Failures are
// swallowed so tracking never blocks a student from taking a quiz (e.g. before
// Supabase env vars are configured, or when `vercel dev` isn't running).

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

// event ∈ 'opened' | 'started' | 'finished'
export function track({ username, quizSlug, event }) {
  return postJSON('/api/track', { username, quizSlug, event });
}

export function saveScore({ username, quizSlug, score, maxScore }) {
  return postJSON('/api/score', { username, quizSlug, score, maxScore });
}

export async function getProgress(username) {
  try {
    const res = await fetch(`/api/progress?username=${encodeURIComponent(username)}`);
    return res.ok ? await res.json().catch(() => null) : null;
  } catch {
    return null;
  }
}
