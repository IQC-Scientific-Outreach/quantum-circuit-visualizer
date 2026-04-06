import { useRef, useEffect, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import GateVisual from './GateVisual';
import { GATE_STYLES } from '../constants';

/**
 * A non-CNOT gate placed on the circuit board.
 * - Draggable: move it to another slot.
 * - Drop target: triggers an "insert before" visual when another gate is dragged over it.
 * - Hover: shows a × delete button in the top-right corner.
 * - Right-click: also deletes (kept as fallback).
 */
const DraggablePlacedGate = ({ cell, wireIndex, stepIndex, handleRightClickDelete, onDelete }) => {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isInsertHovered, setIsInsertHovered] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanupDrag = draggable({
      element: el,
      getInitialData: () => ({ type: 'placed-gate', name: cell.name, wireIndex, stepIndex }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });

    const cleanupDrop = dropTargetForElements({
      element: el,
      getData: () => ({ type: 'gate-insert', wireIndex, stepIndex }),
      onDragEnter: () => setIsInsertHovered(true),
      onDragLeave: () => setIsInsertHovered(false),
      onDrop: () => setIsInsertHovered(false),
    });

    return () => {
      cleanupDrag();
      cleanupDrop();
    };
  }, [cell, wireIndex, stepIndex]);

  const gateClasses = `w-full h-full border text-lg rounded flex items-center justify-center font-bold shadow-sm backdrop-blur-sm cursor-grab transition-all z-20
    ${isDragging ? 'opacity-50' : 'hover:brightness-125'}
    ${isInsertHovered ? 'border-l-4 border-l-blue-400 scale-105 shadow-blue-500/50' : ''}
    ${GATE_STYLES[cell.name]}`;

  return (
    // Wrapper: handles hover detection. Not the draggable element itself, so the
    // delete button sitting outside `ref` doesn't interfere with drag events.
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={ref}
        className={gateClasses}
        onContextMenu={(e) => handleRightClickDelete(e, wireIndex, stepIndex)}
        title="Drag to move"
      >
        <GateVisual name={cell.name} />
      </div>

      {isHovered && !isDragging && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-600 text-slate-200 hover:bg-red-500 hover:text-white text-[10px] flex items-center justify-center z-30 leading-none transition-colors"
          title="Delete gate"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default DraggablePlacedGate;
