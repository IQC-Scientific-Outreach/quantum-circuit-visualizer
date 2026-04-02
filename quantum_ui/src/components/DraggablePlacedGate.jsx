import { useRef, useEffect, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import GateVisual from './GateVisual';
import { GATE_STYLES } from '../constants';

/**
 * A non-CNOT gate that has already been placed on the circuit board.
 * - Draggable: move it to another slot.
 * - Drop target: triggers an "insert before" visual when another gate is dragged over it.
 * - Right-click: deletes the gate.
 */
const DraggablePlacedGate = ({ cell, wireIndex, stepIndex, handleRightClickDelete }) => {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isInsertHovered, setIsInsertHovered] = useState(false);

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

  const baseClasses = `w-full h-full border text-lg rounded flex items-center justify-center font-bold shadow-sm backdrop-blur-sm cursor-grab transition-all z-20 
    ${isDragging ? 'opacity-50' : 'hover:brightness-125'} 
    ${isInsertHovered ? 'border-l-4 border-l-blue-400 scale-105 shadow-blue-500/50' : ''} 
    ${GATE_STYLES[cell.name]}`;

  return (
    <div
      ref={ref}
      className={baseClasses}
      onContextMenu={(e) => handleRightClickDelete(e, wireIndex, stepIndex)}
      title="Drag to move, Right-click to delete"
    >
      <GateVisual name={cell.name} />
    </div>
  );
};

export default DraggablePlacedGate;