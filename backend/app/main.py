"""
FastAPI application for Synth Risk Parity Portfolio Engine.

Provides REST API endpoints for portfolio analysis, optimization,
risk metrics, and Monte Carlo simulations.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Final

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import Field
from pydantic_settings import BaseSettings

from app.models.schemas import (
    AllocationResponse,
    AssetHistoricalReturn,
    BenchmarkData,
    HistoricalDataPoint,
    HistoricalPerformanceData,
    MonteCarloResponse,
    PortfolioAnalysisResponse,
    PortfolioRequest,
    PriceResponse,
    RecommendationResponse,
    RiskContributionResponse,
    RiskMetricsResponse,
    VolatilityComparisonItem,
    VolatilityResponse,
)
from app.services.optimizer import PortfolioOptimizer, RiskTolerance
from app.services.price_client import PriceClient, PriceClientError
from app.services.risk_engine import RiskEngine
from app.services.synth_client import (
    SUPPORTED_ASSETS,
    SynthClient,
    SynthAPIError,
    SynthAssetNotFoundError,
    SynthHTTPError,
    SynthTimeoutError,
)

# =============================================================================
# Configuration
# =============================================================================


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    synth_api_key: str = Field(
        default="",
        description="Synth API key for fetching predictions and volatility"
    )
    synth_api_base_url: str = Field(
        default="https://api.synthdata.co",
        description="Synth API base URL"
    )

    # CORS Configuration
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Allowed CORS origins"
    )
    cors_allow_credentials: bool = Field(
        default=True,
        description="Allow credentials in CORS requests"
    )
    cors_allow_methods: list[str] = Field(
        default=["*"],
        description="Allowed HTTP methods in CORS"
    )
    cors_allow_headers: list[str] = Field(
        default=["*"],
        description="Allowed HTTP headers in CORS"
    )

    # Application Configuration
    debug: bool = Field(
        default=False,
        description="Enable debug mode"
    )
    request_timeout: float = Field(
        default=30.0,
        description="Request timeout in seconds"
    )

    # Monte Carlo Configuration
    monte_carlo_simulations: int = Field(
        default=1000,
        alias="DEFAULT_SIMULATIONS",
        description="Default number of Monte Carlo simulations"
    )
    monte_carlo_days: int = Field(
        default=7,
        alias="DEFAULT_DAYS",
        description="Default number of days for Monte Carlo simulation"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True
        extra = "ignore"


# Initialize settings
settings = Settings()

# =============================================================================
# Logging Configuration
# =============================================================================

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

# =============================================================================
# FastAPI Application
# =============================================================================

API_VERSION: Final[str] = "v1"
API_PREFIX: Final[str] = f"/api/{API_VERSION}"

app = FastAPI(
    title="Synth Risk Parity Portfolio Engine",
    description=(
        "API for portfolio analysis and optimization using Risk Parity strategy. "
        "Provides asset prices, volatility forecasts, portfolio optimization, "
        "risk metrics, and Monte Carlo simulations."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# =============================================================================
# Service Clients (Singleton Pattern)
# =============================================================================

# Price client for fetching current and historical prices
price_client = PriceClient(timeout=settings.request_timeout)

# Risk engine for calculating risk metrics
risk_engine = RiskEngine(seed=42)  # Fixed seed for reproducibility


def get_synth_client() -> SynthClient:
    """
    Create a new SynthClient instance.

    Returns:
        Configured SynthClient instance.

    Raises:
        HTTPException: If API key is not configured.
    """
    if not settings.synth_api_key:
        logger.error("Synth API key not configured")
        raise HTTPException(
            status_code=500,
            detail="Synth API key not configured. Please set SYNTH_API_KEY environment variable."
        )
    return SynthClient(
        api_key=settings.synth_api_key,
        base_url=settings.synth_api_base_url,
        timeout=settings.request_timeout,
    )


# =============================================================================
# Helper Functions
# =============================================================================


def map_risk_tolerance(risk_tolerance: str) -> RiskTolerance:
    """
    Map string risk tolerance to RiskTolerance enum.

    Args:
        risk_tolerance: String representation ("low", "medium", "high").

    Returns:
        RiskTolerance enum value.
    """
    mapping = {
        "low": RiskTolerance.LOW,
        "medium": RiskTolerance.MEDIUM,
        "high": RiskTolerance.HIGH,
    }
    return mapping.get(risk_tolerance.lower(), RiskTolerance.MEDIUM)


def generate_recommendations(
    assets: list[str],
    weights: dict[str, float],
    volatilities: dict[str, float],
    prices: dict[str, float],
    current_weights: dict[str, float] | None = None,
    total_capital: float = 0,
) -> list[RecommendationResponse]:
    """
    Generate BUY/SELL/HOLD/ALLOCATE recommendations based on portfolio mode.
    
    For new portfolios: Shows ALLOCATE recommendations.
    For existing portfolios: Shows BUY/SELL/HOLD based on current vs target weights.

    Args:
        assets: List of asset symbols.
        weights: Target portfolio weights.
        volatilities: Asset volatilities.
        prices: Current asset prices.
        current_weights: Current portfolio weights (None for new portfolios).
        total_capital: Total portfolio value.

    Returns:
        List of RecommendationResponse objects.
    """
    recommendations: list[RecommendationResponse] = []

    for asset in assets:
        target_weight = weights.get(asset, 0)
        current_weight = current_weights.get(asset, 0) if current_weights else None
        price = prices.get(asset, 0)
        
        # Calculate shares
        target_shares = int((total_capital * target_weight) / price) if price > 0 else 0
        current_shares = int((total_capital * (current_weight or 0)) / price) if price > 0 and current_weight else 0
        shares_to_trade = target_shares - current_shares
        
        if current_weights is None:
            # New Portfolio — ALLOCATE only (initial purchase, no existing positions)
            action = "ALLOCATE"
            reason = f"Allocate {target_weight:.1%} of portfolio ({target_shares} shares)"
        else:
            # Existing Portfolio — compare current vs target
            weight_diff = target_weight - (current_weight or 0)

            if abs(weight_diff) < 0.03:
                # Within 3% threshold — HOLD
                action = "HOLD"
                reason = f"Current weight ({current_weight:.1%}) is close to target ({target_weight:.1%}). No rebalancing needed."
            elif weight_diff < -0.03:
                # Need to reduce — SELL
                action = "SELL"
                reason = f"Reduce position from {current_weight:.1%} to {target_weight:.1%}. Sell {abs(shares_to_trade)} shares."
            else:
                # Need to increase — BUY
                action = "BUY"
                reason = f"Increase position from {current_weight:.1%} to {target_weight:.1%}. Buy {shares_to_trade} shares."

        recommendations.append(
            RecommendationResponse(
                symbol=asset,
                action=action,
                reason=reason,
                target_weight=round(target_weight, 4),
                current_weight=round(current_weight, 4) if current_weight is not None else None,
            )
        )

    return recommendations


# =============================================================================
# Health Check Endpoints
# =============================================================================


@app.get(
    f"{API_PREFIX}/health",
    summary="Health Check",
    description="Check if the API service is running and healthy.",
    tags=["Health"],
)
async def health_check() -> dict[str, str]:
    """
    Health check endpoint.

    Returns:
        Simple status response indicating service health.
    """
    logger.debug("Health check requested")
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }


@app.get(
    f"{API_PREFIX}/debug/calculations",
    summary="Debug Calculations",
    description="Get all intermediate calculation values for debugging.",
    tags=["Debug"],
)
async def debug_calculations(
    capital: float = 100000,
    assets: str = "NVDAX,AAPLX,TSLAX",
    risk_tolerance: str = "medium",
) -> dict:
    """
    Debug endpoint to trace all calculations step by step.
    
    Returns all intermediate values for portfolio analysis.
    """
    import numpy as np
    
    asset_list = [a.strip() for a in assets.split(",")]
    
    # Fetch prices
    prices = {}
    for asset in asset_list:
        try:
            price = await price_client.get_current_price(asset)
            prices[asset] = price
        except Exception as e:
            prices[asset] = f"Error: {str(e)}"
    
    # Fetch percentiles from Synth API
    synth_raw = {}
    async with get_synth_client() as client:
        predictions = await client.get_all_predictions(asset_list)
        for asset, pred in predictions.items():
            synth_raw[asset] = {
                "p5": pred.p5,
                "p10": pred.p10,
                "p25": pred.p25,
                "p50": pred.p50,
                "p75": pred.p75,
                "p90": pred.p90,
                "p95": pred.p95,
            }
    
    # Calculate volatilities
    calculated_volatilities = {}
    volatility_steps = {}
    for asset in asset_list:
        if asset in synth_raw and asset in prices and isinstance(prices[asset], float):
            p = synth_raw[asset]
            daily_vol = PortfolioOptimizer.calculate_volatility_from_percentiles(
                p5=p["p5"], p10=p["p10"], p25=p["p25"], p50=p["p50"],
                p75=p["p75"], p90=p["p90"], p95=p["p95"],
                current_price=prices[asset],
            )
            annual_vol = daily_vol * (252 ** 0.5)
            calculated_volatilities[asset] = annual_vol
            volatility_steps[asset] = {
                "p10": p["p10"],
                "p90": p["p90"],
                "current_price": prices[asset],
                "daily_vol": daily_vol,
                "annual_vol": annual_vol,
                "annual_vol_pct": annual_vol * 100,
            }

    # Risk Parity weights with risk tolerance constraints
    risk_tolerance_enum = map_risk_tolerance(risk_tolerance)
    optimizer = PortfolioOptimizer(risk_tolerance=risk_tolerance_enum)
    
    inverse_vols = {asset: 1.0 / vol for asset, vol in calculated_volatilities.items() if isinstance(vol, float) and vol > 0}
    total_inverse = sum(inverse_vols.values())
    raw_weights = {asset: inv_vol / total_inverse for asset, inv_vol in inverse_vols.items()}
    
    # Apply risk tolerance constraints
    risk_parity_weights = optimizer.apply_constraints(raw_weights, calculated_volatilities)
    
    # Risk contributions
    if risk_parity_weights and calculated_volatilities:
        risk_contributions_raw = risk_engine.calculate_risk_contribution(
            weights=risk_parity_weights,
            volatilities=calculated_volatilities,
        )
        # Normalize to percentages
        total_risk = sum(risk_contributions_raw.values())
        risk_contributions = {
            asset: (contrib / total_risk * 100) if total_risk > 0 else 0
            for asset, contrib in risk_contributions_raw.items()
        }
    else:
        risk_contributions = {}
    
    # Portfolio metrics
    if risk_parity_weights and calculated_volatilities:
        portfolio_vol = risk_engine.calculate_portfolio_volatility(
            weights=risk_parity_weights,
            volatilities=calculated_volatilities,
        )
    else:
        portfolio_vol = 0
    
    return {
        "input": {
            "capital": capital,
            "assets": asset_list,
            "risk_tolerance": risk_tolerance,
        },
        "yahoo_prices": prices,
        "synth_raw": synth_raw,
        "volatility_calculation_steps": volatility_steps,
        "calculated_volatilities": {k: v if isinstance(v, float) else str(v) for k, v in calculated_volatilities.items()},
        "risk_parity_calculation": {
            "inverse_vols": inverse_vols,
            "total_inverse_vol": total_inverse,
            "weights": risk_parity_weights,
        },
        "risk_contributions": risk_contributions,
        "portfolio_metrics": {
            "portfolio_volatility": portfolio_vol,
            "portfolio_volatility_pct": portfolio_vol * 100,
        },
        "monte_carlo_params": {
            "n_simulations": settings.monte_carlo_simulations,
            "n_days": settings.monte_carlo_days,
        },
    }


# =============================================================================
# Asset Information Endpoints
# =============================================================================


@app.get(
    f"{API_PREFIX}/assets",
    summary="List Available Assets",
    description="Get the list of all supported assets for portfolio construction.",
    tags=["Assets"],
    response_model=list[str],
)
async def list_assets() -> list[str]:
    """
    List all available assets.

    Returns:
        Sorted list of supported asset symbols.
    """
    logger.info("Listing available assets")
    return sorted(SUPPORTED_ASSETS)


@app.get(
    f"{API_PREFIX}/price/{{symbol}}",
    summary="Get Asset Price",
    description="Get the current price for a specific asset.",
    tags=["Assets"],
    response_model=PriceResponse,
)
async def get_price(symbol: str) -> PriceResponse:
    """
    Get current price for an asset.

    Args:
        symbol: Asset symbol (e.g., NVDAX, AAPLX).

    Returns:
        Current price with timestamp.

    Raises:
        HTTPException: If price fetch fails or asset is not found.
    """
    logger.info(f"Fetching price for {symbol}")

    try:
        price = await price_client.get_current_price(symbol)
        return PriceResponse(
            symbol=symbol,
            price=price,
            timestamp=datetime.now(timezone.utc),
        )
    except PriceClientError as e:
        logger.error(f"Failed to fetch price for {symbol}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch price for {symbol}: {str(e)}",
        ) from e


@app.get(
    f"{API_PREFIX}/volatility/{{symbol}}",
    summary="Get Asset Volatility",
    description="Get the 24-hour and annualized volatility for a specific asset.",
    tags=["Assets"],
    response_model=VolatilityResponse,
)
async def get_volatility(symbol: str) -> VolatilityResponse:
    """
    Get volatility forecast for an asset.

    Args:
        symbol: Asset symbol (e.g., NVDAX, AAPLX).

    Returns:
        Volatility metrics including 24h and annualized values.

    Raises:
        HTTPException: If volatility fetch fails or asset is not found.
    """
    logger.info(f"Fetching volatility for {symbol}")

    try:
        async with get_synth_client() as client:
            forecast = await client.get_volatility(symbol)

            # Annualize 24h volatility (sqrt of 252 trading days)
            annualized_vol = forecast.volatility_24h * (252 ** 0.5)

            return VolatilityResponse(
                symbol=symbol,
                volatility_24h=round(forecast.volatility_24h, 6),
                annualized_volatility=round(annualized_vol, 6),
            )
    except SynthAssetNotFoundError as e:
        logger.error(f"Asset not found: {symbol}")
        raise HTTPException(
            status_code=404,
            detail=str(e),
        ) from e
    except SynthTimeoutError as e:
        logger.error(f"Timeout fetching volatility for {symbol}")
        raise HTTPException(
            status_code=504,
            detail=f"Request timed out: {str(e)}",
        ) from e
    except SynthHTTPError as e:
        logger.error(f"API error fetching volatility for {symbol}: {e.status}")
        raise HTTPException(
            status_code=e.status,
            detail=f"Synth API error: {e.message}",
        ) from e
    except SynthAPIError as e:
        logger.error(f"Synth API error for {symbol}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Synth API error: {str(e)}",
        ) from e


# =============================================================================
# Portfolio Analysis Endpoints
# =============================================================================


@app.post(
    f"{API_PREFIX}/portfolio/analyze",
    summary="Analyze Portfolio",
    description=(
        "Perform comprehensive portfolio analysis including optimization, "
        "risk metrics, Monte Carlo simulation, and recommendations."
    ),
    tags=["Portfolio"],
    response_model=PortfolioAnalysisResponse,
)
async def analyze_portfolio(request: PortfolioRequest) -> PortfolioAnalysisResponse:
    """
    Perform complete portfolio analysis.

    This endpoint:
    1. Fetches current prices for all assets
    2. Fetches prediction percentiles from Synth API
    3. Calculates volatilities from percentiles
    4. Optimizes portfolio weights using Risk Parity
    5. Calculates risk contributions
    6. Runs Monte Carlo simulation
    7. Generates investment recommendations

    Args:
        request: PortfolioRequest with capital, assets, and risk tolerance.

    Returns:
        Complete PortfolioAnalysisResponse with all analysis results.

    Raises:
        HTTPException: If any service call fails.
    """
    logger.info("=" * 60)
    logger.info(f"Analyzing portfolio:")
    logger.info(f"  Mode: {request.mode}")
    logger.info(f"  Assets: {request.assets}")
    logger.info(f"  Risk Tolerance: {request.risk_tolerance}")
    if request.mode == "new":
        logger.info(f"  Capital: ${request.capital:,.2f}")
    else:
        logger.info(f"  Cash: ${request.cash:,.2f}")
        logger.info(f"  Positions: {request.positions}")
    logger.info("=" * 60)

    try:
        # Step 1: Fetch current prices for all assets
        logger.debug("Step 1: Fetching current prices...")
        prices: dict[str, float] = {}
        price_errors: list[str] = []

        for asset in request.assets:
            try:
                price = await price_client.get_current_price(asset)
                prices[asset] = price
                logger.debug(f"  {asset}: ${price:.2f}")
            except PriceClientError as e:
                price_errors.append(f"{asset}: {str(e)}")
                logger.warning(f"Failed to fetch price for {asset}: {e}")

        if price_errors:
            logger.warning(f"Some prices could not be fetched: {price_errors}")

        if not prices:
            logger.error("No prices fetched!")
            raise HTTPException(
                status_code=503,
                detail="Failed to fetch prices for any assets",
            )

        # Step 2: Calculate total capital and current weights based on mode
        logger.debug("Step 2: Calculating capital and weights...")
        total_capital = 0.0
        current_weights: dict[str, float] | None = None
        
        if request.mode == "new":
            # New portfolio: use provided capital
            if not request.capital:
                logger.error("Capital is required for new portfolios")
                raise HTTPException(
                    status_code=400,
                    detail="Capital is required for new portfolios"
                )
            total_capital = request.capital
            current_weights = None  # No current positions
            logger.info(f"  New portfolio - Total capital: ${total_capital:,.2f}")
        else:
            # Existing portfolio: calculate from positions
            if not request.positions:
                logger.error("Positions are required for existing portfolios")
                raise HTTPException(
                    status_code=400,
                    detail="Positions are required for existing portfolios"
                )
            
            # Calculate position values
            logger.debug("  Calculating position values...")
            position_values = {
                asset: shares * prices[asset]
                for asset, shares in request.positions.items()
                if asset in prices
            }
            logger.info(f"  Position values: {position_values}")
            
            # Add cash
            cash = request.cash or 0
            logger.info(f"  Cash: ${cash:,.2f}")
            total_capital = sum(position_values.values()) + cash
            logger.info(f"  Total capital: ${total_capital:,.2f}")
            
            # Calculate current weights
            if total_capital > 0:
                current_weights = {
                    asset: value / total_capital
                    for asset, value in position_values.items()
                }
                logger.info(f"  Current weights: {current_weights}")
            else:
                logger.error("Total portfolio value is zero or negative")
                raise HTTPException(
                    status_code=400,
                    detail="Total portfolio value must be greater than 0"
                )

        # Step 3: Fetch prediction percentiles from Synth API
        logger.debug("Fetching prediction percentiles...")
        percentiles: dict[str, dict[str, float]] = {}

        async with get_synth_client() as client:
            predictions = await client.get_all_predictions(request.assets)

            for asset, pred in predictions.items():
                percentiles[asset] = pred.to_dict()

        # Step 3: Calculate volatilities from percentiles
        logger.debug("Calculating volatilities from percentiles...")
        volatilities: dict[str, float] = {}
        synth_vols: dict[str, tuple[float, str]] = {}  # asset -> (vol, source)

        for asset in request.assets:
            if asset in percentiles and asset in prices:
                p = percentiles[asset]
                try:
                    vol = PortfolioOptimizer.calculate_volatility_from_percentiles(
                        p5=p["p5"],
                        p10=p["p10"],
                        p25=p["p25"],
                        p50=p["p50"],
                        p75=p["p75"],
                        p90=p["p90"],
                        p95=p["p95"],
                        current_price=prices[asset],
                    )
                    # Annualize the 24h volatility (it's daily volatility)
                    vol = vol * (252 ** 0.5)
                    
                    # Skip zero or negative volatility
                    if vol > 0:
                        volatilities[asset] = vol
                        synth_vols[asset] = (vol, "percentiles")
                        logger.info(f"Volatility for {asset}: {vol:.4f} ({vol*100:.2f}% annualized)")
                    else:
                        logger.warning(f"Zero/negative volatility for {asset}: {vol}")
                except Exception as e:
                    logger.warning(f"Failed to calculate volatility for {asset}: {e}")

        # Fallback: use Synth volatility API for missing volatilities
        missing_vol_assets = [a for a in request.assets if a not in volatilities]
        if missing_vol_assets:
            logger.debug(f"Fetching Synth volatility for: {missing_vol_assets}")
            try:
                async with get_synth_client() as client:
                    vol_forecasts = await client.get_all_volatility(missing_vol_assets)
                    for asset, forecast in vol_forecasts.items():
                        # Annualize the 24h volatility, but cap at 100% annualized
                        vol = min(forecast.volatility_24h * (252 ** 0.5), 1.0)
                        volatilities[asset] = vol
                        synth_vols[asset] = (vol, "synth_api")
                        logger.info(f"Synth volatility for {asset}: {vol:.4f} ({vol*100:.2f}%)")
            except Exception as e:
                logger.warning(f"Failed to fetch Synth volatility: {e}")

        # Always fetch historical volatility for comparison (independently)
        hist_vols: dict[str, float] = {}
        for asset in request.assets:
            try:
                hvol = await price_client.get_historical_volatility(asset, period="3mo")
                if hvol > 0:
                    hist_vols[asset] = hvol
                    logger.info(f"Historical volatility for {asset}: {hvol:.2%}")
                else:
                    hist_vols[asset] = 0.15
                    logger.warning(f"Using default historical vol for {asset}: 15%")
            except Exception as e:
                logger.warning(f"Could not get historical vol for {asset}: {e}")
                hist_vols[asset] = 0.0

        # Final fallback: use historical volatility for optimizer if still missing
        missing_vol_assets = [a for a in request.assets if a not in volatilities]
        if missing_vol_assets:
            logger.debug(f"Calculating historical volatility for: {missing_vol_assets}")
            for asset in missing_vol_assets:
                hv = hist_vols.get(asset, 0.15)
                volatilities[asset] = hv if hv > 0 else 0.15
                logger.warning(f"Using historical vol as fallback for {asset}: {volatilities[asset]:.2%}")

        if not volatilities:
            raise HTTPException(
                status_code=503,
                detail="Failed to calculate volatilities for any assets",
            )

        # Step 4: Optimize portfolio weights using Risk Parity
        logger.debug("Optimizing portfolio weights...")
        risk_tolerance = map_risk_tolerance(request.risk_tolerance)
        optimizer = PortfolioOptimizer(risk_tolerance=risk_tolerance)

        # Filter to assets with both prices and volatilities
        valid_assets = [a for a in request.assets if a in prices and a in volatilities]

        if not valid_assets:
            raise HTTPException(
                status_code=400,
                detail="No valid assets with both price and volatility data",
            )

        allocation = optimizer.optimize(
            capital=total_capital,
            assets=valid_assets,
            volatilities=volatilities,
            prices=prices,
            risk_tolerance=risk_tolerance,
        )

        # Step 5: Calculate risk contributions
        logger.debug("Calculating risk contributions...")
        risk_contributions_dict = risk_engine.calculate_risk_contribution(
            weights=allocation.weights,
            volatilities=volatilities,
        )

        risk_contributions = [
            RiskContributionResponse(
                symbol=asset,
                risk_contribution=round(risk_contributions_dict.get(asset, 0), 6),
                weight=round(allocation.weights.get(asset, 0), 6),
                volatility=round(volatilities.get(asset, 0), 6),
            )
            for asset in valid_assets
        ]

        # Step 6: Calculate portfolio risk metrics
        logger.debug("Calculating portfolio risk metrics...")
        portfolio_volatility = risk_engine.calculate_portfolio_volatility(
            weights=allocation.weights,
            volatilities=volatilities,
        )

        # Generate synthetic returns for VaR/CVaR calculation
        # Using normal distribution with portfolio volatility
        synthetic_returns = risk_engine._rng.normal(
            loc=0.0001,  # Small positive drift
            scale=portfolio_volatility / (252 ** 0.5),  # Daily volatility
            size=252,  # One year of daily returns
        ).tolist()

        var_95 = risk_engine.calculate_var(synthetic_returns, confidence=0.95)
        cvar_95 = risk_engine.calculate_cvar(synthetic_returns, confidence=0.95)
        max_drawdown = risk_engine.calculate_max_drawdown(synthetic_returns)
        sharpe_ratio = risk_engine.calculate_sharpe_ratio(synthetic_returns)

        risk_metrics = RiskMetricsResponse(
            portfolio_volatility=round(portfolio_volatility, 6),
            var_95=round(var_95, 6),
            cvar_95=round(cvar_95, 6),
            max_drawdown=round(max_drawdown, 6),
            sharpe_ratio=round(sharpe_ratio, 4),
        )

        # Step 7: Run Monte Carlo simulation
        logger.debug("Running Monte Carlo simulation...")
        monte_carlo_result = risk_engine.run_monte_carlo(
            capital=total_capital,
            weights=allocation.weights,
            volatilities=volatilities,
            n_simulations=100,  # Fixed at 100 for better UX
            n_days=7,  # 7-day forecast
        )

        # Create MonteCarloResponse from result
        monte_carlo = MonteCarloResponse(
            simulations_count=monte_carlo_result["n_simulations"],
            mean_return=round(monte_carlo_result["statistics"]["mean_return"], 6),
            std_return=round(monte_carlo_result["statistics"]["std_return"], 6),
            min_return=round(monte_carlo_result["statistics"]["min_return"], 6),
            max_return=round(monte_carlo_result["statistics"]["max_return"], 6),
            percentile_5=round(monte_carlo_result["statistics"]["p5_return"], 6),
            percentile_95=round(monte_carlo_result["statistics"]["p95_return"], 6),
            paths=monte_carlo_result["scenarios"],
        )

        # Step 8: Generate recommendations
        logger.debug("Generating recommendations...")
        recommendations = generate_recommendations(
            assets=valid_assets,
            weights=allocation.weights,
            volatilities=volatilities,
            prices=prices,
            current_weights=current_weights,
            total_capital=total_capital,
        )

        # Build response
        allocations = [
            AllocationResponse(
                symbol=asset,
                weight=round(allocation.weights.get(asset, 0), 6),
                current_weight=round(current_weights.get(asset, 0), 6) if current_weights else None,
                shares=round(allocation.shares.get(asset, 0), 8),
                value=round(allocation.weights.get(asset, 0) * total_capital, 2),
            )
            for asset in valid_assets
        ]

        # Add Cash as special "asset" for existing portfolios
        if request.mode == "existing" and cash > 0:
            cash_weight = cash / total_capital
            allocations.append(
                AllocationResponse(
                    symbol="CASH",
                    weight=0.0,  # Target = 0% (fully invested)
                    current_weight=round(cash_weight, 6),
                    shares=0,
                    value=round(cash, 2),
                )
            )

        # Build volatility comparison list
        vol_comparison = [
            VolatilityComparisonItem(
                symbol=asset,
                synth_volatility=round(synth_vols.get(asset, (volatilities.get(asset, 0), "unknown"))[0], 6),
                historical_volatility=round(hist_vols.get(asset, 0), 6),
                source=synth_vols.get(asset, (0, "unknown"))[1],
            )
            for asset in valid_assets
        ]

        # =========================================================
        # Benchmark & Historical Performance (#10 and #11)
        # =========================================================
        benchmark_data: BenchmarkData | None = None
        historical_perf: HistoricalPerformanceData | None = None
        try:
            # Fetch 1-year history for SPY and all valid assets concurrently
            symbols_for_history = list(valid_assets) + ["SPY"]
            history_batch = await price_client.get_historical_prices_batch(
                symbols_for_history, period="1y"
            )

            spy_hist = history_batch.get("SPY")
            if isinstance(spy_hist, list) and len(spy_hist) >= 2:
                spy_start = spy_hist[0].close
                spy_end = spy_hist[-1].close
                sp500_1y_return = (spy_end - spy_start) / spy_start if spy_start else 0.0

                # Per-asset 1-year return
                asset_returns_list: list[AssetHistoricalReturn] = []
                asset_1y_returns: dict[str, float] = {}
                for asset in valid_assets:
                    ah = history_batch.get(asset)
                    if isinstance(ah, list) and len(ah) >= 2:
                        a_start = ah[0].close
                        a_end = ah[-1].close
                        r = (a_end - a_start) / a_start if a_start else 0.0
                        asset_1y_returns[asset] = r
                        asset_returns_list.append(AssetHistoricalReturn(
                            symbol=asset,
                            return_1y=round(r, 6),
                            start_price=round(a_start, 4),
                            end_price=round(a_end, 4),
                        ))
                    else:
                        asset_1y_returns[asset] = 0.0

                # Weighted portfolio 1-year return
                weights_map = {a: allocation.weights.get(a, 0) for a in valid_assets}
                portfolio_1y_return = sum(
                    weights_map.get(sym, 0) * ret
                    for sym, ret in asset_1y_returns.items()
                )

                benchmark_data = BenchmarkData(
                    sp500_1y_return=round(sp500_1y_return, 6),
                    sp500_current_price=round(spy_end, 2),
                    sp500_1y_ago_price=round(spy_start, 2),
                    portfolio_1y_return=round(portfolio_1y_return, 6),
                    outperformance=round(portfolio_1y_return - sp500_1y_return, 6),
                )

                # ---- Build normalized time-series for line chart ----
                # Use SPY dates as the timeline backbone
                # For each date find the normalized portfolio value using
                # the nearest available price for each asset.

                # Use actual total_capital (no cap)
                display_capital = total_capital

                # Build date->price maps for each asset
                asset_price_maps: dict[str, dict[str, float]] = {}
                for asset in valid_assets:
                    ah2 = history_batch.get(asset)
                    if isinstance(ah2, list) and len(ah2) >= 2:
                        asset_price_maps[asset] = {
                            h.date.strftime("%Y-%m-%d"): h.close for h in ah2
                        }

                spy_date_map: dict[str, float] = {
                    h.date.strftime("%Y-%m-%d"): h.close for h in spy_hist
                }

                # Use every 5th date to keep payload small (~50 points)
                spy_dates = sorted(spy_date_map.keys())
                sampled_dates = spy_dates[::5] + ([spy_dates[-1]] if spy_dates[-1] not in spy_dates[::5] else [])

                data_points: list[HistoricalDataPoint] = []
                for date_str in sampled_dates:
                    # Portfolio value: sum(weight * (price[date]/price[start]))
                    port_multiplier = 0.0
                    for asset, w in weights_map.items():
                        pm = asset_price_maps.get(asset, {})
                        price_at_date = pm.get(date_str)
                        if price_at_date is None:
                            # take closest earlier date
                            earlier = [v for k, v in pm.items() if k <= date_str]
                            price_at_date = earlier[-1] if earlier else None
                        if price_at_date is not None:
                            asset_start = list(pm.values())[0] if pm else 1.0
                            port_multiplier += w * (price_at_date / asset_start if asset_start else 1.0)
                        else:
                            port_multiplier += w  # flat if no data

                    spy_at_date = spy_date_map.get(date_str, spy_start)
                    spy_multiplier = spy_at_date / spy_start if spy_start else 1.0

                    # Scale to display capital for realistic chart values
                    data_points.append(HistoricalDataPoint(
                        date=date_str,
                        value=round(display_capital * port_multiplier, 2),
                        sp500_value=round(display_capital * spy_multiplier, 2),
                    ))

                historical_perf = HistoricalPerformanceData(
                    data_points=data_points,
                    asset_returns=asset_returns_list,
                    portfolio_final_value=round(display_capital * port_multiplier, 2),
                    sp500_final_value=round(display_capital * spy_multiplier, 2),
                )

        except Exception as bench_err:
            logger.warning(f"Benchmark/historical data failed (non-critical): {bench_err}")

        response = PortfolioAnalysisResponse(
            allocations=allocations,
            risk_contributions=risk_contributions,
            risk_metrics=risk_metrics,
            monte_carlo=monte_carlo,
            recommendations=recommendations,
            volatility_comparison=vol_comparison,
            total_capital=total_capital,
            timestamp=datetime.now(timezone.utc),
            benchmark=benchmark_data,
            historical_performance=historical_perf,
        )

        logger.info(f"Portfolio analysis completed for {len(valid_assets)} assets")
        return response

    except SynthAssetNotFoundError as e:
        logger.error(f"Asset not found: {e}")
        raise HTTPException(status_code=404, detail=str(e)) from e
    except SynthTimeoutError as e:
        logger.error(f"Synth API timeout: {e}")
        raise HTTPException(status_code=504, detail=f"Request timed out: {str(e)}") from e
    except SynthHTTPError as e:
        logger.error(f"Synth API HTTP error: {e.status}")
        raise HTTPException(status_code=e.status, detail=f"Synth API error: {e.message}") from e
    except SynthAPIError as e:
        logger.error(f"Synth API error: {e}")
        raise HTTPException(status_code=502, detail=f"Synth API error: {str(e)}") from e
    except Exception as e:
        logger.error(f"Unexpected error during portfolio analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        ) from e


@app.post(
    f"{API_PREFIX}/portfolio/optimize",
    summary="Optimize Portfolio",
    description="Calculate optimal Risk Parity allocation for given assets.",
    tags=["Portfolio"],
    response_model=list[AllocationResponse],
)
async def optimize_portfolio(request: PortfolioRequest) -> list[AllocationResponse]:
    """
    Optimize portfolio allocation using Risk Parity strategy.

    Args:
        request: PortfolioRequest with capital, assets, and risk tolerance.

    Returns:
        List of AllocationResponse with optimal weights, shares, and values.

    Raises:
        HTTPException: If optimization fails.
    """
    logger.info(f"Optimizing portfolio: capital=${request.capital:,.2f}, assets={request.assets}")

    try:
        # Fetch prices
        prices: dict[str, float] = {}
        for asset in request.assets:
            try:
                price = await price_client.get_current_price(asset)
                prices[asset] = price
            except PriceClientError as e:
                logger.warning(f"Failed to fetch price for {asset}: {e}")

        if not prices:
            raise HTTPException(
                status_code=503,
                detail="Failed to fetch prices for any assets",
            )

        # Fetch volatilities
        volatilities: dict[str, float] = {}
        async with get_synth_client() as client:
            vol_forecasts = await client.get_all_volatility(request.assets)
            for asset, forecast in vol_forecasts.items():
                volatilities[asset] = forecast.volatility_24h * (252 ** 0.5)

        if not volatilities:
            raise HTTPException(
                status_code=503,
                detail="Failed to fetch volatilities for any assets",
            )

        # Optimize
        risk_tolerance = map_risk_tolerance(request.risk_tolerance)
        optimizer = PortfolioOptimizer(risk_tolerance=risk_tolerance)

        valid_assets = [a for a in request.assets if a in prices and a in volatilities]

        if not valid_assets:
            raise HTTPException(
                status_code=400,
                detail="No valid assets with both price and volatility data",
            )

        allocation = optimizer.optimize(
            capital=request.capital,
            assets=valid_assets,
            volatilities=volatilities,
            prices=prices,
            risk_tolerance=risk_tolerance,
        )

        # Build response
        return [
            AllocationResponse(
                symbol=asset,
                weight=round(allocation.weights.get(asset, 0), 6),
                shares=round(allocation.shares.get(asset, 0), 8),
                value=round(allocation.weights.get(asset, 0) * request.capital, 2),
            )
            for asset in valid_assets
        ]

    except SynthAssetNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except SynthTimeoutError as e:
        raise HTTPException(status_code=504, detail=f"Request timed out: {str(e)}") from e
    except SynthAPIError as e:
        raise HTTPException(status_code=502, detail=f"Synth API error: {str(e)}") from e
    except Exception as e:
        logger.error(f"Unexpected error during optimization: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        ) from e


# =============================================================================
# Monte Carlo Endpoint
# =============================================================================


@app.get(
    f"{API_PREFIX}/monte-carlo",
    summary="Monte Carlo Simulation",
    description="Generate Monte Carlo simulation parameters and sample paths.",
    tags=["Simulation"],
    response_model=MonteCarloResponse,
)
async def get_monte_carlo(
    capital: float = Query(
        default=10000.0,
        gt=0,
        description="Initial capital for simulation",
    ),
    simulations: int = Query(
        default=1000,
        ge=100,
        le=10000,
        description="Number of simulation paths",
    ),
    days: int = Query(
        default=30,
        ge=1,
        le=365,
        description="Number of days to simulate",
    ),
    assets: str = Query(
        default="NVDAX,AAPLX,SPYX",
        description="Comma-separated list of assets",
    ),
    risk_tolerance: str = Query(
        default="medium",
        pattern="^(low|medium|high)$",
        description="Risk tolerance level",
    ),
) -> MonteCarloResponse:
    """
    Run Monte Carlo simulation for portfolio.

    Args:
        capital: Initial capital amount.
        simulations: Number of simulation paths.
        days: Number of days to simulate.
        assets: Comma-separated list of asset symbols.
        risk_tolerance: Risk tolerance level (low, medium, high).

    Returns:
        MonteCarloResponse with simulation statistics and sample paths.

    Raises:
        HTTPException: If simulation fails.
    """
    asset_list = [a.strip() for a in assets.split(",") if a.strip()]

    logger.info(
        f"Running Monte Carlo: capital=${capital:,.2f}, "
        f"simulations={simulations}, days={days}, assets={asset_list}"
    )

    try:
        # Fetch prices
        prices: dict[str, float] = {}
        for asset in asset_list:
            try:
                price = await price_client.get_current_price(asset)
                prices[asset] = price
            except PriceClientError as e:
                logger.warning(f"Failed to fetch price for {asset}: {e}")

        # Fetch volatilities
        volatilities: dict[str, float] = {}
        async with get_synth_client() as client:
            vol_forecasts = await client.get_all_volatility(asset_list)
            for asset, forecast in vol_forecasts.items():
                volatilities[asset] = forecast.volatility_24h * (252 ** 0.5)

        if not volatilities or not prices:
            raise HTTPException(
                status_code=503,
                detail="Failed to fetch required data for simulation",
            )

        # Calculate Risk Parity weights
        valid_assets = [a for a in asset_list if a in prices and a in volatilities]
        risk_tolerance_enum = map_risk_tolerance(risk_tolerance)
        optimizer = PortfolioOptimizer(risk_tolerance=risk_tolerance_enum)

        weights = optimizer.calculate_risk_parity_weights(
            {a: volatilities[a] for a in valid_assets}
        )

        # Run simulation
        simulations_result = risk_engine.run_monte_carlo(
            capital=capital,
            weights=weights,
            volatilities=volatilities,
            n_simulations=simulations,
            n_days=days,
        )

        # Calculate statistics
        sim_returns = [sim.return_pct for sim in simulations_result]
        mean_return = sum(sim_returns) / len(sim_returns)
        variance = sum((r - mean_return) ** 2 for r in sim_returns) / len(sim_returns)
        std_return = variance ** 0.5

        sorted_returns = sorted(sim_returns)
        percentile_5_idx = int(len(sorted_returns) * 0.05)
        percentile_95_idx = int(len(sorted_returns) * 0.95)

        # Sample paths (first 50)
        sample_paths = [sim.path for sim in simulations_result[:50]]

        return MonteCarloResponse(
            simulations_count=len(simulations_result),
            mean_return=round(mean_return, 6),
            std_return=round(std_return, 6),
            min_return=round(min(sim_returns), 6),
            max_return=round(max(sim_returns), 6),
            percentile_5=round(sorted_returns[percentile_5_idx], 6),
            percentile_95=round(sorted_returns[percentile_95_idx], 6),
            paths=sample_paths,
        )

    except SynthAssetNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except SynthTimeoutError as e:
        raise HTTPException(status_code=504, detail=f"Request timed out: {str(e)}") from e
    except SynthAPIError as e:
        raise HTTPException(status_code=502, detail=f"Synth API error: {str(e)}") from e
    except Exception as e:
        logger.error(f"Unexpected error during Monte Carlo simulation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        ) from e


# =============================================================================
# Root Endpoint
# =============================================================================


@app.get(
    "/",
    summary="API Root",
    description="Welcome endpoint with API information.",
    tags=["General"],
)
async def root() -> dict[str, str]:
    """
    Root endpoint with API information.

    Returns:
        Welcome message and documentation links.
    """
    return {
        "message": "Welcome to Synth Risk Parity Portfolio Engine API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{API_PREFIX}/health",
    }
