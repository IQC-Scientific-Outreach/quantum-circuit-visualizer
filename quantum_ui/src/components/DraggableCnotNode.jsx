import { useRef, useEffect, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

/**
 * Renders either the control dot or the target ⊕ symbol for a placed CNOT gate.
 * It is both draggable (to move/swap the node) and a drop target (for swapping
 * control↔target or inserting another gate at this position).
 */
const DraggableCnotNode = ({ cell, wireIndex, stepIndex }) => {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPartnerHovered, setIsPartnerHovered] = useState(false);
  const [isInsertHovered, setIsInsertHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanupDrag = draggable({
      element: el,
      getInitialData: () => ({
        type: 'cnot-node',
        role: cell.role,
        wireIndex,
        stepIndex,
        peerWire: cell.role === 'control' ? cell.targetWire : cell.controlWire,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
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
      onDragLeave: () => {
        setIsPartnerHovered(false);
        setIsInsertHovered(false);
      },
      onDrop: () => {
        setIsPartnerHovered(false);
        setIsInsertHovered(false);
      },
    });

    return () => {
      cleanupDrag();
      cleanupDrop();
    };
  }, [cell, wireIndex, stepIndex]);

  const baseClasses = `absolute w-full h-full flex items-center justify-center cursor-grab transition-all z-20 
    ${isDragging ? 'opacity-0' : 'hover:scale-110'} 
    ${isPartnerHovered ? 'bg-blue-500/30 rounded-lg scale-110' : ''} 
    ${isInsertHovered ? 'border-l-4 border-l-blue-400 shadow-blue-500/50 scale-105' : ''}`;

  return (
    <div ref={ref} className={baseClasses}>
      {cell.role === 'control' && (
        <div className="w-4 h-4 rounded-full bg-rose-400" />
      )}
      {cell.role === 'target' && (
        <svg
          className="w-8 h-8 text-rose-400 bg-slate-950 rounded-full"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M12 2v20M2 12h20" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
};

export default DraggableCnotNode;