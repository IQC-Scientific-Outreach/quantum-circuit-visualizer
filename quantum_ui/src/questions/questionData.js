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
 * hiddenBlocks: [{ topWire, bottomWire, startStep, endStep }]
 *   Renders a large opaque block over parts of the circuit.
 * 
 * Add more questions to the array to scale the quiz — no other changes required.
 */
import rawBackup from './questions.json';

function parseBuilderBackup(questions) {
  if (!Array.isArray(questions)) return [];
  
  return questions.map((q, i) => {
    const id = q.id || i + 1;
    
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
    if (q.explanation) out.explanation = q.explanation;

    // 3. Format the answer key
    if (!q.restrictToBlanks) {
      const answer = [];
      (q.answerCircuit || []).forEach((wire, wi) => {
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
      out.answer = answer;
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
