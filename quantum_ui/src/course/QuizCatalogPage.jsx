import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QUIZZES } from '../questions/quizManifest';
import { getStudent, clearStudent } from './identity';
import { getAvailableQuizzes, getProgress } from './api';

// Student dashboard (/quizzes). Lists quizzes from the manifest; a Supabase-backed
// availability list decides which are unlocked, and per-quiz progress shows best %,
// completion, or an in-progress marker. Locked quizzes are greyed and non-clickable.
export default function QuizCatalogPage() {
  const navigate = useNavigate();
  const student = getStudent();
  const [availability, setAvailability] = useState(null); // { configured, available:[] } | null
  const [progress, setProgress] = useState({});           // slug -> row

  useEffect(() => {
    let alive = true;
    getAvailableQuizzes().then((r) => { if (alive) setAvailability(r); });
    if (student?.username) {
      getProgress(student.username).then((r) => { if (alive && r?.progress) setProgress(r.progress); });
    }
    return () => { alive = false; };
  }, [student?.username]);

  function handleLogout() {
    clearStudent();
    navigate('/');
  }

  // Locked only when availability is configured AND the slug isn't in the unlocked list.
  // Unconfigured / failed fetch → everything unlocked (dev fallback).
  const configured = !!availability?.configured;
  const availableSet = new Set(availability?.available || []);
  const isLocked = (slug) => configured && !availableSet.has(slug);

  function badge(slug) {
    const p = progress[slug];
    if (!p) return null;
    if (p.everCompleted) {
      return <span className="text-xs text-emerald-400">✓ Completed · best {p.bestPct}%</span>;
    }
    if (p.inProgress) {
      return (
        <span className="text-xs text-amber-400">
          In progress · {p.questionsAnswered}/{p.totalQuestions}
        </span>
      );
    }
    return null;
  }

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
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
          {QUIZZES.length} {QUIZZES.length === 1 ? 'quiz' : 'quizzes'}
        </p>

        <div className="grid gap-3">
          {QUIZZES.map((quiz, i) => {
            const num = String(i + 1).padStart(2, '0');
            const locked = isLocked(quiz.slug);

            const inner = (
              <>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">{num}</span>
                    <h2 className="text-base font-semibold text-white truncate">{quiz.title}</h2>
                  </div>
                  {quiz.description && <p className="text-sm text-slate-400 mt-1">{quiz.description}</p>}
                  <div className="mt-1.5">
                    {locked
                      ? <span className="text-xs text-slate-500">🔒 Locked</span>
                      : badge(quiz.slug)}
                  </div>
                </div>
                <span className={`shrink-0 ${locked ? 'text-slate-600' : 'text-blue-400 group-hover:translate-x-0.5 transition-transform'}`}>
                  {locked ? '🔒' : '→'}
                </span>
              </>
            );

            const base = 'flex items-center justify-between gap-4 rounded-xl p-4 border';

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
