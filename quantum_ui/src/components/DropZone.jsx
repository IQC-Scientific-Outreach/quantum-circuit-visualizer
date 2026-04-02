import { useRef, useEffect, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

/**
 * An empty slot on the circuit board.
 * Highlights on drag-over to show the user where a gate will land.
 */
const DropZone = ({ wireIndex, stepIndex }) => {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ type: 'slot', wireIndex, stepIndex }),
      onDragEnter: () => setIsHovered(true),
      onDragLeave: () => setIsHovered(false),
      onDrop: () => setIsHovered(false),
    });
  }, [wireIndex, stepIndex]);

  return (
    <div
      ref={ref}
      className={`w-full h-full border-2 rounded transition-colors ${
        isHovered
          ? 'border-blue-500 bg-blue-500/20'
          : 'border-transparent hover:border-slate-700 border-dashed'
      }`}
    />
  );
};

export default DropZone;