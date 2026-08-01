import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QuestionsPage from '../pages/QuestionsPage.jsx';
import { getQuizMeta } from '../questions/quizManifest';
import { parseBuilderBackup } from '../questions/questionData';
import { getStudent } from './identity';
import { getQuiz, getProgress, saveProgress } from './api';

// Small centered message for loading / locked / not-found / error states.
function Notice({ title, body }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 font-sans p-8">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {body && <p className="text-slate-400 text-sm text-center max-w-sm">{body}</p>}
      <Link to="/quizzes" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
        ← Back to Quizzes
      </Link>
    </div>
  );
}

// Course quiz player (/quiz/:slug). Fetches content from /api/quiz/:slug (which gates on
// availability, so locked content never ships), resumes from saved progress when a run is
// in flight, and upserts progress after every question via onProgress.
export default function CourseQuizPage() {
  const { slug } = useParams();
  const meta = getQuizMeta(slug);
  const student = getStudent();
  const username = student?.username;

  // status: loading | ready | locked | notfound | error
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      const q = await getQuiz(slug); // { status, backup? }
      if (!alive) return;
      if (q.status === 404) return setState({ status: 'notfound' });
      if (q.status === 403) return setState({ status: 'locked' });
      if (q.status !== 200 || !Array.isArray(q.backup)) return setState({ status: 'error' });

      const questions = parseBuilderBackup(q.backup);
      const totalQuestions = questions.length;
      const maxPoints = questions.reduce((s, x) => s + (x.points || 0), 0);

      // Resume an in-flight run if one exists; otherwise start fresh.
      let initialQuestionIndex = 0;
      let initialScores = [];
      let resuming = false;
      if (username) {
        const pr = await getProgress(username);
        const row = pr?.progress?.[slug];
        if (row && row.inProgress && row.questionsAnswered < totalQuestions && Array.isArray(row.perQuestion)) {
          resuming = true;
          initialQuestionIndex = row.questionsAnswered;
          initialScores = row.perQuestion.map((points, i) => ({
            questionId: questions[i]?.id,
            points,
            usedHint: false,
          }));
        }
      }
      if (!alive) return;

      // Fresh open: record/reset the current run (best score + ever_completed preserved
      // server-side). Skipped when resuming so we don't wipe in-flight progress.
      if (!resuming && username) {
        saveProgress({
          username, quizSlug: slug,
          totalQuestions, maxPoints,
          questionsAnswered: 0, points: 0, perQuestion: [], completed: false,
        });
      }

      setState({ status: 'ready', questions, initialQuestionIndex, initialScores });
    })();
    return () => { alive = false; };
  }, [slug, username]);

  if (state.status === 'loading') return <Notice title="Loading…" />;
  if (state.status === 'locked')  return <Notice title="Not available yet" body="This quiz hasn’t been unlocked for the class yet." />;
  if (state.status === 'notfound') return <Notice title="Quiz not found" body={`No quiz matches “${slug}”.`} />;
  if (state.status === 'error')   return <Notice title="Couldn’t load quiz" body="Something went wrong. Please try again." />;

  return (
    <QuestionsPage
      key={slug}
      courseMode
      initialQuestions={state.questions}
      initialQuestionIndex={state.initialQuestionIndex}
      initialScores={state.initialScores}
      quizMeta={{ title: meta?.title }}
      onProgress={(p) => {
        if (username) saveProgress({ username, quizSlug: slug, ...p });
      }}
    />
  );
}
