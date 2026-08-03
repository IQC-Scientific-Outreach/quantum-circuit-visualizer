import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QuestionsPage from '../pages/QuestionsPage.jsx';
import { getQuizMeta } from '../questions/quizManifest';
import { parseBuilderBackup } from '../questions/questionData';
import { getStudent } from './identity';
import { getQuiz, getResume, saveProgress } from './api';

// Cap on stored attempts per (username, quiz_slug) so retakes can't grow the table without bound.
const MAX_ATTEMPTS = 50;

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

// Course quiz player (/quiz/:slug). Fetches content from /api/quiz/:slug (gated on availability,
// so locked content never ships), resumes the latest in-flight attempt if one exists, otherwise
// starts a new attempt, and upserts that attempt after every question via onProgress.
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

      // Resume the latest in-flight attempt if there is one; otherwise start the next attempt.
      let attemptNo = 1;
      let initialQuestionIndex = 0;
      let initialScores = [];
      let resuming = false;
      if (username) {
        const pr = await getResume(username, slug);
        const r = pr?.resume;
        if (r && r.questionsAnswered < totalQuestions && Array.isArray(r.perQuestion)) {
          resuming = true;
          attemptNo = r.attemptNo;
          initialQuestionIndex = r.questionsAnswered;
          // per_question is [{id,points,revealed,wrongTries}]; tolerate old [int] rows too.
          initialScores = r.perQuestion.map((e, i) =>
            typeof e === 'number'
              ? { questionId: questions[i]?.id, points: e, usedHint: false, wrongTries: 0 }
              : { questionId: e.id, points: e.points, usedHint: e.revealed, wrongTries: e.wrongTries || 0, ...(e.wrongChoices ? { wrongChoices: e.wrongChoices } : {}) }
          );
        } else {
          attemptNo = Math.min((pr?.maxAttemptNo || 0) + 1, MAX_ATTEMPTS);
        }
      }
      if (!alive) return;

      // Fresh attempt: create/reset this attempt's row (skipped when resuming).
      if (!resuming && username) {
        saveProgress({
          username, quizSlug: slug, attemptNo,
          totalQuestions, maxPoints,
          questionsAnswered: 0, points: 0, perQuestion: [], completed: false,
        });
      }

      setState({ status: 'ready', questions, initialQuestionIndex, initialScores, attemptNo });
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
        if (username) saveProgress({ username, quizSlug: slug, attemptNo: state.attemptNo, ...p });
      }}
    />
  );
}
