import { parseBuilderBackup } from './questionData';
import quiz01 from './catalog/quiz-01.json';
import quiz02 from './catalog/quiz-02.json';
import quiz03 from './catalog/quiz-03.json';

// ── Quiz catalog ────────────────────────────────────────────────────────────
// Ordered list of quizzes shown on the dashboard (/quizzes) and played at
// /quiz/:slug. Each `backup` is the raw "Save JSON backup" array exported from
// the Question Builder; parseBuilderBackup turns it into the runtime question
// shape QuestionsPage renders. For now every quiz is a single mock question —
// replace the catalog/quiz-0N.json files with real exports as they're authored.
//
// ── To add another quiz (iterative) ──
//   1. Author it in the builder → "Save JSON backup" → save as catalog/quiz-04.json
//   2. `import quiz04 from './catalog/quiz-04.json'` above
//   3. Add one row to CATALOG below with a unique slug, title, description, backup
const CATALOG = [
  { slug: 'quiz-1', title: 'Quiz 1', description: 'Placeholder — first quiz.',  backup: quiz01 },
  { slug: 'quiz-2', title: 'Quiz 2', description: 'Placeholder — second quiz.', backup: quiz02 },
  { slug: 'quiz-3', title: 'Quiz 3', description: 'Placeholder — third quiz.',  backup: quiz03 },
];

export const QUIZZES = CATALOG.map(({ backup, ...meta }) => ({
  ...meta,
  questions: parseBuilderBackup(backup),
}));

export function getQuizBySlug(slug) {
  return QUIZZES.find((q) => q.slug === slug) || null;
}
