import { useState } from 'react';

export interface PortfolioPosition {
  shares: number;
}

export interface PortfolioInputData {
  mode: 'new' | 'existing';
  capital?: number;
  positions?: { [asset: string]: PortfolioPosition };
  cash?: number;
  assets: string[];
  riskTolerance: 'low' | 'medium' | 'high';
}

interface PortfolioInputProps {
  onSubmit: (data: PortfolioInputData) => void;
  isLoading?: boolean;
  initialData?: PortfolioInputData;
}

const AVAILABLE_ASSETS = ['NVDAX', 'AAPLX', 'GOOGLX', 'TSLAX', 'SPYX'];

const RISK_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export function PortfolioInput({ onSubmit, isLoading, initialData }: PortfolioInputProps) {
  const [mode, setMode] = useState<'new' | 'existing'>(initialData?.mode || 'new');
  const [capital, setCapital] = useState<string>(initialData?.capital?.toString() || '');
  const [positions, setPositions] = useState<{ [asset: string]: number }>(
    initialData?.positions
      ? Object.entries(initialData.positions).reduce((acc, [k, v]) => ({ ...acc, [k]: v.shares }), {})
      : {}
  );
  const [cash, setCash] = useState<string>(initialData?.cash?.toString() || '0');
  const [selectedAssets, setSelectedAssets] = useState<string[]>(initialData?.assets || AVAILABLE_ASSETS);
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>(initialData?.riskTolerance || 'medium');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleCapitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setCapital(val);
  };

  const handleAssetToggle = (asset: string) => {
    setSelectedAssets(prev => prev.includes(asset) ? prev.filter(a => a !== asset) : [...prev, asset]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};
    if (mode === 'new') {
      if (!capital || isNaN(parseFloat(capital))) newErrors.capital = 'Enter a valid amount';
      if (selectedAssets.length === 0) newErrors.assets = 'Select at least one asset';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    onSubmit({
      mode,
      capital: mode === 'new' ? parseFloat(capital) : undefined,
      positions: mode === 'existing' ? Object.entries(positions).reduce((acc, [k, v]) => ({ ...acc, [k]: { shares: v } }), {}) : undefined,
      cash: mode === 'existing' ? parseFloat(cash) : undefined,
      assets: mode === 'new' ? selectedAssets : Object.keys(positions),
      riskTolerance,
    });
  };

  return (
    <div className="card-human">
      {/* Header */}
      <div className="mb-8">
        <h3 className="font-bold text-2xl mb-1" style={{ letterSpacing: '-0.04em', color: 'var(--text-main)' }}>Strategy Configuration</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Neural network risk modeling · Probabilistic allocation</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Mode Selection */}
        <div>
          <label className="label-human">Input stream</label>
          <div className="grid grid-cols-2 gap-2">
            {(['new', 'existing'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="py-3 px-4 rounded-xl font-semibold text-sm transition-all"
                style={{
                  backgroundColor: mode === m ? 'var(--accent-black)' : 'rgba(17,17,17,0.05)',
                  color: mode === m ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  letterSpacing: '-0.02em',
                }}
              >
                {m === 'new' ? 'Synthetic Creation' : 'Active Portfolio'}
              </button>
            ))}
          </div>
        </div>

        {/* Capital / Positions */}
        {mode === 'new' ? (
          <div>
            <label className="label-human">Deployed Capital (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold" style={{ color: 'var(--text-muted)' }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                value={capital}
                onChange={handleCapitalChange}
                className="input-human !pl-10 !text-2xl !font-bold"
                placeholder="100,000"
                style={{ letterSpacing: '-0.04em' }}
              />
            </div>
            {errors.capital && <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent-red)' }}>{errors.capital}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="label-human">Ledger Positions</label>
            {AVAILABLE_ASSETS.map(asset => (
              <div key={asset} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(17,17,17,0.05)', border: '1.5px solid rgba(17,17,17,0.08)' }}>
                <span className="text-xs font-bold w-14" style={{ color: 'var(--text-main)' }}>{asset}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={(positions[asset] ?? 0) === 0 ? '' : positions[asset]!.toString()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPositions(prev => ({ ...prev, [asset]: val === '' ? 0 : parseInt(val, 10) }));
                  }}
                  className="flex-1 bg-transparent text-sm font-semibold outline-none"
                  placeholder="0"
                  style={{ color: 'var(--text-main)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>shares</span>
              </div>
            ))}
            <div>
              <label className="label-human">Cash Reserve</label>
              <input type="text" inputMode="decimal" value={cash === '0' ? '' : cash} onChange={e => setCash(e.target.value.replace(/[^0-9.]/g, '') || '0')} className="input-human" placeholder="0" />
            </div>
          </div>
        )}

        {/* Asset Selection */}
        {mode === 'new' && (
          <div>
            <label className="label-human">Model Universe</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ASSETS.map(asset => {
                const isSelected = selectedAssets.includes(asset);
                return (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => handleAssetToggle(asset)}
                    className="px-4 py-2 rounded-full font-semibold text-sm transition-all"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-black)' : 'rgba(17,17,17,0.06)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {asset}
                  </button>
                );
              })}
            </div>
            {errors.assets && <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent-red)' }}>{errors.assets}</p>}
          </div>
        )}

        {/* Risk Tolerance */}
        <div>
          <label className="label-human">Risk Multiplier</label>
          <div className="grid grid-cols-3 gap-2">
            {RISK_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRiskTolerance(option.value)}
                className="py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  backgroundColor: riskTolerance === option.value ? 'var(--accent-black)' : 'rgba(17,17,17,0.05)',
                  color: riskTolerance === option.value ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-human-primary !py-4 text-sm font-bold"
          style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
        >
          {isLoading ? 'Running Model...' : 'Execute Simulation'}
        </button>
      </form>
    </div>
  );
}

export default PortfolioInput;
