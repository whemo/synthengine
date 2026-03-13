"""
Synth API Client for Synth Risk Parity Portfolio Engine.

Provides async methods to fetch prediction percentiles and volatility forecasts
from the Synth API (https://api.synthdata.co).
"""

import asyncio
import logging
from typing import Final

import aiohttp
from aiohttp import ClientError, ClientTimeout

logger = logging.getLogger(__name__)

# Supported assets
SUPPORTED_ASSETS: Final[set[str]] = {
    "NVDAX",
    "AAPLX",
    "GOOGLX",
    "TSLAX",
    "SPYX",
}

# API configuration
SYNTH_API_BASE_URL: Final[str] = "https://api.synthdata.co"
DEFAULT_TIMEOUT_SECONDS: Final[float] = 30.0  # Increased timeout for concurrent requests


class SynthAPIError(Exception):
    """Base exception for Synth API errors."""

    pass


class SynthAssetNotFoundError(SynthAPIError):
    """Raised when an unsupported asset is requested."""

    pass


class SynthTimeoutError(SynthAPIError):
    """Raised when a request to Synth API times out."""

    pass


class SynthHTTPError(SynthAPIError):
    """Raised when Synth API returns an HTTP error status."""

    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(f"HTTP {status}: {message}")


class PredictionPercentiles:
    """Prediction percentiles for an asset."""

    def __init__(
        self,
        p5: float,
        p10: float,
        p25: float,
        p50: float,
        p75: float,
        p90: float,
        p95: float,
    ):
        self.p5 = p5
        self.p10 = p10
        self.p25 = p25
        self.p50 = p50
        self.p75 = p75
        self.p90 = p90
        self.p95 = p95

    def to_dict(self) -> dict[str, float]:
        """Convert to dictionary representation."""
        return {
            "p5": self.p5,
            "p10": self.p10,
            "p25": self.p25,
            "p50": self.p50,
            "p75": self.p75,
            "p90": self.p90,
            "p95": self.p95,
        }

    def __repr__(self) -> str:
        return (
            f"PredictionPercentiles(p5={self.p5}, p50={self.p50}, p95={self.p95})"
        )


class VolatilityForecast:
    """24-hour volatility forecast for an asset."""

    def __init__(self, volatility_24h: float, asset: str):
        self.volatility_24h = volatility_24h
        self.asset = asset

    def to_dict(self) -> dict[str, float | str]:
        """Convert to dictionary representation."""
        return {
            "asset": self.asset,
            "volatility_24h": self.volatility_24h,
        }

    def __repr__(self) -> str:
        return f"VolatilityForecast(asset={self.asset}, volatility_24h={self.volatility_24h})"


class SynthClient:
    """
    Async client for interacting with the Synth API.

    Provides methods to fetch prediction percentiles and volatility forecasts
    for supported assets. Uses aiohttp for async HTTP requests.

    Attributes:
        api_key: The API key for authentication.
        base_url: The base URL of the Synth API.
        timeout: Request timeout in seconds.

    Example:
        >>> async with SynthClient(api_key="your_key") as client:
        ...     percentiles = await client.get_prediction_percentiles("NVDAX")
        ...     volatility = await client.get_volatility("AAPLX")
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = SYNTH_API_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ):
        """
        Initialize the Synth API client.

        Args:
            api_key: The API key for authentication.
            base_url: The base URL of the Synth API. Defaults to production URL.
            timeout: Request timeout in seconds. Defaults to 10 seconds.
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """
        Get or create the aiohttp session.

        Returns:
            The aiohttp ClientSession instance.
        """
        if self._session is None or self._session.closed:
            timeout = ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self) -> None:
        """Close the underlying HTTP session."""
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None

    async def __aenter__(self) -> "SynthClient":
        """Async context manager entry."""
        await self._get_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()

    def _validate_asset(self, asset: str) -> None:
        """
        Validate that the asset is supported.

        Args:
            asset: The asset symbol to validate.

        Raises:
            SynthAssetNotFoundError: If the asset is not supported.
        """
        if asset not in SUPPORTED_ASSETS:
            raise SynthAssetNotFoundError(
                f"Asset '{asset}' is not supported. "
                f"Supported assets: {', '.join(sorted(SUPPORTED_ASSETS))}"
            )

    def _get_auth_headers(self) -> dict[str, str]:
        """
        Get authentication headers for API requests.

        Returns:
            Dictionary containing the Authorization header.
        """
        return {"Authorization": f"Apikey {self.api_key}"}

    async def _request(self, method: str, endpoint: str, params: dict | None = None) -> dict:
        """
        Make an HTTP request to the Synth API.

        Args:
            method: HTTP method (GET, POST, etc.).
            endpoint: API endpoint (e.g., "/insights/prediction-percentiles").
            params: Optional query parameters.

        Returns:
            JSON response as a dictionary.

        Raises:
            SynthTimeoutError: If the request times out.
            SynthHTTPError: If the API returns an error status.
            SynthAPIError: For other request errors.
        """
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        headers = self._get_auth_headers()

        try:
            async with session.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
            ) as response:
                if response.status >= 400:
                    error_text = await response.text()
                    raise SynthHTTPError(status=response.status, message=error_text)

                return await response.json()

        except asyncio.TimeoutError as e:
            raise SynthTimeoutError(f"Request to {url} timed out after {self.timeout}s") from e
        except ClientError as e:
            raise SynthAPIError(f"Request failed: {str(e)}") from e

    async def get_prediction_percentiles(self, asset: str) -> PredictionPercentiles:
        """
        Fetch prediction percentiles for a given asset.

        Retrieves the distribution of predicted returns at various percentile
        levels (5th, 10th, 25th, 50th, 75th, 90th, 95th).

        Args:
            asset: The asset symbol (e.g., "NVDAX", "AAPLX").

        Returns:
            PredictionPercentiles object containing all percentile values.

        Raises:
            SynthAssetNotFoundError: If the asset is not supported.
            SynthTimeoutError: If the request times out.
            SynthHTTPError: If the API returns an error status.
            SynthAPIError: For other request errors.

        Example:
            >>> async with SynthClient(api_key="key") as client:
            ...     percentiles = await client.get_prediction_percentiles("NVDAX")
            ...     print(percentiles.p50)  # Median prediction
        """
        self._validate_asset(asset)

        response_data = await self._request(
            method="GET",
            endpoint="/insights/prediction-percentiles",
            params={"asset": asset},
        )

        # Parse response - API returns array of percentiles
        forecast_future = response_data.get("forecast_future", {})
        data = forecast_future.get("percentiles", [])
        
        logger.info(f"[SYNTH] Raw percentiles for {asset}: len={len(data) if isinstance(data, list) else 'N/A'}")

        # Use last element if array (most recent forecast)
        if isinstance(data, list) and len(data) > 1:
            percentile_data = data[-1]  # Use most recent forecast (last element)
            logger.info(f"[SYNTH] Using LAST element for {asset}")
        elif isinstance(data, list) and len(data) == 1:
            percentile_data = data[0]
            logger.warning(f"[SYNTH] Only ONE element for {asset}")
        else:
            percentile_data = data if isinstance(data, dict) else {}
            logger.warning(f"[SYNTH] Using dict/empty for {asset}")
        
        logger.info(f"[SYNTH] percentile_data for {asset}: {percentile_data}")

        # API returns: 0.005, 0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 0.995
        # We need: p5, p10, p25, p50, p75, p90, p95
        # Map available keys (use 0.2 for p10, 0.8 for p90 as closest approximations)
        p5 = float(percentile_data.get("0.05", 0))
        p10 = float(percentile_data.get("0.1", percentile_data.get("0.2", 0)))  # Use 0.2 as fallback
        p25 = float(percentile_data.get("0.25", percentile_data.get("0.2", 0)))  # Use 0.2 as fallback
        p50 = float(percentile_data.get("0.5", 0))
        p75 = float(percentile_data.get("0.75", percentile_data.get("0.65", 0)))  # Use 0.65 as fallback
        p90 = float(percentile_data.get("0.9", percentile_data.get("0.8", 0)))  # Use 0.8 as fallback
        p95 = float(percentile_data.get("0.95", 0))

        return PredictionPercentiles(
            p5=p5,
            p10=p10,
            p25=p25,
            p50=p50,
            p75=p75,
            p90=p90,
            p95=p95,
        )

    async def get_volatility(self, asset: str) -> VolatilityForecast:
        """
        Fetch 24-hour volatility forecast for a given asset.

        Retrieves the predicted volatility for the next 24 hours,
        useful for risk parity calculations.

        Args:
            asset: The asset symbol (e.g., "NVDAX", "AAPLX").

        Returns:
            VolatilityForecast object containing the 24h volatility prediction.

        Raises:
            SynthAssetNotFoundError: If the asset is not supported.
            SynthTimeoutError: If the request times out.
            SynthHTTPError: If the API returns an error status.
            SynthAPIError: For other request errors.

        Example:
            >>> async with SynthClient(api_key="key") as client:
            ...     vol = await client.get_volatility("TSLAX")
            ...     print(f"24h volatility: {vol.volatility_24h}")
        """
        self._validate_asset(asset)

        response_data = await self._request(
            method="GET",
            endpoint="/insights/volatility",
            params={"asset": asset},
        )

        # Parse response - API returns realized.volatility or realized.average_volatility
        data = response_data.get("data", response_data)
        realized = data.get("realized", {})
        
        # Try different possible keys - volatility is already in decimal form (not percentage)
        volatility = float(
            realized.get("volatility_24h", 
            realized.get("volatility", 
            realized.get("average_volatility", 0)))
        )
        
        # If volatility > 1, it's probably in percentage form (e.g., 18.86 = 18.86%)
        # Convert to decimal
        if volatility > 1:
            volatility = volatility / 100

        return VolatilityForecast(
            volatility_24h=volatility,
            asset=asset,
        )

    async def get_all_predictions(self, assets: list[str] | None = None) -> dict[str, PredictionPercentiles]:
        """
        Fetch prediction percentiles for multiple assets sequentially (to avoid rate limits).

        Args:
            assets: List of asset symbols. If None, fetches for all supported assets.

        Returns:
            Dictionary mapping asset symbols to their PredictionPercentiles.

        Example:
            >>> async with SynthClient(api_key="key") as client:
            ...     predictions = await client.get_all_predictions(["NVDAX", "AAPLX"])
        """
        if assets is None:
            assets = list(SUPPORTED_ASSETS)

        output: dict[str, PredictionPercentiles] = {}
        for asset in assets:
            try:
                percentiles = await self.get_prediction_percentiles(asset)
                output[asset] = percentiles
            except Exception as e:
                logger.warning(f"Failed to fetch predictions for {asset}: {e}")

        return output

    async def get_all_volatility(self, assets: list[str] | None = None) -> dict[str, VolatilityForecast]:
        """
        Fetch volatility forecasts for multiple assets sequentially (to avoid rate limits).

        Args:
            assets: List of asset symbols. If None, fetches for all supported assets.

        Returns:
            Dictionary mapping asset symbols to their VolatilityForecast.

        Example:
            >>> async with SynthClient(api_key="key") as client:
            ...     volatilities = await client.get_all_volatility()
        """
        if assets is None:
            assets = list(SUPPORTED_ASSETS)

        output: dict[str, VolatilityForecast] = {}
        for asset in assets:
            try:
                forecast = await self.get_volatility(asset)
                output[asset] = forecast
            except Exception as e:
                logger.warning(f"Failed to fetch volatility for {asset}: {e}")

        return output
