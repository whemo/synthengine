/**
 * DriftMonitor — light mode redesign
 * Shows per-asset portfolio drift from target weights.
 */

interface DriftItem {
  symbol: string;
  targetWeight: number;
  currentWeight: number;
  drift: number;
  driftPct: number;
}

interface Props {
  allocations: Array<{ symbol: string; weight: number; currentWeight?: number }>;
}

const DRIFT_THRESHOLDS = { low: 0.02, medium: 0.05, high: 0.10 };

function getDriftLevel(absDrift: number): 'ok' | 'watch' | 'rebalance' {
  if (absDrift >= DRIFT_THRESHOLDS.high) return 'rebalance';
  if (absDrift >= DRIFT_THRESHOLDS.medium) return 'watch';
  return 'ok';
}

const LEVEL_CONFIG = {
  ok: { color: '#111111', bg: 'rgba(17,17,17,0.06)', label: 'Optimal' },
  watch: { color: '#8A887D', bg: 'rgba(138,136,125,0.1)', label: 'Drift' },
  rebalance: { color: '#E6221D', bg: 'rgba(230,34,29,0.08)', label: 'Action' },
};

export default function DriftMonitor({ allocations }: Props) {
  const itemsWithCurrent = allocations.filter(a => a.currentWeight !== undefined && a.currentWeight !== null);

  if (itemsWithCurrent.length === 0) {
    return (
      <div>
        <h4 className="font-bold text-lg mb-2" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Drift Monitor</h4>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Use <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Active Portfolio</span> mode to activate drift analysis.
        </p>
      </div>
    );
  }

  const driftItems: DriftItem[] = itemsWithCurrent.map(a => {
    const drift = a.weight - (a.currentWeight ?? a.weight);
    return { symbol: a.symbol, targetWeight: a.weight, currentWeight: a.currentWeight ?? a.weight, drift, driftPct: drift * 100 };
  });

  const needsRebalance = driftItems.some(d => getDriftLevel(Math.abs(d.drift)) === 'rebalance');
  const needsWatch = driftItems.some(d => getDriftLevel(Math.abs(d.drift)) === 'watch');
  const statusLabel = needsRebalance ? 'Rebalancing Required' : needsWatch ? 'Marginal Exposure Skew' : 'Alignment within Tolerance';
  const statusColor = needsRebalance ? '#E6221D' : needsWatch ? '#8A887D' : '#111111';

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Drift Monitor</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Equilibrium vs. target weights</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-4">
        {driftItems.map(item => {
          const level = getDriftLevel(Math.abs(item.drift));
          const cfg = LEVEL_CONFIG[level];
          const barWidth = Math.min(Math.abs(item.driftPct) * 4, 100);
          return (
            <div key={item.symbol} className="p-4 rounded-2xl" style={{ backgroundColor: cfg.bg }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{item.symbol}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(17,17,17,0.08)', color: cfg.color }}>{cfg.label}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: cfg.color }}>{item.drift > 0 ? '+' : ''}{item.driftPct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'rgba(17,17,17,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(barWidth, 4)}%`, backgroundColor: cfg.color }} />
              </div>
              <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <span>Current: {(item.currentWeight * 100).toFixed(1)}%</span>
                <span>Target: {(item.targetWeight * 100).toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
