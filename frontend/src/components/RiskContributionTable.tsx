import React from 'react';

export interface RiskContributionData {
  symbol: string;
  weight: number;
  volatility: number;
  riskContribution: number;
  value: number;
}

interface RiskContributionTableProps {
  riskContributions: RiskContributionData[];
  title?: string;
  formatCurrency?: (v: number) => string;
}

const formatPercent = (value: number): string => {
  return value.toFixed(1);
};



const getAssetIcon = (symbol: string): string => {
  const iconMap: Record<string, string> = {
    BTC: '₿',
    ETH: 'Ξ',
    SOL: '◎',
    USDT: '₮',
    USDC: '$',
    BNB: '🅱',
    XRP: '✕',
    ADA: '₳',
    DOGE: 'Ð',
    MATIC: '🟣',
    DOT: '●',
    AVAX: '🔺',
    LINK: '⬡',
    UNI: '🦄',
    AAPL: '🍎',
    GOOGL: '🔍',
    MSFT: '🪟',
    AMZN: '📦',
    TSLA: '🚗',
    NVDA: '🎮',
    META: '👍',
    NFLX: '🎬',
  };

  return iconMap[symbol.toUpperCase()] ?? '●';
};

const getRiskColor = (contribution: number): string => {
  if (contribution >= 20) return 'text-red-400';
  if (contribution >= 10) return 'text-yellow-400';
  return 'text-green-400';
};

export const RiskContributionTable: React.FC<RiskContributionTableProps> = ({
  riskContributions,
  title = 'Risk Contribution Analysis',
  formatCurrency: fmtCurrency,
}) => {
  const fmt = fmtCurrency ?? ((v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
  if (!riskContributions || riskContributions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <svg
            className="w-16 h-16 mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-center">No risk contribution data available</p>
          <p className="text-sm mt-1">Add assets to your portfolio to see the analysis</p>
        </div>
      </div>
    );
  }

  const totalRisk = riskContributions.reduce(
    (sum, item) => sum + item.riskContribution,
    0
  );

  // Normalize risk contribution to show percentage of total risk (should sum to 100%)
  const normalizeRiskContribution = (riskContribution: number): number => {
    if (totalRisk === 0) return 0;
    return (riskContribution / totalRisk) * 100;
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          <span className="text-gray-400">
            Total:{' '}
            <span className="text-gray-200 font-medium">100.00%</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-950/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Asset
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Weight (%)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Volatility (%)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Risk Contribution (%)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Value ($)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {riskContributions.map((item, index) => (
              <tr
                key={item.symbol}
                className={`
                  transition-colors duration-150 hover:bg-gray-800/50
                  ${index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'}
                `}
              >
                {/* Asset */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg">
                      {getAssetIcon(item.symbol)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-100">
                        {item.symbol}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Weight */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-300 font-mono">
                    {formatPercent(item.weight * 100)}
                  </span>
                </td>

                {/* Volatility */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-300 font-mono">
                    {formatPercent(item.volatility * 100)}
                  </span>
                </td>

                {/* Risk Contribution */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`text-sm font-medium font-mono ${getRiskColor(normalizeRiskContribution(item.riskContribution))}`}>
                    {formatPercent(normalizeRiskContribution(item.riskContribution))}
                  </span>
                </td>

                {/* Value */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-300 font-mono">
                    {fmt(item.value)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="px-6 py-4 bg-gray-950/30 border-t border-gray-800">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            {riskContributions.length} {riskContributions.length === 1 ? 'asset' : 'assets'}
          </span>
          <span className="text-gray-400">
            Total Value:{' '}
            <span className="text-gray-200 font-medium">
              {fmt(riskContributions.reduce((sum, item) => sum + item.value, 0))}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default RiskContributionTable;
