import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { HistoricalPerformanceData } from '../types';

interface Props {
  data: HistoricalPerformanceData;
  formatCurrency: (v: number) => string;
}

const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(17,17,17,0.1)', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(17,17,17,0.08)' }}>
        <p className="text-xs font-bold mb-2 pb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(17,17,17,0.06)' }}>{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{entry.name}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const HistoricalPerformanceChart: React.FC<Props> = ({ data, formatCurrency }) => {
  const chartData = data.dataPoints.map(point => ({
    date: point.date,
    'Active Strategy': point.value,
    'SPY Target': point.sp500Value,
  }));

  const isOutperforming = data.portfolioFinalValue > data.sp500FinalValue;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Retrospective Alpha</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Yahoo Finance prices · Synth AI weights</p>
        </div>
        <div className="flex items-end gap-6">
          <div className="text-right">
            <p className="font-bold text-2xl" style={{ letterSpacing: '-0.04em', color: isOutperforming ? 'var(--text-main)' : 'var(--accent-red)' }}>
              {formatCurrency(data.portfolioFinalValue)}
            </p>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Expected Final</p>
          </div>
          <div className="h-10 w-px" style={{ backgroundColor: 'rgba(17,17,17,0.1)' }} />
          <div className="text-right">
            <p className="font-bold text-xl" style={{ letterSpacing: '-0.04em', color: 'var(--text-muted)' }}>
              {formatCurrency(data.sp500FinalValue)}
            </p>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Benchmark</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: '300px', marginBottom: '24px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPortfolioLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#111111" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#111111" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSP500Light" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8A887D" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#8A887D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,0.06)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} minTickGap={80} dy={8} />
            <YAxis
              tickFormatter={(v) => `$${((v || 0) / 1000).toFixed(0)}k`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}
              axisLine={false} tickLine={false} domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
            <Area type="monotone" dataKey="SPY Target" stroke="#8A887D" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorSP500Light)" name="SPY Target" />
            <Area type="monotone" dataKey="Active Strategy" stroke="#111111" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPortfolioLight)" name="Active Strategy" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Asset Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {data.assetReturns.map((asset) => (
          <div key={asset.symbol} className="p-3 rounded-2xl" style={{ backgroundColor: 'rgba(17,17,17,0.05)' }}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-bold" style={{ color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{asset.symbol}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{
                backgroundColor: (asset.return1y || 0) >= 0 ? 'rgba(17,17,17,0.08)' : 'rgba(230,34,29,0.08)',
                color: (asset.return1y || 0) >= 0 ? 'var(--text-main)' : 'var(--accent-red)',
              }}>
                {((asset.return1y || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              <span>${(asset.startPrice || 0).toFixed(0)}</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>${(asset.endPrice || 0).toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoricalPerformanceChart;
