/**
 * AllocationChart — Liquidity Distribution with Before/After Comparison
 * Light mode redesign matching reference design.
 */

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface AllocationData {
  symbol: string;
  weight: number;
  currentWeight?: number;
  value: number;
}

interface AllocationChartProps {
  allocations: AllocationData[];
  totalCapital: number;
  title?: string;
  formatCurrency?: (v: number) => string;
}

// Warm, earthy palette matching the reference aesthetic
const COLORS = ['#111111', '#8A887D', '#C4B9A0', '#A09080', '#6B6058', '#D4C8B8', '#5A544C'];

const ASSET_SECTOR: Record<string, string> = {
  'NVDAX': 'Technology', 'AAPLX': 'Technology', 'GOOGLX': 'Technology',
  'TSLAX': 'Consumer', 'SPYX': 'Broad Market', 'NVDA': 'Technology',
  'AAPL': 'Technology', 'GOOGL': 'Technology', 'TSLA': 'Consumer',
  'META': 'Technology', 'NFLX': 'Communications', 'AMZN': 'Consumer', 'MSFT': 'Technology',
};

const CustomTooltip = ({ active, payload, formatCurrency }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; rawValue: number } }>;
  formatCurrency?: (v: number) => string;
}) => {
  const fmtVal = formatCurrency ?? ((v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(17,17,17,0.1)', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(17,17,17,0.08)' }}>
        <p className="text-xs font-bold mb-2 pb-1" style={{ color: 'var(--text-main)', borderBottom: '1px solid rgba(17,17,17,0.06)', letterSpacing: '-0.01em' }}>{data.name}</p>
        <div className="space-y-1">
          <p className="text-xs flex justify-between gap-6 font-medium" style={{ color: 'var(--text-muted)' }}>
            Weight <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{data.value.toFixed(2)}%</span>
          </p>
          <p className="text-xs flex justify-between gap-6 font-medium" style={{ color: 'var(--text-muted)' }}>
            Value <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{fmtVal(data.rawValue)}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function AllocationChart({ allocations, formatCurrency: fmtCurrency }: AllocationChartProps) {
  const formatCurrency = fmtCurrency ?? ((v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  });

  const hasCurrentWeights = allocations.some(a => a.currentWeight !== undefined && a.currentWeight !== null && a.currentWeight > 0);
  const optimalData = allocations.map(a => ({ name: a.symbol, value: a.weight * 100, rawValue: a.value }));
  const dominantOptimal = optimalData.length > 0 ? optimalData.reduce((max, item) => item.value > max.value ? item : max, optimalData[0]) : null;

  const sectorBreakdown = useMemo(() => {
    const sectors: Record<string, { assets: string[], targetWeight: number }> = {};
    allocations.forEach(a => {
      const sector = ASSET_SECTOR[a.symbol] || 'Other';
      if (!sectors[sector]) sectors[sector] = { assets: [], targetWeight: 0 };
      sectors[sector].assets.push(a.symbol);
      sectors[sector].targetWeight += a.weight;
    });
    return Object.entries(sectors).filter(([_, d]) => d.targetWeight > 0).sort((a, b) => b[1].targetWeight - a[1].targetWeight);
  }, [allocations]);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Liquidity Distribution</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Risk Parity weights · Synth API data</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-2xl" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>{formatCurrency(allocations.reduce((s, a) => s + a.value, 0))}</p>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Investable Capital</p>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="flex items-center gap-8">
        <div style={{ width: '200px', height: '200px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={optimalData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="var(--bg-base)"
                strokeWidth={2}
              >
                {optimalData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Asset Breakdown */}
        <div className="flex-1 space-y-3">
          {allocations.map((a, index) => (
            <div key={a.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{a.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                {hasCurrentWeights && a.currentWeight !== undefined && a.currentWeight !== null && a.currentWeight > 0 && (
                  <>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{(a.currentWeight * 100).toFixed(1)}%</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>
                  </>
                )}
                <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{(a.weight * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}

          {/* Dominant indicator */}
          {dominantOptimal && (
            <div className="pt-3 border-t" style={{ borderColor: 'rgba(17,17,17,0.08)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {dominantOptimal.name} dominant · {dominantOptimal.value.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sector tags */}
      {sectorBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-6 pt-5" style={{ borderTop: '1px solid rgba(17,17,17,0.08)' }}>
          {sectorBreakdown.map(([name, data]) => (
            <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(17,17,17,0.06)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{name}</span>
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{(data.targetWeight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AllocationChart;
