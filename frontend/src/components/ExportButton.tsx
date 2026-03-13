/**
 * ExportButton — exports portfolio analysis as CSV or PDF report.
 */

import { useState } from 'react';
import jsPDF from 'jspdf';

interface ExportData {
    totalCapital: number;
    currency: string;
    timestamp: string;
    allocations: Array<{
        symbol: string;
        weight: number;
        value: number;
        currentWeight?: number;
    }>;
    riskMetrics: {
        sharpeRatio: number;
        volatility: number;
        maxDrawdown: number;
        var95: number;
        cvar95: number;
        diversificationRatio: number;
    };
    riskContributions: Array<{
        symbol: string;
        weight: number;
        volatility: number;
        riskContribution: number;
        value: number;
    }>;
    volatilityComparison?: Array<{
        symbol: string;
        synthVolatility: number;
        historicalVolatility: number;
    }>;
    formatCurrency: (v: number) => string;
}

interface Props {
    data: ExportData;
}

function downloadCsv(data: ExportData) {
    const rows: string[] = [];

    // Header info
    rows.push(`"Synth Risk Parity Portfolio Report"`);
    rows.push(`"Generated","${new Date(data.timestamp).toLocaleString()}"`);
    rows.push(`"Total Capital","${data.formatCurrency(data.totalCapital)}"`);
    rows.push(`"Currency","${data.currency}"`);
    rows.push('');

    // Risk Metrics
    rows.push('"RISK METRICS"');
    rows.push('"Metric","Value"');
    rows.push(`"Sharpe Ratio","${data.riskMetrics.sharpeRatio.toFixed(3)}"`);
    rows.push(`"Annualized Volatility","${(data.riskMetrics.volatility * 100).toFixed(2)}%"`);
    rows.push(`"Max Drawdown","${(data.riskMetrics.maxDrawdown * 100).toFixed(2)}%"`);
    rows.push(`"VaR 95%","${(data.riskMetrics.var95 * 100).toFixed(2)}%"`);
    rows.push(`"CVaR 95%","${(data.riskMetrics.cvar95 * 100).toFixed(2)}%"`);
    rows.push(`"Diversification Ratio","${data.riskMetrics.diversificationRatio.toFixed(3)}"`);
    rows.push('');

    // Allocations
    rows.push('"PORTFOLIO ALLOCATION"');
    rows.push('"Symbol","Target Weight","Value","Current Weight"');
    for (const a of data.allocations) {
        rows.push(`"${a.symbol}","${(a.weight * 100).toFixed(2)}%","${data.formatCurrency(a.value)}","${a.currentWeight !== undefined ? (a.currentWeight * 100).toFixed(2) + '%' : 'N/A'}"`);
    }
    rows.push('');

    // Risk Contributions
    rows.push('"RISK CONTRIBUTIONS"');
    rows.push('"Symbol","Weight","Volatility","Risk Contribution","Value"');
    for (const r of data.riskContributions) {
        rows.push(`"${r.symbol}","${(r.weight * 100).toFixed(2)}%","${(r.volatility * 100).toFixed(2)}%","${(r.riskContribution * 100).toFixed(2)}%","${data.formatCurrency(r.value)}"`);
    }
    rows.push('');

    // Volatility Comparison
    if (data.volatilityComparison && data.volatilityComparison.length > 0) {
        rows.push('"SYNTH AI vs HISTORICAL VOLATILITY"');
        rows.push('"Symbol","Synth AI Forecast","Realized (3m)","Difference"');
        for (const v of data.volatilityComparison) {
            const diff = v.synthVolatility - v.historicalVolatility;
            rows.push(`"${v.symbol}","${(v.synthVolatility * 100).toFixed(2)}%","${(v.historicalVolatility * 100).toFixed(2)}%","${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(2)}%"`);
        }
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `synth-portfolio-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadPdf(data: ExportData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W = 210;
    const MARGIN = 14;
    let y = 20;

    const section = (title: string) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(99, 102, 241);
        doc.setFont('helvetica', 'bold');
        doc.text(title, MARGIN, y);
        y += 6;
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 5;
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'normal');
    };

    const row = (label: string, value: string, indent = false) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(indent ? `  ${label}` : label, MARGIN, y);
        doc.setTextColor(20, 20, 20);
        doc.text(value, PAGE_W - MARGIN, y, { align: 'right' });
        y += 5.5;
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 60);
    doc.text('Synth Risk Parity', MARGIN, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 140);
    doc.text('Portfolio Analysis Report', MARGIN, y + 7);
    doc.setFontSize(8);
    doc.text(new Date(data.timestamp).toLocaleString(), PAGE_W - MARGIN, y + 7, { align: 'right' });
    y += 18;

    // Summary bar
    doc.setFillColor(240, 242, 255);
    doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, 16, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 120);
    doc.text('Total Portfolio Value', MARGIN + 4, y + 6);
    doc.text(data.formatCurrency(data.totalCapital), MARGIN + 4, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 140);
    doc.text(`Display Currency: ${data.currency}`, PAGE_W - MARGIN - 4, y + 9, { align: 'right' });
    y += 22;

    // Risk Metrics
    section('Risk Metrics');
    row('Sharpe Ratio', data.riskMetrics.sharpeRatio.toFixed(3));
    row('Annualized Volatility', `${(data.riskMetrics.volatility * 100).toFixed(2)}%`);
    row('Max Drawdown', `${(data.riskMetrics.maxDrawdown * 100).toFixed(2)}%`);
    row('Value at Risk (95%)', `${(data.riskMetrics.var95 * 100).toFixed(2)}%`);
    row('CVaR (95%)', `${(data.riskMetrics.cvar95 * 100).toFixed(2)}%`);
    row('Diversification Ratio', data.riskMetrics.diversificationRatio.toFixed(3));
    y += 4;

    // Allocations
    section('Portfolio Allocation');
    for (const a of data.allocations) {
        row(a.symbol, `${(a.weight * 100).toFixed(2)}%  |  ${data.formatCurrency(a.value)}`);
    }
    y += 4;

    // Risk contributions
    section('Risk Contributions');
    for (const r of data.riskContributions) {
        row(`${r.symbol}`, `vol ${(r.volatility * 100).toFixed(2)}%  ·  RC ${(r.riskContribution * 100).toFixed(2)}%`);
    }
    y += 4;

    // Volatility comparison
    if (data.volatilityComparison && data.volatilityComparison.length > 0) {
        section('Synth AI vs Realized Volatility');
        for (const v of data.volatilityComparison) {
            const diff = v.synthVolatility - v.historicalVolatility;
            row(
                v.symbol,
                `Synth ${(v.synthVolatility * 100).toFixed(2)}%  ·  Hist ${(v.historicalVolatility * 100).toFixed(2)}%  ·  d ${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(2)}%`
            );
        }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Synth Risk Parity — ${new Date().toLocaleDateString()}  |  Page ${i}/${pageCount}`, PAGE_W / 2, 292, { align: 'center' });
    }

    doc.save(`synth-portfolio-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function ExportButton({ data }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all"
                style={{ backgroundColor: 'var(--accent-black)', color: '#ffffff', border: 'none', letterSpacing: '-0.01em' }}
            >
                Export Terminal
                <svg className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-11 z-20 overflow-hidden min-w-[200px]" style={{ background: 'var(--bg-card)', border: '1px solid rgba(17,17,17,0.1)', borderRadius: '20px', boxShadow: '0 8px 32px rgba(17,17,17,0.1)' }}>
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(17,17,17,0.06)' }}>
                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Select Format</p>
                        </div>
                        <button
                            onClick={() => { downloadCsv(data); setOpen(false); }}
                            className="w-full px-4 py-3.5 text-left text-sm font-semibold flex items-center justify-between group hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--text-main)' }}
                        >
                            <span>CSV Ledger</span>
                            <span style={{ color: 'var(--text-muted)' }}>↓</span>
                        </button>
                        <button
                            onClick={() => { downloadPdf(data); setOpen(false); }}
                            className="w-full px-4 py-3.5 text-left text-sm font-semibold flex items-center justify-between group hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--text-main)', borderTop: '1px solid rgba(17,17,17,0.06)' }}
                        >
                            <span>PDF Report</span>
                            <span style={{ color: 'var(--text-muted)' }}>↓</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
