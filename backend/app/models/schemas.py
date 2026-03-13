"""
Pydantic schemas for Synth Risk Parity Portfolio Engine.

Provides request/response models for portfolio analysis, risk calculations,
and investment recommendations.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Request Schemas
# =============================================================================


class PortfolioRequest(BaseModel):
    """Request model for portfolio analysis and optimization."""

    model_config = ConfigDict(populate_by_name=True)

    # Portfolio mode: 'new' (fresh capital) or 'existing' (rebalance)
    mode: Literal["new", "existing"] = "new"
    
    # For 'new' mode: capital to invest
    capital: float | None = Field(
        default=None,
        gt=0,
        description="Total capital available for investment in USD (for new portfolios)"
    )
    
    # For 'existing' mode: current positions
    positions: dict[str, int] | None = Field(
        default=None,
        description="Current share positions for each asset (for existing portfolios)"
    )
    cash: float | None = Field(
        default=0,
        ge=0,
        description="Available cash for existing portfolios"
    )
    
    # Common fields
    assets: list[str] = Field(
        ...,
        min_length=1,
        description="List of asset symbols to include in the portfolio"
    )
    risk_tolerance: Literal["low", "medium", "high"] = Field(
        ...,
        description="Investor risk tolerance level affecting allocation strategy"
    )


class AssetRequest(BaseModel):
    """Request model for single asset operations."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Asset symbol (e.g., 'BTC', 'ETH')"
    )


# =============================================================================
# Response Schemas - Basic Data
# =============================================================================


class PriceResponse(BaseModel):
    """Response model for asset price data."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    price: float = Field(..., gt=0, description="Current price in USD")
    timestamp: datetime = Field(..., description="Price timestamp in UTC")


class VolatilityResponse(BaseModel):
    """Response model for asset volatility metrics."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    volatility_24h: float = Field(
        ...,
        ge=0,
        description="24-hour historical volatility as decimal (e.g., 0.05 for 5%)"
    )
    annualized_volatility: float = Field(
        ...,
        ge=0,
        description="Annualized volatility as decimal"
    )


class PercentilesResponse(BaseModel):
    """Response model for price distribution percentiles."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    p5: float = Field(..., description="5th percentile price")
    p10: float = Field(..., description="10th percentile price")
    p25: float = Field(..., description="25th percentile price")
    p50: float = Field(..., description="50th percentile price (median)")
    p75: float = Field(..., description="75th percentile price")
    p90: float = Field(..., description="90th percentile price")
    p95: float = Field(..., description="95th percentile price")


# =============================================================================
# Response Schemas - Portfolio Analysis
# =============================================================================


class AllocationResponse(BaseModel):
    """Response model for portfolio allocation per asset."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    weight: float = Field(
        ...,
        ge=0,
        le=1,
        description="Target portfolio weight as decimal (0.0 to 1.0)"
    )
    current_weight: float | None = Field(
        default=None,
        description="Current portfolio weight as decimal (for existing portfolios)"
    )
    shares: float = Field(
        default=0,
        ge=0,
        description="Number of shares/units to purchase (0 for CASH)"
    )
    value: float = Field(
        ...,
        gt=0,
        description="Allocated value in USD"
    )


class RiskContributionResponse(BaseModel):
    """Response model for risk contribution per asset."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    risk_contribution: float = Field(
        ...,
        ge=0,
        description="Asset's contribution to total portfolio risk as decimal"
    )
    weight: float = Field(
        ...,
        ge=0,
        le=1,
        description="Asset weight in portfolio as decimal"
    )
    volatility: float = Field(
        ...,
        ge=0,
        description="Asset's individual volatility as decimal"
    )


class RiskMetricsResponse(BaseModel):
    """Response model for overall portfolio risk metrics."""

    model_config = ConfigDict(populate_by_name=True)

    portfolio_volatility: float = Field(
        ...,
        ge=0,
        description="Total portfolio volatility (annualized) as decimal"
    )
    var_95: float = Field(
        ...,
        description="Value at Risk at 95% confidence level (daily, as decimal)"
    )
    cvar_95: float = Field(
        ...,
        description="Conditional Value at Risk at 95% confidence level (expected shortfall)"
    )
    max_drawdown: float = Field(
        ...,
        ge=-1,
        le=0,
        description="Maximum historical drawdown as decimal (negative value)"
    )
    sharpe_ratio: float = Field(
        ...,
        description="Sharpe ratio (risk-adjusted return metric)"
    )


# =============================================================================
# Response Schemas - Simulation & Recommendations
# =============================================================================


class MonteCarloResponse(BaseModel):
    """Response model for Monte Carlo simulation results."""

    model_config = ConfigDict(populate_by_name=True)

    simulations_count: int = Field(
        ...,
        gt=0,
        description="Number of simulation paths generated"
    )
    mean_return: float = Field(
        ...,
        description="Mean expected return from simulations as decimal"
    )
    std_return: float = Field(
        ...,
        ge=0,
        description="Standard deviation of returns as decimal"
    )
    min_return: float = Field(
        ...,
        description="Minimum return observed across all simulations as decimal"
    )
    max_return: float = Field(
        ...,
        description="Maximum return observed across all simulations as decimal"
    )
    percentile_5: float = Field(
        ...,
        description="5th percentile of simulated returns (worst case scenario)"
    )
    percentile_95: float = Field(
        ...,
        description="95th percentile of simulated returns (best case scenario)"
    )
    paths: list[list[float]] = Field(
        ...,
        description="Sample of simulated price paths (cumulative returns)"
    )


class RecommendationResponse(BaseModel):
    """Response model for investment recommendations."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    action: Literal["BUY", "SELL", "HOLD", "ALLOCATE"] = Field(
        ...,
        description="Recommended action for this asset"
    )
    reason: str = Field(
        ...,
        description="Explanation for the recommendation"
    )
    target_weight: float = Field(
        ...,
        ge=0,
        le=1,
        description="Target portfolio weight as decimal"
    )
    current_weight: float | None = Field(
        default=None,
        description="Current portfolio weight if available (None for new positions)"
    )


# =============================================================================
# Complete Portfolio Analysis Response
# =============================================================================


class VolatilityComparisonItem(BaseModel):
    """Per-asset comparison of Synth AI vs historical volatility."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., description="Asset symbol")
    synth_volatility: float = Field(
        ...,
        ge=0,
        description="Synth AI predicted volatility (annualized decimal)",
    )
    historical_volatility: float = Field(
        ...,
        ge=0,
        description="Historical volatility from Yahoo Finance (annualized decimal)",
    )
    source: str = Field(
        ...,
        description="Source of synth volatility: 'percentiles' or 'synth_api'",
    )


class PortfolioAnalysisResponse(BaseModel):
    """
    Complete response model for portfolio analysis.
    
    Contains allocations, risk metrics, Monte Carlo simulations,
    and actionable recommendations for risk parity portfolio construction.
    """

    model_config = ConfigDict(populate_by_name=True)

    allocations: list[AllocationResponse] = Field(
        ...,
        description="Optimal allocation for each asset in the portfolio"
    )
    risk_contributions: list[RiskContributionResponse] = Field(
        ...,
        description="Risk contribution breakdown per asset"
    )
    risk_metrics: RiskMetricsResponse = Field(
        ...,
        description="Overall portfolio risk metrics"
    )
    monte_carlo: MonteCarloResponse = Field(
        ...,
        description="Monte Carlo simulation results for portfolio performance"
    )
    recommendations: list[RecommendationResponse] = Field(
        ...,
        description="Actionable investment recommendations per asset"
    )
    volatility_comparison: list[VolatilityComparisonItem] = Field(
        default=[],
        description="Per-asset Synth AI vs historical volatility comparison"
    )
    total_capital: float = Field(
        ...,
        gt=0,
        description="Total capital allocated to the portfolio in USD"
    )
    timestamp: datetime = Field(
        ...,
        description="Analysis timestamp in UTC"
    )
    benchmark: "BenchmarkData | None" = Field(
        default=None,
        description="S&P 500 benchmark comparison data"
    )
    historical_performance: "HistoricalPerformanceData | None" = Field(
        default=None,
        description="1-year historical portfolio performance simulation"
    )


class BenchmarkData(BaseModel):
    """S&P 500 benchmark comparison for the portfolio."""

    model_config = ConfigDict(populate_by_name=True)

    sp500_1y_return: float = Field(
        ...,
        description="S&P 500 1-year total return (decimal, e.g. 0.25 = 25%)"
    )
    sp500_current_price: float = Field(
        ...,
        description="Current S&P 500 (SPY) price"
    )
    sp500_1y_ago_price: float = Field(
        ...,
        description="S&P 500 (SPY) price 1 year ago"
    )
    portfolio_1y_return: float = Field(
        ...,
        description="Estimated portfolio 1-year return based on weighted asset returns"
    )
    outperformance: float = Field(
        ...,
        description="Portfolio return minus S&P 500 return (positive = outperformed)"
    )


class HistoricalDataPoint(BaseModel):
    """A single date/value point for historical performance charts."""

    model_config = ConfigDict(populate_by_name=True)

    date: str = Field(..., description="Date in YYYY-MM-DD format")
    value: float = Field(..., description="Normalized portfolio value (starting at 1.0)")
    sp500_value: float = Field(..., description="Normalized S&P 500 value (starting at 1.0)")


class AssetHistoricalReturn(BaseModel):
    """1-year return for a single asset."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str
    return_1y: float
    start_price: float
    end_price: float


class HistoricalPerformanceData(BaseModel):
    """Historical 1-year portfolio performance simulation."""

    model_config = ConfigDict(populate_by_name=True)

    data_points: list[HistoricalDataPoint] = Field(
        default=[],
        description="Time series of normalized portfolio and S&P 500 values over 1 year"
    )
    asset_returns: list[AssetHistoricalReturn] = Field(
        default=[],
        description="Individual 1-year return for each asset"
    )
    portfolio_final_value: float = Field(
        ...,
        description="Portfolio value if $10,000 was invested 1 year ago"
    )
    sp500_final_value: float = Field(
        ...,
        description="S&P 500 value if $10,000 was invested 1 year ago"
    )
