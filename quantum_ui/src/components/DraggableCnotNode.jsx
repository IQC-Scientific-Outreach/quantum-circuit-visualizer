import { useRef, useEffect, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

/**
 * Renders one node of a placed multi-wire gate: CNOT, CZ, FF_x, FF_Z, or TOFFOLI.
 *
 * Quantum (CNOT, CZ, TOFFOLI) — slate color
 *   CNOT / TOFFOLI control: filled circle   target: X
 *   CZ             control: filled circle   target: filled circle
 *
 * Classically-controlled (FF_x, FF_Z) — amber color
 *   FF_x  control: filled square   target: ⊕
 *   FF_Z  control: filled square   target: Z-box
 */
const DraggableCnotNode = ({ cell, wireIndex, stepIndex }) => {
  const ref = useRef(null);
  const [isDragging,       setIsDragging]       = useState(false);
  const [isPartnerHovered, setIsPartnerHovered] = useState(false);
  const [isInsertHovered,  setIsInsertHovered]  = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isToffoliType = cell.name === 'TOFFOLI' || cell.name === 'BLANK_3';
    const cleanupDrag = draggable({
      element: el,
      getInitialData: () => ({
        type: isToffoliType ? 'toffoli-node' : 'cnot-node',
        name: cell.name,
        role: cell.role,
        wireIndex,
        stepIndex,
        peerWire: isToffoliType ? undefined : (cell.role === 'control' ? cell.targetWire : cell.controlWire),
        controls: cell.controls,
        targetWire: cell.targetWire,
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
        } else if (
          source.data.type === 'toffoli-node' &&
          source.data.stepIndex === stepIndex &&
          (source.data.controls.includes(wireIndex) || source.data.targetWire === wireIndex)
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

  const isClassical = cell.name === 'FF_x' || cell.name === 'FF_Z';
  const isBlank = cell.name === 'BLANK_2' || cell.name === 'BLANK_3';

  const baseClasses = `absolute w-full h-full flex items-center justify-center cursor-grab transition-all z-20
    ${isDragging       ? 'opacity-0'                              : 'hover:scale-110'}
    ${isPartnerHovered ? 'bg-blue-500/30 rounded-lg scale-110'   : ''}
    ${isInsertHovered  ? 'border-l-4 border-l-blue-400 scale-105': ''}`;

  return (
    <div ref={ref} className={baseClasses}>

      {isBlank && (
        <div className="w-9 h-9 border-2 border-dashed border-slate-500 bg-slate-800/30 rounded flex items-center justify-center">
          <span className="text-xl font-mono text-slate-600 select-none">?</span>
        </div>
      )}

      {/* ── Control nodes ── */}
      {cell.role === 'control' && !isClassical && !isBlank && (
        // CNOT, CZ, or TOFFOLI: quantum filled circle
        <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />
      )}
      {cell.role === 'control' && isClassical && !isBlank && (
        // FF_x or FF_Z: classical filled square
        <div className="w-3.5 h-3.5 rounded-sm bg-amber-400" />
      )}

      {/* ── Target nodes ── */}
      {/* CNOT/TOFFOLI target: square with X (slate) */}
      {cell.role === 'target' && (cell.name === 'CNOT' || cell.name === 'TOFFOLI') && !isBlank && (
        <div className="w-9 h-9 border-2 border-slate-400/80 bg-slate-800/60 rounded flex items-center justify-center">
          <span className="text-slate-200 text-base font-bold leading-none select-none">X</span>
        </div>
      )}
      {/* CZ target: Z-box (slate) */}
      {cell.role === 'target' && cell.name === 'CZ' && (
        <div className="w-9 h-9 border border-slate-400/70 bg-slate-500/10 rounded flex items-center justify-center">
          <span className="text-slate-300 text-base font-bold leading-none select-none">Z</span>
        </div>
      )}
      {/* FF_x target: square with X (amber) */}
      {cell.role === 'target' && cell.name === 'FF_x' && (
        <div className="w-9 h-9 border-2 border-amber-400/80 bg-amber-900/30 rounded flex items-center justify-center">
          <span className="text-amber-200 text-base font-bold leading-none select-none">X</span>
        </div>
      )}
      {/* FF_Z target: Z-box (amber) — unchanged */}
      {cell.role === 'target' && cell.name === 'FF_Z' && (
        <div className="w-9 h-9 border border-amber-400/70 bg-amber-500/10 rounded flex items-center justify-center">
          <span className="text-amber-300 text-base font-bold leading-none select-none">Z</span>
        </div>
      )}

    </div>
  );
};

export default DraggableCnotNode;
