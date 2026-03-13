import { usePortfolio } from './hooks/usePortfolio';
import { useState, useCallback } from 'react';
import PortfolioInput from './components/PortfolioInput';
import type { PortfolioInputData } from './components/PortfolioInput';
import AllocationChart from './components/AllocationChart';
import ExportButton from './components/ExportButton';
import HistoricalPerformanceChart from './components/HistoricalPerformanceChart';
import MonteCarloChart from './components/MonteCarloChart';
import VolatilityComparisonChart from './components/VolatilityComparisonChart';
import SynthForecast24h from './components/SynthForecast24h';
import CurrencySelector from './components/CurrencySelector';
import DriftMonitor from './components/DriftMonitor';
import RecommendationsPanel from './components/RecommendationsPanel';
import Tooltip from './components/Tooltip';
import { useCurrencyContext } from './contexts/CurrencyContext';

type RiskLevel = 'low' | 'medium' | 'high';

const RISK_LABELS: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

const KPI_TOOLTIPS = {
  netLiquidity: 'Total portfolio value — current market price × shares held across all positions, including cash reserves.',
  volatility: 'Annualized standard deviation of portfolio returns. Higher = more price swings. Below 15% is conservative, 15–30% moderate, 30%+ aggressive.',
  sharpe: 'Risk-adjusted return: (Return − Risk-free rate) / Volatility. Above 1.0 is good, above 2.0 is excellent.',
  var: 'Value at Risk (95%): maximum expected daily loss in 95% of scenarios. A VaR of -2% means you could lose up to 2% on a bad day.',
  tailRisk: 'Max Drawdown: largest peak-to-trough decline in portfolio value historically. Measures worst-case loss scenario.',
  cvar: 'Conditional VaR (95%): average expected loss in the worst 5% of scenarios — more conservative than standard VaR.',
};



function App() {
  const { analysis, isLoading, error, analyzePortfolio, resetAnalysis, clearError } = usePortfolio();
  const { format, currency } = useCurrencyContext();
  const [lastRequest, setLastRequest] = useState<PortfolioInputData | null>(null);
  const [currentRisk, setCurrentRisk] = useState<RiskLevel>('medium');
  const [copySuccess, setCopySuccess] = useState(false);

  // On mount: read URL params and pre-fill if present
  const getInitialData = useCallback((): Partial<PortfolioInputData> | undefined => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('capital')) return undefined;
    const assets = params.get('assets')?.split(',').filter(Boolean) ?? [];
    const capital = Number(params.get('capital')) || 100000;
    const risk = (params.get('risk') as RiskLevel) || 'medium';
    setCurrentRisk(risk);
    return { assets, capital, riskTolerance: risk, mode: 'new' };
  }, []);

  const [initialData] = useState(getInitialData);

  const handleSubmit = async (data: PortfolioInputData) => {
    setLastRequest(data);
    setCurrentRisk((data.riskTolerance as RiskLevel) || 'medium');
    await analyzePortfolio(data as any);
  };

  const handleReset = () => {
    resetAnalysis();
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleRiskRerun = async (risk: RiskLevel) => {
    if (!lastRequest || isLoading) return;
    setCurrentRisk(risk);
    const updated = { ...lastRequest, riskTolerance: risk };
    setLastRequest(updated);
    await analyzePortfolio(updated as any);
  };

  const handleShare = () => {
    if (!lastRequest) return;
    const params = new URLSearchParams({
      capital: String(lastRequest.capital || ''),
      assets: (lastRequest.assets || []).join(','),
      risk: lastRequest.riskTolerance || 'medium',
    });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-main)', transition: 'background-color 0.4s ease, color 0.4s ease' }}>
      {/* ─── Header ─── */}
      <header className="border-b px-8 lg:px-12 sticky top-0 z-50" style={{ borderColor: 'rgba(17,17,17,0.1)', backgroundColor: 'var(--bg-base)', backdropFilter: 'blur(20px)', transition: 'background-color 0.4s ease' }}>
        <div className="max-w-[1440px] mx-auto flex items-center justify-between py-5">
          {/* Logo */}
          <h1
            className="font-bold leading-none select-none"
            style={{ fontSize: '28px', letterSpacing: '-0.04em', color: 'var(--text-main)', cursor: analysis ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
            onClick={analysis ? handleReset : undefined}
            title={analysis ? 'Click to reset' : undefined}
          >
            SynthEngine
          </h1>

          {/* Centre: empty now (pills moved below hero) */}
          <div />

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <CurrencySelector />
            {analysis && (
              <div className="flex items-center gap-2 animate-fade-in">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all"
                  style={{ backgroundColor: copySuccess ? 'rgba(52,168,83,0.12)' : 'rgba(17,17,17,0.07)', color: copySuccess ? '#34A853' : 'var(--text-main)', border: '1.5px solid transparent' }}
                >
                  {copySuccess ? (
                    <>✓ Copied</>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </>
                  )}
                </button>
                <ExportButton
                  data={{
                    totalCapital: analysis.totalCapital,
                    currency,
                    timestamp: analysis.timestamp,
                    allocations: analysis.allocations.map(a => ({ symbol: a.symbol, weight: a.weight, value: a.value, currentWeight: a.currentWeight })),
                    riskMetrics: {
                      sharpeRatio: analysis.riskMetrics.sharpeRatio,
                      volatility: analysis.riskMetrics.portfolioVolatility,
                      maxDrawdown: analysis.riskMetrics.maxDrawdown,
                      var95: analysis.riskMetrics.var95,
                      cvar95: analysis.riskMetrics.cvar95,
                      diversificationRatio: 0,
                    },
                    riskContributions: analysis.riskContributions.map(r => ({
                      symbol: r.symbol, weight: r.weight, volatility: r.volatility,
                      riskContribution: r.riskContribution, value: r.value ?? (r.weight * analysis.totalCapital),
                    })),
                    volatilityComparison: analysis.volatilityComparison ?? [],
                    formatCurrency: format,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="px-8 lg:px-12 py-10">
        <div className="max-w-[1440px] mx-auto">

          {/* Hero Title */}
          <div className="mb-10 text-center animate-fade-up">
            <h2 className="font-bold" style={{ fontSize: '56px', letterSpacing: '-0.06em', lineHeight: '1.05', color: 'var(--text-main)' }}>
              {analysis ? 'Portfolio Analysis' : 'Algorithmic Optimization'}
            </h2>
            <p className="mt-3 text-base font-medium" style={{ color: 'var(--text-muted)' }}>
              Portfolio analysis with analytics based on Synth data
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-8 p-5 rounded-2xl border flex items-start gap-4 animate-fade-in" style={{ backgroundColor: 'rgba(230,34,29,0.06)', borderColor: 'rgba(230,34,29,0.2)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'var(--accent-red)' }}>
                <span className="text-[10px] font-black text-white">!</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-red)' }}>Protocol Exception</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{error}</p>
              </div>
              <button onClick={clearError} style={{ color: 'var(--text-muted)' }} className="hover:opacity-70 transition-opacity">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Landing Form */}
          {!analysis && (
            <div className="max-w-xl mx-auto mt-4 animate-scale-in">
              <PortfolioInput onSubmit={handleSubmit} isLoading={isLoading} initialData={initialData as PortfolioInputData} />
            </div>
          )}

          {/* ── Dashboard ── */}
          {analysis && (
            <div className="space-y-6">
              {/* ROW 1: 4 KPI Cards */}
              <div className="grid grid-cols-4 gap-6">
                {/* Net Liquidity */}
                <div className="card-human flex flex-col justify-between animate-fade-up stagger-1" style={{ minHeight: '160px' }}>
                  <div className="flex items-start">
                    <Tooltip content={KPI_TOOLTIPS.netLiquidity}>
                      <p className="section-label cursor-help" style={{ borderBottom: '1px dashed rgba(17,17,17,0.15)', paddingBottom: '4px', display: 'inline-block' }}>Net Liquidity ⓘ</p>
                    </Tooltip>
                  </div>
                  <div>
                    <div className="metric-value animate-count-up">
                      <span className="metric-muted" style={{ fontSize: '32px', marginRight: '2px' }}>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}</span>
                      {Math.floor(analysis.totalCapital / 1000)},{String(Math.round(analysis.totalCapital % 1000)).padStart(3, '0')}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#34A853', boxShadow: '0 0 6px #34A85360' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Oracle Synchronized</span>
                    </div>
                  </div>
                </div>

                {/* Annualized Volatility */}
                <div className="card-human flex flex-col justify-between animate-fade-up stagger-2" style={{ minHeight: '160px' }}>
                  <div className="flex items-start">
                    <Tooltip content={KPI_TOOLTIPS.volatility}>
                      <p className="section-label cursor-help" style={{ borderBottom: '1px dashed rgba(17,17,17,0.15)', paddingBottom: '4px', display: 'inline-block' }}>Annualized Volatility ⓘ</p>
                    </Tooltip>
                  </div>
                  <div>
                    <div className="metric-value animate-count-up">
                      {(analysis.riskMetrics.portfolioVolatility * 100).toFixed(1)}
                      <span className="metric-muted" style={{ fontSize: '28px' }}>%</span>
                    </div>
                    <p className="text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>
                      Sharpe:&nbsp;
                      <Tooltip content={KPI_TOOLTIPS.sharpe}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(17,17,17,0.2)' }}>{analysis.riskMetrics.sharpeRatio.toFixed(2)}</span>
                      </Tooltip>
                      <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>·</span>
                      95% VaR:&nbsp;
                      <Tooltip content={KPI_TOOLTIPS.var}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(17,17,17,0.2)' }}>{(analysis.riskMetrics.var95 * 100).toFixed(2)}%</span>
                      </Tooltip>
                    </p>
                  </div>
                </div>

                {/* Tail Risk */}
                <div className="card-human flex flex-col justify-between animate-fade-up stagger-3" style={{ minHeight: '160px' }}>
                  <div className="flex items-start">
                    <Tooltip content={KPI_TOOLTIPS.tailRisk}>
                      <p className="section-label cursor-help" style={{ borderBottom: '1px dashed rgba(17,17,17,0.15)', paddingBottom: '4px', display: 'inline-block' }}>Tail Risk (Max Drawdown) ⓘ</p>
                    </Tooltip>
                  </div>
                  <div>
                    <div className="metric-value animate-count-up" style={{ color: 'var(--accent-red)' }}>
                      {(analysis.riskMetrics.maxDrawdown * 100).toFixed(1)}
                      <span style={{ fontSize: '28px', color: 'var(--accent-red)', opacity: 0.6 }}>%</span>
                    </div>
                    <p className="text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>
                      CVaR 95%:&nbsp;
                      <Tooltip content={KPI_TOOLTIPS.cvar}>
                        <span style={{ color: 'var(--accent-red)', fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(230,34,29,0.3)' }}>{(analysis.riskMetrics.cvar95 * 100).toFixed(2)}%</span>
                      </Tooltip>
                    </p>
                  </div>
                </div>
                {/* Risk Selection */}
                <div className="card-human flex flex-col justify-between animate-fade-up stagger-4" style={{ minHeight: '160px' }}>
                  <div className="flex items-start">
                    <p className="section-label cursor-default" style={{ borderBottom: '1px dashed transparent', paddingBottom: '4px', display: 'inline-block' }}>Risk Profile</p>
                  </div>
                  <div className="flex flex-row items-center mt-auto w-full p-1" style={{ backgroundColor: 'rgba(17,17,17,0.06)', borderRadius: '16px' }}>
                    {(['low', 'medium', 'high'] as RiskLevel[]).map(r => (
                      <button
                        key={r}
                        onClick={() => handleRiskRerun(r)}
                        disabled={isLoading}
                        className="flex-1"
                        style={{
                          padding: '12px 0',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: 700,
                          letterSpacing: '-0.01em',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          border: 'none',
                          textAlign: 'center',
                          backgroundColor: currentRisk === r ? 'var(--bg-card)' : 'transparent',
                          color: currentRisk === r ? 'var(--text-main)' : 'var(--text-muted)',
                          boxShadow: currentRisk === r ? '0 4px 12px rgba(17,17,17,0.08), 0 1px 2px rgba(17,17,17,0.04)' : 'none',
                        }}
                      >
                        {RISK_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ROW 2: Allocation + Execution Signals */}
              <div className="grid gap-6 animate-fade-up stagger-4" style={{ gridTemplateColumns: '7fr 5fr' }}>
                <div className="card-human">
                  <AllocationChart
                    allocations={analysis.allocations.map(a => ({ symbol: a.symbol, weight: a.weight, currentWeight: a.currentWeight, value: a.value }))}
                    totalCapital={analysis.totalCapital}
                    formatCurrency={format}
                  />
                </div>
                <div className="card-human">
                  <RecommendationsPanel
                    recommendations={analysis.recommendations.map(r => ({ symbol: r.symbol, action: r.action, reason: r.reason, targetWeight: r.targetWeight, currentWeight: r.currentWeight }))}
                  />
                </div>
              </div>

              {/* Portfolio Alignment (Active mode only) */}
              {analysis.allocations.some(a => a.currentWeight !== undefined && a.currentWeight !== null && a.currentWeight > 0) && (
                <div className="card-human animate-fade-up stagger-5">
                  <DriftMonitor allocations={analysis.allocations.map(a => ({ symbol: a.symbol, weight: a.weight, currentWeight: a.currentWeight }))} />
                </div>
              )}

              {/* ROW 3: Monte Carlo + Signal Variance */}
              <div className="grid gap-6 animate-fade-up stagger-5" style={{ gridTemplateColumns: '7fr 5fr' }}>
                <div className="card-human">
                  <MonteCarloChart paths={analysis.monteCarlo.paths} initialCapital={analysis.totalCapital} />
                </div>
                <div className="card-human">
                  <VolatilityComparisonChart data={analysis.volatilityComparison.map(v => ({ symbol: v.symbol, synthVolatility: v.synthVolatility, historicalVolatility: v.historicalVolatility, source: v.source }))} />
                </div>
              </div>

              {/* ROW 4: 24h Forecast + Historical */}
              <div className="grid gap-6 animate-fade-up stagger-6" style={{ gridTemplateColumns: '5fr 7fr' }}>
                <div className="card-human">
                  <SynthForecast24h monteCarlo={analysis.monteCarlo} totalCapital={analysis.totalCapital} formatCurrency={format} />
                </div>
                {analysis.historicalPerformance && (
                  <div className="card-human">
                    <HistoricalPerformanceChart data={analysis.historicalPerformance} formatCurrency={format} />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(227,225,213,0.85)', backdropFilter: 'blur(16px)' }}>
          <div className="flex flex-col items-center gap-5 animate-scale-in">
            <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(17,17,17,0.1)', borderTopColor: 'var(--text-main)' }} />
            <h3 className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>Aggregating Probabilities</h3>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
