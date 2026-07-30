// Student identity persisted in localStorage, mirroring ThemeToggle's plain
// localStorage.getItem/setItem pattern. Only the username lives client-side;
// the class code and Supabase keys stay server-side.
const STUDENT_KEY = 'course_student';

export function getStudent() {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.username === 'string' && parsed.username.trim()) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStudent({ username }) {
  localStorage.setItem(STUDENT_KEY, JSON.stringify({ username }));
}

export function clearStudent() {
  localStorage.removeItem(STUDENT_KEY);
}
