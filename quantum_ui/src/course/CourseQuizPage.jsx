import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import QuestionsPage from '../pages/QuestionsPage.jsx';
import { getQuizBySlug } from '../questions/quizCatalog';
import { getStudent } from './identity';
import { track, saveScore } from './api';

// Course quiz player (/quiz/:slug). Looks the quiz up in the catalog and renders
// the shared QuestionsPage player in course mode (teacher chrome hidden, quizzes
// link shown) with tracking callbacks:
//   • 'opened'   on mount
//   • 'started'  at the first answer (via onEvent)
//   • 'finished' + best score at completion (via onEvent + onComplete)
// All tracking is best-effort (see course/api.js) so the quiz plays regardless.
export default function CourseQuizPage() {
  const { slug } = useParams();
  const quiz = getQuizBySlug(slug);
  const student = getStudent();
  const username = student?.username;

  // Fire 'opened' once per mount.
  const openedRef = useRef(false);
  useEffect(() => {
    if (!quiz || !username || openedRef.current) return;
    openedRef.current = true;
    track({ username, quizSlug: slug, event: 'opened' });
  }, [quiz, username, slug]);

  if (!quiz) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 font-sans p-8">
        <h1 className="text-2xl font-bold text-white">Quiz not found</h1>
        <p className="text-slate-400 text-sm">No quiz matches “{slug}”.</p>
        <Link to="/quizzes" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
          ← Back to Quizzes
        </Link>
      </div>
    );
  }

  return (
    <QuestionsPage
      key={quiz.slug}
      courseMode
      initialQuestions={quiz.questions}
      quizMeta={{ title: quiz.title }}
      onEvent={(event) => {
        if (username) track({ username, quizSlug: slug, event });
      }}
      onComplete={({ totalPoints, maxPoints }) => {
        if (username) saveScore({ username, quizSlug: slug, score: totalPoints, maxScore: maxPoints });
      }}
    />
  );
}
