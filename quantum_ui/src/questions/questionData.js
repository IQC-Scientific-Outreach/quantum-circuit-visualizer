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
 * Add more questions to the array to scale the quiz — no other changes required.
 */
export const QUESTIONS = [
  {
    id: 1,
    title: 'Create an X Gate',
    description:
      'The circuit below has H gates on either side of a blank. ' +
      'Fill the blank with a single gate so that the whole circuit acts as an X gate. ' /*+
      'Hint: H Z H = X.'*/,
    points: 10,
    allowedGates: ['H', 'X', 'Y', 'Z', 'T'],
    // 1 qubit, 3 steps: H | blank | H
    circuit: [
      [
        { name: 'H', locked: true },
        { blank: true },
        { name: 'H', locked: true },
      ],
    ],
    // The blank at (wire 0, step 1) must be filled with Z
    answer: [{ wireIndex: 0, stepIndex: 1, gate: 'Z' }],
  },
  {
    id: 2,
    title: 'Create Bell State |Φ⁻⟩',
    description:
      'Create the entangled Bell state (|00⟩ − |11⟩)/√2. ' +
      'The H and CNOT are already placed. ' +
      'Fill the blank on qubit 0 before the H gate.',
    points: 15,
    allowedGates: ['H', 'X', 'Y', 'Z', 'T'],
    // 2 qubits, 3 steps
    // q[0]: blank | H | CNOT-control
    // q[1]: (inactive) | (inactive) | CNOT-target
    circuit: [
      [
        { blank: true },
        { name: 'H', locked: true },
        { name: 'CNOT', role: 'control', targetWire: 1, locked: true },
      ],
      [
        null,
        null,
        { name: 'CNOT', role: 'target', controlWire: 0, locked: true },
      ],
    ],
    // The blank at (wire 0, step 0) must be filled with X
    answer: [{ wireIndex: 0, stepIndex: 0, gate: 'X' }],
  },
];
