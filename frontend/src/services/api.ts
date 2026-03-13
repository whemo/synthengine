import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  Asset,
  PortfolioInputData,
  PortfolioAnalysis,
  ApiError,
} from '../types';

const API_BASE_URL = '/api/v1';

/**
 * Convert snake_case keys to camelCase (recursive)
 */
function snakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Convert snake_case to camelCase (including numbers after underscore)
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = snakeToCamel(value);
  }
  return result;
}

/**
 * Create axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Error handler for API requests
 */
const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | any[] | Record<string, any>; message?: string }>;
    const responseData = axiosError.response?.data;
    
    // Handle Pydantic validation errors (422) - detail is an array of validation errors
    if (responseData?.detail && Array.isArray(responseData.detail)) {
      const validationErrors = responseData.detail.map((err: any) => err.msg || JSON.stringify(err));
      return {
        message: validationErrors.join('; '),
        status: axiosError.response?.status || 422,
        details: responseData.detail,
      };
    }
    
    // Handle string detail or other formats
    return {
      message: (typeof responseData?.detail === 'string' ? responseData.detail : responseData?.message) || axiosError.message,
      status: axiosError.response?.status || 500,
      details: responseData?.detail,
    };
  }
  return {
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    status: 500,
  };
};

/**
 * Get list of available assets
 */
export const getAssets = async (): Promise<Asset[]> => {
  try {
    const response = await apiClient.get<Asset[]>('/assets');
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Get price for a specific asset
 * @param symbol - Asset symbol (e.g., 'NVDAX', 'AAPLX')
 */
export const getPrice = async (symbol: string): Promise<{ symbol: string; price: number; timestamp: string }> => {
  try {
    const response = await apiClient.get<{ symbol: string; price: number; timestamp: string }>(`/price/${symbol}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Get volatility data for a specific asset
 * @param symbol - Asset symbol (e.g., 'NVDAX', 'AAPLX')
 */
export const getVolatility = async (symbol: string): Promise<{ symbol: string; volatility_24h: number; annualized_volatility: number }> => {
  try {
    const response = await apiClient.get<{ symbol: string; volatility_24h: number; annualized_volatility: number }>(`/volatility/${symbol}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Analyze portfolio risk and performance metrics
 * @param data - Portfolio input with capital, assets, and risk tolerance
 */
export const analyzePortfolio = async (data: PortfolioInputData): Promise<PortfolioAnalysis> => {
  try {
    // Convert camelCase to snake_case for backend compatibility
    const requestData: any = {
      mode: data.mode,
      assets: data.assets,
      risk_tolerance: data.riskTolerance,
    };
    
    if (data.mode === 'new') {
      requestData.capital = data.capital;
    } else {
      requestData.cash = data.cash;
      // Convert positions from {NVDAX: {shares: 5}} to {NVDAX: 5}
      if (data.positions) {
        requestData.positions = Object.fromEntries(
          Object.entries(data.positions).map(([k, v]) => [k, v.shares])
        );
      }
    }
    
    const response = await apiClient.post<PortfolioAnalysis>('/portfolio/analyze', requestData);
    // Convert snake_case response to camelCase
    return snakeToCamel(response.data) as PortfolioAnalysis;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Optimize portfolio using risk parity algorithm
 * @param data - Portfolio input data
 */
export const optimizePortfolio = async (data: PortfolioInputData): Promise<{ allocations: Array<{ symbol: string; weight: number; shares: number; value: number }> }> => {
  try {
    // Convert camelCase to snake_case for backend compatibility
    const requestData = {
      capital: data.capital,
      assets: data.assets,
      risk_tolerance: data.riskTolerance,
    };
    const response = await apiClient.post<{ allocations: Array<{ symbol: string; weight: number; shares: number; value: number }> }>('/portfolio/optimize', requestData);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Health check endpoint
 */
export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  try {
    const response = await apiClient.get<{ status: string; timestamp: string }>('/health');
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export default apiClient;
