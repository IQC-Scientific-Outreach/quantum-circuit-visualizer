import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QUIZZES } from '../questions/quizManifest';
import { getStudent, clearStudent } from './identity';
import { getDashboard } from './api';

// Browser stale-while-revalidate cache so reloads render instantly (lock state lives in the
// backend, so the first load per device still makes one call).
const cacheKey = (username) => `course_dashboard_${username || 'anon'}`;
function readCache(username) {
  try {
    const raw = localStorage.getItem(cacheKey(username));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(username, data) {
  try {
    localStorage.setItem(cacheKey(username), JSON.stringify(data));
  } catch {
    /* ignore quota/serialization errors */
  }
}

// Student dashboard (/quizzes). Renders instantly from cached data, then revalidates via
// /api/dashboard. Locked quizzes are hidden entirely (only unlocked ones show once availability
// is known; before that, the cached set shows). Per-quiz progress shows best %, completion, or an
// in-progress marker.
export default function QuizCatalogPage() {
  const navigate = useNavigate();
  const student = getStudent();
  const username = student?.username;

  const [data, setData] = useState(() => readCache(username));
  const [loaded, setLoaded] = useState(() => !!readCache(username));

  useEffect(() => {
    let alive = true;
    getDashboard(username || '').then((r) => {
      if (!alive) return;
      if (r) {
        setData(r);
        writeCache(username, r);
      }
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [username]);

  function handleLogout() {
    clearStudent();
    navigate('/');
  }

  const configured = !!data?.configured;
  const availableSet = new Set(data?.available || []);
  const progress = data?.progress || {};

  // Hide locked quizzes entirely: when availability is configured, show only unlocked ones.
  // Unconfigured (dev / no Supabase) or before first load → show all (fallback).
  const visible = QUIZZES.filter((q) => !configured || availableSet.has(q.slug));

  function barPct(slug) {
    const p = progress[slug];
    if (!p) return 0;
    if (p.everCompleted) return p.bestPct || 0;
    if (p.inProgress && p.totalQuestions) return Math.round((p.questionsAnswered / p.totalQuestions) * 100);
    return 0;
  }

  const total = visible.length;
  const completedCount = visible.filter((q) => progress[q.slug]?.everCompleted).length;
  const completedPcts = visible.map((q) => progress[q.slug]).filter((p) => p?.everCompleted).map((p) => p.bestPct || 0);
  const avgBest = completedPcts.length
    ? Math.round(completedPcts.reduce((s, x) => s + x, 0) / completedPcts.length)
    : null;
  const overallPct = total ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="fixed inset-0 w-full bg-slate-950 text-slate-300 font-sans overflow-y-auto">
      <header className="bg-slate-900 border-b border-slate-700/50 flex items-center gap-4 px-5 py-3 sticky top-0 z-10">
        <Link to="/" className="text-slate-500 hover:text-slate-200 text-xs transition-colors">← Visualizer</Link>
        <span className="text-slate-700 select-none">|</span>
        <h1 className="text-sm font-semibold text-white tracking-tight">Quizzes</h1>
        <div className="flex-1" />
        {student && (
          <span className="text-xs text-slate-500">
            Signed in as <span className="text-slate-300">{student.username}</span>
          </span>
        )}
        <button
          onClick={handleLogout}
          className="text-slate-500 hover:text-red-400 text-xs transition-colors shrink-0"
        >
          Log out
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        {/* Overview summary */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2 gap-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Your progress</p>
            <span className="text-xs text-slate-400">
              {loaded || data
                ? <>{completedCount} of {total} completed{avgBest != null && <span className="text-slate-500"> · avg best {avgBest}%</span>}</>
                : <span className="text-slate-600">Loading…</span>}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        {!loaded && !data ? (
          <p className="text-slate-500 text-sm">Loading quizzes…</p>
        ) : total === 0 ? (
          <p className="text-slate-500 text-sm">No quizzes available yet.</p>
        ) : (
          <div className="grid gap-3">
            {visible.map((quiz) => {
              const num = String(QUIZZES.indexOf(quiz) + 1).padStart(2, '0');
              const p = progress[quiz.slug];
              const pct = barPct(quiz.slug);
              const badge = p?.everCompleted ? (
                <span className="text-xs text-emerald-400">
                  ✓ Completed · best {p.bestPct}%{p.attemptsCount > 1 ? ` · ${p.attemptsCount} attempts` : ''}
                </span>
              ) : p?.inProgress ? (
                <span className="text-xs text-amber-400">
                  In progress · {p.questionsAnswered}/{p.totalQuestions}{p.attemptsCount > 1 ? ` · attempt ${p.attemptsCount}` : ''}
                </span>
              ) : null;

              return (
                <Link
                  key={quiz.slug}
                  to={`/quiz/${quiz.slug}`}
                  className="group flex items-start justify-between gap-4 rounded-xl p-4 border bg-slate-900 border-slate-700/50 hover:border-blue-500/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500">{num}</span>
                      <h2 className="text-base font-semibold text-white truncate">{quiz.title}</h2>
                    </div>
                    {quiz.description && <p className="text-sm text-slate-400 mt-1">{quiz.description}</p>}
                    {badge && <div className="mt-1.5">{badge}</div>}
                    {p && (
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full transition-all duration-500 ${p.everCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 self-start text-blue-400 group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
