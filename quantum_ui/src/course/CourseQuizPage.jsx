import { useParams, Link } from 'react-router-dom';

// Stub — the course quiz player + tracking is built in Phase 5. It will look
// up the quiz in QUIZZES by slug and render <QuestionsPage> with the
// onEvent/onComplete callbacks added in Phase 1.
export default function CourseQuizPage() {
  const { slug } = useParams();
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 font-sans p-8">
      <h1 className="text-2xl font-bold text-white">Quiz: {slug}</h1>
      <p className="text-slate-400 text-sm">Quiz player coming soon.</p>
      <Link to="/quizzes" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
        ← Back to Quizzes
      </Link>
    </div>
  );
}
