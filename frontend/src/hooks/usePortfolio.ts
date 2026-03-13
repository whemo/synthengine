import { useState, useCallback } from 'react';
import type { PortfolioInputData, PortfolioAnalysis, ApiError } from '../types';
import { analyzePortfolio as apiAnalyzePortfolio } from '../services/api';

/**
 * State interface for portfolio hook
 */
interface UsePortfolioState {
  portfolioData: PortfolioInputData | null;
  analysis: PortfolioAnalysis | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Return type for usePortfolio hook
 */
interface UsePortfolioReturn {
  portfolioData: PortfolioInputData | null;
  analysis: PortfolioAnalysis | null;
  isLoading: boolean;
  error: string | null;
  analyzePortfolio: (data: PortfolioInputData) => Promise<void>;
  resetAnalysis: () => void;
  clearError: () => void;
}

/**
 * Custom React hook for managing portfolio state and API requests
 * Handles full lifecycle of portfolio analysis including loading states and error handling
 */
export const usePortfolio = (): UsePortfolioReturn => {
  const [state, setState] = useState<UsePortfolioState>({
    portfolioData: null,
    analysis: null,
    isLoading: false,
    error: null,
  });

  /**
   * Analyze portfolio by sending data to backend
   * @param data - Portfolio input data with capital, assets, and risk tolerance
   */
  const analyzePortfolio = useCallback(async (data: PortfolioInputData): Promise<void> => {
    console.log('[usePortfolio] Sending request:', JSON.stringify(data, null, 2));
    
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      portfolioData: data,
    }));

    try {
      const analysis = await apiAnalyzePortfolio(data);
      console.log('[usePortfolio] Received response:', analysis);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        analysis,
        portfolioData: data,
      }));
    } catch (error) {
      console.error('[usePortfolio] Error:', error);
      let errorMessage = 'Failed to analyze portfolio';
      
      if (error && typeof error === 'object' && 'message' in error) {
        const apiError = error as ApiError;
        
        // Handle Pydantic validation errors (422)
        if (apiError.details && Array.isArray(apiError.details)) {
          // Extract error messages from Pydantic validation errors
          const validationErrors = apiError.details.map(detail => {
            if (typeof detail === 'object' && detail !== null) {
              // Pydantic error format: {type, loc, msg, input}
              return (detail as any).msg || JSON.stringify(detail);
            }
            return String(detail);
          });
          errorMessage = validationErrors.join('; ');
        } else if (apiError.details && typeof apiError.details === 'object') {
          // Handle detail object
          errorMessage = JSON.stringify(apiError.details);
        } else if (apiError.details && typeof apiError.details === 'string') {
          errorMessage = apiError.details;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        analysis: null,
      }));
    }
  }, []);

  /**
   * Reset analysis results and portfolio data
   */
  const resetAnalysis = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      portfolioData: null,
      analysis: null,
      error: null,
    }));
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    portfolioData: state.portfolioData,
    analysis: state.analysis,
    isLoading: state.isLoading,
    error: state.error,
    analyzePortfolio,
    resetAnalysis,
    clearError,
  };
};

export default usePortfolio;
