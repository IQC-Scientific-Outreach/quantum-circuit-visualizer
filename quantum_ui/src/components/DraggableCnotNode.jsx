import { useRef, useEffect, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

/**
 * Renders one node of a placed two-wire gate: CNOT, CZ, CC_X, or CC_Z.
 *
 * Quantum 2q (CNOT, CZ) — slate color
 *   CNOT  control: filled circle   target: ⊕
 *   CZ    control: filled circle   target: filled circle
 *
 * Classically-controlled (CC_X, CC_Z) — amber color
 *   CC_X  control: filled square   target: ⊕
 *   CC_Z  control: filled square   target: Z-box
 */
const DraggableCnotNode = ({ cell, wireIndex, stepIndex }) => {
  const ref = useRef(null);
  const [isDragging,       setIsDragging]       = useState(false);
  const [isPartnerHovered, setIsPartnerHovered] = useState(false);
  const [isInsertHovered,  setIsInsertHovered]  = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanupDrag = draggable({
      element: el,
      getInitialData: () => ({
        type: 'cnot-node',
        name: cell.name,
        role: cell.role,
        wireIndex,
        stepIndex,
        peerWire: cell.role === 'control' ? cell.targetWire : cell.controlWire,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop:      () => setIsDragging(false),
    });

    const cleanupDrop = dropTargetForElements({
      element: el,
      getData: () => ({ type: 'cnot-node-drop', wireIndex, stepIndex }),
      onDragEnter: ({ source }) => {
        if (
          source.data.type === 'cnot-node' &&
          source.data.peerWire === wireIndex &&
          source.data.stepIndex === stepIndex
        ) {
          setIsPartnerHovered(true);
        } else {
          setIsInsertHovered(true);
        }
      },
      onDragLeave: () => { setIsPartnerHovered(false); setIsInsertHovered(false); },
      onDrop:      () => { setIsPartnerHovered(false); setIsInsertHovered(false); },
    });

    return () => { cleanupDrag(); cleanupDrop(); };
  }, [cell, wireIndex, stepIndex]);

  const isClassical = cell.name === 'CC_X' || cell.name === 'CC_Z';

  const baseClasses = `absolute w-full h-full flex items-center justify-center cursor-grab transition-all z-20
    ${isDragging       ? 'opacity-0'                              : 'hover:scale-110'}
    ${isPartnerHovered ? 'bg-blue-500/30 rounded-lg scale-110'   : ''}
    ${isInsertHovered  ? 'border-l-4 border-l-blue-400 scale-105': ''}`;

  return (
    <div ref={ref} className={baseClasses}>

      {/* ── Control nodes ── */}
      {cell.role === 'control' && !isClassical && (
        // CNOT or CZ: quantum filled circle
        <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />
      )}
      {cell.role === 'control' && isClassical && (
        // CC_X or CC_Z: classical filled square
        <div className="w-3.5 h-3.5 rounded-sm bg-amber-400" />
      )}

      {/* ── Target nodes ── */}
      {cell.role === 'target' && cell.name === 'CNOT' && (
        <svg className="w-8 h-8 text-slate-300 bg-slate-900 rounded-full"
             viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
          <path d="M12 2v20M2 12h20" strokeWidth="1.5" />
        </svg>
      )}
      {cell.role === 'target' && cell.name === 'CZ' && (
        // CZ: target is also a filled dot (symmetric)
        <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />
      )}
      {cell.role === 'target' && cell.name === 'CC_X' && (
        <svg className="w-8 h-8 text-amber-300 bg-slate-900 rounded-full"
             viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
          <path d="M12 2v20M2 12h20" strokeWidth="1.5" />
        </svg>
      )}
      {cell.role === 'target' && cell.name === 'CC_Z' && (
        <div className="w-9 h-9 border border-amber-400/70 bg-amber-500/10 rounded flex items-center justify-center">
          <span className="text-amber-300 text-base font-bold leading-none">Z</span>
        </div>
      )}

    </div>
  );
};

export default DraggableCnotNode;
