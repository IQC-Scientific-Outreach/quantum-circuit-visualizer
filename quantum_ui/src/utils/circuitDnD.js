export const TWO_WIRE = ['CNOT', 'CZ', 'FF_x', 'FF_Z'];

/**
 * Centralized drag-and-drop logic for quantum circuits.
 * Used by QuestionsPage and QuestionBuilderPage to handle placing, moving,
 * swapping, and inserting gates (including multi-qubit gates like CNOT and TOFFOLI).
 */
export function applyGateDrop(prevCircuit, sourceData, destData, options = {}) {
  const { hiddenBlocks = [] } = options;

  let next = prevCircuit.map(w => [...w]);
  const wIdx = destData.wireIndex;
  const sIdx = destData.stepIndex;

  const isOccupied = (w, s) => next[w]?.[s] != null && !next[w][s].blank;

  // 1. Dropping onto a question-blank slot (Questions tab)
  if (destData.type === 'question-blank') {
    if (sourceData.type === 'gate') {
      const gateName = sourceData.name;
      if (!TWO_WIRE.includes(gateName) && gateName !== 'TOFFOLI') {
        next[wIdx][sIdx] = { blank: true, filled: gateName };
        return next;
      }
    }
    return prevCircuit;
  }

  // 2. Handle Multi-Qubit Node Swaps
  const isCnotSwap =
    sourceData.type === 'cnot-node' &&
    destData.type === 'cnot-node-drop' &&
    destData.wireIndex === sourceData.peerWire &&
    destData.stepIndex === sourceData.stepIndex;

  const isToffoliSwap =
    sourceData.type === 'toffoli-node' &&
    destData.type === 'cnot-node-drop' &&
    (sourceData.controls?.includes(destData.wireIndex) || sourceData.targetWire === destData.wireIndex) &&
    destData.stepIndex === sourceData.stepIndex;

  if (isToffoliSwap) {
    const _tOld  = next[sourceData.wireIndex]?.[sourceData.stepIndex];
    const _tSwap = next[destData.wireIndex]?.[sourceData.stepIndex];

    const oldWire = sourceData.wireIndex;
    const swapWire = destData.wireIndex;
    const step = sourceData.stepIndex;
    const oldRole = _tOld.role;
    const swapRole = _tSwap.role;
    if (oldRole === swapRole) return prevCircuit;

    const controls = [...sourceData.controls];
    let newControls = controls;
    if (oldRole === 'control') newControls = [swapWire, controls.find(c => c !== oldWire)];
    else newControls = [oldWire, controls.find(c => c !== swapWire)];
    const newTarget = oldRole === 'control' ? oldWire : swapWire;

    // Immutable updates to preserve blank structure
    next[oldWire][step]       = { ...next[oldWire][step],       role: swapRole, controls: newControls, targetWire: newTarget };
    next[swapWire][step]      = { ...next[swapWire][step],      role: oldRole,  controls: newControls, targetWire: newTarget };
    next[newControls[0]][step] = { ...next[newControls[0]][step], controls: newControls, targetWire: newTarget };
    next[newControls[1]][step] = { ...next[newControls[1]][step], controls: newControls, targetWire: newTarget };
    next[newTarget][step]     = { ...next[newTarget][step],     controls: newControls, targetWire: newTarget };
    return next;
  }

  if (isCnotSwap) {
    const _cOld  = next[sourceData.wireIndex]?.[sourceData.stepIndex];
    const _cPeer = next[sourceData.peerWire]?.[sourceData.stepIndex];

    const oldWire = sourceData.wireIndex;
    const peerWire = sourceData.peerWire;
    const step = sourceData.stepIndex;

    if (_cOld?.blank && _cPeer?.blank) {
      // Swap roles within blank structure (immutable, preserves blank:true etc.)
      const { controlWire: _oCW, targetWire: _oTW, ...oldBase } = _cOld;
      const { controlWire: _pCW, targetWire: _pTW, ...peerBase } = _cPeer;
      const newOldRole = _cPeer.role;
      const newPeerRole = _cOld.role;
      next[oldWire][step] = {
        ...oldBase,
        role: newOldRole,
        ...(newOldRole === 'control' ? { targetWire: peerWire } : { controlWire: peerWire }),
      };
      next[peerWire][step] = {
        ...peerBase,
        role: newPeerRole,
        ...(newPeerRole === 'control' ? { targetWire: oldWire } : { controlWire: oldWire }),
      };
      return next;
    }

    next[oldWire][step] = {
      name: sourceData.name,
      role: sourceData.role === 'control' ? 'target' : 'control',
      [sourceData.role === 'control' ? 'controlWire' : 'targetWire']: peerWire,
    };
    next[peerWire][step] = {
      name: sourceData.name,
      role: sourceData.role,
      [sourceData.role === 'control' ? 'targetWire' : 'controlWire']: oldWire,
    };
    return next;
  }

  // 3. Handle Gate Insertion (shifting gates right)
  const isInsert = destData.type === 'gate-insert' || (destData.type === 'cnot-node-drop' && !isCnotSwap);

  if (isInsert) {
    const insertStep = destData.stepIndex;
    const targetWire = destData.wireIndex;

    // Prevent inserting into or before hidden blocks
    if (hiddenBlocks && hiddenBlocks.some(block => insertStep <= block.endStep)) {
      return prevCircuit;
    }

    if (sourceData.type === 'placed-gate') {
      next[sourceData.wireIndex][sourceData.stepIndex] = null;
    } else if (sourceData.type === 'cnot-node') {
      next[sourceData.wireIndex][sourceData.stepIndex] = null;
      next[sourceData.peerWire][sourceData.stepIndex] = null;
    } else if (sourceData.type === 'toffoli-node') {
      next[sourceData.controls[0]][sourceData.stepIndex] = null;
      next[sourceData.controls[1]][sourceData.stepIndex] = null;
      next[sourceData.targetWire][sourceData.stepIndex] = null;
    }

    next.forEach(wire => wire.splice(insertStep, 0, null));

    if (sourceData.type === 'gate') {
      const gateName = sourceData.name;
      if (TWO_WIRE.includes(gateName)) {
        const tIdx = targetWire < next.length - 1 ? targetWire + 1 : targetWire - 1;
        if (tIdx >= 0 && tIdx < next.length) {
          const ctrlW = Math.min(targetWire, tIdx);
          const tgtW  = Math.max(targetWire, tIdx);
          next[ctrlW][insertStep] = { name: gateName, role: 'control', targetWire: tgtW };
          next[tgtW][insertStep]  = { name: gateName, role: 'target',  controlWire: ctrlW };
        }
      } else if (gateName === 'TOFFOLI') {
        const c1 = targetWire;
        if (next.length >= 3) {
          const c2 = c1 + 1 < next.length ? c1 + 1 : c1 - 1;
          const tIdx = [c1 + 2, c1 - 1, c1 - 2].find(w => w >= 0 && w < next.length && w !== c2) ?? [...Array(next.length).keys()].find(w => w !== c1 && w !== c2);
          next[c1][insertStep] = { name: gateName, role: 'control', controls: [c1, c2], targetWire: tIdx };
          next[c2][insertStep] = { name: gateName, role: 'control', controls: [c1, c2], targetWire: tIdx };
          next[tIdx][insertStep] = { name: gateName, role: 'target', controls: [c1, c2], targetWire: tIdx };
        }
      } else if (gateName === 'BLANK') {
        next[targetWire][insertStep] = { blank: true };
      } else {
        next[targetWire][insertStep] = { name: gateName };
      }
    } else if (sourceData.type === 'placed-gate') {
      next[targetWire][insertStep] = sourceData.name === 'BLANK' ? { blank: true } : { name: sourceData.name };
    } else if (sourceData.type === 'cnot-node') {
      next[targetWire][insertStep] = {
        name: sourceData.name, role: sourceData.role,
        [sourceData.role === 'control' ? 'targetWire' : 'controlWire']: sourceData.peerWire
      };
      next[sourceData.peerWire][insertStep] = {
        name: sourceData.name, role: sourceData.role === 'control' ? 'target' : 'control',
        [sourceData.role === 'control' ? 'controlWire' : 'targetWire']: targetWire
      };
    } else if (sourceData.type === 'toffoli-node') {
      next[sourceData.controls[0]][insertStep] = { name: sourceData.name, role: 'control', controls: sourceData.controls, targetWire: sourceData.targetWire };
      next[sourceData.controls[1]][insertStep] = { name: sourceData.name, role: 'control', controls: sourceData.controls, targetWire: sourceData.targetWire };
      next[sourceData.targetWire][insertStep] = { name: sourceData.name, role: 'target', controls: sourceData.controls, targetWire: sourceData.targetWire };
   }
    return next;
  }

  // 4. Handle dropping onto an empty slot
  if (destData.type === 'slot') {
    if (sourceData.type === 'gate') {
      const gateName = sourceData.name;
      if (TWO_WIRE.includes(gateName)) {
        const tIdx = wIdx < next.length - 1 ? wIdx + 1 : wIdx - 1;
        if (tIdx >= 0 && tIdx < next.length && !isOccupied(wIdx, sIdx) && !isOccupied(tIdx, sIdx)) {
          const ctrlW = Math.min(wIdx, tIdx);
          const tgtW  = Math.max(wIdx, tIdx);
          next[ctrlW][sIdx] = { name: gateName, role: 'control', targetWire: tgtW };
          next[tgtW][sIdx]  = { name: gateName, role: 'target',  controlWire: ctrlW };
          return next;
        }
      } else if (gateName === 'TOFFOLI') {
        if (next.length >= 3) {
          const c2 = wIdx + 1 < next.length ? wIdx + 1 : wIdx - 1;
          const tIdx = [wIdx + 2, wIdx - 1, wIdx - 2].find(w => w >= 0 && w < next.length && w !== c2) ?? [...Array(next.length).keys()].find(w => w !== wIdx && w !== c2);
          if (!isOccupied(wIdx, sIdx) && !isOccupied(c2, sIdx) && !isOccupied(tIdx, sIdx)) {
            next[wIdx][sIdx] = { name: gateName, role: 'control', controls: [wIdx, c2], targetWire: tIdx };
            next[c2][sIdx] = { name: gateName, role: 'control', controls: [wIdx, c2], targetWire: tIdx };
            next[tIdx][sIdx] = { name: gateName, role: 'target', controls: [wIdx, c2], targetWire: tIdx };
            return next;
          }
        }
      } else if (gateName === 'BLANK') {
        if (!isOccupied(wIdx, sIdx)) {
          next[wIdx][sIdx] = { blank: true };
          return next;
        }
      } else {
        if (!isOccupied(wIdx, sIdx)) {
          next[wIdx][sIdx] = { name: gateName };
          return next;
        }
      }
      return prevCircuit;
    }

    if (sourceData.type === 'placed-gate') {
      if (!isOccupied(wIdx, sIdx)) {
        next[sourceData.wireIndex][sourceData.stepIndex] = null;
        next[wIdx][sIdx] = sourceData.name === 'BLANK' ? { blank: true } : { name: sourceData.name };
        return next;
      }
      return prevCircuit;
    }

    if (sourceData.type === 'cnot-node') {
      const { wireIndex: oldW, stepIndex: oldS, name, role, peerWire } = sourceData;
      if (sIdx === oldS && !isOccupied(wIdx, sIdx) && wIdx !== peerWire) {
        next[oldW][oldS] = null;
        next[wIdx][sIdx] = { name, role, [role === 'control' ? 'targetWire' : 'controlWire']: peerWire };
        next[peerWire][sIdx][role === 'control' ? 'controlWire' : 'targetWire'] = wIdx;
        return next;
      }
      return prevCircuit;
    }

    if (sourceData.type === 'toffoli-node') {
      const { wireIndex: oldW, stepIndex: oldS, name, role, controls, targetWire } = sourceData;
      if (sIdx === oldS && !isOccupied(wIdx, sIdx)) {
        if (role === 'control' && wIdx !== targetWire && wIdx !== controls.find(c => c !== oldW)) {
          next[oldW][oldS] = null;
          const otherC = controls.find(c => c !== oldW);
          const newControls = [wIdx, otherC];
          next[wIdx][sIdx] = { name, role, controls: newControls, targetWire };
          next[otherC][sIdx].controls = newControls;
          next[targetWire][sIdx].controls = newControls;
          return next;
        } else if (role === 'target' && !controls.includes(wIdx)) {
          next[oldW][oldS] = null;
          next[wIdx][sIdx] = { name, role, controls, targetWire: wIdx };
          next[controls[0]][sIdx].targetWire = wIdx;
          next[controls[1]][sIdx].targetWire = wIdx;
          return next;
        }
      }
      return prevCircuit;
    }
  }

  return prevCircuit;
}

/**
 * Safely removes a gate from a circuit grid, handling multi-qubit bounds and blanks.
 */
export function removeGateFromCircuit(circuit, wireIndex, stepIndex) {
  const next = circuit.map(w => [...w]);
  const cell = next[wireIndex]?.[stepIndex];
  if (!cell || cell.locked) return next;

  if (cell.blank) {
    if (cell.filled) {
      next[wireIndex][stepIndex] = { blank: true };
    }
    return next;
  }

  if (TWO_WIRE.includes(cell.name)) {
    const peerWire = cell.role === 'control' ? cell.targetWire : cell.controlWire;
    next[wireIndex][stepIndex] = null;
    if (next[peerWire]) next[peerWire][stepIndex] = null;
  } else if (cell.name === 'TOFFOLI') {
    next[cell.controls[0]][stepIndex] = null;
    next[cell.controls[1]][stepIndex] = null;
    next[cell.targetWire][stepIndex] = null;
  } else if (cell.name === 'BARRIER') {
    for (let w = cell.topWire; w <= cell.bottomWire; w++) {
      if (next[w]) next[w][stepIndex] = null;
    }
  } else {
    next[wireIndex][stepIndex] = null;
  }

  return next;
}