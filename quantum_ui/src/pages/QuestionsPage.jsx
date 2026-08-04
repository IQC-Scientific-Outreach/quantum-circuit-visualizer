import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { QUESTIONS } from '../questions/questionData';
import { GATE_STYLES } from '../constants';
import GateVisual from '../components/GateVisual';
import DraggableGate from '../components/DraggableGate';
import QuestionBlankSlot from '../components/question/QuestionBlankSlot';
import ResultsPanel from '../components/ResultsPanel';
import DropZone from '../components/DropZone';
import CircuitCell from '../components/CircuitCell';
import DraggablePlacedGate from '../components/DraggablePlacedGate';
import DraggableCnotNode from '../components/DraggableCnotNode';
import initQuantumEngine from '../wasm/quantum_engine.js';
import { simulateCircuit } from '../utils/simulateCircuit.js';
import { applyGateDrop, TWO_WIRE, removeGateFromCircuit, insertColumnIfOccupied } from '../utils/circuitDnD.js';
import { compactCircuit } from '../utils/compactCircuit.js';
import { decodeStudentPackage } from '../utils/questionPackage.js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-600 text-slate-200 hover:bg-red-500 hover:text-white text-[10px] flex items-center justify-center z-30 leading-none transition-colors opacity-0 group-hover/filled:opacity-100"
        title="Remove gate"
      >
        ×
      </button>
    </div>
  );
}

// ─── Circuit board ────────────────────────────────────────────────────────────

/**
 * separatorSteps: column indices to draw a thin divider line before, marking the
 * boundaries between the "given" question circuit and the student-editable areas
 * on either side of it (used for restrictToBlanks: false questions).
 * stepOffset: how many editable columns precede the given circuit — hiddenBlocks
 * step indices are relative to the given circuit, so the overlay shifts by it.
 */
function QuestionCircuit({ circuitState, hiddenBlocks, restrictToBlanks, onDelete, separatorSteps = [], stepOffset = 0, selectedQubit, onWireClick, hoveredBarrier, onHoverBarrier, onResizeBarrier }) {
  const customRenderer = useCallback((cell, wireIndex, stepIndex) => {
    if (!cell) {
      if (restrictToBlanks) return null;
      return undefined;
    }

    if (cell.blank && !cell.filled) {
      if (cell.name === 'BLANK_2' || cell.name === 'BLANK_3') {
        return (
          <div className="w-full h-full relative flex items-center justify-center z-20 group/cnot">
            <QuestionBlankSlot wireIndex={wireIndex} stepIndex={stepIndex} />
            {cell.name === 'BLANK_3' ? (
              wireIndex === Math.min(...cell.controls, cell.targetWire) && <div className="absolute w-px bg-slate-400 z-0 pointer-events-none" style={{ left: 'calc(50% - 1px)', top: '50%', height: `${(Math.max(...cell.controls, cell.targetWire) - wireIndex) * 5}rem` }} />
            ) : (
              cell.role === 'control' && <div className="absolute w-px bg-slate-400 z-0 pointer-events-none" style={{ left: 'calc(50% - 1px)', top: cell.targetWire > wireIndex ? '50%' : 'auto', bottom: cell.targetWire < wireIndex ? '50%' : 'auto', height: `${Math.abs(cell.targetWire - wireIndex) * 5}rem` }} />
            )}
          </div>
        );
      }
      return <QuestionBlankSlot wireIndex={wireIndex} stepIndex={stepIndex} />;
    }

    if (cell.blank && cell.filled) {
      if (cell.name === 'BLANK_2' || cell.name === 'BLANK_3') {
        return <CircuitCell cell={{ ...cell, name: cell.filled }} wireIndex={wireIndex} stepIndex={stepIndex} onDelete={onDelete} onRightClickDelete={(e) => { e.preventDefault(); onDelete(wireIndex, stepIndex); }} />;
      }
      return <FilledBlankGate gateName={cell.filled} onClear={() => onDelete(wireIndex, stepIndex)} />;
    }

    if (cell.locked && TWO_WIRE.includes(cell.name) && cell.role === 'control') {
      const diff = cell.targetWire - wireIndex;
      return (
        <div className="w-full h-full relative flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full bg-slate-300 z-10" />
          <div className="absolute w-px bg-slate-400 pointer-events-none" style={{ left: 'calc(50% - 0.5px)', top: diff > 0 ? '50%' : 'auto', bottom: diff < 0 ? '50%' : 'auto', height: `${Math.abs(diff) * 5}rem` }} />
        </div>
      );
    }
    if (cell.locked && cell.name === 'CNOT' && cell.role === 'target') return <div className="w-full h-full flex items-center justify-center"><div className="w-9 h-9 border-2 border-slate-400/80 bg-slate-800/60 rounded flex items-center justify-center select-none"><span className="text-slate-200 text-base font-bold leading-none">X</span></div></div>;
    if (cell.locked && cell.name === 'CZ'   && cell.role === 'target') return <div className="w-full h-full flex items-center justify-center"><div className="w-9 h-9 border border-slate-400/70 bg-slate-500/10 rounded flex items-center justify-center select-none"><span className="text-slate-300 text-base font-bold leading-none">Z</span></div></div>;
    if (cell.locked && !TWO_WIRE.includes(cell.name)) return <LockedGate cell={cell} />;

    return undefined;
  }, [restrictToBlanks, onDelete]);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl p-5 inline-block min-w-max relative">
      {circuitState.map((wire, wireIndex) => (
        <div key={`wire-${wireIndex}`} className="flex items-center mb-2 last:mb-0">
          <button
            onClick={() => onWireClick && onWireClick(wireIndex)}
            className={`w-16 font-mono font-medium text-right pr-4 text-sm shrink-0 transition-colors ${
              selectedQubit === wireIndex
                ? 'text-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={selectedQubit === wireIndex ? 'Clear ⟨Z⟩ selection' : `Show ⟨Z⟩ for q[${wireIndex}]`}
          >
            q[{wireIndex}]
          </button>
          <div className="flex relative items-center py-2 px-1">
            <div className="absolute left-0 right-0 h-px bg-slate-600 z-0" />
            {wire.flatMap((cell, stepIndex) => {
              const elements = [];
              // Divider between given circuit and student-editable area
              if (separatorSteps.includes(stepIndex)) {
                elements.push(
                  <div
                    key={`sep-${wireIndex}-${stepIndex}`}
                    className="w-0.5 h-10 bg-blue-500/40 mx-1.5 shrink-0 self-center rounded-full"
                    title="Boundary of the given circuit"
                  />
                );
              }
              elements.push(
                <div
                  key={`slot-${wireIndex}-${stepIndex}`}
                  className="w-14 h-14 relative flex items-center justify-center mx-1 z-10"
                >
                  <CircuitCell
                    cell={cell}
                    wireIndex={wireIndex}
                    stepIndex={stepIndex}
                    customRenderer={customRenderer}
                    onDelete={onDelete}
                    onRightClickDelete={(e, w, s) => { e.preventDefault(); onDelete(w, s); }}
                    hoveredBarrier={hoveredBarrier}
                    onHoverBarrier={onHoverBarrier}
                    onResizeBarrier={onResizeBarrier}
                  />
                </div>
              );
              return elements;
            })}
          </div>
        </div>
      ))}

      {/* Hidden blocks overlay */}
      {hiddenBlocks && hiddenBlocks.map((block, i) => (
        <div
          key={`hidden-${i}`}
          className="absolute z-40 bg-slate-800/95 border border-slate-600 rounded-lg flex items-center justify-center backdrop-blur-sm shadow-xl"
          style={{
            top:    `calc(1.25rem + ${block.topWire}   * 5rem)`,
            left:   `calc(5.75rem + ${block.startStep + stepOffset} * 4rem)`,
            width:  `calc(${(block.endStep - block.startStep + 1)} * 4rem - 0.5rem)`,
            height: `calc(${(block.bottomWire - block.topWire  + 1)} * 5rem - 0.5rem)`,
          }}
        >
          <span className="text-slate-400 font-bold tracking-widest uppercase text-xs">Hidden Circuit</span>
        </div>
      ))}
    </div>
  );
}

// ─── Final score screen ───────────────────────────────────────────────────────

function FinalScreen({ scores, questions, onRetry }) {
  const totalPoints = scores.reduce((s, r) => s + r.points, 0);
  const maxPoints   = questions.reduce((s, q) => s + q.points, 0);
  const pct = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  return (
    <div className="fixed inset-0 w-full bg-slate-950 text-slate-300 flex flex-col items-center justify-center font-sans gap-6 p-8 overflow-y-auto">
      <div className="text-5xl">{pct === 100 ? '🏆' : pct >= 50 ? '🎉' : '💡'}</div>
      <h1 className="text-2xl font-bold text-white">Quiz Complete!</h1>
      <p className="text-base text-slate-400">
        Final score:{' '}
        <span className="text-white font-semibold">{totalPoints}</span>
        <span className="text-slate-500"> / {maxPoints} points</span>
        <span className="text-slate-600 ml-2">({pct}%)</span>
      </p>

      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-3 min-w-80">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Breakdown</p>
        {questions.map((q, i) => {
          const s = scores[i];
          const earned = s?.points ?? 0;
          const hint   = s?.usedHint;
          return (
            <div key={q.id} className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-300 truncate">{q.title}</span>
              <span className="shrink-0">
                {hint && <span className="text-amber-500/80 text-xs mr-2">(revealed)</span>}
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

// ─── Editable-region geometry (equivalent-state questions) ───────────────────
// A free-form question's grid is laid out as
//   [ leftSteps editable columns | given circuit | rightSteps editable columns ]
// The given circuit is a fixed block; both editable areas start at the size the
// question asks for and grow outwards as the student fills them, so the left one
// gains columns at the far edge while the block itself stays put.
// Both default to the historic layout: nothing before, a buffer after.

// Empty columns kept beyond the student's outermost gate on a growing side.
const SPARE_STEPS = 1;

/** Columns the given circuit occupies inside the student grid. */
function givenLen(question) {
  const c = question.circuit;
  if (!c || c.length === 0) return 0;
  return Math.max(0, ...c.map(w => w.length));
}

/** Editable columns before the given circuit (its starting size). */
function leftStepsOf(question) {
  if (question.restrictToBlanks || question.questionType === 'mcq') return 0;
  return Math.max(0, question.leftSteps ?? 0);
}

/**
 * Whether the area before the given circuit may gain columns. It needs the
 * circuit itself as an anchor: without one there is no boundary to grow away
 * from, and a question that asks for no room before it never gets any.
 */
function canGrowLeft(question) {
  return leftStepsOf(question) > 0 && givenLen(question) > 0;
}

/** Columns a region uses, measured from the edge its gates are packed against. */
function usedColumns(grid, from, to, packedRight) {
  let used = 0;
  for (const wire of grid) {
    if (packedRight) {
      for (let i = from; i < to; i++) {
        if (wire[i]) { used = Math.max(used, to - i); break; }
      }
    } else {
      for (let i = to - 1; i >= from; i--) {
        if (wire[i]) { used = Math.max(used, i - from + 1); break; }
      }
    }
  }
  return used;
}

/** Editable columns after the given circuit (the legacy buffer when unspecified). */
function rightStepsOf(question) {
  if (question.restrictToBlanks || question.questionType === 'mcq') return 0;
  return Math.max(0, question.rightSteps ?? Math.max(3, 8 - givenLen(question)));
}

/**
 * Start column of the given circuit. A drop may splice a column into the grid,
 * so the block is located by its locked cells rather than assumed to sit at
 * leftSteps; `fallback` covers questions that ship no given circuit at all.
 */
function findGivenStart(grid, qLen, fallback) {
  if (qLen === 0) return fallback;
  for (let s = 0; s < (grid[0]?.length ?? 0); s++) {
    for (let w = 0; w < grid.length; w++) {
      const cell = grid[w][s];
      if (cell && (cell.locked || cell.blank)) return s;
    }
  }
  return fallback;
}

/**
 * Packs the left region against the given circuit. `minWidth` is the size the
 * question asks for; a region that may grow keeps every gate beyond it, one that
 * may not returns null when its gates no longer fit (the drop is then rejected).
 */
function fitLeftRegion(part, minWidth, allowGrow) {
  const current = part[0]?.length ?? 0;
  if (current === 0) return part.map(() => Array(minWidth).fill(null));
  // compactCircuit packs left, so reverse around it to pack right instead.
  const packed = compactCircuit(part.map(w => [...w].reverse())).map(w => w.reverse());
  const width = allowGrow
    ? Math.max(minWidth, usedColumns(packed, 0, current, true))
    : minWidth;
  if (current > width) {
    const surplus = packed.map(w => w.slice(0, current - width));
    if (surplus.some(w => w.some(c => c !== null))) return null;
    return packed.map(w => w.slice(current - width));
  }
  return packed.map(w => [...Array(width - current).fill(null), ...w]);
}

/**
 * Restores the [left | given | right] layout after a drop or a delete: student
 * gates are packed against the given circuit from both sides, and each area keeps
 * at least the width the question asked for. Widths past that are left alone —
 * the auto-resize pass below settles the spare columns on either end.
 * Returns null when a non-growing left region can no longer hold its gates.
 */
function normalizeRegions(grid, question) {
  const qLen  = givenLen(question);
  const left  = leftStepsOf(question);
  const start = findGivenStart(grid, qLen, left);

  const leftPart  = grid.map(w => w.slice(0, start));
  const given     = grid.map(w => w.slice(start, start + qLen));
  const rightPart = grid.map(w => w.slice(start + qLen));

  const packedLeft = fitLeftRegion(leftPart, left, canGrowLeft(question));
  if (!packedLeft) return null;
  const packedRight = (rightPart[0]?.length ?? 0) > 0 ? compactCircuit(rightPart) : rightPart;

  return grid.map((_, i) => [...packedLeft[i], ...given[i], ...packedRight[i]]);
}

/** hiddenBlocks step indices are relative to the given circuit — shift them into grid space. */
function shiftHiddenBlocks(question, givenStart) {
  if (!question.hiddenBlocks || givenStart === 0) return question.hiddenBlocks;
  return question.hiddenBlocks.map(b => ({ ...b, startStep: b.startStep + givenStart, endStep: b.endStep + givenStart }));
}

function initCircuit(question) {
  const src = (question.circuit && question.circuit.length > 0) ? question.circuit : [[null]];
  const qLen  = givenLen(question);
  const left  = leftStepsOf(question);
  const right = rightStepsOf(question);
  // MCQ (and restrict-to-blanks) questions show the given circuit as-is — no editable area.
  if (left + qLen + right === 0) return src.map(() => [null]);
  return src.map(wire => [
    ...Array(left).fill(null),
    ...Array.from({ length: qLen }, (_, s) => (wire[s] ? { ...wire[s] } : null)),
    ...Array(right).fill(null),
  ]);
}

function getAnswerCircuit(question) {
  if (question.questionType === 'mcq') return initCircuit(question);
  const base = initCircuit(question);
  if (!question.restrictToBlanks) {
    const left = leftStepsOf(question);
    let next = base.map(w => w.map(c => (c && !c.locked) ? null : c));
    const place = (entries, offset) => entries.forEach(({ wireIndex, stepIndex, gate, role, targetWire, controlWire, controls }) => {
      const absStep = stepIndex + offset;
      while (next[0].length <= absStep) next.forEach(w => w.push(null));
      if (role) {
        next[wireIndex][absStep] = { name: gate, role, targetWire, controlWire, controls };
      } else {
        next[wireIndex][absStep] = { name: gate };
      }
    });
    // Reference gates before the given circuit, then the ones after it.
    place((question.preAnswer || []).filter(a => a.stepIndex < left), 0);
    place(question.answer || [], left + givenLen(question));
    return next;
  }

  // restrictToBlanks mode: reset blank fills, then fill each blank with its answer gate.
  let next = base.map((w, wi) => w.map((c, si) => {
    if (c?.blank) {
      const orig = question.circuit[wi]?.[si];
      if (orig) return { ...orig, filled: undefined };
    }
    return c;
  }));
  if (question.answer) {
    question.answer.forEach(({ wireIndex, stepIndex, gate, role, targetWire, controlWire, controls }) => {
      while (next[0].length <= stepIndex) next.forEach(w => w.push(null));
      if (role) {
        next[wireIndex][stepIndex] = { name: gate, role, targetWire, controlWire, controls };
      } else {
        const cell = next[wireIndex][stepIndex];
        if (cell?.blank) {
          if (cell.name === 'BLANK_2' || cell.name === 'BLANK_3') {
            next = next.map(w => w.map((c, si) =>
              (si === stepIndex && c?.blank && c.name === cell.name) ? { ...c, filled: gate } : c
            ));
          } else {
            next[wireIndex][stepIndex] = { ...cell, filled: gate };
          }
        }
      }
    });
  }
  return next;
}

// ─── Multiple-choice answers ────────────────────────────────────────────────
// `revealed` colours the correct/incorrect options; `locked` disables selection.
function MCQChoices({ choices, selectedChoice, correctChoice, onSelect, revealed, locked }) {
  return (
    <div className="flex flex-col gap-2.5 max-w-2xl">
      {choices.map((choice, i) => {
        const isSelected = selectedChoice === i;
        const isCorrect  = i === correctChoice;

        let boxCls = 'border-slate-700 bg-slate-900 hover:border-slate-500';
        let badgeCls = 'border-slate-600 text-slate-400';
        if (revealed) {
          if (isCorrect)       { boxCls = 'border-emerald-500/70 bg-emerald-500/10'; badgeCls = 'border-emerald-400 text-emerald-300'; }
          else if (isSelected) { boxCls = 'border-red-500/70 bg-red-500/10';         badgeCls = 'border-red-400 text-red-300'; }
          else                 { boxCls = 'border-slate-700 bg-slate-900 opacity-60'; }
        } else if (isSelected) {
          boxCls = 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40';
          badgeCls = 'border-blue-400 text-blue-300';
        }

        return (
          <button
            key={i}
            disabled={locked}
            onClick={() => onSelect(i)}
            className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${boxCls} ${locked ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold ${badgeCls}`}>
              {String.fromCharCode(65 + i)}
            </span>
            <div className="text-sm text-slate-200 leading-relaxed pt-0.5 min-w-0 flex-1">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{ p: ({node, ...props}) => <p className="mb-0 whitespace-pre-wrap" {...props} /> }}
              >
                {choice || `Choice ${String.fromCharCode(65 + i)}`}
              </ReactMarkdown>
            </div>
            {revealed && isCorrect && <span className="ml-2 text-emerald-400 text-xs shrink-0 pt-1">✓ correct</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function QuestionsPage({ initialQuestions, quizMeta, onEvent, onComplete } = {}) {
  // ── Active question set (default = built-in, replaced when a .qpkg is loaded) ──
  const [activeQuestions, setActiveQuestions] = useState(initialQuestions ?? QUESTIONS);
  const [quizTitle, setQuizTitle]             = useState(quizMeta?.title ?? null); // null = practice mode
  const quizFileRef = useRef(null);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [scores, setScores]               = useState([]);
  const [phase, setPhase]                 = useState('playing');

  const question = activeQuestions[questionIndex];

  const [circuitState,    setCircuitState]    = useState(() => initCircuit(question));
  const [feedback,        setFeedback]        = useState(null);
  const [answerRevealed,  setAnswerRevealed]  = useState(false);
  const [hiddenCircuitRevealed, setHiddenCircuitRevealed] = useState(false);
  const [selectedChoice,  setSelectedChoice]  = useState(null);

  const isMCQ = question.questionType === 'mcq';

  const [engine,   setEngine]   = useState(null);
  const [isReady,  setIsReady]  = useState(false);
  const [shots, setShots] = useState(100);
  const [resampleCount, setResampleCount] = useState(0);
  const [selectedQubit, setSelectedQubit] = useState(null);
  const [hoveredBarrier, setHoveredBarrier] = useState(null);

  // ── Helper: reset everything for a given question set ──────────────────────
  function startQuiz(qs) {
    setActiveQuestions(qs);
    setQuestionIndex(0);
    setScores([]);
    setPhase('playing');
    setCircuitState(initCircuit(qs[0]));
    setFeedback(null);
    setAnswerRevealed(false);
    setHiddenCircuitRevealed(false);
    setSelectedChoice(null);
  }

  // ── Load .qpkg file ─────────────────────────────────────────────────────────
  function handleLoadQuizFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const payload = decodeStudentPackage(ev.target.result);
        setQuizTitle(payload.meta?.title || 'Quiz');
        startQuiz(payload.questions);
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Load Quantum Engine ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadEngine() {
      try {
        const Module = await initQuantumEngine();
        setEngine(Module);
        setIsReady(true);
      } catch (err) { console.error(err); }
    }
    loadEngine();
  }, []);

  // ── ✅ Good: Calculate derived data during rendering and cache expensive WASM calls
  const simResults = useMemo(() => {
    if (!isReady || !engine || isMCQ) return null;
    const normalizedCircuit = circuitState.map(wire => wire.map(cell => {
      if (!cell) return null;
      if (cell.blank) return cell.filled ? { ...cell, name: cell.filled } : null;
      return { ...cell };
    }));
    return simulateCircuit(engine, normalizedCircuit, null, shots, selectedQubit);
  }, [isReady, engine, isMCQ, circuitState, shots, selectedQubit, resampleCount]);

  // ── Adjust state during render: Auto-expand circuit empty buffer slots ──────
  const [prevCircuitForResize, setPrevCircuitForResize] = useState(circuitState);
  const [prevQuestionIndex, setPrevQuestionIndex] = useState(questionIndex);

  if (circuitState !== prevCircuitForResize || questionIndex !== prevQuestionIndex) {
    setPrevCircuitForResize(circuitState);
    setPrevQuestionIndex(questionIndex);

    if (!isMCQ && questionIndex >= scores.length) { // equivalent to skipping auto-expanding on past questions
      const qLen = givenLen(question);
      const currentLength = circuitState[0].length;

      if (question.restrictToBlanks) {
        // The circuit is shown as-is — no editable area to size.
        if (currentLength < qLen) {
          setCircuitState(prev => prev.map(wire => [...wire, ...Array(qLen - currentLength).fill(null)]));
        } else if (currentLength > qLen) {
          setCircuitState(prev => prev.map(wire => wire.slice(0, qLen)));
        }
      } else {
        const start = findGivenStart(circuitState, qLen, leftStepsOf(question));
        // An untouched area shows exactly the size the question asked for; once the
        // student places something it keeps SPARE_STEPS columns past their last gate.
        const grow  = (min, used, allow) =>
          (used === 0 || !allow) ? min : Math.max(min, used + SPARE_STEPS);

        const desiredLeft = grow(
          leftStepsOf(question), usedColumns(circuitState, 0, start, true), canGrowLeft(question));
        const desiredRight = grow(
          rightStepsOf(question), usedColumns(circuitState, start + qLen, currentLength, false), true);

        const padLeft  = desiredLeft - start;
        const padRight = desiredRight - (currentLength - start - qLen);

        if (padLeft !== 0 || padRight !== 0) {
          setCircuitState(prev => prev.map(wire => {
            let next = wire;
            if (padLeft > 0)       next = [...Array(padLeft).fill(null), ...next];
            else if (padLeft < 0)  next = next.slice(-padLeft);
            if (padRight > 0)      next = [...next, ...Array(padRight).fill(null)];
            else if (padRight < 0) next = next.slice(0, next.length + padRight);
            return next;
          }));
        }
      }
    }
  }

  // ── DnD monitor ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        if (questionIndex < scores.length) return; // Prevent drag-and-drop on past questions
        const [dest] = location.current.dropTargets;
        if (!dest) return;

        const { wireIndex, stepIndex } = dest.data;

        setCircuitState(prev => {
          // The area before the circuit grows, so read the boundary off the grid.
          const givenStart = findGivenStart(prev, givenLen(question), leftStepsOf(question));
          const givenEnd   = givenStart + givenLen(question);
          // The given circuit itself stays untouchable; both sides of it are fair game.
          if (!question.restrictToBlanks && stepIndex >= givenStart && stepIndex < givenEnd) {
            return prev;
          }

          const cell = prev[wireIndex]?.[stepIndex];
          if (source.data.type === 'gate' && cell?.blank && (cell.name === 'BLANK_2' || cell.name === 'BLANK_3')) {
            const is2Wire = TWO_WIRE.includes(source.data.name);
            const is3Wire = source.data.name === 'TOFFOLI';
            const isClassical = ['FF_X', 'FF_Z'].includes(source.data.name);
            
            const isMeasured = (w) => prev[w]?.some(c => c?.name === 'MEASURE' || (c?.blank && c?.filled === 'MEASURE')) ?? false;

            if ((cell.name === 'BLANK_2' && is2Wire) || (cell.name === 'BLANK_3' && is3Wire)) {
              const involvedWires = [];
              if (cell.name === 'BLANK_2') {
                involvedWires.push(wireIndex);
                involvedWires.push(cell.role === 'control' ? cell.targetWire : cell.controlWire);
                const cWire = cell.role === 'control' ? wireIndex : cell.controlWire;
                const tWire = cell.role === 'target' ? wireIndex : cell.targetWire;
                if (isClassical && !isMeasured(cWire)) return prev;
                if (!isClassical && isMeasured(cWire)) return prev;
                if (isMeasured(tWire)) return prev;
              } else if (cell.name === 'BLANK_3') {
                involvedWires.push(cell.targetWire);
                involvedWires.push(cell.controls[0]);
                involvedWires.push(cell.controls[1]);
                if (isMeasured(cell.targetWire) || isMeasured(cell.controls[0]) || isMeasured(cell.controls[1])) return prev;
              }
              involvedWires.sort((a, b) => a - b);

              return prev.map((w, wi) => w.map((c, si) => {
                if (si === stepIndex && involvedWires.includes(wi) && c?.blank && c.name === cell.name) {
                  if (is2Wire) {
                    const top = involvedWires[0];
                    const bottom = involvedWires[1];
                    if (wi === top) {
                      return { ...c, filled: source.data.name, role: 'control', targetWire: bottom, controlWire: undefined };
                    } else {
                      return { ...c, filled: source.data.name, role: 'target', controlWire: top, targetWire: undefined };
                    }
                  } else if (is3Wire) {
                    const target = involvedWires[2];
                    const controls = [involvedWires[0], involvedWires[1]];
                    if (wi === target) {
                      return { ...c, filled: source.data.name, role: 'target', controls, targetWire: target };
                    } else {
                      return { ...c, filled: source.data.name, role: 'control', controls, targetWire: target };
                    }
                  }
                }
                return c;
              }));
            }
            return prev;
          }

          if (source.data.type === 'gate' && cell?.blank && (!cell.name || cell.name === 'BLANK')) {
            return prev.map((w, wi) => w.map((c, si) => 
              (wi === wireIndex && si === stepIndex && c?.blank) ? { ...c, filled: source.data.name } : c
            ));
          }

          if (question.restrictToBlanks) {
            const isCnotSwap = source.data.type === 'cnot-node' && dest.data.type === 'cnot-node-drop' && source.data.peerWire === dest.data.wireIndex && source.data.stepIndex === dest.data.stepIndex;
            const isToffoliSwap = source.data.type === 'toffoli-node' && dest.data.type === 'cnot-node-drop' && dest.data.stepIndex === source.data.stepIndex && (source.data.controls?.includes(dest.data.wireIndex) || source.data.targetWire === dest.data.wireIndex);
            
            if (isToffoliSwap) {
              return prev.map((w, wi) => w.map((c, si) => {
                if (si !== source.data.stepIndex || !c || c.name !== 'BLANK_3') return c;
                const oldWire = source.data.wireIndex;
                const swapWire = dest.data.wireIndex;
                const oldRole = prev[oldWire][si].role;
                const swapRole = prev[swapWire][si].role;
                if (oldRole === swapRole) return c;
                
                let newControls = [...source.data.controls];
                if (oldRole === 'control') newControls = [swapWire, newControls.find(cw => cw !== oldWire)];
                else newControls = [oldWire, newControls.find(cw => cw !== swapWire)];
                const newTarget = oldRole === 'control' ? oldWire : swapWire;
                
                if (wi === oldWire) return { ...c, role: swapRole, controls: newControls, targetWire: newTarget };
                if (wi === swapWire) return { ...c, role: oldRole, controls: newControls, targetWire: newTarget };
                if (newControls.includes(wi) || newTarget === wi) return { ...c, controls: newControls, targetWire: newTarget };
                return c;
              }));
            }

            if (isCnotSwap) {
              return prev.map((w, wi) => w.map((c, si) => {
                if (si !== source.data.stepIndex || !c || c.name !== 'BLANK_2') return c;
                const oldWire = source.data.wireIndex;
                const peerWire = source.data.peerWire;
                if (wi === oldWire) {
                  const role = source.data.role === 'control' ? 'target' : 'control';
                  return { ...c, role, [role === 'control' ? 'controlWire' : 'targetWire']: undefined, [role === 'control' ? 'targetWire' : 'controlWire']: peerWire };
                }
                if (wi === peerWire) {
                  const role = source.data.role;
                  return { ...c, role, [role === 'control' ? 'controlWire' : 'targetWire']: undefined, [role === 'control' ? 'targetWire' : 'controlWire']: oldWire };
                }
                return c;
              }));
            }

            if (dest.data.type === 'gate-insert' || (dest.data.type === 'cnot-node-drop' && !isCnotSwap && !isToffoliSwap)) {
              return prev;
            }
          }
          const next = applyGateDrop(prev, source.data, dest.data, {
            // Drops before the given circuit can't shift it — normalizeRegions puts it back.
            hiddenBlocks: stepIndex < givenStart ? [] : shiftHiddenBlocks(question, givenStart),
          });
          // For free-form (equivalent circuit) mode, re-pack around the given circuit
          if (question.restrictToBlanks) return next;

          return normalizeRegions(next, question) ?? prev;
        });
        setFeedback(null);
      },
    });
  }, [question, questionIndex, scores.length]);

  // ── Delete gate ─────────────────────────────────────────────────────────────
  const deleteGate = useCallback((wireIndex, stepIndex) => {
    if (questionIndex < scores.length) return; // Prevent deletions on past questions
    setCircuitState(prev => {
      const cell = prev[wireIndex]?.[stepIndex];
      // Blanks: clear the filled gate but preserve the blank structure so the
      // student can fill it again.  removeGateFromCircuit now fully deletes
      // blanks (matching builder behaviour), so we intercept here first.
      if (cell?.blank) {
        if (cell.name === 'BLANK_2' || cell.name === 'BLANK_3') {
          return prev.map(w => w.map((c, si) =>
            (si === stepIndex && c?.blank && c.name === cell.name) ? { ...c, filled: undefined } : c
          ));
        }
        // single BLANK: clear fill only
        return prev.map((w, wi) => w.map((c, si) =>
          (wi === wireIndex && si === stepIndex && c?.blank) ? { ...c, filled: undefined } : c
        ));
      }
      // removeGateFromCircuit guards cell.locked — locked question gates are never removed
      const next = removeGateFromCircuit(prev, wireIndex, stepIndex);
      // Re-pack around the given circuit after delete in free-form mode
      if (question.restrictToBlanks) return next;

      return normalizeRegions(next, question) ?? next;
    });
    setFeedback(null);
  }, [question, questionIndex, scores.length]);

  // ── Barrier Resize ─────────────────────────────────────────────────────────
  const resizeBarrier = useCallback((wireIndex, stepIndex, action) => {
    if (questionIndex < scores.length) return; // Prevent resize on past questions
    if (question.restrictToBlanks) return;
    setCircuitState(prev => {
      const newCircuit = prev.map(wire => [...wire]);
      const cell = newCircuit[wireIndex][stepIndex];
      if (!cell || cell.name !== 'BARRIER' || cell.locked) return prev;

      for (let w = cell.topWire; w <= cell.bottomWire; w++) newCircuit[w][stepIndex] = null;

      let newTop = cell.topWire;
      let newBottom = cell.bottomWire;
      if (action === 'extendTop')    newTop    = Math.max(0, newTop - 1);
      if (action === 'shrinkTop')    newTop    = Math.min(newTop + 1, newBottom);
      if (action === 'extendBottom') newBottom = Math.min(prev.length - 1, newBottom + 1);
      if (action === 'shrinkBottom') newBottom = Math.max(newBottom - 1, newTop);

      const newSpanWires = Array.from({ length: newBottom - newTop + 1 }, (_, i) => newTop + i);
      insertColumnIfOccupied(newCircuit, stepIndex, newSpanWires);

      for (let w = newTop; w <= newBottom; w++) {
        newCircuit[w][stepIndex] = { name: 'BARRIER', topWire: newTop, bottomWire: newBottom };
      }

      return normalizeRegions(newCircuit, question) ?? prev;
    });
  }, [question, questionIndex, scores.length]);

  // ── Check answer ─────────────────────────────────────────────────────────────
  const checkCorrect = useCallback(() => {
    if (!question.restrictToBlanks) {
      if (!simResults || simResults.stateVector.length === 0 || !engine) return false;

      const qLen = givenLen(question);
      const left = leftStepsOf(question);
      const expectedGrid = question.circuit.map(wire => [
        ...Array(left).fill(null),
        ...Array.from({ length: qLen }, (_, s) => {
          const cell = wire[s];
          return (!cell || cell.blank) ? null : { ...cell };
        }),
      ]);

      // Answer step indices from the builder are 0-based within their own region.
      // Offset them so they land beside — never on top of — the locked gates.
      const place = (entries, offset) => entries.forEach(({ wireIndex, stepIndex, gate, role, targetWire, controlWire, controls }) => {
        const absStep = stepIndex + offset;
        while (expectedGrid[0].length <= absStep) expectedGrid.forEach(w => w.push(null));
        if (role) {
          expectedGrid[wireIndex][absStep] = { name: gate, role, targetWire, controlWire, controls };
        } else {
          expectedGrid[wireIndex][absStep] = { name: gate };
        }
      });
      place((question.preAnswer || []).filter(a => a.stepIndex < left), 0);
      place(question.answer || [], left + qLen);

      const expectedSim = simulateCircuit(engine, expectedGrid, null, shots, null);
      if (!expectedSim || expectedSim.stateVector.length === 0) return false;

      let realPart = 0, imagPart = 0;
      for (let i = 0; i < simResults.stateVector.length; i++) {
        realPart += simResults.stateVector[i].real * expectedSim.stateVector[i].real + simResults.stateVector[i].imag * expectedSim.stateVector[i].imag;
        imagPart += simResults.stateVector[i].imag * expectedSim.stateVector[i].real - simResults.stateVector[i].real * expectedSim.stateVector[i].imag;
      }
      return (realPart * realPart + imagPart * imagPart) > 0.99;
    }

    for (let w = 0; w < circuitState.length; w++) {
      for (let s = 0; s < circuitState[w].length; s++) {
        const cell = circuitState[w][s];
        if (cell?.blank) {
              const originalCell = question.circuit[w]?.[s];
              if (!originalCell) return false;

          if (cell.name === 'BLANK_2' || cell.name === 'BLANK_3') {
            const isSymmetric = cell.filled === 'CZ';
            if (!isSymmetric) {
              if (cell.name === 'BLANK_2') {
                if (cell.role !== originalCell.role) return false;
                if (cell.targetWire !== originalCell.targetWire) return false;
                if (cell.controlWire !== originalCell.controlWire) return false;
              } else if (cell.name === 'BLANK_3') {
                if (cell.role !== originalCell.role) return false;
                if (cell.targetWire !== originalCell.targetWire) return false;
                if (cell.controls || originalCell.controls) {
                  if (!cell.controls || !originalCell.controls) return false;
                  const c1 = [...cell.controls].sort((a, b) => a - b);
                  const c2 = [...originalCell.controls].sort((a, b) => a - b);
                  if (c1[0] !== c2[0] || c1[1] !== c2[1]) return false;
                }
              }
            }

            // Only check once per multi-qubit blank (at the original control wire)
            if (originalCell.role !== 'control') continue;
            if (originalCell.name === 'BLANK_3' && originalCell.controls && originalCell.controls[0] !== w) continue;
          }

              const expected = (question.answer || []).find(a => a.wireIndex === w && a.stepIndex === s);
              if (expected) {
                if (cell.filled !== expected.gate) return false;
              } else {
                if (cell.filled) return false;
              }
        }
      }
    }
    return true;
  }, [circuitState, question, simResults, engine, shots]);

  // ── Advance to next question ─────────────────────────────────────────────────
  const advanceQuestion = useCallback((pointsEarned) => {
    const record     = { questionId: question.id, points: pointsEarned, usedHint: answerRevealed };
    const newScores  = [...scores, record];
    if (scores.length === 0) onEvent?.('started'); // first answer of this run
    setScores(newScores);
    if (questionIndex + 1 < activeQuestions.length) {
      const nextIdx = questionIndex + 1;
      const nextQ = activeQuestions[nextIdx];
      setCircuitState(initCircuit(nextQ));
      setFeedback(null);
      setAnswerRevealed(false);
      setHiddenCircuitRevealed(false);
      setSelectedQubit(null);
      setHoveredBarrier(null);
      setSelectedChoice(null);
      setQuestionIndex(nextIdx);
    } else {
      setPhase('done');
    }
  }, [scores, question, questionIndex, answerRevealed, activeQuestions, onEvent]);

  // ── Fire finished / onComplete once the quiz reaches the done phase ─────────
  // Reuses FinalScreen's total/max computation so callers get the same numbers.
  useEffect(() => {
    if (phase !== 'done') return;
    const totalPoints = scores.reduce((s, r) => s + r.points, 0);
    const maxPoints   = activeQuestions.reduce((s, q) => s + q.points, 0);
    onEvent?.('finished');
    onComplete?.({ scores, totalPoints, maxPoints });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MCQ selection ─────────────────────────────────────────────────────────
  const mcqLocked = isMCQ && (questionIndex < scores.length || answerRevealed || feedback === 'correct');
  const selectChoice = (i) => {
    if (mcqLocked) return;
    setSelectedChoice(i);
    setFeedback(null);
  };

  const handleSubmit = () => {
    if (answerRevealed) { advanceQuestion(0); return; }
    const correct = isMCQ ? (selectedChoice === question.correctChoice) : checkCorrect();
    setFeedback(correct ? 'correct' : 'incorrect');
  };

  const handleGetAnswer = () => {
    if (isMCQ) {
      setSelectedChoice(question.correctChoice);
      setAnswerRevealed(true);
      setFeedback(null);
      return;
    }
    setCircuitState(getAnswerCircuit(question));
    setAnswerRevealed(true);
    setFeedback(null);
  };

  const handleRetry = () => startQuiz(activeQuestions);

  // ── Final screen ──────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return <FinalScreen scores={scores} questions={activeQuestions} onRetry={handleRetry} />;
  }

  const maxPoints    = activeQuestions.reduce((s, q) => s + q.points, 0);
  const currentScore = scores.reduce((s, r) => s + r.points, 0);

  // For equivalent-circuit questions: separators around the given circuit
  const freeForm    = !isMCQ && !question.restrictToBlanks;
  const givenSteps  = freeForm ? givenLen(question) : 0;
  // The area before the circuit grows, so the boundary comes from the grid itself.
  const givenStart  = freeForm ? findGivenStart(circuitState, givenSteps, leftStepsOf(question)) : 0;
  const separatorSteps = freeForm
    ? [...(givenStart > 0 ? [givenStart] : []), ...(givenSteps > 0 ? [givenStart + givenSteps] : [])]
    : [];
  // MCQ questions that opted to keep a circuit render it read-only above the choices
  const showMcqCircuit = isMCQ && !question.hideCircuit && question.circuit && question.circuit.some(w => w.length > 0);

  return (
    <div className="fixed inset-0 w-full flex flex-col font-sans text-slate-300 bg-slate-950">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-700/50 flex items-center gap-4 px-5 py-3 shrink-0">
        <Link to="/" className="text-slate-500 hover:text-slate-200 text-xs transition-colors shrink-0">
          ← Visualizer
        </Link>

        <span className="text-slate-700 select-none">|</span>

        {/* Title: quiz name when loaded, otherwise "Practice Questions" */}
        <h1 className="text-sm font-semibold text-white tracking-tight">
          {quizTitle ?? 'Practice Questions'}
        </h1>

        {/* Back to practice (only when a quiz file is loaded) */}
        {quizTitle && (
          <button
            onClick={() => { setQuizTitle(null); startQuiz(QUESTIONS); }}
            className="text-slate-500 hover:text-slate-200 text-xs transition-colors shrink-0"
          >
            ← Practice
          </button>
        )}

        <Link to="/builder" className="text-slate-500 hover:text-slate-200 text-xs transition-colors shrink-0">
          Question Builder →
        </Link>

        {/* Load quiz file */}
        <input ref={quizFileRef} type="file" accept=".qpkg" onChange={handleLoadQuizFile} className="hidden" />
        <button
          onClick={() => quizFileRef.current?.click()}
          className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors shrink-0"
          title="Load a .qpkg quiz file from your teacher"
        >
          ↑ Load Quiz File
        </button>

        <div className="flex-1" />

        {/* Progress dots */}
        <div className="flex gap-2 items-center">
          {activeQuestions.map((q, i) => (
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

        <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
          <span className="text-white font-semibold">{currentScore}</span>
          <span className="text-slate-600"> / {maxPoints} pts</span>
        </span>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: gate palette (circuit questions only) */}
        {!isMCQ && (
        <aside className="w-44 bg-slate-900 border-r border-slate-700/50 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Gate Palette</p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {question.restrictToBlanks ? 'Drag onto a blank' : 'Drag onto circuit'}
            </p>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3 items-center justify-items-center">
              {(question.allowedGates || []).map(gate => (
                <DraggableGate key={gate} gate={gate} />
              ))}
            </div>
          </div>
        </aside>
        )}

        {/* Center: question content */}
        <div className="flex-1 overflow-auto min-w-0 p-6 space-y-5">

          {/* Question header */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Question {questionIndex + 1} of {activeQuestions.length}
              <span className="text-slate-600"> · {question.points} points</span>
            </p>
            <h2 className="text-xl font-bold text-white mb-2">{question.title}</h2>
            <div className="text-sm text-slate-400 leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{ p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} /> }}
              >
                {(question.description || '').replace(/\n{3,}/g, match => '\n\n' + '&nbsp;\n\n'.repeat(match.length - 2))}
              </ReactMarkdown>
            </div>
            {/* Label for equivalent-circuit questions */}
            {freeForm && separatorSteps.length > 0 && (
              <p className="text-[10px] text-slate-600 mt-1">
                {leftStepsOf(question) > 0
                  ? 'The blue lines mark off the given circuit — you can add gates before it and after it. Everything counts for amplitude.'
                  : 'The blue line separates the given circuit (left) from your additions (right). Both count for amplitude.'}
              </p>
            )}
          </div>

          {/* Circuit board / MCQ choices */}
          {isMCQ ? (
            <div className="space-y-5">
              {showMcqCircuit && (
                <div className="overflow-auto">
                  <QuestionCircuit
                    circuitState={circuitState}
                    hiddenBlocks={hiddenCircuitRevealed ? [] : question.hiddenBlocks}
                    restrictToBlanks={true}
                    onDelete={() => {}}
                    selectedQubit={null}
                  />
                </div>
              )}
              <MCQChoices
                choices={question.choices || []}
                selectedChoice={selectedChoice}
                correctChoice={question.correctChoice}
                onSelect={selectChoice}
                revealed={mcqLocked}
                locked={mcqLocked}
              />
            </div>
          ) : (
            <div className="overflow-auto">
              <QuestionCircuit
                circuitState={circuitState}
                hiddenBlocks={hiddenCircuitRevealed ? [] : question.hiddenBlocks}
                restrictToBlanks={question.restrictToBlanks}
                onDelete={deleteGate}
                separatorSteps={separatorSteps}
                stepOffset={givenStart}
                selectedQubit={selectedQubit}
                onWireClick={wi => setSelectedQubit(prev => prev === wi ? null : wi)}
                hoveredBarrier={hoveredBarrier}
                onHoverBarrier={setHoveredBarrier}
                onResizeBarrier={resizeBarrier}
              />
            </div>
          )}

          {/* Controls + feedback */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
            {questionIndex > 0 && (
              <button
                onClick={() => {
                  if (questionIndex === scores.length) {
                    if (feedback === 'correct') {
                      setScores(prev => [...prev, { questionId: question.id, points: question.points, usedHint: false }]);
                    } else if (answerRevealed) {
                      setScores(prev => [...prev, { questionId: question.id, points: 0, usedHint: true }]);
                    }
                  }
                  const prevIdx = questionIndex - 1;
                  const prevQ = activeQuestions[prevIdx];
                  setCircuitState(getAnswerCircuit(prevQ));
                  setFeedback(scores[prevIdx].points > 0 ? 'correct' : null);
                  setAnswerRevealed(true);
                  setHiddenCircuitRevealed(false);
                  setSelectedQubit(null);
                  setHoveredBarrier(null);
                  setSelectedChoice(prevQ.questionType === 'mcq' ? prevQ.correctChoice : null);
                  setQuestionIndex(prevIdx);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
              >
                ← Back
              </button>
            )}
            {questionIndex < scores.length ? (
              <>
                {scores[questionIndex].points > 0 ? (
                  <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
                    ✓ Correctly answered! ({scores[questionIndex].points} pts)
                  </div>
                ) : (
                  <div className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5">
                    Answer revealed — 0 points for this question
                  </div>
                )}
                <button
                  onClick={() => {
                  const nextIdx = questionIndex + 1;
                  if (nextIdx < activeQuestions.length) {
                    const nextQ = activeQuestions[nextIdx];
                    if (nextIdx < scores.length) {
                      setCircuitState(getAnswerCircuit(nextQ));
                      setFeedback(scores[nextIdx].points > 0 ? 'correct' : null);
                      setAnswerRevealed(true);
                      setSelectedChoice(nextQ.questionType === 'mcq' ? nextQ.correctChoice : null);
                    } else {
                      setCircuitState(initCircuit(nextQ));
                      setFeedback(null);
                      setAnswerRevealed(false);
                      setSelectedChoice(null);
                    }
                    setHiddenCircuitRevealed(false);
                    setSelectedQubit(null);
                    setHoveredBarrier(null);
                    setQuestionIndex(nextIdx);
                  } else setPhase('done');
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {questionIndex + 1 < activeQuestions.length ? 'Next Question →' : 'Finish →'}
                </button>
              </>
            ) : answerRevealed ? (
              <>
                <div className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5">
                  Answer revealed — 0 points for this question
                </div>
                <button
                  onClick={() => advanceQuestion(0)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {questionIndex + 1 < activeQuestions.length ? 'Next Question →' : 'Finish →'}
                </button>
              </>
            ) : (
              <>
                {feedback !== 'correct' && (
                  <>
                    <button
                      onClick={handleSubmit}
                      disabled={isMCQ && selectedChoice === null}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                    <button
                      onClick={handleGetAnswer}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                    >
                      Get Answer (0 pts)
                    </button>
                  </>
                )}

                {feedback === 'correct' && (
                  <>
                    <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
                      ✓ Correct! +{question.points} points
                    </div>
                    <button
                      onClick={() => advanceQuestion(question.points)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {questionIndex + 1 < activeQuestions.length ? 'Next Question →' : 'Finish →'}
                    </button>
                  </>
                )}
                {feedback === 'incorrect' && (
                  <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">
                    {isMCQ ? '✗ Not quite — try a different option' : '✗ Not quite — try a different gate'}
                  </div>
                )}
              </>
            )}

            {(questionIndex < scores.length || answerRevealed) && question.hiddenBlocks?.length > 0 && (
              <button
                onClick={() => setHiddenCircuitRevealed(prev => !prev)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors ml-auto"
              >
                {hiddenCircuitRevealed ? 'Hide Hidden Circuit' : 'Reveal Hidden Circuit'}
              </button>
            )}
            </div>

            {(questionIndex < scores.length || answerRevealed || feedback === 'correct') && question.explanation && (
              <div className="bg-slate-800/80 border border-slate-600/50 rounded-xl p-4 text-sm text-slate-300 mt-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Explanation</p>
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{ p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} /> }}
                >
                  {question.explanation.replace(/\n{3,}/g, match => '\n\n' + '&nbsp;\n\n'.repeat(match.length - 2))}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Right: Results Panel (circuit questions only).
            Per-question `hideResults` (default show) suppresses it. */}
        {!question.hideResults && !isMCQ && (
          <ResultsPanel
            isReady={isReady}
            circuit={circuitState}
            measureStep={null}
            selectedQubit={selectedQubit}
            simResults={simResults}
            shots={shots}
            setShots={setShots}
            onResample={() => setResampleCount(c => c + 1)}
            scrollableCredits={true}
          />
        )}
      </div>
    </div>
  );
}
