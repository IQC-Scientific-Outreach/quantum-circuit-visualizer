import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { QUESTIONS } from '../questions/questionData';
import { GATE_STYLES } from '../constants';
import GateVisual from '../components/GateVisual';
import DraggableGate from '../components/DraggableGate';
import QuestionBlankSlot from '../components/question/QuestionBlankSlot';

// ─── Small display components ────────────────────────────────────────────────

/** A locked (given) single-qubit gate — display only, no drag or delete. */
function LockedGate({ cell }) {
  return (
    <div
      className={`w-full h-full border text-lg rounded flex items-center justify-center font-bold shadow-sm select-none ${GATE_STYLES[cell.name]}`}
      title="Given (locked)"
    >
      <GateVisual name={cell.name} />
    </div>
  );
}

/** A filled blank — shows the placed gate with an × button to remove it. */
function FilledBlankGate({ gateName, onClear }) {
  return (
    <div className="relative w-full h-full group/filled">
      <div
        className={`w-full h-full border text-lg rounded flex items-center justify-center font-bold shadow-sm ring-2 ring-blue-400/60 ${GATE_STYLES[gateName]}`}
      >
        <GateVisual name={gateName} />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-600 text-slate-200 hover:bg-red-500 hover:text-white text-[10px] flex items-center justify-center z-30 leading-none transition-colors"
        title="Remove gate"
      >
        ×
      </button>
    </div>
  );
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

const TWO_WIRE = ['CNOT', 'CZ', 'FF_x', 'FF_Z'];

/**
 * Renders a single cell in the question circuit grid.
 * Returns null for inactive cells so the horizontal wire still shows through.
 */
function CellContent({ cell, wireIndex, stepIndex, onClear }) {
  if (!cell) return null;

  // Blank slot (unfilled)
  if (cell.blank && !cell.filled) {
    return <QuestionBlankSlot wireIndex={wireIndex} stepIndex={stepIndex} />;
  }

  // Blank slot (filled by student)
  if (cell.blank && cell.filled) {
    return (
      <FilledBlankGate
        gateName={cell.filled}
        onClear={() => onClear(wireIndex, stepIndex)}
      />
    );
  }

  // Locked single-qubit gate
  if (cell.locked && !TWO_WIRE.includes(cell.name)) {
    return <LockedGate cell={cell} />;
  }

  // Locked multi-qubit control node + connecting line
  if (cell.locked && TWO_WIRE.includes(cell.name) && cell.role === 'control') {
    const diff = cell.targetWire - wireIndex;
    return (
      <div className="w-full h-full relative flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full bg-slate-300 z-10" />
        <div
          className="absolute w-px bg-slate-400 pointer-events-none"
          style={{
            left: 'calc(50% - 0.5px)',
            top: diff > 0 ? '50%' : 'auto',
            bottom: diff < 0 ? '50%' : 'auto',
            height: `${Math.abs(diff) * 5}rem`,
          }}
        />
      </div>
    );
  }

  // Locked CNOT target node
  if (cell.locked && cell.name === 'CNOT' && cell.role === 'target') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-slate-400/80 bg-slate-800/60 rounded flex items-center justify-center select-none">
          <span className="text-slate-200 text-base font-bold leading-none">X</span>
        </div>
      </div>
    );
  }

  // Locked CZ target node
  if (cell.locked && cell.name === 'CZ' && cell.role === 'target') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-9 h-9 border border-slate-400/70 bg-slate-500/10 rounded flex items-center justify-center select-none">
          <span className="text-slate-300 text-base font-bold leading-none">Z</span>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Circuit board ────────────────────────────────────────────────────────────

function QuestionCircuit({ circuitState, onClear }) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl p-5 inline-block min-w-max">
      {circuitState.map((wire, wireIndex) => (
        <div key={wireIndex} className="flex items-center mb-2 last:mb-0">
          {/* Wire label */}
          <div className="w-16 font-mono font-medium text-right pr-4 text-sm text-slate-400 shrink-0">
            q[{wireIndex}]
          </div>

          {/* Slots with wire line */}
          <div className="flex relative items-center py-2 px-1">
            <div className="absolute left-0 right-0 h-px bg-slate-600 z-0" />
            {wire.map((cell, stepIndex) => (
              <div
                key={stepIndex}
                className="w-14 h-14 relative flex items-center justify-center mx-1 z-10"
              >
                <CellContent
                  cell={cell}
                  wireIndex={wireIndex}
                  stepIndex={stepIndex}
                  onClear={onClear}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Final score screen ───────────────────────────────────────────────────────

function FinalScreen({ scores, onRetry }) {
  const totalPoints = scores.reduce((s, r) => s + r.points, 0);
  const maxPoints = QUESTIONS.reduce((s, q) => s + q.points, 0);
  const pct = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-300 flex flex-col items-center justify-center font-sans gap-6 p-8">
      <div className="text-5xl">{pct === 100 ? '🏆' : pct >= 50 ? '🎉' : '💡'}</div>
      <h1 className="text-2xl font-bold text-white">Quiz Complete!</h1>
      <p className="text-base text-slate-400">
        Final score:{' '}
        <span className="text-white font-semibold">{totalPoints}</span>
        <span className="text-slate-500"> / {maxPoints} points</span>
        <span className="text-slate-600 ml-2">({pct}%)</span>
      </p>

      {/* Per-question breakdown */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-3 min-w-80">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">
          Breakdown
        </p>
        {QUESTIONS.map((q, i) => {
          const s = scores[i];
          const earned = s?.points ?? 0;
          const hint = s?.usedHint;
          return (
            <div key={q.id} className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-300 truncate">{q.title}</span>
              <span className="shrink-0">
                {hint && (
                  <span className="text-amber-500/80 text-xs mr-2">(revealed)</span>
                )}
                <span className={earned > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                  {earned} / {q.points} pts
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-2">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Try Again
        </button>
        <Link
          to="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Back to Visualizer
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

/** Build fresh mutable circuit state from a question definition. */
function initCircuit(question) {
  return question.circuit.map(wire =>
    wire.map(cell => (cell ? { ...cell } : null))
  );
}

export default function QuestionsPage() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [scores, setScores] = useState([]); // [{ questionId, points, usedHint }]
  const [phase, setPhase] = useState('playing'); // 'playing' | 'done'

  const question = QUESTIONS[questionIndex];

  const [circuitState, setCircuitState] = useState(() => initCircuit(question));
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'incorrect'
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Reset circuit + UI state whenever the question changes
  useEffect(() => {
    setCircuitState(initCircuit(question));
    setFeedback(null);
    setAnswerRevealed(false);
  }, [questionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // DnD monitor: handle gate drops from palette onto blank slots
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const [dest] = location.current.dropTargets;
        if (!dest) return;
        if (source.data.type !== 'gate' || dest.data.type !== 'question-blank') return;

        const { wireIndex, stepIndex } = dest.data;
        setCircuitState(prev => {
          const next = prev.map(w => [...w]);
          const cell = next[wireIndex][stepIndex];
          if (cell?.blank) {
            next[wireIndex][stepIndex] = { blank: true, filled: source.data.name };
          }
          return next;
        });
        setFeedback(null);
      },
    });
  }, []);

  const clearBlank = useCallback((wireIndex, stepIndex) => {
    setCircuitState(prev => {
      const next = prev.map(w => [...w]);
      const cell = next[wireIndex][stepIndex];
      if (cell?.blank) next[wireIndex][stepIndex] = { blank: true };
      return next;
    });
    setFeedback(null);
  }, []);

  const checkCorrect = useCallback(() =>
    question.answer.every(({ wireIndex, stepIndex, gate }) => {
      const cell = circuitState[wireIndex]?.[stepIndex];
      return cell?.blank && cell?.filled === gate;
    }),
  [circuitState, question]);

  const advanceQuestion = useCallback((pointsEarned) => {
    const record = { questionId: question.id, points: pointsEarned, usedHint: answerRevealed };
    const newScores = [...scores, record];
    setScores(newScores);
    if (questionIndex + 1 < QUESTIONS.length) {
      setQuestionIndex(qi => qi + 1);
    } else {
      setPhase('done');
    }
  }, [scores, question, questionIndex, answerRevealed]);

  const handleSubmit = () => {
    if (answerRevealed) {
      advanceQuestion(0);
      return;
    }
    if (checkCorrect()) {
      setFeedback('correct');
      setTimeout(() => advanceQuestion(question.points), 1400);
    } else {
      setFeedback('incorrect');
    }
  };

  const handleGetAnswer = () => {
    setCircuitState(prev => {
      const next = prev.map(w => [...w]);
      question.answer.forEach(({ wireIndex, stepIndex, gate }) => {
        next[wireIndex][stepIndex] = { blank: true, filled: gate };
      });
      return next;
    });
    setAnswerRevealed(true);
    setFeedback(null);
  };

  const handleRetry = () => {
    setScores([]);
    setQuestionIndex(0);
    setPhase('playing');
  };

  // ── Final screen ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    return <FinalScreen scores={scores} onRetry={handleRetry} />;
  }

  // ── Header totals ─────────────────────────────────────────────────────────
  const maxPoints = QUESTIONS.reduce((s, q) => s + q.points, 0);
  const currentScore = scores.reduce((s, r) => s + r.points, 0);

  return (
    <div className="fixed inset-0 flex flex-col font-sans text-slate-300 bg-slate-950">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-700/50 flex items-center gap-4 px-5 py-3 shrink-0">
        <Link
          to="/"
          className="text-slate-500 hover:text-slate-200 text-xs transition-colors shrink-0"
        >
          ← Visualizer
        </Link>

        <span className="text-slate-700 select-none">|</span>

        <h1 className="text-sm font-semibold text-white tracking-tight">
          Practice Questions
        </h1>

        <div className="flex-1" />

        {/* Progress dots */}
        <div className="flex gap-2 items-center">
          {QUESTIONS.map((q, i) => (
            <div
              key={q.id}
              className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                i < questionIndex
                  ? 'bg-emerald-500 border-emerald-400'
                  : i === questionIndex
                  ? 'bg-blue-500 border-blue-300 shadow-[0_0_6px_rgba(59,130,246,0.5)] scale-125'
                  : 'bg-slate-700 border-slate-600'
              }`}
              title={`Q${i + 1}: ${q.title}`}
            />
          ))}
        </div>

        <span className="text-slate-700 select-none">|</span>

        {/* Running score */}
        <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
          <span className="text-white font-semibold">{currentScore}</span>
          <span className="text-slate-600"> / {maxPoints} pts</span>
        </span>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: gate palette */}
        <aside className="w-44 bg-slate-900 border-r border-slate-700/50 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Gate Palette
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">Drag onto a blank</p>
          </div>
          <div className="p-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 items-center justify-items-center">
              {question.allowedGates.map(gate => (
                <DraggableGate key={gate} gate={gate} />
              ))}
            </div>
          </div>
        </aside>

        {/* Center: question content */}
        <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">

          {/* Question header */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Question {questionIndex + 1} of {QUESTIONS.length}
              <span className="text-slate-600"> · {question.points} points</span>
            </p>
            <h2 className="text-xl font-bold text-white mb-2">{question.title}</h2>
            <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
              {question.description}
            </p>
          </div>

          {/* Circuit board */}
          <div className="overflow-auto">
            <QuestionCircuit circuitState={circuitState} onClear={clearBlank} />
          </div>

          {/* Controls + feedback */}
          <div className="flex items-center gap-3 flex-wrap">
            {answerRevealed ? (
              /* After "Get Answer" — offer Next/Finish, no points */
              <>
                <div className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5">
                  Answer revealed — 0 points for this question
                </div>
                <button
                  onClick={() => advanceQuestion(0)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {questionIndex + 1 < QUESTIONS.length ? 'Next Question →' : 'Finish →'}
                </button>
              </>
            ) : (
              /* Normal play state */
              <>
                <button
                  onClick={handleSubmit}
                  disabled={feedback === 'correct'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Submit
                </button>
                <button
                  onClick={handleGetAnswer}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                >
                  Get Answer (0 pts)
                </button>

                {feedback === 'correct' && (
                  <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5 animate-pulse">
                    ✓ Correct! +{question.points} points — moving on…
                  </div>
                )}
                {feedback === 'incorrect' && (
                  <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">
                    ✗ Not quite — try a different gate
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
