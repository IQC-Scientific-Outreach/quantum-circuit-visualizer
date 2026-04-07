import { useRef, useEffect, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

/**
 * An empty blank slot in a question circuit.
 * Accepts gate drops from the palette and highlights on hover.
 */
const QuestionBlankSlot = ({ wireIndex, stepIndex }) => {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ type: 'question-blank', wireIndex, stepIndex }),
      onDragEnter: () => setIsHovered(true),
      onDragLeave: () => setIsHovered(false),
      onDrop: () => setIsHovered(false),
    });
  }, [wireIndex, stepIndex]);

  return (
    <div
      ref={ref}
      className={`w-full h-full border-2 border-dashed rounded transition-colors flex items-center justify-center ${
        isHovered
          ? 'border-blue-400 bg-blue-500/20'
          : 'border-slate-500 bg-slate-800/30 hover:border-slate-400'
      }`}
      title="Drop a gate here"
    >
      <span className={`text-xs font-mono select-none transition-colors ${isHovered ? 'text-blue-400' : 'text-slate-600'}`}>
        ?
      </span>
    </div>
  );
};

export default QuestionBlankSlot;
