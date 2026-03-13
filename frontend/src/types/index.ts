/**
 * Asset-related types
 */
export interface Asset {
  symbol: string;
  name: string;
  assetClass: string;
  sector?: string;
}

export interface AssetPrice {
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
}

export interface AssetVolatility {
  symbol: string;
  volatility: number;
  period: string;
  annualized: boolean;
}

/**
 * Portfolio Input types
 */
export interface PortfolioPosition {
  shares: number;
}

export interface PortfolioInputData {
  mode?: 'new' | 'existing';
  capital?: number;
  positions?: {
    [asset: string]: PortfolioPosition;
  };
  cash?: number;
  assets: string[];
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * Portfolio Analysis types
 */
export interface AllocationData {
  symbol: string;
  weight: number;
  currentWeight?: number;
  value: number;
  shares?: number;
}

export interface RiskContributionData {
  symbol: string;
  weight: number;
  volatility: number;
  riskContribution: number;
  value: number;
}

export interface RiskMetricsData {
  portfolioVolatility: number;
  var95: number;
  cvar95: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface RecommendationData {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ALLOCATE';
  reason: string;
  targetWeight: number;
  currentWeight?: number;
}

export interface MonteCarloData {
  simulationsCount: number;
  meanReturn: number;
  stdReturn: number;
  minReturn: number;
  maxReturn: number;
  percentile5: number;
  percentile95: number;
  paths: number[][];
}

export interface VolatilityComparisonData {
  symbol: string;
  synthVolatility: number;
  historicalVolatility: number;
  source: string;
}

export interface BenchmarkData {
  sp5001yReturn: number;
  sp500CurrentPrice: number;
  sp5001yAgoPrice: number;
  portfolio1yReturn: number;
  outperformance: number;
}

export interface HistoricalDataPoint {
  date: string;
  value: number;
  sp500Value: number;
}

export interface AssetHistoricalReturn {
  symbol: string;
  return1y: number;
  startPrice: number;
  endPrice: number;
}

export interface HistoricalPerformanceData {
  dataPoints: HistoricalDataPoint[];
  assetReturns: AssetHistoricalReturn[];
  portfolioFinalValue: number;
  sp500FinalValue: number;
}

export interface PortfolioAnalysis {
  totalCapital: number;
  allocations: AllocationData[];
  riskContributions: RiskContributionData[];
  riskMetrics: RiskMetricsData;
  monteCarlo: MonteCarloData;
  recommendations: RecommendationData[];
  volatilityComparison: VolatilityComparisonData[];
  benchmark?: BenchmarkData;
  historicalPerformance?: HistoricalPerformanceData;
  timestamp: string;
}

/**
 * Optimization types
 */
export interface OptimizationRequest {
  assets: string[];
  targetReturn?: number;
  maxRisk?: number;
  constraints?: OptimizationConstraints;
}

export interface OptimizationConstraints {
  minWeight?: number;
  maxWeight?: number;
  maxConcentration?: number;
  allowedAssetClasses?: string[];
}

export interface OptimizationResult {
  optimalWeights: PortfolioPosition[];
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  diversificationRatio: number;
  rebalancingTrades?: RebalancingTrade[];
}

export interface RebalancingTrade {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  change: number;
  action: 'BUY' | 'SELL';
}

/**
 * API Response types
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  details?: string | any[] | Record<string, any>;
}

/**
 * Chart data types
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface RiskParityChartData {
  name: string;
  weight: number;
  riskContribution: number;
}
