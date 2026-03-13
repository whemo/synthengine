/**
 * VolatilityComparisonChart — light mode redesign
 */

import type { VolatilityComparisonData } from '../types';

interface Props { data: VolatilityComparisonData[]; }

interface AssetVolatility extends VolatilityComparisonData {
  compression: number;
  compressionPct: string;
}

export default function VolatilityComparisonChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: '300px' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Signal Matrix Empty</p>
      </div>
    );
  }

  const assets: AssetVolatility[] = data.map(d => {
    const compression = d.historicalVolatility > 0 ? (d.synthVolatility - d.historicalVolatility) / d.historicalVolatility : 0;
    return { ...d, compression, compressionPct: `${compression < 0 ? '↓' : '↑'} ${Math.abs(compression * 100).toFixed(0)}%` };
  });

  const maxVol = Math.max(...assets.map(a => Math.max(a.synthVolatility, a.historicalVolatility))) * 1.1;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Signal Variance</h3>
        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Synth AI vs Historical Volatility</p>
      </div>

      {/* Explanation pill */}
      <div className="mb-6 px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(17,17,17,0.05)' }}>
        <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Low Synth vs High Hist indicates <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>expected risk compression</span>.
          High Synth vs Low Hist signals <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>rising volatility</span>.
        </p>
      </div>

      {/* Asset bars */}
      <div className="space-y-6">
        {assets.map(asset => {
          const isCompression = asset.compression < 0;
          const synthWidth = (asset.synthVolatility / maxVol) * 100;
          const histWidth = (asset.historicalVolatility / maxVol) * 100;
          return (
            <div key={asset.symbol}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm" style={{ color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{asset.symbol}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{
                  backgroundColor: isCompression ? 'rgba(17,17,17,0.08)' : 'rgba(230,34,29,0.08)',
                  color: isCompression ? 'var(--text-main)' : 'var(--accent-red)',
                }}>
                  {asset.compressionPct} {isCompression ? 'compression' : 'expansion'}
                </span>
              </div>

              {/* Synth bar */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold w-20" style={{ color: 'var(--text-main)' }}>Synth AI</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: '10px', backgroundColor: 'rgba(17,17,17,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${synthWidth}%`, backgroundColor: 'var(--text-main)' }} />
                </div>
                <span className="text-sm font-bold w-14 text-right" style={{ color: 'var(--text-main)' }}>{(asset.synthVolatility * 100).toFixed(1)}%</span>
              </div>

              {/* Historical bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold w-20" style={{ color: 'var(--text-muted)' }}>Historical</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: '10px', backgroundColor: 'rgba(17,17,17,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${histWidth}%`, backgroundColor: 'var(--text-muted)' }} />
                </div>
                <span className="text-sm font-bold w-14 text-right" style={{ color: 'var(--text-muted)' }}>{(asset.historicalVolatility * 100).toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
