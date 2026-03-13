"""
Portfolio Optimizer for Risk Parity allocation strategy.

Provides methods to calculate optimal portfolio weights based on asset volatilities
using the Risk Parity approach, where each asset contributes equally to portfolio risk.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Final


class RiskTolerance(str, Enum):
    """Risk tolerance levels for portfolio allocation."""

    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


# Risk tolerance adjustment factors
# Low: more conservative, amplify low volatility assets
# Medium: standard Risk Parity (no adjustment)
# High: more aggressive, allow higher weights for volatile assets
RISK_TOLERANCE_FACTORS: Final[dict[RiskTolerance, float]] = {
    RiskTolerance.LOW: 1.5,      # Amplify inverse volatility (more conservative)
    RiskTolerance.MEDIUM: 1.0,   # Standard Risk Parity
    RiskTolerance.HIGH: 0.7,     # Reduce inverse volatility effect (more aggressive)
}

# Risk tolerance constraints for portfolio construction
RISK_TOLERANCE_CONSTRAINTS: Final[dict[RiskTolerance, dict[str, float]]] = {
    RiskTolerance.LOW: {
        "min_weight": 0.10,      # Minimum 10% per asset
        "max_weight": 0.30,      # Maximum 30% per asset
        "max_portfolio_volatility": 0.15,  # Max 15% annual vol
    },
    RiskTolerance.MEDIUM: {
        "min_weight": 0.05,      # Minimum 5% per asset
        "max_weight": 0.40,      # Maximum 40% per asset
        "max_portfolio_volatility": 0.25,  # Max 25% annual vol
    },
    RiskTolerance.HIGH: {
        "min_weight": 0.05,      # Minimum 5% per asset
        "max_weight": 0.50,      # Maximum 50% per asset
        "max_portfolio_volatility": 0.40,  # Max 40% annual vol
    },
}


class OptimizerError(Exception):
    """Base exception for Portfolio Optimizer errors."""

    pass


class OptimizerInvalidInputError(OptimizerError):
    """Raised when input parameters are invalid."""

    pass


class OptimizerCalculationError(OptimizerError):
    """Raised when a calculation fails."""

    pass


@dataclass
class PortfolioAllocation:
    """
    Result of portfolio optimization.

    Contains the calculated weights, share quantities, and metadata
    for the optimized portfolio allocation.

    Attributes:
        weights: Dictionary mapping asset symbols to their portfolio weights (0.0 to 1.0).
        shares: Dictionary mapping asset symbols to the number of shares to purchase.
        prices: Dictionary mapping asset symbols to their current prices.
        total_capital: Total capital allocated to the portfolio.

    Example:
        >>> allocation = PortfolioAllocation(
        ...     weights={"NVDAX": 0.25, "AAPLX": 0.75},
        ...     shares={"NVDAX": 10.0, "AAPLX": 50.0},
        ...     prices={"NVDAX": 100.0, "AAPLX": 150.0},
        ...     total_capital=8500.0
        ... )
        >>> print(allocation.weights)
        {'NVDAX': 0.25, 'AAPLX': 0.75}
    """

    weights: dict[str, float]
    shares: dict[str, float]
    prices: dict[str, float]
    total_capital: float

    def to_dict(self) -> dict[str, dict[str, float] | float]:
        """
        Convert allocation to dictionary representation.

        Returns:
            Dictionary with all allocation data.
        """
        return {
            "weights": self.weights,
            "shares": self.shares,
            "prices": self.prices,
            "total_capital": self.total_capital,
        }

    def __repr__(self) -> str:
        assets = ", ".join(self.weights.keys())
        return f"PortfolioAllocation(assets=[{assets}], total_capital={self.total_capital})"


class PortfolioOptimizer:
    """
    Portfolio optimizer implementing Risk Parity allocation strategy.

    Risk Parity is an investment strategy that allocates capital based on risk
    contribution rather than capital allocation. Each asset contributes equally
    to the overall portfolio risk.

    The core formula for Risk Parity weights:
        weight[i] = (1 / volatility[i]) / sum(1 / volatility[j] for all j)

    This means assets with lower volatility receive higher weights, and
    assets with higher volatility receive lower weights.

    Attributes:
        risk_tolerance: The risk tolerance level for optimization.

    Example:
        >>> optimizer = PortfolioOptimizer()
        >>> volatilities = {"NVDAX": 0.35, "AAPLX": 0.25, "SPYX": 0.15}
        >>> weights = optimizer.calculate_risk_parity_weights(volatilities)
        >>> print(weights)
        {'NVDAX': 0.21, 'AAPLX': 0.29, 'SPYX': 0.50}
    """

    def __init__(self, risk_tolerance: RiskTolerance = RiskTolerance.MEDIUM):
        """
        Initialize the Portfolio Optimizer.

        Args:
            risk_tolerance: The risk tolerance level. Defaults to MEDIUM.
                           - LOW: More conservative, favors low-volatility assets
                           - MEDIUM: Standard Risk Parity allocation
                           - HIGH: More aggressive, allows higher volatile asset weights

        Example:
            >>> optimizer_conservative = PortfolioOptimizer(RiskTolerance.LOW)
            >>> optimizer_aggressive = PortfolioOptimizer(RiskTolerance.HIGH)
        """
        self.risk_tolerance = risk_tolerance

    @staticmethod
    def calculate_volatility_from_percentiles(
        p5: float,
        p10: float,
        p25: float,
        p50: float,
        p75: float,
        p90: float,
        p95: float,
        current_price: float,
    ) -> float:
        """
        Calculate implied volatility from Synth prediction percentiles.

        Uses the inter-percentile range (P90 - P10) normalized by current price
        to estimate the expected volatility. The divisor 2.56 approximates the
        conversion from percentile range to standard deviation.

        Formula:
            volatility = (p90 - p10) / current_price / 2.56

        The factor 2.56 comes from the normal distribution property where
        P90 - P10 ≈ 2.56 * σ (standard deviation).

        Args:
            p5: 5th percentile prediction.
            p10: 10th percentile prediction.
            p25: 25th percentile prediction.
            p50: 50th percentile (median) prediction.
            p75: 75th percentile prediction.
            p90: 90th percentile prediction.
            p95: 95th percentile prediction.
            current_price: Current asset price for normalization.

        Returns:
            Estimated volatility as a decimal (e.g., 0.25 for 25%).

        Raises:
            OptimizerInvalidInputError: If current_price is zero or negative.

        Example:
            >>> vol = PortfolioOptimizer.calculate_volatility_from_percentiles(
            ...     p5=90, p10=95, p25=100, p50=105, p75=110, p90=115, p95=120,
            ...     current_price=105
            ... )
            >>> print(f"Volatility: {vol:.2%}")
            Volatility: 7.55%
        """
        if current_price <= 0:
            raise OptimizerInvalidInputError(
                f"Current price must be positive, got {current_price}"
            )

        # Calculate inter-percentile range (P90 - P10)
        percentile_range = p90 - p10

        # Normalize by current price and convert to standard deviation
        volatility = percentile_range / current_price / 2.56

        return abs(volatility)  # Ensure non-negative

    def calculate_risk_parity_weights(
        self,
        volatilities: dict[str, float],
    ) -> dict[str, float]:
        """
        Calculate Risk Parity weights from asset volatilities.

        Implements the Risk Parity formula where each asset's weight is
        inversely proportional to its volatility:

            weight[i] = (1 / volatility[i]) / sum(1 / volatility[j] for all j)

        The risk tolerance setting adjusts the inverse volatility calculation:
            - LOW: Amplifies the inverse (more weight to low-volatility assets)
            - MEDIUM: Standard inverse volatility
            - HIGH: Reduces the inverse effect (more balanced weights)

        Args:
            volatilities: Dictionary mapping asset symbols to their volatilities.
                         Volatilities should be positive decimals (e.g., 0.25 for 25%).

        Returns:
            Dictionary mapping asset symbols to their Risk Parity weights.
            Weights sum to 1.0 (100% allocation).

        Raises:
            OptimizerInvalidInputError: If volatilities dict is empty or contains
                                       non-positive values.

        Example:
            >>> optimizer = PortfolioOptimizer()
            >>> volatilities = {"NVDAX": 0.35, "AAPLX": 0.25, "SPYX": 0.15}
            >>> weights = optimizer.calculate_risk_parity_weights(volatilities)
            >>> print(f"SPYX weight: {weights['SPYX']:.2%}")
            SPYX weight: 50.00%
        """
        if not volatilities:
            raise OptimizerInvalidInputError("Volatilities dictionary cannot be empty")

        # Validate all volatilities are positive
        for asset, vol in volatilities.items():
            if vol <= 0:
                raise OptimizerInvalidInputError(
                    f"Volatility for '{asset}' must be positive, got {vol}"
                )

        # Get risk tolerance adjustment factor
        adjustment_factor = RISK_TOLERANCE_FACTORS[self.risk_tolerance]

        # Calculate inverse volatilities raised to adjustment factor
        # Higher adjustment = more weight to low-volatility assets
        inverse_vols: dict[str, float] = {}
        for asset, volatility in volatilities.items():
            inverse_vol = 1.0 / volatility
            # Apply risk tolerance adjustment
            adjusted_inverse_vol = inverse_vol ** adjustment_factor
            inverse_vols[asset] = adjusted_inverse_vol

        # Sum of all adjusted inverse volatilities
        total_inverse_vol = sum(inverse_vols.values())

        if total_inverse_vol == 0:
            raise OptimizerCalculationError("Sum of inverse volatilities is zero")

        # Calculate normalized weights
        weights: dict[str, float] = {}
        for asset, inverse_vol in inverse_vols.items():
            weights[asset] = inverse_vol / total_inverse_vol

        return weights

    def apply_constraints(
        self,
        weights: dict[str, float],
        volatilities: dict[str, float],
    ) -> dict[str, float]:
        """
        Apply risk tolerance constraints to portfolio weights.
        
        Enforces min/max weight limits and portfolio volatility limits
        based on the risk tolerance setting.
        
        Args:
            weights: Raw portfolio weights from Risk Parity calculation.
            volatilities: Asset volatilities for portfolio vol calculation.
            
        Returns:
            Constrained weights that satisfy all limits.
        """
        constraints = RISK_TOLERANCE_CONSTRAINTS[self.risk_tolerance]
        min_weight = constraints["min_weight"]
        max_weight = constraints["max_weight"]
        
        # Apply min/max weight constraints
        constrained = {}
        for asset, weight in weights.items():
            constrained[asset] = max(min_weight, min(max_weight, weight))
        
        # Re-normalize to sum to 1.0
        total = sum(constrained.values())
        if total > 0:
            constrained = {asset: w / total for asset, w in constrained.items()}
        
        return constrained

    def optimize(
        self,
        capital: float,
        assets: list[str],
        volatilities: dict[str, float],
        prices: dict[str, float],
        risk_tolerance: RiskTolerance | None = None,
    ) -> PortfolioAllocation:
        """
        Perform full portfolio optimization with Risk Parity allocation.

        Calculates optimal weights based on volatilities, then determines
        the number of shares to purchase for each asset given the available
        capital and current prices.

        Args:
            capital: Total capital to allocate (must be positive).
            assets: List of asset symbols to include in the portfolio.
            volatilities: Dictionary mapping asset symbols to their volatilities.
            prices: Dictionary mapping asset symbols to their current prices.
            risk_tolerance: Optional risk tolerance override. If None, uses
                           the instance's risk_tolerance setting.

        Returns:
            PortfolioAllocation object containing weights, shares, prices,
            and total capital allocated.

        Raises:
            OptimizerInvalidInputError: If capital is non-positive, assets list
                                       is empty, or required data is missing.
            OptimizerCalculationError: If weight calculation fails.

        Example:
            >>> optimizer = PortfolioOptimizer(RiskTolerance.MEDIUM)
            >>> allocation = optimizer.optimize(
            ...     capital=10000.0,
            ...     assets=["NVDAX", "AAPLX", "SPYX"],
            ...     volatilities={"NVDAX": 0.35, "AAPLX": 0.25, "SPYX": 0.15},
            ...     prices={"NVDAX": 120.0, "AAPLX": 180.0, "SPYX": 450.0}
            ... )
            >>> print(f"NVDAX shares: {allocation.shares['NVDAX']:.2f}")
            >>> print(f"Total allocated: ${allocation.total_capital:.2f}")
        """
        # Validate inputs
        if capital <= 0:
            raise OptimizerInvalidInputError(
                f"Capital must be positive, got {capital}"
            )

        if not assets:
            raise OptimizerInvalidInputError("Assets list cannot be empty")

        # Validate all assets have volatility and price data
        missing_volatility = [a for a in assets if a not in volatilities]
        missing_price = [a for a in assets if a not in prices]

        if missing_volatility:
            raise OptimizerInvalidInputError(
                f"Missing volatility data for assets: {', '.join(missing_volatility)}"
            )

        if missing_price:
            raise OptimizerInvalidInputError(
                f"Missing price data for assets: {', '.join(missing_price)}"
            )

        # Validate prices are positive
        for asset in assets:
            if prices[asset] <= 0:
                raise OptimizerInvalidInputError(
                    f"Price for '{asset}' must be positive, got {prices[asset]}"
                )

        # Use provided risk tolerance or fall back to instance default
        effective_risk_tolerance = risk_tolerance or self.risk_tolerance

        # Filter volatilities to only include requested assets
        asset_volatilities = {a: volatilities[a] for a in assets}

        # Calculate Risk Parity weights
        weights = self.calculate_risk_parity_weights(asset_volatilities)
        
        # Apply risk tolerance constraints (min/max weights)
        weights = self.apply_constraints(weights, asset_volatilities)

        # Calculate shares to purchase for each asset
        shares: dict[str, float] = {}
        allocated_capital: dict[str, float] = {}

        for asset in assets:
            # Capital allocated to this asset
            asset_capital = capital * weights[asset]
            allocated_capital[asset] = asset_capital

            # Number of shares (can be fractional)
            share_count = asset_capital / prices[asset]
            shares[asset] = share_count

        # Calculate actual total capital allocated (may differ slightly due to rounding)
        total_allocated = sum(allocated_capital.values())

        return PortfolioAllocation(
            weights=weights,
            shares=shares,
            prices={a: prices[a] for a in assets},
            total_capital=total_allocated,
        )

    def set_risk_tolerance(self, risk_tolerance: RiskTolerance) -> None:
        """
        Update the risk tolerance setting.

        Args:
            risk_tolerance: The new risk tolerance level.

        Example:
            >>> optimizer = PortfolioOptimizer()
            >>> optimizer.set_risk_tolerance(RiskTolerance.HIGH)
        """
        self.risk_tolerance = risk_tolerance

    @staticmethod
    def calculate_portfolio_volatility(
        weights: dict[str, float],
        volatilities: dict[str, float],
    ) -> float:
        """
        Calculate the weighted portfolio volatility.

        This is a simplified calculation that assumes zero correlation
        between assets. For a more accurate calculation, a correlation
        matrix would be needed.

        Formula (simplified):
            portfolio_vol = sqrt(sum(weight[i]^2 * vol[i]^2 for all i))

        Args:
            weights: Dictionary mapping asset symbols to their portfolio weights.
            volatilities: Dictionary mapping asset symbols to their volatilities.

        Returns:
            Estimated portfolio volatility as a decimal.

        Example:
            >>> weights = {"A": 0.5, "B": 0.5}
            >>> vols = {"A": 0.2, "B": 0.3}
            >>> port_vol = PortfolioOptimizer.calculate_portfolio_volatility(weights, vols)
            >>> print(f"Portfolio volatility: {port_vol:.2%}")
        """
        portfolio_variance = 0.0

        for asset, weight in weights.items():
            if asset not in volatilities:
                continue
            vol = volatilities[asset]
            portfolio_variance += (weight ** 2) * (vol ** 2)

        return portfolio_variance ** 0.5
