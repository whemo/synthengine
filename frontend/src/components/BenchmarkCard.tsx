import React from 'react';
import type { BenchmarkData } from '../types';

interface Props {
    data: BenchmarkData;
}

const BenchmarkCard: React.FC<Props> = ({ data }) => {
    const isOutperforming = data.outperformance > 0;

    return (
        <div className="card-human h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Market Divergence</h3>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">1Y Comparative Signal (SPY)</p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-sm border text-[9px] font-bold uppercase tracking-widest ${isOutperforming
                        ? 'bg-[#34D399]/5 border-[#34D399]/20 text-[#34D399]'
                        : 'bg-[#F87171]/5 border-[#F87171]/20 text-[#F87171]'
                        }`}>
                        {isOutperforming ? 'Outperformance' : 'Underperformance'}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                    <div>
                        <span className="label-human">Portfolio Yield</span>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-bold text-white">{(data.portfolio1yReturn * 100).toFixed(2)}%</p>
                        </div>
                    </div>
                    <div>
                        <span className="label-human">Benchmark Yield</span>
                        <p className="text-xl font-bold text-white/40">{(data.sp5001yReturn * 100).toFixed(2)}%</p>
                    </div>
                </div>

                <div className="bg-white/5 p-6 rounded-lg border border-white/5 mb-8">
                    <span className="label-human">Alpha Factor</span>
                    <div className={`text-5xl font-bold tracking-tight ${isOutperforming ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
                        {isOutperforming ? '+' : ''}{(data.outperformance * 100).toFixed(2)}%
                    </div>
                    <p className="text-[10px] font-medium text-white/30 mt-3 leading-relaxed">
                        {isOutperforming
                            ? `Synth AI risk parity generated ${(data.outperformance * 100).toFixed(1)}% statistical alpha relative to SPY indices.`
                            : `Model trailed benchmark by ${Math.abs(data.outperformance * 100).toFixed(1)}% during this epoch.`}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
                <div>
                    <span className="label-human">Settle Price</span>
                    <p className="text-sm font-bold text-white/70">${data.sp500CurrentPrice.toFixed(2)}</p>
                </div>
                <div>
                    <span className="label-human">Origin Price</span>
                    <p className="text-sm font-bold text-white/20">${data.sp5001yAgoPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <span className="label-human">Bias</span>
                    <p className={`text-[10px] font-bold ${data.sp5001yReturn > 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
                        {data.sp5001yReturn > 0 ? 'BULLISH' : 'BEARISH'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BenchmarkCard;
