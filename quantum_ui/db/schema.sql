-- =============================================================================
-- Course quiz backend — Supabase schema (source of truth)
-- =============================================================================
-- Apply in the Supabase SQL editor. Safe to re-run (idempotent creates + seed).
--
-- Consumed by the serverless functions in quantum_ui/api/:
--   • attempts          → progress.js  (GET resume, POST upsert an attempt)
--                         dashboard.js (aggregate best %, completion, in-progress, counts)
--   • quiz_availability → quiz/[slug].js (content gate), dashboard.js (which quizzes show)
-- Enrollment (enroll.js) validates CLASS_CODE from an env var — no table needed.
--
-- Design notes
-- ------------
--  • One row per ATTEMPT (not per student+quiz), so re-attempts are preserved.
--  • "best score", pct, and "ever completed" are NOT stored — they are computed at
--    read time (dashboard.js + the analytics queries), so nothing derivable is
--    duplicated in the DB.
--  • per_question is a compact jsonb array, one entry per answered question:
--      [{ "id": <question id>, "points": <int>, "revealed": <bool>, "wrongTries": <int> }, …]
--    % attempted / correct / gave-up / unattempted and per-question "themes" all
--    derive from this field.
--
-- Migrating from an earlier schema? If you previously created the single-row
-- `progress` table (or the original `events`/`attempts` tables), drop them first —
-- see the destructive ONE-TIME MIGRATION block at the bottom (test data only).
-- =============================================================================

-- Per-attempt progress. UNIQUE (username, quiz_slug, attempt_no): the same attempt is
-- upserted in place as the student answers; a new attempt_no starts a new row.
create table if not exists attempts (
  id                 bigint  generated always as identity primary key,
  username           text    not null,
  quiz_slug          text    not null,
  attempt_no         int     not null,
  total_questions    int     not null default 0,          -- snapshot of the quiz at attempt time
  max_points         int     not null default 0,          -- snapshot
  questions_answered int     not null default 0,
  points             int     not null default 0,
  per_question       jsonb   not null default '[]'::jsonb, -- see Design notes for shape
  completed          boolean not null default false,
  started_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (username, quiz_slug, attempt_no)
);
-- The UNIQUE index above leads with `username`, so it also serves the hot reads:
--   dashboard.js → where username = ?
--   progress.js  → where username = ? and quiz_slug = ?
-- Optional — add only if you frequently run analytics filtered by a single quiz:
-- create index if not exists attempts_quiz_slug_idx on attempts (quiz_slug);

-- Which quizzes are unlocked. Flip is_available to true in the table editor to reveal a
-- quiz one-by-one — no redeploy. Add a row per new quiz (defaults to locked).
create table if not exists quiz_availability (
  quiz_slug    text    primary key,
  is_available boolean not null default false
);

insert into quiz_availability (quiz_slug, is_available) values
  ('quiz-1', true),
  ('quiz-2', false),
  ('quiz-3', false)
on conflict (quiz_slug) do nothing;

-- =============================================================================
-- ONE-TIME MIGRATION (DESTRUCTIVE — run only when upgrading from an older schema;
-- test data only). Uncomment, run once, then re-run the create statements above.
-- =============================================================================
-- drop table if exists progress;   -- old single-row-per-quiz model
-- drop table if exists events;     -- from the original plan, now unused
-- drop table if exists attempts;   -- ONLY if an older `attempts` with different columns exists
