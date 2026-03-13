/**
 * CurrencyContext — provides currency state to all components.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useCurrency, type CurrencyCode } from '../hooks/useCurrency';
import type { CurrencyInfo } from '../hooks/useCurrency';

interface CurrencyContextValue {
    currency: CurrencyCode;
    setCurrency: (c: CurrencyCode) => void;
    currencyInfo: CurrencyInfo;
    format: (usdAmount: number) => string;
    convert: (usdAmount: number) => number;
    isLoadingRates: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const value = useCurrency();
    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrencyContext(): CurrencyContextValue {
    const ctx = useContext(CurrencyContext);
    if (!ctx) throw new Error('useCurrencyContext must be used inside CurrencyProvider');
    return ctx;
}
