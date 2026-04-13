import DraggableCnotNode from './DraggableCnotNode';
import DraggablePlacedGate from './DraggablePlacedGate';
import DraggableBarrier from './DraggableBarrier';
import DropZone from './DropZone';
import { TWO_WIRE } from '../utils/circuitDnD';

export default function CircuitCell({
  cell,
  wireIndex,
  stepIndex,
  onDelete,
  onRightClickDelete = (e) => { e.preventDefault(); },
  customRenderer,
  
  // Barrier specific (mostly App.jsx)
  hoveredBarrier,
  onHoverBarrier = () => {},
  onResizeBarrier = () => {}
}) {
  if (!cell) {
    if (customRenderer) {
      const custom = customRenderer(cell, wireIndex, stepIndex);
      if (custom !== undefined) return custom;
    }
    return <DropZone wireIndex={wireIndex} stepIndex={stepIndex} />;
  }

  if (customRenderer) {
    const custom = customRenderer(cell, wireIndex, stepIndex);
    if (custom !== undefined) return custom;
  }

  if (cell.name === 'BARRIER') {
    return (
      <div
        className="w-full h-full relative flex items-center justify-center z-20 overflow-visible"
        onContextMenu={(e) => onRightClickDelete(e, wireIndex, stepIndex)}
      >
        <DraggableBarrier
          cell={cell}
          wireIndex={wireIndex}
          stepIndex={stepIndex}
          isHovered={hoveredBarrier === `${stepIndex}-${cell.topWire}-${cell.bottomWire}`}
          onHoverChange={(on) => onHoverBarrier(on ? `${stepIndex}-${cell.topWire}-${cell.bottomWire}` : null)}
          onDelete={() => onDelete(wireIndex, stepIndex)}
          onResize={(action) => onResizeBarrier(wireIndex, stepIndex, action)}
        />
      </div>
    );
  }

  const isMultiWire = TWO_WIRE.includes(cell.name) || cell.name === 'TOFFOLI' || cell.name === 'BLANK_2' || cell.name === 'BLANK_3';
  if (isMultiWire) {
    return (
      <div
        className="w-full h-full relative flex items-center justify-center z-20 group/cnot"
        onContextMenu={(e) => onRightClickDelete(e, wireIndex, stepIndex)}
      >
        <DraggableCnotNode cell={cell} wireIndex={wireIndex} stepIndex={stepIndex} />

        {cell.name === 'TOFFOLI' || cell.name === 'BLANK_3' ? (
          wireIndex === Math.min(...cell.controls, cell.targetWire) && (
            <>
              <div className="absolute w-px bg-slate-400 z-0 pointer-events-none" style={{ left: 'calc(50% - 1px)', top: '50%', height: `${(Math.max(...cell.controls, cell.targetWire) - wireIndex) * 5}rem` }} />
              <button onClick={(e) => { e.stopPropagation(); onDelete(wireIndex, stepIndex); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-700 text-slate-300 hover:bg-red-500 hover:text-white text-[10px] flex items-center justify-center z-40 opacity-0 group-hover/cnot:opacity-100 transition-opacity leading-none" title="Delete gate">×</button>
            </>
          )
        ) : (
          cell.role === 'control' && (
            <>
              {(cell.name === 'CNOT' || cell.name === 'CZ' || cell.name === 'BLANK_2') ? (
                <div className="absolute w-px bg-slate-400 z-0 pointer-events-none" style={{ left: 'calc(50% - 1px)', top: cell.targetWire > wireIndex ? '50%' : 'auto', bottom: cell.targetWire < wireIndex ? '50%' : 'auto', height: `${Math.abs(cell.targetWire - wireIndex) * 5}rem` }} />
              ) : (
                <div className="absolute z-0 pointer-events-none" style={{ left: 'calc(50% - 3px)', top: cell.targetWire > wireIndex ? '50%' : 'auto', bottom: cell.targetWire < wireIndex ? '50%' : 'auto', height: `${Math.abs(cell.targetWire - wireIndex) * 5}rem`, width: '6px', borderLeft:  '1.5px solid rgba(251,191,36,0.6)', borderRight: '1.5px solid rgba(251,191,36,0.6)' }} />
              )}
              <button onClick={(e) => { e.stopPropagation(); onDelete(wireIndex, stepIndex); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-700 text-slate-300 hover:bg-red-500 hover:text-white text-[10px] flex items-center justify-center z-40 opacity-0 group-hover/cnot:opacity-100 transition-opacity leading-none" title="Delete gate">×</button>
            </>
          )
        )}
      </div>
    );
  }

  return (
    <DraggablePlacedGate
      cell={cell} wireIndex={wireIndex} stepIndex={stepIndex}
      handleRightClickDelete={onRightClickDelete}
      onDelete={() => onDelete(wireIndex, stepIndex)}
    />
  );
}