"""
Risk Engine module for portfolio risk metrics calculations.

Provides comprehensive risk analysis tools including volatility, VaR, CVaR,
maximum drawdown, Sharpe ratio, and Monte Carlo simulations.
"""

from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray


@dataclass
class SimulationResult:
    """
    Result of a single Monte Carlo simulation.

    Attributes:
        final_value: Final portfolio value after simulation period.
        return_pct: Total return percentage over the simulation period.
        path: List of portfolio values at each time step for visualization.
    """

    final_value: float
    return_pct: float
    path: list[float]


class RiskEngine:
    """
    Engine for calculating portfolio risk metrics.

    Provides methods for computing various risk measures including volatility,
    Value at Risk (VaR), Conditional VaR (CVaR), maximum drawdown, Sharpe ratio,
    and Monte Carlo simulations for risk assessment.
    """

    def __init__(self, seed: int | None = None) -> None:
        """
        Initialize the RiskEngine.

        Args:
            seed: Random seed for reproducibility in Monte Carlo simulations.
                  If None, uses system random state.
        """
        self._rng = np.random.default_rng(seed)

    def calculate_portfolio_volatility(
        self,
        weights: dict[str, float],
        volatilities: dict[str, float],
        correlation_matrix: dict[str, dict[str, float]] | None = None,
    ) -> float:
        """
        Calculate portfolio volatility (standard deviation of returns).

        If correlation matrix is not provided, assumes assets are uncorrelated.

        Args:
            weights: Dictionary mapping asset identifiers to portfolio weights.
                     Weights should sum to 1.0 (or close to it).
            volatilities: Dictionary mapping asset identifiers to annualized
                          volatilities (as decimals, e.g., 0.20 for 20%).
            correlation_matrix: Optional nested dictionary representing the
                                correlation matrix between assets. If None,
                                assumes zero correlation between assets.

        Returns:
            Portfolio volatility as a decimal (e.g., 0.15 for 15%).

        Raises:
            ValueError: If weights or volatilities dictionaries don't match,
                        or if correlation matrix is invalid.
        """
        assets = list(weights.keys())

        if set(assets) != set(volatilities.keys()):
            raise ValueError("Weights and volatilities must have the same assets")

        n = len(assets)
        w = np.array([weights[asset] for asset in assets])
        v = np.array([volatilities[asset] for asset in assets])

        if correlation_matrix is None:
            # Assume uncorrelated assets: portfolio variance = sum(w_i^2 * v_i^2)
            portfolio_variance = np.sum((w * v) ** 2)
        else:
            # Build correlation matrix
            corr = np.zeros((n, n))
            for i, asset_i in enumerate(assets):
                for j, asset_j in enumerate(assets):
                    if asset_i == asset_j:
                        corr[i, j] = 1.0
                    elif asset_i in correlation_matrix and asset_j in correlation_matrix[asset_i]:
                        corr[i, j] = correlation_matrix[asset_i][asset_j]
                    else:
                        corr[i, j] = 0.0

            # Validate correlation matrix is symmetric
            if not np.allclose(corr, corr.T):
                raise ValueError("Correlation matrix must be symmetric")

            # Covariance matrix: Cov(i,j) = corr(i,j) * vol(i) * vol(j)
            cov_matrix = np.outer(v, v) * corr

            # Portfolio variance: w^T * Cov * w
            portfolio_variance = float(w @ cov_matrix @ w)

        return float(np.sqrt(portfolio_variance))

    def calculate_var(
        self,
        returns: list[float],
        confidence: float = 0.95,
    ) -> float:
        """
        Calculate Value at Risk (VaR) using the percentile method.

        VaR represents the maximum expected loss at a given confidence level.
        For example, 95% VaR of -0.05 means there's a 5% chance of losing
        more than 5% of the portfolio value.

        Args:
            returns: List of historical returns (as decimals, e.g., -0.02 for -2%).
            confidence: Confidence level for VaR calculation (e.g., 0.95 for 95%).
                        Must be between 0 and 1.

        Returns:
            VaR as a negative decimal representing the loss threshold.
            For example, -0.05 means 5% loss at the specified confidence level.

        Raises:
            ValueError: If returns list is empty or confidence is out of range.
        """
        if not returns:
            raise ValueError("Returns list cannot be empty")

        if not 0 < confidence < 1:
            raise ValueError("Confidence must be between 0 and 1 (exclusive)")

        returns_array = np.array(returns)
        # VaR is the (1 - confidence) percentile of returns
        # For 95% confidence, we want the 5th percentile
        percentile = (1 - confidence) * 100
        var = float(np.percentile(returns_array, percentile))

        return var

    def calculate_cvar(
        self,
        returns: list[float],
        confidence: float = 0.95,
    ) -> float:
        """
        Calculate Conditional Value at Risk (CVaR), also known as Expected Shortfall.

        CVaR represents the expected loss given that the loss exceeds VaR.
        It provides a more conservative risk measure than VaR by accounting
        for the severity of losses in the tail of the distribution.

        Args:
            returns: List of historical returns (as decimals, e.g., -0.02 for -2%).
            confidence: Confidence level for CVaR calculation (e.g., 0.95 for 95%).
                        Must be between 0 and 1.

        Returns:
            CVaR as a negative decimal representing the expected loss in the tail.
            For example, -0.08 means an expected 8% loss when exceeding VaR threshold.

        Raises:
            ValueError: If returns list is empty or confidence is out of range.
        """
        if not returns:
            raise ValueError("Returns list cannot be empty")

        if not 0 < confidence < 1:
            raise ValueError("Confidence must be between 0 and 1 (exclusive)")

        returns_array = np.array(returns)
        var = self.calculate_var(returns, confidence)

        # CVaR is the mean of returns below VaR threshold
        tail_returns = returns_array[returns_array <= var]

        if len(tail_returns) == 0:
            # Edge case: no returns below VaR (shouldn't happen with proper data)
            return var

        cvar = float(np.mean(tail_returns))
        return cvar

    def calculate_max_drawdown(self, returns: list[float]) -> float:
        """
        Calculate the maximum drawdown from a series of returns.

        Maximum drawdown represents the largest peak-to-trough decline
        in portfolio value, expressed as a percentage of the peak.

        Args:
            returns: List of historical returns (as decimals, e.g., -0.02 for -2%).
                     Returns should be in chronological order.

        Returns:
            Maximum drawdown as a negative decimal (e.g., -0.25 for 25% drawdown).
            Returns 0.0 if the portfolio never declined from its peak.

        Raises:
            ValueError: If returns list is empty.
        """
        if not returns:
            raise ValueError("Returns list cannot be empty")

        returns_array = np.array(returns)

        # Calculate cumulative returns (wealth index starting from 1.0)
        cumulative = np.cumprod(1 + returns_array)

        # Track running maximum
        running_max = np.maximum.accumulate(cumulative)

        # Calculate drawdowns at each point
        drawdowns = (cumulative - running_max) / running_max

        # Maximum drawdown is the minimum (most negative) drawdown
        max_dd = float(np.min(drawdowns))

        return max_dd

    def calculate_sharpe_ratio(
        self,
        returns: list[float],
        risk_free_rate: float = 0.02,  # Annual risk-free rate
    ) -> float:
        """
        Calculate the Sharpe ratio for a series of returns.

        The Sharpe ratio measures risk-adjusted return by comparing
        excess return (over risk-free rate) to volatility.

        Args:
            returns: List of historical returns (as decimals, e.g., 0.01 for 1%).
                     Assumes DAILY returns.
            risk_free_rate: Annual risk-free rate as a decimal (default 0.02 for 2%).
                            Will be converted to daily rate.

        Returns:
            Annualized Sharpe ratio as a float.
        """
        if len(returns) < 2:
            raise ValueError("At least 2 returns are required to calculate Sharpe ratio")

        returns_array = np.array(returns)

        # Convert annual risk-free rate to daily
        daily_risk_free = risk_free_rate / 252.0

        # Calculate excess returns
        excess_returns = returns_array - daily_risk_free

        # Daily Sharpe ratio
        mean_excess = np.mean(excess_returns)
        std_daily = np.std(returns_array, ddof=1)

        if std_daily == 0:
            return 0.0

        daily_sharpe = mean_excess / std_daily

        # Annualize: Sharpe_annual = Sharpe_daily × √252
        annual_sharpe = daily_sharpe * np.sqrt(252)

        return annual_sharpe

    def calculate_risk_contribution(
        self,
        weights: dict[str, float],
        volatilities: dict[str, float],
        correlation_matrix: dict[str, dict[str, float]] | None = None,
    ) -> dict[str, float]:
        """
        Calculate each asset's contribution to total portfolio risk.

        Risk contribution shows how much each asset contributes to the
        overall portfolio volatility. This is useful for risk parity
        strategies and understanding concentration risk.

        Args:
            weights: Dictionary mapping asset identifiers to portfolio weights.
            volatilities: Dictionary mapping asset identifiers to volatilities.
            correlation_matrix: Optional correlation matrix between assets.
                                If None, assumes uncorrelated assets.

        Returns:
            Dictionary mapping asset identifiers to their risk contributions
            as decimals. The sum of all contributions equals the portfolio
            volatility.

        Raises:
            ValueError: If weights or volatilities dictionaries don't match.
        """
        assets = list(weights.keys())

        if set(assets) != set(volatilities.keys()):
            raise ValueError("Weights and volatilities must have the same assets")

        n = len(assets)
        w = np.array([weights[asset] for asset in assets])
        v = np.array([volatilities[asset] for asset in assets])

        # Build correlation matrix if not provided
        if correlation_matrix is None:
            corr = np.eye(n)
        else:
            corr = np.zeros((n, n))
            for i, asset_i in enumerate(assets):
                for j, asset_j in enumerate(assets):
                    if asset_i == asset_j:
                        corr[i, j] = 1.0
                    elif asset_i in correlation_matrix and asset_j in correlation_matrix[asset_i]:
                        corr[i, j] = correlation_matrix[asset_i][asset_j]
                    else:
                        corr[i, j] = 0.0

        # Covariance matrix
        cov_matrix = np.outer(v, v) * corr

        # Portfolio variance and volatility
        portfolio_variance = float(w @ cov_matrix @ w)
        portfolio_volatility = np.sqrt(portfolio_variance)

        if portfolio_volatility == 0:
            # Edge case: zero volatility portfolio
            return {asset: 0.0 for asset in assets}

        # Marginal risk contribution: d(sigma_p)/d(w_i) = (Cov * w)_i / sigma_p
        marginal_contrib = (cov_matrix @ w) / portfolio_volatility

        # Risk contribution: w_i * marginal_contrib_i
        risk_contrib = w * marginal_contrib

        return {assets[i]: float(risk_contrib[i]) for i in range(n)}

    def run_monte_carlo(
        self,
        capital: float,
        weights: dict[str, float],
        volatilities: dict[str, float],
        expected_returns: dict[str, float] | None = None,
        n_simulations: int = 100,  # Changed from 1000 to 100
        n_days: int = 7,  # Changed from 1 to 7
        correlation_matrix: dict[str, dict[str, float]] | None = None,
    ) -> dict:
        """
        Run Monte Carlo simulation for portfolio value projection.

        Simulates potential future portfolio paths using geometric Brownian motion
        with the specified volatilities and optional expected returns.

        Args:
            capital: Initial portfolio value (e.g., 10000 for $10,000).
            weights: Dictionary mapping asset identifiers to portfolio weights.
            volatilities: Dictionary mapping asset identifiers to annualized
                          volatilities (as decimals).
            expected_returns: Optional dictionary mapping asset identifiers to
                              expected annualized returns. If None, assumes
                              zero drift (returns driven purely by volatility).
            n_simulations: Number of simulation paths to generate (default 100).
            n_days: Number of days to simulate (default 7).
            correlation_matrix: Optional correlation matrix between assets.
                                If None, assumes uncorrelated assets.

        Returns:
            Dictionary containing:
            - scenarios: List of all simulation paths
            - n_simulations: Number of simulations run
            - n_days: Number of days simulated
            - statistics: Comprehensive statistics (mean, std, percentiles, VaR, CVaR, etc.)
            - final_values: Final portfolio values for each scenario
            - return_distribution: Histogram data for return distribution
            - return_bins: Bin edges for histogram
        """
        if capital <= 0:
            raise ValueError("Capital must be positive")

        assets = list(weights.keys())

        if set(assets) != set(volatilities.keys()):
            raise ValueError("Weights and volatilities must have the same assets")

        n = len(assets)
        w = np.array([weights[asset] for asset in assets])
        v = np.array([volatilities[asset] for asset in assets])

        # Convert annualized volatility to daily
        daily_vol = v / np.sqrt(252)

        # Expected returns (drift)
        if expected_returns is None:
            mu = np.zeros(n)
        else:
            if set(assets) != set(expected_returns.keys()):
                raise ValueError("Expected returns must have the same assets")
            mu = np.array([expected_returns[asset] for asset in assets]) / 252  # Daily drift

        # Build correlation matrix for Cholesky decomposition
        if correlation_matrix is None:
            corr = np.eye(n)
        else:
            corr = np.zeros((n, n))
            for i, asset_i in enumerate(assets):
                for j, asset_j in enumerate(assets):
                    if asset_i == asset_j:
                        corr[i, j] = 1.0
                    elif asset_i in correlation_matrix and asset_j in correlation_matrix[asset_i]:
                        corr[i, j] = correlation_matrix[asset_i][asset_j]
                    else:
                        corr[i, j] = 0.0

        # Cholesky decomposition for correlated random variables
        try:
            cholesky = np.linalg.cholesky(corr)
        except np.linalg.LinAlgError:
            # If correlation matrix is not positive definite, use nearest
            corr = self._nearest_positive_definite(corr)
            cholesky = np.linalg.cholesky(corr)

        # Run simulations
        rng = np.random.default_rng(42)  # Fixed seed for reproducibility
        all_paths = np.zeros((n_simulations, n_days + 1))
        all_paths[:, 0] = capital

        for sim in range(n_simulations):
            portfolio_value = capital
            path = [portfolio_value]

            for day in range(n_days):
                # Correlated shocks
                z = rng.standard_normal(n)
                correlated_shocks = cholesky @ z

                # Daily returns for each asset
                asset_returns = mu + daily_vol * correlated_shocks

                # Portfolio return (weighted sum)
                portfolio_return = np.sum(w * asset_returns)

                # Update portfolio value
                portfolio_value *= (1 + portfolio_return)
                path.append(portfolio_value)

            all_paths[sim] = path

        # Calculate statistics
        final_values = all_paths[:, -1]
        returns = (final_values - capital) / capital

        # Sort returns for percentiles
        sorted_returns = np.sort(returns)
        n = len(sorted_returns)

        # Percentiles
        p5 = sorted_returns[int(0.05 * n)]
        p25 = sorted_returns[int(0.25 * n)]
        p75 = sorted_returns[int(0.75 * n)]
        p95 = sorted_returns[int(0.95 * n)]

        # VaR and CVaR (5%)
        var_5 = p5
        cvar_5 = np.mean(sorted_returns[:int(0.05 * n)])

        # Probability metrics
        prob_profit = float(np.sum(returns > 0) / n_simulations)
        prob_loss = float(np.sum(returns < 0) / n_simulations)

        # Histogram for return distribution
        return_distribution, return_bins = np.histogram(returns, bins=20)

        return {
            "scenarios": all_paths.tolist(),
            "n_simulations": n_simulations,
            "n_days": n_days,
            "statistics": {
                "mean_return": float(np.mean(returns)),
                "std_return": float(np.std(returns)),
                "min_return": float(np.min(returns)),
                "max_return": float(np.max(returns)),
                "median_return": float(np.median(returns)),
                "p5_return": float(p5),
                "p25_return": float(p25),
                "p75_return": float(p75),
                "p95_return": float(p95),
                "var_95": float(var_5),
                "cvar_95": float(cvar_5),
                "prob_profit": float(prob_profit),
                "prob_loss": float(prob_loss),
                "scenarios_profitable": int(np.sum(returns > 0)),
                "scenarios_loss": int(np.sum(returns < 0)),
            },
            "final_values": {
                "initial": capital,
                "mean": float(np.mean(final_values)),
                "median": float(np.median(final_values)),
                "min": float(np.min(final_values)),
                "max": float(np.max(final_values)),
                "p5": float(np.percentile(final_values, 5)),
                "p25": float(np.percentile(final_values, 25)),
                "p75": float(np.percentile(final_values, 75)),
                "p95": float(np.percentile(final_values, 95)),
            },
            "return_distribution": return_distribution.tolist(),
            "return_bins": return_bins.tolist(),
        }

    def _nearest_positive_definite(self, matrix: NDArray[np.float64]) -> NDArray[np.float64]:
        """
        Find the nearest positive definite matrix to the input matrix.

        Uses the algorithm from Higham (2002) to find the nearest
        correlation matrix in the Frobenius norm.

        Args:
            matrix: Input symmetric matrix that may not be positive definite.

        Returns:
            Nearest positive definite matrix.
        """
        B = (matrix + matrix.T) / 2
        _, s, V = np.linalg.svd(B)
        H = V.T @ np.diag(s) @ V
        A2 = (B + H) / 2
        A3 = (A2 + A2.T) / 2

        # Ensure positive definiteness by adding small diagonal if needed
        min_eig = np.min(np.linalg.eigvalsh(A3))
        if min_eig <= 0:
            A3 += np.eye(len(A3)) * (-min_eig + 1e-10)

        return A3

    def get_simulation_statistics(
        self,
        simulations: list[SimulationResult],
    ) -> dict[str, float]:
        """
        Calculate summary statistics from Monte Carlo simulation results.

        Args:
            simulations: List of SimulationResult objects from run_monte_carlo.

        Returns:
            Dictionary containing:
            - mean_return: Average return percentage across simulations
            - median_return: Median return percentage
            - std_return: Standard deviation of returns
            - percentile_5: 5th percentile of returns
            - percentile_95: 95th percentile of returns
            - probability_loss: Probability of negative return
            - probability_gain_10pct: Probability of gain > 10%
        """
        if not simulations:
            raise ValueError("Simulations list cannot be empty")

        returns = np.array([sim.return_pct for sim in simulations])

        return {
            "mean_return": float(np.mean(returns)),
            "median_return": float(np.median(returns)),
            "std_return": float(np.std(returns)),
            "percentile_5": float(np.percentile(returns, 5)),
            "percentile_95": float(np.percentile(returns, 95)),
            "probability_loss": float(np.mean(returns < 0)),
            "probability_gain_10pct": float(np.mean(returns > 0.10)),
        }
