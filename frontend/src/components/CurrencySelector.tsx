/**
 * CurrencySelector — light mode
 */

import { useCurrencyContext } from '../contexts/CurrencyContext';
import { CURRENCIES, type CurrencyCode } from '../hooks/useCurrency';

const CURRENCY_FLAGS: Record<CurrencyCode, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', BTC: '₿', ETH: 'Ξ',
};

export default function CurrencySelector() {
  const { currency, setCurrency, isLoadingRates } = useCurrencyContext();

  return (
    <div className="relative flex items-center">
      {isLoadingRates && (
        <div className="absolute -left-5 w-3 h-3 rounded-full animate-spin" style={{ border: '1.5px solid rgba(17,17,17,0.1)', borderTopColor: 'var(--text-main)' }} />
      )}
      <select
        id="currency-selector"
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className="appearance-none cursor-pointer focus:outline-none transition-all text-sm font-semibold px-4 py-2 pr-8 rounded-full"
        style={{
          backgroundColor: 'rgba(17,17,17,0.07)',
          border: '1.5px solid rgba(17,17,17,0.1)',
          color: 'var(--text-main)',
          backgroundImage: 'none',
          letterSpacing: '-0.01em',
        }}
        title="Display currency"
      >
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
          <option key={code} value={code} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}>
            {CURRENCY_FLAGS[code]} {code}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
