// Client + server quiz METADATA only — no question content, so catalog/*.json never
// enters the client bundle. Question content is served on demand (and gated) by
// api/quiz/[slug].js, which reads it from quizContent.js (server-only).
//
// ── To add a quiz ──
//   1. Author in the builder → "Save JSON backup" → save as catalog/quiz-04.json
//   2. Add its content to quizContent.js (server map)
//   3. Add a row here (unique slug, title, description)
//   4. Insert a quiz_availability row in Supabase (defaults locked)
export const QUIZZES = [
  { slug: 'quiz-1', title: 'Quiz 1', description: 'Single-qubit quantum circuits' },
  { slug: 'quiz-2', title: 'Quiz 2', description: 'Two-qubit quantum circuits' },
  { slug: 'quiz-3', title: 'Quiz 3', description: 'Quantum protocols as circuits' },
];

export function getQuizMeta(slug) {
  return QUIZZES.find((q) => q.slug === slug) || null;
}
