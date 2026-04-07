import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

import initQuantumEngine from './wasm/quantum_engine.js'
import { SINGLE_QUBIT_GATES } from './constants';
import { compactCircuit } from './utils/compactCircuit';
import { simulateShots } from './utils/simulateShots';
import { circuitToCode, parseCode } from './utils/circuitCode';
import DraggableGate from './components/DraggableGate';
import DraggableCnotNode from './components/DraggableCnotNode';
import DraggablePlacedGate from './components/DraggablePlacedGate';
import DropZone from './components/DropZone';
import MeasurementHistogram from './components/MeasurementHistogram';
import ExpectationValue from './components/ExpectationValue';
import './App.css'

function App() {
  const [circuit, setCircuit] = useState([
    [null, null, null, null],
    [null, null, null, null]
  ]);

  const [engine, setEngine] = useState(null);
  const [probabilities, setProbabilities] = useState([]);
  const [stateVector, setStateVector] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const [shots, setShots] = useState(100);
  const [shotResults, setShotResults] = useState([]);

  const [measureStep, setMeasureStep] = useState(null);
  const [selectedQubit, setSelectedQubit] = useState(null);
  const [expectationValue, setExpectationValue] = useState(null);
  const [, setClassicalBits] = useState([]);

  // Circuit code input state
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(null);
  const codeInputFocused = useRef(false);

  const TWO_WIRE = ['CNOT', 'CZ', 'FF_x', 'FF_Z'];

  // For each wire: the first step index that contains a MEASURE gate (-1 if none)
  const measureStepPerWire = circuit.map(wire => {
    const idx = wire.findIndex(cell => cell?.name === 'MEASURE');
    return idx;
  });

  // ---------------------------------------------------------------------------
  // WASM engine
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadEngine() {
      try {
        const Module = await initQuantumEngine();
        setEngine(Module);
        setIsReady(true);
      } catch (err) {
        console.error('Failed to load WASM:', err);
      }
    }
    loadEngine();
  }, []);

  const runCircuit = useCallback((targetStep = null) => {
    if (!engine) return;

    const numQubits = circuit.length;
    const sim = new engine.Simulator(numQubits);
    const cppCircuitDisplay = new engine.VectorInstruction();
    const cppCircuitShots = new engine.VectorInstruction();

    const compiledInstructions = [];

    const maxStep = targetStep !== null ? targetStep : circuit[0].length - 1;

    for (let step = 0; step <= maxStep; step++) {
      for (let wire = 0; wire < numQubits; wire++) {
        const cell = circuit[wire][step];
        if (!cell) continue;

        if (TWO_WIRE.includes(cell.name)) {
          if (cell.role === 'control') {
            compiledInstructions.push({ name: cell.name, qubits: [wire, cell.targetWire] });
          }
        } else {
          compiledInstructions.push({ name: cell.name, qubits: [wire] });
        }
      }
    }

    compiledInstructions.forEach(inst => {
      // For shots, use exact instructions (actual collapse)
      const cppQubitsShots = new engine.VectorInt();
      inst.qubits.forEach(q => cppQubitsShots.push_back(q));
      cppCircuitShots.push_back({ name: inst.name, qubits: cppQubitsShots });
      cppQubitsShots.delete();

      // For display, defer measurements to preserve superposition for exact probabilities
      if (inst.name !== 'MEASURE') {
        let deferredName = inst.name;
        if (inst.name === 'FF_x') deferredName = 'CNOT';
        else if (inst.name === 'FF_Z') deferredName = 'CZ';

        const cppQubitsDisplay = new engine.VectorInt();
        inst.qubits.forEach(q => cppQubitsDisplay.push_back(q));
        cppCircuitDisplay.push_back({ name: deferredName, qubits: cppQubitsDisplay });
        cppQubitsDisplay.delete();
      }
    });

    // --- Single display run ---
    sim.run(cppCircuitDisplay);

    const cppProb = sim.get_probabilities();
    const probArr = [];
    const events = [];
    for (let i = 0; i < cppProb.size(); i++) {
      probArr.push(cppProb.get(i));
      events.push(i.toString(2).padStart(numQubits, '0'));
    }
    setProbabilities(probArr);

    const cppState = sim.get_statevector();
    const stateArr = [];
    for (let i = 0; i < cppState.size(); i += 2) {
      const real = cppState.get(i);
      const imag = cppState.get(i + 1);
      stateArr.push({ real, imag });
    }
    setStateVector(stateArr);

    if (selectedQubit !== null && typeof sim.get_expectation_z === 'function') {
      setExpectationValue(sim.get_expectation_z(selectedQubit));
    } else {
      setExpectationValue(null);
    }

    const cppBits = sim.get_classical_bits();
    const bitsArr = [];
    for (let i = 0; i < cppBits.size(); i++) bitsArr.push(cppBits.get(i));
    setClassicalBits(bitsArr);

    sim.delete();
    cppProb.delete();
    cppState.delete();
    cppBits.delete();

    // --- Histogram ---
    const hasMeasurements = compiledInstructions.some(i => i.name === 'MEASURE');
    const numShots = parseInt(shots, 10) || 100;

    if (hasMeasurements) {
      const counts = Object.fromEntries(events.map(e => [e, 0]));
      for (let s = 0; s < numShots; s++) {
        const simShot = new engine.Simulator(numQubits);
        simShot.run(cppCircuitShots);
        const cppProbShot = simShot.get_probabilities();
        let r = Math.random();
        for (let i = 0; i < cppProbShot.size(); i++) {
          r -= cppProbShot.get(i);
          if (r <= 0) { counts[events[i]]++; break; }
        }
        simShot.delete();
        cppProbShot.delete();
      }
      setShotResults(events.map(state => ({ state: `|${state}⟩`, count: counts[state] })));
    } else {
      const rawCounts = simulateShots(events, probArr, numShots);
      setShotResults(events.map(state => ({ state: `|${state}⟩`, count: rawCounts[state] })));
    }

    cppCircuitDisplay.delete();
    cppCircuitShots.delete();
  }, [circuit, engine, shots, selectedQubit]);

  useEffect(() => {
    if (isReady && engine) {
      runCircuit(measureStep);
    }
  }, [measureStep, circuit, shots, isReady, engine, runCircuit]);

  // Sync code input when circuit changes externally (drag-drop, etc.)
  useEffect(() => {
    if (!codeInputFocused.current) {
      setCodeInput(circuitToCode(circuit));
    }
  }, [circuit]);

  // ---------------------------------------------------------------------------
  // Auto-resize
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let highestOccupiedIndex = -1;
    circuit.forEach(wire => {
      for (let i = wire.length - 1; i >= 0; i--) {
        if (wire[i] !== null) {
          if (i > highestOccupiedIndex) highestOccupiedIndex = i;
          break;
        }
      }
    });

    const desiredLength = Math.max(10, highestOccupiedIndex + 6);
    const currentLength = circuit[0].length;

    if (currentLength !== desiredLength) {
      setCircuit(prevCircuit =>
        prevCircuit.map(wire => {
          if (currentLength < desiredLength) {
            return [...wire, ...Array(desiredLength - currentLength).fill(null)];
          } else {
            return wire.slice(0, desiredLength);
          }
        })
      );
    }
  }, [circuit]);

  // ---------------------------------------------------------------------------
  // Drag-and-drop monitor
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const gateData = source.data;
        const slotData = destination.data;

        if (gateData.type === 'gate' && slotData.type === 'slot') {
          setCircuit(prev => {
            const newCircuit = prev.map(wire => [...wire]);
            if (TWO_WIRE.includes(gateData.name)) {
              const cIndex = slotData.wireIndex;
              const tIndex = cIndex < prev.length - 1 ? cIndex + 1 : cIndex - 1;
              // Validate: classical gates need a measured control wire;
              //           quantum gates need an unmeasured control wire;
              //           target must always be unmeasured.
              const ctrlMeasured = prev[cIndex]?.some(c => c?.name === 'MEASURE') ?? false;
              const tgtMeasured  = prev[tIndex]?.some(c => c?.name === 'MEASURE') ?? false;
              const isClassical  = ['FF_x', 'FF_Z'].includes(gateData.name);
              if (isClassical && !ctrlMeasured) return prev;
              if (!isClassical && ctrlMeasured) return prev;
              if (tgtMeasured) return prev;
              newCircuit[cIndex][slotData.stepIndex] = { name: gateData.name, role: 'control', targetWire: tIndex };
              newCircuit[tIndex][slotData.stepIndex] = { name: gateData.name, role: 'target', controlWire: cIndex };
            } else {
              newCircuit[slotData.wireIndex][slotData.stepIndex] = { name: gateData.name };
            }
            return compactCircuit(newCircuit);
          });
          return;
        }

        if (gateData.type === 'cnot-node' && slotData.type === 'slot') {
          setCircuit(prev => {
            const newCircuit = prev.map(wire => [...wire]);
            const { name: gateName, role, wireIndex: oldWire, stepIndex: oldStep, peerWire } = gateData;
            const newWire = slotData.wireIndex;
            const newStep = slotData.stepIndex;

            if (newWire === peerWire && newStep === oldStep) return prev;
            if (newStep !== oldStep) return prev;

            // Validate control-wire constraint when the control node is being moved
            if (role === 'control') {
              const isMeasured = prev[newWire]?.some(c => c?.name === 'MEASURE') ?? false;
              const isClassical = ['FF_x', 'FF_Z'].includes(gateName);
              if (isClassical && !isMeasured) return prev;
              if (!isClassical && isMeasured) return prev;
            }

            newCircuit[oldWire][oldStep] = null;
            newCircuit[newWire][newStep] = {
              name: gateName,
              role,
              [role === 'control' ? 'targetWire' : 'controlWire']: peerWire,
            };
            newCircuit[peerWire][oldStep] = {
              name: gateName,
              role: role === 'control' ? 'target' : 'control',
              [role === 'control' ? 'controlWire' : 'targetWire']: newWire,
            };

            return compactCircuit(newCircuit);
          });
          return;
        }

        if (gateData.type === 'placed-gate' && slotData.type === 'slot') {
          setCircuit(prev => {
            const newCircuit = prev.map(wire => [...wire]);
            const { wireIndex: oldWire, stepIndex: oldStep, name } = gateData;
            const newWire = slotData.wireIndex;
            const newStep = slotData.stepIndex;

            if (oldWire === newWire && oldStep === newStep) return prev;

            newCircuit[oldWire][oldStep] = null;
            newCircuit[newWire][newStep] = { name };

            return compactCircuit(newCircuit);
          });
          return;
        }

        const isCnotSwap =
          gateData.type === 'cnot-node' &&
          slotData.type === 'cnot-node-drop' &&
          slotData.wireIndex === gateData.peerWire &&
          slotData.stepIndex === gateData.stepIndex;

        const isInsert =
          slotData.type === 'gate-insert' ||
          (slotData.type === 'cnot-node-drop' && !isCnotSwap);

        if (isCnotSwap) {
          setCircuit(prev => {
            const newCircuit = prev.map(wire => [...wire]);
            const oldWire = gateData.wireIndex;
            const peerWire = gateData.peerWire;
            const step = gateData.stepIndex;

            newCircuit[oldWire][step] = {
              name: gateData.name,
              role: gateData.role === 'control' ? 'target' : 'control',
              [gateData.role === 'control' ? 'controlWire' : 'targetWire']: peerWire,
            };
            newCircuit[peerWire][step] = {
              name: gateData.name,
              role: gateData.role,
              [gateData.role === 'control' ? 'targetWire' : 'controlWire']: oldWire,
            };
            return compactCircuit(newCircuit);
          });
          return;
        }

        if (isInsert) {
          setCircuit(prev => {
            let newCircuit = prev.map(wire => [...wire]);
            const insertStep = slotData.stepIndex;
            const targetWire = slotData.wireIndex;

            if (gateData.type === 'placed-gate') {
              newCircuit[gateData.wireIndex][gateData.stepIndex] = null;
            } else if (gateData.type === 'cnot-node') {
              newCircuit[gateData.wireIndex][gateData.stepIndex] = null;
              newCircuit[gateData.peerWire][gateData.stepIndex] = null;
            }

            newCircuit = newCircuit.map(wire => {
              const newWire = [...wire];
              newWire.splice(insertStep, 0, null);
              return newWire;
            });

            if (gateData.type === 'gate') {
              if (TWO_WIRE.includes(gateData.name)) {
                const tIndex = targetWire < prev.length - 1 ? targetWire + 1 : targetWire - 1;
                newCircuit[targetWire][insertStep] = { name: gateData.name, role: 'control', targetWire: tIndex };
                newCircuit[tIndex][insertStep] = { name: gateData.name, role: 'target', controlWire: targetWire };
              } else {
                newCircuit[targetWire][insertStep] = { name: gateData.name };
              }
            } else if (gateData.type === 'placed-gate') {
              newCircuit[targetWire][insertStep] = { name: gateData.name };
            } else if (gateData.type === 'cnot-node') {
              newCircuit[targetWire][insertStep] = {
                name: gateData.name,
                role: gateData.role,
                [gateData.role === 'control' ? 'targetWire' : 'controlWire']: gateData.peerWire,
              };
              newCircuit[gateData.peerWire][insertStep] = {
                name: gateData.name,
                role: gateData.role === 'control' ? 'target' : 'control',
                [gateData.role === 'control' ? 'controlWire' : 'targetWire']: targetWire,
              };
            }

            return compactCircuit(newCircuit);
          });
        }
      },
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Circuit editing helpers
  // ---------------------------------------------------------------------------
  const deleteGate = useCallback((wireIndex, stepIndex) => {
    setCircuit(prev => {
      const newCircuit = prev.map(wire => [...wire]);
      const cell = newCircuit[wireIndex][stepIndex];
      if (!cell) return prev;
      if (TWO_WIRE.includes(cell.name)) {
        const peerWire = cell.role === 'control' ? cell.targetWire : cell.controlWire;
        newCircuit[wireIndex][stepIndex] = null;
        newCircuit[peerWire][stepIndex] = null;
      } else {
        newCircuit[wireIndex][stepIndex] = null;
      }
      return compactCircuit(newCircuit);
    });
  }, []);

  const handleRightClickDelete = (e, wireIndex, stepIndex) => {
    e.preventDefault();
    deleteGate(wireIndex, stepIndex);
  };

  const addQubit = () => {
    const numSteps = circuit[0].length;
    setCircuit([...circuit, Array(numSteps).fill(null)]);
  };

  const removeQubit = (indexToRemove) => {
    if (circuit.length <= 1) return;
    setCircuit(prev => {
      // 1. For every remaining wire, null out cells whose 2-wire peer is the
      //    deleted wire, and remap peer references for wires above the cut.
      const cleaned = prev.map((wire, wi) => {
        if (wi === indexToRemove) return wire; // will be filtered out below
        return wire.map(cell => {
          if (!cell || !TWO_WIRE.includes(cell.name)) return cell;
          const peerKey = cell.role === 'control' ? 'targetWire' : 'controlWire';
          const peer = cell[peerKey];
          if (peer === indexToRemove) return null; // orphaned — delete it
          // Remap: if peer was above the removed wire, shift index down
          return peer > indexToRemove
            ? { ...cell, [peerKey]: peer - 1 }
            : cell;
        });
      });
      // 2. Drop the deleted wire and compact the result.
      return compactCircuit(cleaned.filter((_, i) => i !== indexToRemove));
    });
  };

  // ---------------------------------------------------------------------------
  // Circuit code load
  // ---------------------------------------------------------------------------
  const loadFromCode = () => {
    const parsed = parseCode(codeInput, circuit.length);
    if (!parsed) {
      setCodeError('Could not parse — check syntax e.g. h(0), cx(0,1), m(1)');
      return;
    }
    setCodeError(null);
    setCircuit(parsed);
  };

  const handleCodeKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      loadFromCode();
    }
  };

  // ---------------------------------------------------------------------------
  // Derived display data: which qubits are "measured" at the current sim point
  // ---------------------------------------------------------------------------
  const numQubits = circuit.length;

  // A qubit is "measured" if it has a MEASURE gate that falls within the
  // currently simulated range (measureStep === null means full circuit).
  const measuredQubits = new Set(
    measureStepPerWire
      .map((mIdx, i) => {
        if (mIdx === -1) return null;
        if (measureStep === null || measureStep >= mIdx) return i;
        return null;
      })
      .filter(i => i !== null)
  );

  const quantumQubits = Array.from({ length: numQubits }, (_, i) => i)
    .filter(i => !measuredQubits.has(i));

  // Heading label: "|q0 q2⟩" style, only quantum qubits
  const quantumLabel = quantumQubits.length > 0
    ? `|${quantumQubits.map(i => `q${i}`).join(' ')}⟩`
    : null;

  // Marginalized probabilities over quantum qubits only
  const numQuantum = quantumQubits.length;
  const margProbMap = new Map(); // label → probability

  if (probabilities.length > 0 && numQuantum > 0) {
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] === 0) continue;
      let margIdx = 0;
      for (let k = 0; k < numQuantum; k++) {
        const qubit = quantumQubits[k];
        const bit = (i >> (numQubits - 1 - qubit)) & 1;
        margIdx = (margIdx << 1) | bit;
      }
      const label = margIdx.toString(2).padStart(numQuantum, '0');
      margProbMap.set(label, (margProbMap.get(label) ?? 0) + probabilities[i]);
    }
  } else if (probabilities.length > 0 && numQuantum === 0) {
    // All qubits measured — no quantum state to show
  }

  // Marginalized amplitude map (quantum qubit label → amplitude string)
  const margAmpMap = new Map();
  if (stateVector.length > 0 && numQuantum > 0) {
    // Find the first state with non-zero probability to act as our "anchor" branch
    let anchorIdx = -1;
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > 1e-8) {
        anchorIdx = i;
        break;
      }
    }

    if (anchorIdx !== -1) {
      // We only look at states that share the same measured qubit outcomes as the anchor
      const isMatch = (index) => {
        for (const mq of measuredQubits) {
          if (((anchorIdx >> (numQubits - 1 - mq)) & 1) !== ((index >> (numQubits - 1 - mq)) & 1)) return false;
        }
        return true;
      };

      let branchProb = 0;
      for (let i = 0; i < probabilities.length; i++) {
        if (isMatch(i)) branchProb += probabilities[i];
      }
      const norm = branchProb > 0 ? Math.sqrt(branchProb) : 1;

      for (let i = 0; i < stateVector.length; i++) {
        if (isMatch(i)) {
          let margIdx = 0;
          for (let k = 0; k < numQuantum; k++) {
            const qubit = quantumQubits[k];
            const bit = (i >> (numQubits - 1 - qubit)) & 1;
            margIdx = (margIdx << 1) | bit;
          }
          const label = margIdx.toString(2).padStart(numQuantum, '0');

          const { real, imag } = stateVector[i];
          let r = real / norm;
          let im = imag / norm;
          
          if (Math.abs(r) < 1e-5) r = 0;
          if (Math.abs(im) < 1e-5) im = 0;

          if (Math.abs(r) > 1e-6 || Math.abs(im) > 1e-6) {
            const sign = im >= 0 ? '+' : '-';
            margAmpMap.set(label, `${r.toFixed(4)} ${sign} ${Math.abs(im).toFixed(4)}i`);
          }
        }
      }
    }
  }

  // P(qubit i = 1) for each measured qubit, derived from probabilities
  const measuredQubitsProb = new Map(); // qubit index → P(=1)
  for (const qi of measuredQubits) {
    let p1 = 0;
    for (let i = 0; i < probabilities.length; i++) {
      if ((i >> (numQubits - 1 - qi)) & 1) p1 += probabilities[i];
    }
    measuredQubitsProb.set(qi, p1);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 flex font-sans text-slate-300 bg-slate-950">

      {/* Left sidebar */}
      <aside className="w-55 bg-slate-900 border-r border-slate-700/50 flex flex-col shrink-0 z-10">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h1 className="text-sm font-semibold text-white tracking-tight leading-tight">Circuit Visualizer</h1>
          {!isReady && <p className="text-[10px] text-amber-400 animate-pulse mt-0.5">Initializing…</p>}
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Single-qubit</p>
            <div className="grid grid-cols-2 gap-3 items-center justify-items-center">
              {SINGLE_QUBIT_GATES.map(gate => (
                <DraggableGate key={gate} gate={gate} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Quantum 2q</p>
            <div className="flex gap-2 justify-center">
              {['CNOT', 'CZ'].map(gate => (
                <DraggableGate key={gate} gate={gate} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-amber-500/70 uppercase tracking-widest mb-2">Classical ctrl</p>
            <div className="flex gap-2 justify-center">
              {['FF_x', 'FF_Z'].map(gate => (
                <DraggableGate key={gate} gate={gate} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Circuit board */}
      <div className="flex-1 overflow-auto p-3 bg-slate-950">
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl p-5 inline-block min-w-max">

          {/* Time scrubber row */}
          <div className="flex items-center mb-3">
            <div className="w-16 text-[10px] text-slate-400 font-semibold uppercase tracking-widest text-right pr-4">Time</div>
            <div className="flex relative items-center py-2 px-9">
              {circuit[0]?.map((_, stepIndex) => (
                <div
                  key={`time-${stepIndex}`}
                  onClick={() => setMeasureStep(measureStep === stepIndex ? null : stepIndex)}
                  className="w-14 h-5 relative flex items-center justify-center mx-1 z-30 cursor-pointer group/timeline"
                  title={measureStep === stepIndex ? 'Clear scrubber' : `Measure at step ${stepIndex}`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                    measureStep === stepIndex
                      ? 'bg-purple-500 border-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.5)] scale-125'
                      : 'bg-slate-800 border-slate-600 group-hover/timeline:bg-slate-700'
                  }`} />
                  {measureStep === stepIndex && (
                    <div
                      className="absolute top-4 left-1/2 w-[2px] bg-purple-500/50 -translate-x-1/2 pointer-events-none"
                      style={{ height: `${circuit.length * 5}rem` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Qubit wires */}
          {circuit.map((wire, wireIndex) => (
            <div key={`wire-${wireIndex}`} className="flex items-center mb-2 group">

              <button
                onClick={() => setSelectedQubit(selectedQubit === wireIndex ? null : wireIndex)}
                className={`w-16 font-mono font-medium text-right pr-4 text-sm transition-colors shrink-0 ${
                  selectedQubit === wireIndex
                    ? 'text-purple-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={selectedQubit === wireIndex ? 'Clear ⟨Z⟩ selection' : `Show ⟨Z⟩ for q[${wireIndex}]`}
              >
                q[{wireIndex}]
              </button>

              <div className="flex relative items-center py-2 px-1">
                {measureStepPerWire[wireIndex] === -1 ? (
                  <div className="absolute left-0 right-0 h-px bg-slate-600 z-0" />
                ) : (
                  <>
                    <div
                      className="absolute left-0 h-px bg-slate-600 z-0"
                      style={{ width: `calc(${measureStepPerWire[wireIndex]} * (3.5rem + 0.5rem) + 2rem)` }}
                    />
                    <div
                      className="absolute right-0 z-0"
                      style={{
                        left: `calc(${measureStepPerWire[wireIndex]} * (3.5rem + 0.5rem) + 2rem)`,
                        top: 'calc(50% - 2px)',
                        height: '4px',
                        borderTop:    '1.5px solid rgba(251,191,36,0.55)',
                        borderBottom: '1.5px solid rgba(251,191,36,0.55)',
                      }}
                    />
                  </>
                )}

                {wire.map((cell, stepIndex) => (
                  <div
                    key={`slot-${wireIndex}-${stepIndex}`}
                    className="w-14 h-14 relative flex items-center justify-center mx-1 z-10"
                  >
                    {cell ? (
                      TWO_WIRE.includes(cell.name) ? (
                        <div
                          className="w-full h-full relative flex items-center justify-center z-20 group/cnot"
                          onContextMenu={(e) => handleRightClickDelete(e, wireIndex, stepIndex)}
                        >
                          <DraggableCnotNode cell={cell} wireIndex={wireIndex} stepIndex={stepIndex} />

                          {cell.role === 'control' && (
                            <>
                              {(cell.name === 'CNOT' || cell.name === 'CZ') ? (
                                <div
                                  className="absolute w-px bg-slate-400 z-0 pointer-events-none"
                                  style={{
                                    left: 'calc(50% - 1px)',
                                    top: cell.targetWire > wireIndex ? '50%' : 'auto',
                                    bottom: cell.targetWire < wireIndex ? '50%' : 'auto',
                                    height: `${Math.abs(cell.targetWire - wireIndex) * 5}rem`,
                                  }}
                                />
                              ) : (
                                <div
                                  className="absolute z-0 pointer-events-none"
                                  style={{
                                    left: 'calc(50% - 3px)',
                                    top: cell.targetWire > wireIndex ? '50%' : 'auto',
                                    bottom: cell.targetWire < wireIndex ? '50%' : 'auto',
                                    height: `${Math.abs(cell.targetWire - wireIndex) * 5}rem`,
                                    width: '6px',
                                    borderLeft:  '1.5px solid rgba(251,191,36,0.6)',
                                    borderRight: '1.5px solid rgba(251,191,36,0.6)',
                                  }}
                                />
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteGate(wireIndex, stepIndex); }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-700 text-slate-300 hover:bg-red-500 hover:text-white text-[10px] flex items-center justify-center z-40 opacity-0 group-hover/cnot:opacity-100 transition-opacity leading-none"
                                title="Delete gate"
                              >×</button>
                            </>
                          )}
                        </div>
                      ) : (
                        <DraggablePlacedGate
                          cell={cell}
                          wireIndex={wireIndex}
                          stepIndex={stepIndex}
                          handleRightClickDelete={handleRightClickDelete}
                          onDelete={() => deleteGate(wireIndex, stepIndex)}
                        />
                      )
                    ) : (
                      <DropZone wireIndex={wireIndex} stepIndex={stepIndex} />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => removeQubit(wireIndex)}
                className="ml-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title="Remove qubit"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <div className="mt-4">
            <button
              onClick={addQubit}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-white transition-colors"
            >
              <Plus size={13} /> Add Qubit
            </button>
          </div>
        </div>
      </div>

      {/* Results panel */}
      <aside className="w-64 bg-slate-900 border-l border-slate-700/50 shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-700/50 shrink-0 flex items-center gap-2">
          <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-widest">Results</p>
          {measureStep !== null && (
            <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded px-1.5 py-0.5">step {measureStep}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-slate-700/40">
          {!isReady ? (
            <p className="text-[10px] text-slate-500 text-center mt-8 animate-pulse px-4">Initializing engine…</p>
          ) : (
            <>
              {selectedQubit !== null && expectationValue !== null && (
                <div className="px-4 py-3">
                  <ExpectationValue qubitIndex={selectedQubit} value={expectationValue} measureStep={measureStep} />
                </div>
              )}

              {/* Classical bits: show P(=1) from probability array */}
              {measuredQubits.size > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">Measured</p>
                  <div className="flex flex-col gap-2 font-mono text-xs">
                    {[...measuredQubits].map(i => {
                      const p1 = measuredQubitsProb.get(i) ?? 0;
                      const p0 = 1 - p1;
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400">q[{i}]</span>
                            <span className="text-slate-500 text-[10px]">
                              <span className="text-slate-300">{(p0 * 100).toFixed(1)}%</span> |0⟩ ·{' '}
                              <span className="text-amber-300">{(p1 * 100).toFixed(1)}%</span> |1⟩
                            </span>
                          </div>
                          {/* Mini probability bar: left=|0⟩ slate, right=|1⟩ amber */}
                          <div className="h-1 w-full bg-slate-700/60 rounded-full overflow-hidden flex">
                            <div className="h-full bg-slate-400/70 rounded-l-full" style={{ width: `${p0 * 100}%` }} />
                            <div className="h-full bg-amber-500/70 rounded-r-full" style={{ width: `${p1 * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Probabilities: marginalized to quantum qubits */}
              {margProbMap.size > 0 && (
                <div className="px-4 py-3">
                  <div className="flex items-baseline gap-1.5 mb-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Probabilities</p>
                    {quantumLabel && (
                      <span className="text-[10px] text-slate-500 font-mono">{quantumLabel}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 font-mono text-xs">
                    {[...margProbMap.entries()].map(([label, prob]) => (
                      <div key={`prob-${label}`} className="flex justify-between items-center">
                        <span className="text-slate-400">|{label}⟩</span>
                        <span className="text-white font-medium tabular-nums">{(prob * 100).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amplitudes: marginalized to quantum qubits */}
              {margAmpMap.size > 0 && (
                <div className="px-4 py-3">
                  <div className="flex items-baseline gap-1.5 mb-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Amplitudes</p>
                    {quantumLabel && (
                      <span className="text-[10px] text-slate-500 font-mono">{quantumLabel}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                    {[...margAmpMap.entries()].map(([label, amp]) => (
                      <div key={`amp-${label}`} className="flex justify-between items-center gap-2">
                        <span className="text-slate-400 shrink-0">|{label}⟩</span>
                        <span className="text-slate-200 font-medium tabular-nums text-right">{amp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 py-3">
                <MeasurementHistogram data={shotResults} shots={shots} />
              </div>

              {/* Shots */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Shots</p>
                <input
                  type="number"
                  value={shots}
                  onChange={(e) => setShots(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-slate-500 focus:text-white"
                  min="1"
                  max="100000"
                />
              </div>

              {/* Circuit code */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Circuit Code</p>
                <textarea
                  value={codeInput}
                  onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
                  onFocus={() => { codeInputFocused.current = true; }}
                  onBlur={() => { codeInputFocused.current = false; }}
                  onKeyDown={handleCodeKeyDown}
                  rows={3}
                  spellCheck={false}
                  placeholder="h(0), cx(0,1), m(1)"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-slate-500 resize-none leading-relaxed"
                />
                {codeError && (
                  <p className="text-[10px] text-red-400 mt-1">{codeError}</p>
                )}
                <button
                  onClick={loadFromCode}
                  className="mt-1.5 w-full text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded py-1 transition-colors"
                >
                  Load ↵
                </button>
                <p className="text-[9px] text-slate-600 mt-1.5 leading-relaxed">
                  Gates: h x y z t m cx cz ffx ffz<br />
                  e.g. <span className="text-slate-500">h(0), cx(0,1), m(1)</span>
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default App;
