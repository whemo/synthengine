import React from 'react';
import type { RiskMetricsData } from './RiskMetricsCard';

interface TopMetricsBarProps {
    riskMetrics: RiskMetricsData;
}

const TopMetricsBar: React.FC<TopMetricsBarProps> = ({ riskMetrics }) => {
    const formatPct = (val: number) => `${(val * 100).toFixed(2)}%`;

    return (
        <div className="card-human flex flex-col lg:flex-row items-center justify-between p-6 gap-8">
            {/* Risk Telemetry Strip */}
            <div className="flex flex-1 justify-between gap-8 w-full">
                <div>
                    <span className="text-sm text-white/40 font-bold uppercase tracking-widest mb-2 block">Annualized Vol</span>
                    <p className="text-3xl font-bold text-[#34D399]">{formatPct(riskMetrics.portfolioVolatility)}</p>
                </div>
                <div>
                    <span className="text-sm text-white/40 font-bold uppercase tracking-widest mb-2 block">95% VaR</span>
                    <p className="text-3xl font-bold text-white/80">{formatPct(riskMetrics.var95)}</p>
                </div>
                <div>
                    <span className="text-sm text-white/40 font-bold uppercase tracking-widest mb-2 block">Sharpe</span>
                    <p className="text-3xl font-bold text-[#3B82F6]">{riskMetrics.sharpeRatio.toFixed(2)}</p>
                </div>
                <div>
                    <span className="text-sm text-white/40 font-bold uppercase tracking-widest mb-2 block">Tail Risk (MDD)</span>
                    <p className="text-3xl font-bold text-[#F87171]">{formatPct(riskMetrics.maxDrawdown)}</p>
                </div>
            </div>
        </div>
    );
};

export default TopMetricsBar;
