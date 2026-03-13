/**
 * SectorExposureChart — shows portfolio allocation grouped by sector.
 * Highlights concentration risk when one sector dominates the portfolio.
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

/* Hardcoded sector mapping for known assets */
const ASSET_SECTOR: Record<string, { sector: string; emoji: string }> = {
    // Synth synthetic equities
    NVDAX: { sector: 'Technology', emoji: '•' },
    AAPLX: { sector: 'Technology', emoji: '•' },
    GOOGLX: { sector: 'Technology', emoji: '•' },
    TSLAX: { sector: 'Consumer', emoji: '•' },
    SPYX: { sector: 'Broad Market', emoji: '•' },
    // Common real equities
    NVDA: { sector: 'Technology', emoji: '•' },
    AAPL: { sector: 'Technology', emoji: '•' },
    MSFT: { sector: 'Technology', emoji: '•' },
    GOOGL: { sector: 'Technology', emoji: '•' },
    AMZN: { sector: 'Consumer', emoji: '•' },
    TSLA: { sector: 'Consumer', emoji: '•' },
    META: { sector: 'Technology', emoji: '•' },
    NFLX: { sector: 'Communications', emoji: '•' },
    BRK: { sector: 'Finance', emoji: '•' },
    JPM: { sector: 'Finance', emoji: '•' },
    BAC: { sector: 'Finance', emoji: '•' },
    XOM: { sector: 'Energy', emoji: '•' },
    CVX: { sector: 'Energy', emoji: '•' },
    JNJ: { sector: 'Healthcare', emoji: '•' },
    PFE: { sector: 'Healthcare', emoji: '•' },
    // Crypto
    BTC: { sector: 'Crypto', emoji: '₿' },
    ETH: { sector: 'Crypto', emoji: 'Ξ' },
    SOL: { sector: 'Crypto', emoji: '◎' },
};

const SECTOR_COLORS: Record<string, string> = {
    'Technology': '#3B82F6',
    'Consumer': '#F59E0B',
    'Finance': '#10B981',
    'Healthcare': '#EC4899',
    'Energy': '#F97316',
    'Crypto': '#8B5CF6',
    'Communications': '#06B6D4',
    'Broad Market': '#64748B',
    'Other': '#94A3B8',
};

const GRADIENTS = [
    { id: 'grad-sector-0', start: '#3B82F6', end: '#1e3a8a' },
    { id: 'grad-sector-1', start: '#F59E0B', end: '#78350f' },
    { id: 'grad-sector-2', start: '#10B981', end: '#064e3b' },
    { id: 'grad-sector-3', start: '#EC4899', end: '#831843' },
    { id: 'grad-sector-4', start: '#F97316', end: '#7c2d12' },
];

interface Props {
    allocations: Array<{ symbol: string; weight: number }>;
}

interface SectorData {
    sector: string;
    weight: number;
    assets: string[];
    emoji: string;
    color: string;
}

const CustomTooltip = ({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ payload: SectorData }>;
}) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-2 shadow-2xl">
            <p className="text-white font-bold text-[10px] mb-1">
                {d.emoji} {d.sector}
            </p>
            <p className="text-xl font-bold mb-1" style={{ color: d.color }}>
                {(d.weight * 100).toFixed(1)}%
            </p>
            <p className="text-white/20 text-[8px] font-bold uppercase tracking-tight">{d.assets.join(' · ')}</p>
        </div>
    );
};

export default function SectorExposureChart({ allocations }: Props) {
    if (!allocations || allocations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px]">
                <div className="w-16 h-16 bg-white/[0.02] border border-white/5 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    </svg>
                </div>
                <p className="text-white/20 font-bold uppercase tracking-[0.2em] text-[10px]">No Sector Data</p>
            </div>
        );
    }

    // Group allocations by sector
    const sectorMap: Record<string, { weight: number; assets: string[]; emoji: string }> = {};
    for (const alloc of allocations) {
        const meta = ASSET_SECTOR[alloc.symbol.toUpperCase()] ?? { sector: 'Other', emoji: '•' };
        if (!sectorMap[meta.sector]) {
            sectorMap[meta.sector] = { weight: 0, assets: [], emoji: meta.emoji };
        }
        sectorMap[meta.sector].weight += alloc.weight;
        sectorMap[meta.sector].assets.push(alloc.symbol);
    }

    const data: SectorData[] = Object.entries(sectorMap)
        .map(([sector, info]) => ({
            sector,
            weight: info.weight,
            assets: info.assets,
            emoji: info.emoji,
            color: SECTOR_COLORS[sector] ?? SECTOR_COLORS['Other'],
        }))
        .sort((a, b) => b.weight - a.weight);

    const topSector = data[0];
    const totalSectors = data.length;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="mb-6 pb-4 border-b border-white/5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-2">Cluster Distribution</h3>
                        <div className="flex items-center gap-3">
                            <p className="text-2xl font-bold tracking-tight text-white">
                                {topSector.emoji} {topSector.sector}
                            </p>
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                                Dominant ({(topSector.weight * 100).toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-white/30 tracking-tight">
                            {totalSectors} Sectors
                        </p>
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Diversification</span>
                    </div>
                </div>
            </div>

            {/* Content - Two columns with centered pie chart */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {/* Left column - sectors list */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/5">
                    {data.map((entry) => (
                        <div key={entry.sector} className="group cursor-default">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full shadow-lg"
                                        style={{ backgroundColor: entry.color, boxShadow: `0 0 10px ${entry.color}40` }}
                                    />
                                    <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-tight">
                                        {entry.emoji} {entry.sector}
                                    </span>
                                </div>
                                <span
                                    className="text-xs sm:text-sm font-bold tracking-tight"
                                    style={{ color: entry.color }}
                                >
                                    {(entry.weight * 100).toFixed(1)}%
                                </span>
                            </div>

                            <div className="h-[3px] bg-white/5 rounded-full overflow-hidden mb-1">
                                <div
                                    className="h-full transition-all duration-700"
                                    style={{
                                        width: `${entry.weight * 100}%`,
                                        backgroundColor: entry.color,
                                    }}
                                />
                            </div>
                            <p className="text-white/20 text-[9px] sm:text-[10px] font-medium uppercase tracking-widest group-hover:text-white/40 transition-colors">
                                {entry.assets.join(' · ')}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Right column - Pie Chart centered */}
                <div className="flex items-center justify-center">
                    <div className="w-[280px] h-[280px] flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                {GRADIENTS.map(g => (
                                    <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={g.start} stopOpacity={0.9} />
                                        <stop offset="95%" stopColor={g.end} stopOpacity={0.3} />
                                    </linearGradient>
                                ))}
                                {/* Glow filters */}
                                <filter id="sector-glow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={95}
                                paddingAngle={5}
                                dataKey="weight"
                                nameKey="sector"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth={2}
                                filter="url(#sector-glow)"
                            >
                                {data.map((_, index) => (
                                    <Cell key={index} fill={`url(#grad-sector-${index % GRADIENTS.length})`} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
