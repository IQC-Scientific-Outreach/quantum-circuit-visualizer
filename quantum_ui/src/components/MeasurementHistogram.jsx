import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MeasurementHistogram = ({ data, shots }) => {
  if (!data || data.length === 0) return null;

  return (
    <>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
        Histogram
        <span className="text-slate-500 normal-case font-normal ml-1.5">({shots} shots)</span>
      </p>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <XAxis
              dataKey="state"
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                color: '#f1f5f9',
                fontSize: 11,
                borderRadius: 6,
              }}
            />
            <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

export default MeasurementHistogram;
