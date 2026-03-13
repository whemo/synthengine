/**
 * RecommendationsPanel — Execution Signals
 * Ultra-compact table-row style cards — minimal height per asset.
 */

export interface RecommendationData {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ALLOCATE';
  reason: string;
  targetWeight: number;
  currentWeight?: number;
}

interface RecommendationsPanelProps {
  recommendations: RecommendationData[];
}

const formatWeight = (weight: number): string => `${(weight * 100).toFixed(1)}%`;

const actionConfig: Record<RecommendationData['action'], { label: string; color: string; bg: string }> = {
  ALLOCATE: { label: 'Initial', color: '#111111', bg: 'rgba(17,17,17,0.08)' },
  BUY:      { label: 'Buy',     color: '#111111', bg: 'rgba(17,17,17,0.08)' },
  SELL:     { label: 'Sell',    color: '#E6221D', bg: 'rgba(230,34,29,0.08)' },
  HOLD:     { label: 'Hold',    color: '#8A887D', bg: 'rgba(138,136,125,0.12)' },
};

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  const hasRecommendations = recommendations && recommendations.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Execution Signals</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Synth AI volatility forecasts</p>
        </div>
        {hasRecommendations && (
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(17,17,17,0.08)', color: 'var(--text-main)' }}>
            Active
          </span>
        )}
      </div>

      {!hasRecommendations ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Run simulation to generate signals</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {recommendations.map((r, i) => {
            const cfg = actionConfig[r.action];
            return (
              <div key={`${r.symbol}-${i}`} style={{
                padding: '10px 14px',
                borderRadius: '14px',
                backgroundColor: 'rgba(17,17,17,0.04)',
                border: '1px solid rgba(17,17,17,0.07)',
              }}>
                {/* Top row: symbol + badge + weights */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="font-bold text-sm" style={{ letterSpacing: '-0.02em', color: 'var(--text-main)', minWidth: '52px' }}>{r.symbol}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                    {cfg.label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reason}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-main)', flexShrink: 0 }}>
                    {r.currentWeight !== undefined ? `${formatWeight(r.currentWeight)} → ` : ''}{formatWeight(r.targetWeight)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RecommendationsPanel;
