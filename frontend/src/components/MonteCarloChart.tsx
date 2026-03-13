/**
 * MonteCarloChart — Fan Chart, light mode redesign
 */

import { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface MonteCarloChartProps { paths: number[][]; initialCapital: number; }
interface ChartDataPoint { day: number; p5: number; p25: number; mean: number; p75: number; p95: number; initial: number; }

export default function MonteCarloChart({ paths, initialCapital }: MonteCarloChartProps) {
  const nDays = paths.length > 0 ? paths[0].length - 1 : 7;

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (paths.length === 0) return [];
    return Array.from({ length: nDays + 1 }, (_, dayIndex) => {
      const valuesAtDay = paths.map(path => path[dayIndex]);
      const sorted = [...valuesAtDay].sort((a, b) => a - b);
      const n = sorted.length;
      return {
        day: dayIndex,
        p5: sorted[Math.floor(n * 0.05)],
        p25: sorted[Math.floor(n * 0.25)],
        mean: valuesAtDay.reduce((a, b) => a + b, 0) / n,
        p75: sorted[Math.floor(n * 0.75)],
        p95: sorted[Math.floor(n * 0.95)],
        initial: initialCapital,
      };
    });
  }, [paths, nDays, initialCapital]);

  const stats = useMemo(() => {
    if (paths.length === 0) return null;
    const finalValues = paths.map(p => p[p.length - 1]);
    const returns = finalValues.map(v => (v - initialCapital) / initialCapital);
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const n = sortedReturns.length;
    const meanReturn = returns.reduce((a, b) => a + b, 0) / n;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / n);
    const p5 = sortedReturns[Math.floor(n * 0.05)];
    const var95 = p5;
    const cvar95 = sortedReturns.slice(0, Math.floor(n * 0.05)).reduce((a, b) => a + b, 0) / Math.floor(n * 0.05);
    const probProfit = returns.filter(r => r > 0).length / n;
    const scenariosProfitable = returns.filter(r => r > 0).length;
    const minReturn = Math.min(...returns);
    const maxReturn = Math.max(...returns);
    const allValues = paths.flat();
    const yMin = Math.min(...allValues);
    const yMax = Math.max(...allValues);
    const yRange = yMax - yMin;
    const binCount = 20;
    const binSize = (maxReturn - minReturn) / binCount || 0.001;
    const histogram = new Array(binCount).fill(0);
    returns.forEach(r => { const binIndex = Math.min(Math.floor((r - minReturn) / binSize), binCount - 1); histogram[binIndex]++; });
    const histogramData = histogram.map((count, i) => ({
      bin: (((minReturn + (i + 0.5) * binSize) * 100).toFixed(1)),
      count,
      isPositive: (minReturn + (i + 0.5) * binSize) > 0,
    }));
    return { meanReturn, stdReturn, p5, var95, cvar95, probProfit, scenariosProfitable, minReturn, maxReturn, histogramData, meanFinal: finalValues.reduce((a, b) => a + b, 0) / n, minFinal: Math.min(...finalValues), maxFinal: Math.max(...finalValues), yMin, yMax, yRange };
  }, [paths, initialCapital]);

  const formatCurrency = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 10000) return `$${(v / 1000).toFixed(0)}k`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  const formatYAxis = (v: number) => {
    if (!stats) return `$${v.toFixed(0)}`;
    if (stats.yRange < 200) return `$${v.toFixed(0)}`;
    if (stats.yRange < 2000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return formatCurrency(v);
  };

  const getYDomain = () => {
    if (!stats) return [0, 10000];
    const padding = Math.max(stats.yRange * 0.15, 50);
    return [stats.yMin - padding, stats.yMax + padding];
  };

  const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

  if (!stats || paths.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: '300px' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Awaiting Path Generation</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header + Key Metrics */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Monte Carlo Simulation</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>100 scenarios · 7-Day · Synth AI data</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Expected', value: formatPercent(stats.meanReturn), accent: stats.meanReturn >= 0 },
            { label: 'Prob. Profit', value: `${(stats.probProfit * 100).toFixed(0)}%`, accent: stats.probProfit >= 0.5 },
            { label: 'Worst Case', value: formatPercent(stats.minReturn), accent: false },
            { label: 'Best Case', value: formatPercent(stats.maxReturn), accent: true },
          ].map(m => (
            <div key={m.label} className="px-3 py-2 rounded-2xl text-center" style={{ backgroundColor: 'rgba(17,17,17,0.05)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              <div className="text-sm font-bold" style={{ color: m.accent ? 'var(--text-main)' : 'var(--accent-red)', letterSpacing: '-0.02em' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fan Chart */}
      <div style={{ height: '260px', marginBottom: '24px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="mcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#111111" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#111111" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Initial Capital Line */}
            <Line type="monotone" dataKey="initial" stroke="rgba(17,17,17,0.3)" strokeWidth={1} strokeDasharray="5 5" dot={false} />

            {/* Confidence band */}
            <Area type="monotone" dataKey="p95" stroke="none" fill="url(#mcGrad)" fillOpacity={1} />
            <Area type="monotone" dataKey="p5" stroke="none" fill="var(--bg-card)" fillOpacity={1} />

            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} tickFormatter={v => `D${v}`} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} tickFormatter={formatYAxis} domain={getYDomain()} width={70} />

            {/* Mean Line */}
            <Line type="monotone" dataKey="mean" stroke="#111111" strokeWidth={2.5} dot={false} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload as ChartDataPoint;
                return (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(17,17,17,0.1)', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(17,17,17,0.08)' }}>
                    <p className="text-xs font-bold mb-2 pb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(17,17,17,0.06)' }}>Day {label}</p>
                    <div className="space-y-1.5">
                      {[
                        { label: 'P95 Best', value: data.p95, color: 'var(--text-main)' },
                        { label: 'Expected', value: data.mean, color: 'var(--text-main)', bold: true },
                        { label: 'P5 Worst', value: data.p5, color: 'var(--accent-red)' },
                        { label: 'Initial', value: data.initial, color: 'var(--text-muted)' },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between gap-8 text-xs">
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{r.label}</span>
                          <span style={{ color: r.color, fontWeight: r.bold ? 700 : 600 }}>${r.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario Analysis */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Prob. of Profit', value: `${(stats.probProfit * 100).toFixed(1)}%`, sub: `${stats.scenariosProfitable}/100 profitable`, progress: stats.probProfit, color: 'var(--text-main)' },
          { label: 'VaR (95%)', value: formatCurrency(Math.abs(stats.var95 * initialCapital)), sub: formatPercent(stats.var95), color: 'var(--accent-red)' },
          { label: 'CVaR (95%)', value: formatCurrency(Math.abs(stats.cvar95 * initialCapital)), sub: formatPercent(stats.cvar95), color: 'var(--accent-red)' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ backgroundColor: 'rgba(17,17,17,0.04)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-lg font-bold" style={{ color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
            {'progress' in s && s.progress !== undefined && (
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(17,17,17,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${s.progress * 100}%`, backgroundColor: 'var(--text-main)' }} />
              </div>
            )}
            <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Return Distribution */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: 'rgba(17,17,17,0.04)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Return Distribution</p>
        <div style={{ height: '80px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.histogramData}>
              <XAxis dataKey="bin" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${v}%`} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="rgba(17,17,17,0.5)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
          <span>◄ Loss</span>
          <span>Mean: {formatPercent(stats.meanReturn)}</span>
          <span>Gain ►</span>
        </div>
      </div>
    </div>
  );
}
