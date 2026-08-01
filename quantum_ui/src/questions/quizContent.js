// SERVER-ONLY quiz content. This module is imported ONLY by api/quiz/[slug].js, so the
// raw catalog/*.json stays out of the client bundle and locked quizzes are never shipped
// to the browser. Do NOT import this from any client-side (src/course, src/pages) module.
import quiz01 from './catalog/quiz-01.json' with { type: 'json' };
import quiz02 from './catalog/quiz-02.json' with { type: 'json' };
import quiz03 from './catalog/quiz-03.json' with { type: 'json' };

export const CONTENT = {
  'quiz-1': quiz01,
  'quiz-2': quiz02,
  'quiz-3': quiz03,
};
