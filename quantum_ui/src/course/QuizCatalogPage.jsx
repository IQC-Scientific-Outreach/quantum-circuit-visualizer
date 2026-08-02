import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QUIZZES } from '../questions/quizManifest';
import { getStudent, clearStudent } from './identity';
import { getDashboard } from './api';

// Student dashboard (/quizzes). One /api/dashboard round-trip fetches availability + progress.
// The quiz list renders instantly from the static manifest; lock state, badges, and progress
// bars hydrate when the fetch resolves. Locked quizzes are greyed and non-clickable.
export default function QuizCatalogPage() {
  const navigate = useNavigate();
  const student = getStudent();
  const [data, setData] = useState(null); // { configured, available, progress } | null
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getDashboard(student?.username || '').then((r) => {
      if (!alive) return;
      setData(r);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [student?.username]);

  function handleLogout() {
    clearStudent();
    navigate('/');
  }

  const configured = !!data?.configured;
  const availableSet = new Set(data?.available || []);
  const progress = data?.progress || {};
  const isLocked = (slug) => configured && !availableSet.has(slug);

  // Per-quiz completion percent for the bar (best when completed, live when in progress).
  function barPct(slug) {
    const p = progress[slug];
    if (!p) return 0;
    if (p.everCompleted) return p.bestPct || 0;
    if (p.inProgress && p.totalQuestions) return Math.round((p.questionsAnswered / p.totalQuestions) * 100);
    return 0;
  }

  // Overview summary.
  const total = QUIZZES.length;
  const completedCount = QUIZZES.filter((q) => progress[q.slug]?.everCompleted).length;
  const completedPcts = QUIZZES.map((q) => progress[q.slug]).filter((p) => p?.everCompleted).map((p) => p.bestPct || 0);
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
              {loaded
                ? <>{completedCount} of {total} completed{avgBest != null && <span className="text-slate-500"> · avg best {avgBest}%</span>}</>
                : <span className="text-slate-600">Loading…</span>}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        <div className="grid gap-3">
          {QUIZZES.map((quiz, i) => {
            const num = String(i + 1).padStart(2, '0');
            const locked = isLocked(quiz.slug);
            const p = progress[quiz.slug];
            const pct = barPct(quiz.slug);

            const badge = locked ? (
              <span className="text-xs text-slate-500">🔒 Locked</span>
            ) : p?.everCompleted ? (
              <span className="text-xs text-emerald-400">✓ Completed · best {p.bestPct}%</span>
            ) : p?.inProgress ? (
              <span className="text-xs text-amber-400">In progress · {p.questionsAnswered}/{p.totalQuestions}</span>
            ) : null;

            const inner = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">{num}</span>
                    <h2 className="text-base font-semibold text-white truncate">{quiz.title}</h2>
                  </div>
                  {quiz.description && <p className="text-sm text-slate-400 mt-1">{quiz.description}</p>}
                  {badge && <div className="mt-1.5">{badge}</div>}
                  {!locked && p && (
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full transition-all duration-500 ${p.everCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className={`shrink-0 self-start ${locked ? 'text-slate-600' : 'text-blue-400 group-hover:translate-x-0.5 transition-transform'}`}>
                  {locked ? '🔒' : '→'}
                </span>
              </>
            );

            const base = 'flex items-start justify-between gap-4 rounded-xl p-4 border';

            return locked ? (
              <div
                key={quiz.slug}
                className={`${base} bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed`}
                title="Not unlocked yet"
              >
                {inner}
              </div>
            ) : (
              <Link
                key={quiz.slug}
                to={`/quiz/${quiz.slug}`}
                className={`group ${base} bg-slate-900 border-slate-700/50 hover:border-blue-500/60 transition-colors`}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
