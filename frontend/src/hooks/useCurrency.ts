/**
 * useCurrency hook — USD, EUR, GBP only (crypto removed)
 */

import { useState, useEffect, useCallback } from 'react';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export interface CurrencyInfo {
    code: CurrencyCode;
    symbol: string;
    name: string;
    decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
};

const FALLBACK_RATES: Record<CurrencyCode, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
};

export function useCurrency() {
    const [currency, setCurrency] = useState<CurrencyCode>('USD');
    const [rates, setRates] = useState<Record<CurrencyCode, number>>(FALLBACK_RATES);
    const [isLoadingRates, setIsLoadingRates] = useState(false);

    useEffect(() => {
        const fetchRates = async () => {
            setIsLoadingRates(true);
            try {
                const res = await fetch('https://open.er-api.com/v6/latest/USD');
                if (!res.ok) throw new Error('Rate API failed');
                const data = await res.json();
                setRates({
                    USD: 1,
                    EUR: data.rates?.EUR ?? FALLBACK_RATES.EUR,
                    GBP: data.rates?.GBP ?? FALLBACK_RATES.GBP,
                });
            } catch {
                // Keep fallback rates silently
            } finally {
                setIsLoadingRates(false);
            }
        };

        fetchRates();
        const interval = setInterval(fetchRates, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const convert = useCallback(
        (usdAmount: number): number => usdAmount * rates[currency],
        [currency, rates]
    );

    const format = useCallback(
        (usdAmount: number): string => {
            const info = CURRENCIES[currency];
            const converted = usdAmount * rates[currency];
            return `${info.symbol}${converted.toLocaleString('en-US', {
                minimumFractionDigits: info.decimals,
                maximumFractionDigits: info.decimals,
            })}`;
        },
        [currency, rates]
    );

    return { currency, setCurrency, currencyInfo: CURRENCIES[currency], rates, isLoadingRates, convert, format };
}
