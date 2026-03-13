/**
 * SynthForecast24h — 24-Hour Expected Range from Synth AI
 * Light mode redesign with range bar restored.
 */

import type { MonteCarloData } from '../types';

interface Props {
  monteCarlo: MonteCarloData;
  totalCapital: number;
  formatCurrency: (v: number) => string;
}

export function SynthForecast24h({ monteCarlo, totalCapital, formatCurrency }: Props) {
  const p5Value = totalCapital * (1 + monteCarlo.percentile5);
  const p95Value = totalCapital * (1 + monteCarlo.percentile95);
  const currentValue = totalCapital;

  const probabilityOfGain = monteCarlo.meanReturn > 0
    ? 50 + (monteCarlo.meanReturn / monteCarlo.stdReturn) * 100
    : 50 - Math.abs(monteCarlo.meanReturn / monteCarlo.stdReturn) * 100;
  const clampedProb = Math.min(95, Math.max(5, probabilityOfGain));

  // position of current marker on the bar (0–100%)
  const range = p95Value - p5Value;
  const currentPosition = range > 0 ? ((currentValue - p5Value) / range) * 100 : 50;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>24H Synth Forecast</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Synth AI volatility predictions</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(17,17,17,0.08)', color: 'var(--text-main)' }}>
          AI Powered
        </span>
      </div>

      {/* Range Bar */}
      <div>
        <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)' }}>Portfolio Expected Range (24h)</p>
        <div style={{ position: 'relative', height: '72px' }}>
          {/* Bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <div style={{
              height: '10px', borderRadius: '99px', overflow: 'hidden',
              background: 'linear-gradient(to right, rgba(230,34,29,0.25), rgba(17,17,17,0.1) 40%, rgba(17,17,17,0.1) 60%, rgba(17,17,17,0.2))',
              border: '1px solid rgba(17,17,17,0.1)',
              position: 'relative',
            }}>
              {/* Worst marker (P5) */}
              <div style={{ position: 'absolute', left: '-1px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--accent-red)', border: '2px solid white', boxShadow: '0 2px 6px rgba(230,34,29,0.4)' }} />
              {/* Current marker */}
              <div style={{ position: 'absolute', left: `${currentPosition}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', border: '2.5px solid var(--text-main)', boxShadow: '0 2px 8px rgba(17,17,17,0.2)' }} />
              {/* Best marker (P95) */}
              <div style={{ position: 'absolute', right: '-1px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--text-main)', border: '2px solid white', boxShadow: '0 2px 6px rgba(17,17,17,0.3)' }} />
            </div>
          </div>

          {/* Labels */}
          <div style={{ position: 'absolute', top: '22px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
            {/* Worst */}
            <div style={{ textAlign: 'left' }}>
              <div className="text-xs font-bold" style={{ color: 'var(--accent-red)' }}>{formatCurrency(p5Value)}</div>
              <div className="text-xs" style={{ color: 'var(--accent-red)', opacity: 0.7 }}>({(monteCarlo.percentile5 * 100).toFixed(1)}%)</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Worst</div>
            </div>
            {/* Current */}
            <div style={{ textAlign: 'center' }}>
              <div className="text-sm font-bold" style={{ color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{formatCurrency(currentValue)}</div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Current</div>
            </div>
            {/* Best */}
            <div style={{ textAlign: 'right' }}>
              <div className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>{formatCurrency(p95Value)}</div>
              <div className="text-xs" style={{ color: 'var(--text-main)', opacity: 0.5 }}>({(monteCarlo.percentile95 * 100).toFixed(1)}%)</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Best</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl" style={{ backgroundColor: 'rgba(17,17,17,0.04)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Best Case (95th)</p>
          <p className="font-bold text-base" style={{ letterSpacing: '-0.03em', color: 'var(--text-main)' }}>+{formatCurrency(totalCapital * monteCarlo.percentile95)}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>+{(monteCarlo.percentile95 * 100).toFixed(2)}%</p>
        </div>
        <div className="p-4 rounded-2xl" style={{ backgroundColor: 'rgba(230,34,29,0.05)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Worst Case (5th)</p>
          <p className="font-bold text-base" style={{ letterSpacing: '-0.03em', color: 'var(--accent-red)' }}>{formatCurrency(totalCapital * monteCarlo.percentile5)}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--accent-red)', opacity: 0.7 }}>{(monteCarlo.percentile5 * 100).toFixed(2)}%</p>
        </div>
      </div>

      {/* Probability of Gain */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Probability of Gain</p>
          <span className="font-bold text-lg" style={{ color: clampedProb >= 50 ? 'var(--text-main)' : 'var(--accent-red)', letterSpacing: '-0.03em' }}>
            {clampedProb.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(17,17,17,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${clampedProb}%`, backgroundColor: clampedProb >= 50 ? '#111111' : 'var(--accent-red)' }} />
        </div>
        <p className="text-xs font-semibold mt-1" style={{ color: clampedProb >= 50 ? 'var(--text-muted)' : 'var(--accent-red)' }}>
          {clampedProb >= 50 ? 'Favorable' : clampedProb >= 40 ? 'Neutral' : 'Unfavorable'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid rgba(17,17,17,0.08)' }}>
        {[
          { label: 'Std Dev', value: `${(monteCarlo.stdReturn * 100).toFixed(2)}%` },
          { label: 'Simulations', value: monteCarlo.simulationsCount.toLocaleString() },
          { label: 'Min Return', value: `${(monteCarlo.minReturn * 100).toFixed(2)}%` },
        ].map(s => (
          <div key={s.label}>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-sm font-bold" style={{ color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SynthForecast24h;
