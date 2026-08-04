/**
 * Question definitions for the quiz system.
 *
 * circuit[wireIndex][stepIndex] cell types:
 *   { name, locked: true }                               – locked single-qubit gate (display only)
 *   { name, role, targetWire/controlWire, locked: true } – locked multi-qubit gate node
 *   { blank: true }                                      – empty slot the student must fill
 *   null                                                 – inactive (wire passes through silently)
 *
 * answer: [{ wireIndex, stepIndex, gate }]
 *   Specifies which blank positions must hold which gate for a correct submission.
 *
 * allowedGates: string[]
 *   Gates shown in the palette for this question.
 * 
 * restrictToBlanks: boolean (optional)
 *   If true, prevents drag-and-drop into empty grid slots, restricting placement only to 'blank' slots, and checks exact gate placement matches the 'answer' array.
 *   If false (or omitted), simulates the 'answer' circuit and checks if the student's circuit produces an identical state vector (ignoring global phase).
 *
 * leftSteps / rightSteps: number (optional, equivalent-state questions)
 *   Editable columns the student starts with before / after the given circuit:
 *     [ leftSteps | given circuit | rightSteps ]
 *   Either area grows outwards as the student fills it, keeping the circuit block
 *   in place. leftSteps defaults to 0 (nothing before the circuit, so nothing to
 *   grow); rightSteps defaults to the historic trailing buffer. 'answer' step
 *   indices are relative to the area after the circuit, 'preAnswer' ones to the
 *   area before it.
 *
 * preAnswer: [{ wireIndex, stepIndex, gate, ... }] (optional)
 *   Reference gates placed before the given circuit, same shape as 'answer'.
 *
 * hiddenBlocks: [{ topWire, bottomWire, startStep, endStep }]
 *   Renders a large opaque block over parts of the circuit.
 * 
 * Add more questions to the array to scale the quiz — no other changes required.
 */
import rawBackup from './questions.json';

/** Flattens a builder reference grid into answer entries (step indices are grid-relative). */
function answerFromGrid(circuit) {
  const answer = [];
  (circuit || []).forEach((wire, wi) => {
    wire.forEach((cell, si) => {
      if (!cell || cell.blank) return;
      const item = { wireIndex: wi, stepIndex: si, gate: cell.name };
      if (cell.role) {
        item.role = cell.role;
        if (cell.role === 'control') {
          item.targetWire = cell.targetWire;
          if (cell.controls) item.controls = cell.controls;
        } else {
          if (cell.controlWire != null) item.controlWire = cell.controlWire;
          if (cell.controls)            item.controls     = cell.controls;
          if (cell.targetWire != null)  item.targetWire   = cell.targetWire;
        }
      }
      answer.push(item);
    });
  });
  return answer;
}

export function parseBuilderBackup(questions) {
  if (!Array.isArray(questions)) return [];
  
  return questions.map((q, i) => {
    const id = q.id || i + 1;

    // ── Multiple-choice questions ──
    if (q.questionType === 'mcq') {
      const out = {
        id,
        title: q.title || `Question ${id}`,
        description: q.description,
        points: q.points,
        questionType: 'mcq',
        choices: q.choices || [],
        correctChoice: q.correctChoice ?? 0,
      };
      if (q.hideCircuit) {
        out.hideCircuit = true;
      } else if (q.circuit) {
        out.circuit = q.circuit.map(wire =>
          wire.map(cell => (cell ? { ...cell, locked: true } : null))
        );
        if (q.hiddenBlocks?.length > 0) out.hiddenBlocks = q.hiddenBlocks;
      }
      if (q.hideResults) out.hideResults = true;
      if (q.explanation) out.explanation = q.explanation;
      return out;
    }

    // 1. Trim trailing empty steps
    let lastOcc = -1;
    q.circuit.forEach(wire => {
      for (let s = wire.length - 1; s >= 0; s--) {
        if (wire[s] !== null) {
          if (s > lastOcc) lastOcc = s;
          break;
        }
      }
    });
    const trimSteps = Math.max(0, lastOcc + 1);

    // 2. Format the circuit cells
    const circuit = q.circuit.map(wire => 
      wire.slice(0, trimSteps).map(cell => {
        if (!cell) return null;
        if (cell.blank) {
          if (cell.name === 'BLANK_2' || cell.name === 'BLANK_3') return { ...cell, locked: true };
          return { blank: true, name: 'BLANK' };
        }
        return { ...cell, locked: true };
      })
    );

    const out = {
      id, 
      title: q.title || `Question ${id}`,
      description: q.description, 
      points: q.points,
      allowedGates: q.allowedGates, 
      circuit,
    };
    
    if (q.restrictToBlanks) out.restrictToBlanks = true;
    if (q.evaluationType) out.evaluationType = q.evaluationType;
    if (q.targetState) out.targetState = q.targetState;
    if (q.hiddenBlocks?.length > 0) out.hiddenBlocks = q.hiddenBlocks;
    if (q.hideResults) out.hideResults = true;
    if (q.explanation) out.explanation = q.explanation;

    // 3. Format the answer key
    if (!q.restrictToBlanks) {
      out.answer = answerFromGrid(q.answerCircuit);
      // Student-editable steps around the given circuit. Backups written before
      // these existed leave them unset, keeping the historic layout.
      if (q.rightSteps != null) out.rightSteps = q.rightSteps;
      if (q.leftSteps > 0) {
        out.leftSteps = q.leftSteps;
        out.preAnswer = answerFromGrid(q.preAnswerCircuit);
      }
    } else {
      out.answer = Object.entries(q.exactAnswer || {})
        .filter(([, gate]) => gate)
        .map(([key, gate]) => { 
          const [w, s] = key.split('_').map(Number); 
          return { wireIndex: w, stepIndex: s, gate }; 
        })
        .sort((a, b) => a.wireIndex - b.wireIndex || a.stepIndex - b.stepIndex);
    }
    
    return out;
  });
}

export const QUESTIONS = parseBuilderBackup(rawBackup);
