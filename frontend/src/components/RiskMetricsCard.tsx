import React from 'react';

/**
 * Risk metrics data interface
 */
export interface RiskMetricsData {
  portfolioVolatility: number;
  var95: number;
  cvar95: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface RiskMetricConfig {
  key: keyof RiskMetricsData;
  label: string;
  icon: React.ReactNode;
  tooltip: string;
  isPercentage: boolean;
  inverse: boolean; // true if lower is better (e.g., volatility, drawdown)
}

interface RiskMetricsCardProps {
  riskMetrics: RiskMetricsData | null | undefined;
  title?: string;
}

const formatValue = (value: number | undefined | null, isPercentage: boolean): string => {
  if (value === undefined || value === null) return '0.00';
  if (isPercentage) {
    // Convert decimal to percentage (e.g., 0.09 -> 9.00%)
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(2);
};

const getMetricColor = (value: number, inverse: boolean): string => {
  if (inverse) {
    if (value <= 10) return 'text-[#34D399]';
    if (value <= 20) return 'text-[#3B82F6]';
    return 'text-[#F87171]';
  } else {
    if (value >= 1.5) return 'text-[#34D399]';
    if (value >= 0.5) return 'text-[#3B82F6]';
    return 'text-[#F87171]';
  }
};

const getMetricStatus = (value: number, inverse: boolean): 'OPTIMAL' | 'STABLE' | 'ELEVATED' => {
  if (inverse) {
    if (value <= 10) return 'OPTIMAL';
    if (value <= 20) return 'STABLE';
    return 'ELEVATED';
  } else {
    if (value >= 1.5) return 'OPTIMAL';
    if (value >= 0.5) return 'STABLE';
    return 'ELEVATED';
  }
};

const metricConfigs: RiskMetricConfig[] = [
  {
    key: 'portfolioVolatility',
    label: 'Annualized Vol',
    isPercentage: true,
    inverse: true,
    tooltip: 'Forward-looking volatility prediction derived from Synth AI price distributions.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    key: 'var95',
    label: '95% Value at Risk',
    isPercentage: true,
    inverse: true,
    tooltip: 'Maximum expected loss at a 95% confidence interval.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    key: 'sharpeRatio',
    label: 'Predicted Sharpe',
    isPercentage: false,
    inverse: false,
    tooltip: 'Risk-adjusted return projection. Values > 1.0 indicate efficient capital allocation.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    key: 'maxDrawdown',
    label: 'Tail Risk (MDD)',
    isPercentage: true,
    inverse: true,
    tooltip: 'Maximum peak-to-trough decline predicted across all simulation paths.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
];

const MetricCard = ({ config, value }: { config: RiskMetricConfig; value: number }) => {
  const colorClass = getMetricColor(value, config.inverse);
  const status = getMetricStatus(value, config.inverse);

  return (
    <div className="card-human !p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white/5 p-1.5 rounded-sm text-white/40">
          {config.icon}
        </div>
        <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${status === 'OPTIMAL' ? 'bg-[#34D399]/5 border-[#34D399]/20 text-[#34D399]' :
          status === 'STABLE' ? 'bg-[#3B82F6]/5 border-[#3B82F6]/20 text-[#3B82F6]' :
            'bg-[#F87171]/5 border-[#F87171]/20 text-[#F87171]'
          }`}>
          {status}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">{config.label}</p>
        <p className={`text-xl font-bold tracking-tight ${colorClass}`}>
          {formatValue(value, config.isPercentage)}
        </p>
      </div>
    </div>
  );
};

export function RiskMetricsCard({ riskMetrics }: RiskMetricsCardProps) {
  const hasData = riskMetrics && Object.values(riskMetrics).every(v => v !== null && v !== undefined);

  return (
    <div className="h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em]">Risk Metrics</h3>
          <p className="text-[9px] text-[#3B82F6]/70 font-medium mt-0.5">Using Synth AI predictions</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {hasData ? (
          metricConfigs.map((config) => (
            <MetricCard
              key={config.key}
              config={config}
              value={riskMetrics[config.key]}
            />
          ))
        ) : (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="card-human !p-4 animate-pulse">
              <div className="w-6 h-6 bg-white/5 rounded-sm mb-4" />
              <div className="h-2 w-16 bg-white/5 rounded mb-2" />
              <div className="h-4 w-12 bg-white/5 rounded" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RiskMetricsCard;
