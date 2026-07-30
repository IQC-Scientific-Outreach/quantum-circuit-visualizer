import { Link, useNavigate } from 'react-router-dom';
import { QUIZZES } from '../questions/quizCatalog';
import { getStudent, clearStudent } from './identity';

// Student dashboard (/quizzes). Lists the quizzes from the catalog; clicking one
// opens the player at /quiz/:slug. Per-quiz best score + completion badges come
// later (Phase 6, from /api/progress).
export default function QuizCatalogPage() {
  const navigate = useNavigate();
  const student = getStudent();

  function handleLogout() {
    clearStudent();
    navigate('/');
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
          {QUIZZES.map((quiz, i) => (
            <Link
              key={quiz.slug}
              to={`/quiz/${quiz.slug}`}
              className="group flex items-center justify-between gap-4 bg-slate-900 border border-slate-700/50 rounded-xl p-4 hover:border-blue-500/60 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="text-base font-semibold text-white truncate">{quiz.title}</h2>
                </div>
                {quiz.description && <p className="text-sm text-slate-400 mt-1">{quiz.description}</p>}
                <p className="text-[11px] text-slate-600 mt-1">
                  {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}
                </p>
              </div>
              <span className="shrink-0 text-blue-400 group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
