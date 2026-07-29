import { Link } from 'react-router-dom';

// Stub — the student dashboard is built in Phase 6 (cards from QUIZZES +
// per-quiz best score / completion from /api/progress).
export default function QuizCatalogPage() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 font-sans p-8">
      <h1 className="text-2xl font-bold text-white">Quizzes</h1>
      <p className="text-slate-400 text-sm">Quiz catalog coming soon.</p>
      <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
        ← Back to Visualizer
      </Link>
    </div>
  );
}
