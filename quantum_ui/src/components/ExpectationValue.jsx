/**
 * Displays the arbitrary basis expectation value ⟨{operator}⟩ for a selected qubit.
 * ⟨{operator}⟩ = +1 means |0⟩, -1 means |1⟩, 0 means equal superposition.
 */
const ExpectationValue = ({ operator = 'Z', qubitIndex, value, measureStep, labels = ['1', '0'] }) => {
  const [negLabel, posLabel] = labels;
  if (value === null || qubitIndex === null) return null;

  const stepLabel = measureStep !== null ? `step ${measureStep}` : 'final';

  const valueColor =
    value > 0.01 ? 'text-sky-300' : value < -0.01 ? 'text-rose-300' : 'text-slate-400';

  const barWidth = `${((value + 1) / 2) * 100}%`;
  const barColor = value > 0.01 ? 'bg-sky-500' : value < -0.01 ? 'bg-rose-500' : 'bg-slate-500';

  return (
    <>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
        &#x27E8;{operator}&#x27E9; Expectation
      </p>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-mono text-xs text-slate-400">
          q[{qubitIndex}]
          <span className="text-slate-500 ml-1">@ {stepLabel}</span>
        </span>
        <span className={`font-mono font-semibold text-sm tabular-nums ${valueColor}`}>
          {value.toFixed(4)}
        </span>
      </div>
      {/* Visual bar: left = −1, right = +1 */}
      <div className="h-1 w-full bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: barWidth }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-600">&#x2212;1 |{negLabel}&#x27E9;</span>
        <span className="text-[9px] text-slate-600">+1 |{posLabel}&#x27E9;</span>
      </div>
    </>
  );
};

export default ExpectationValue;
