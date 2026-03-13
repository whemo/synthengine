"""
Yahoo Finance Price Client for fetching current and historical prices.

Provides async methods to fetch current prices and historical price data
from Yahoo Finance using the yfinance library.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Final

import yfinance as yf
from yfinance import Ticker

# Ticker mapping: custom symbols -> Yahoo Finance symbols
TICKER_MAPPING: Final[dict[str, str]] = {
    "NVDAX": "NVDA",
    "AAPLX": "AAPL",
    "GOOGLX": "GOOGL",
    "TSLAX": "TSLA",
    "SPYX": "SPY",
}

# Reverse mapping for reference
REVERSE_TICKER_MAPPING: Final[dict[str, str]] = {v: k for k, v in TICKER_MAPPING.items()}

# Default timeout for yfinance operations (seconds)
DEFAULT_TIMEOUT_SECONDS: Final[float] = 30.0


class PriceClientError(Exception):
    """Base exception for Price Client errors."""

    pass


class PriceTickerNotFoundError(PriceClientError):
    """Raised when a ticker is not found on Yahoo Finance."""

    pass


class PriceTimeoutError(PriceClientError):
    """Raised when a price fetch operation times out."""

    pass


class PriceInvalidTickerError(PriceClientError):
    """Raised when an invalid ticker symbol is provided."""

    pass


@dataclass
class HistoricalPrice:
    """Historical price data for a single day."""

    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    adjusted_close: float

    def to_dict(self) -> dict[str, float | str]:
        """Convert to dictionary representation."""
        return {
            "date": self.date.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "adjusted_close": self.adjusted_close,
        }

    def __repr__(self) -> str:
        return (
            f"HistoricalPrice(date={self.date.strftime('%Y-%m-%d')}, "
            f"close={self.close}, volume={self.volume})"
        )


class PriceClient:
    """
    Async client for fetching price data from Yahoo Finance.

    Provides methods to fetch current prices and historical price data
    for supported assets. Uses yfinance library with async wrapper.

    Attributes:
        timeout: Request timeout in seconds.

    Example:
        >>> client = PriceClient()
        >>> price = await client.get_current_price("NVDAX")
        >>> history = await client.get_historical_prices("AAPLX", period="1mo")
    """

    def __init__(self, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        """
        Initialize the Yahoo Finance price client.

        Args:
            timeout: Request timeout in seconds. Defaults to 30 seconds.
        """
        self.timeout = timeout

    def _map_ticker(self, symbol: str) -> str:
        """
        Map custom ticker symbol to Yahoo Finance ticker.

        Args:
            symbol: The custom ticker symbol (e.g., "NVDAX").

        Returns:
            The Yahoo Finance ticker symbol (e.g., "NVDA").

        Raises:
            PriceInvalidTickerError: If the symbol format is invalid.
        """
        # Check if it's a custom ticker that needs mapping
        if symbol in TICKER_MAPPING:
            return TICKER_MAPPING[symbol]

        # If it's already a standard ticker, return as-is
        # Remove 'X' suffix if present but not in mapping
        if symbol.endswith("X") and symbol[:-1] in TICKER_MAPPING.values():
            return symbol[:-1]

        # Return as-is for standard tickers
        return symbol

    def _fetch_current_price_sync(self, ticker_symbol: str) -> float:
        """
        Synchronous method to fetch current price from Yahoo Finance.

        Args:
            ticker_symbol: The Yahoo Finance ticker symbol.

        Returns:
            The current price as a float.

        Raises:
            PriceTickerNotFoundError: If the ticker is not found.
            PriceClientError: For other fetch errors.
        """
        try:
            ticker = Ticker(ticker_symbol)

            # Fetch current price - try multiple attributes for reliability
            price = None

            # Try fast_info first (newer yfinance versions)
            if hasattr(ticker, "fast_info") and ticker.fast_info is not None:
                try:
                    price = ticker.fast_info["lastPrice"]
                except (KeyError, TypeError):
                    pass

            # Fallback to history
            if price is None:
                hist = ticker.history(period="1d")
                if not hist.empty:
                    price = hist["Close"].iloc[-1]

            # Final fallback to regular_market_price
            if price is None:
                price = ticker.info.get("regularMarketPrice")

            if price is None:
                raise PriceTickerNotFoundError(
                    f"Could not fetch price for ticker '{ticker_symbol}'. "
                    "Ticker may be invalid or market is closed."
                )

            return float(price)

        except PriceTickerNotFoundError:
            raise
        except Exception as e:
            if "404" in str(e) or "Not Found" in str(e):
                raise PriceTickerNotFoundError(
                    f"Ticker '{ticker_symbol}' not found on Yahoo Finance"
                ) from e
            raise PriceClientError(f"Failed to fetch price for '{ticker_symbol}': {str(e)}") from e

    def _fetch_historical_prices_sync(
        self, ticker_symbol: str, period: str = "1mo"
    ) -> list[HistoricalPrice]:
        """
        Synchronous method to fetch historical prices from Yahoo Finance.

        Args:
            ticker_symbol: The Yahoo Finance ticker symbol.
            period: The time period for historical data.
                    Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max.

        Returns:
            List of HistoricalPrice objects sorted by date (oldest first).

        Raises:
            PriceTickerNotFoundError: If the ticker is not found.
            PriceClientError: For other fetch errors.
        """
        try:
            ticker = Ticker(ticker_symbol)
            hist = ticker.history(period=period)

            if hist.empty:
                raise PriceTickerNotFoundError(
                    f"No historical data found for ticker '{ticker_symbol}'. "
                    "Ticker may be invalid or insufficient data available."
                )

            prices: list[HistoricalPrice] = []
            for idx, row in hist.iterrows():
                # Handle timezone-aware datetime
                date = idx
                if hasattr(date, "to_pydatetime"):
                    date = date.to_pydatetime()
                elif hasattr(date, "replace"):
                    # Remove timezone info for consistency
                    date = date.replace(tzinfo=None)

                price = HistoricalPrice(
                    date=date,
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=int(row["Volume"]) if "Volume" in row else 0,
                    adjusted_close=float(row["Adj Close"]) if "Adj Close" in row else float(row["Close"]),
                )
                prices.append(price)

            return prices

        except PriceTickerNotFoundError:
            raise
        except Exception as e:
            if "404" in str(e) or "Not Found" in str(e):
                raise PriceTickerNotFoundError(
                    f"Ticker '{ticker_symbol}' not found on Yahoo Finance"
                ) from e
            raise PriceClientError(
                f"Failed to fetch historical prices for '{ticker_symbol}': {str(e)}"
            ) from e

    async def get_current_price(self, symbol: str) -> float:
        """
        Fetch the current price for a given asset.

        Retrieves the latest market price for the specified ticker symbol.
        Handles ticker mapping for custom symbols (e.g., NVDAX -> NVDA).

        Args:
            symbol: The asset symbol (e.g., "NVDAX", "AAPLX", "NVDA").

        Returns:
            The current price as a float.

        Raises:
            PriceInvalidTickerError: If the symbol format is invalid.
            PriceTickerNotFoundError: If the ticker is not found on Yahoo Finance.
            PriceTimeoutError: If the request times out.
            PriceClientError: For other fetch errors.

        Example:
            >>> client = PriceClient()
            >>> price = await client.get_current_price("NVDAX")
            >>> print(f"NVDA price: ${price:.2f}")
        """
        ticker_symbol = self._map_ticker(symbol)

        try:
            # Use asyncio.to_thread to run synchronous yfinance in async context
            price = await asyncio.wait_for(
                asyncio.to_thread(self._fetch_current_price_sync, ticker_symbol),
                timeout=self.timeout,
            )
            return price

        except asyncio.TimeoutError:
            raise PriceTimeoutError(
                f"Request for '{symbol}' timed out after {self.timeout}s"
            ) from None
        except (PriceTickerNotFoundError, PriceInvalidTickerError):
            raise
        except PriceClientError:
            raise
        except Exception as e:
            raise PriceClientError(
                f"Unexpected error fetching price for '{symbol}': {str(e)}"
            ) from e

    async def get_historical_prices(
        self, symbol: str, period: str = "1mo"
    ) -> list[HistoricalPrice]:
        """
        Fetch historical prices for a given asset.

        Retrieves historical OHLCV (Open, High, Low, Close, Volume) data
        for the specified time period. Handles ticker mapping for custom symbols.

        Args:
            symbol: The asset symbol (e.g., "NVDAX", "AAPLX", "NVDA").
            period: The time period for historical data.
                    Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max.
                    Defaults to "1mo".

        Returns:
            List of HistoricalPrice objects sorted by date (oldest first).
            Each object contains OHLCV data for a single trading day.

        Raises:
            PriceInvalidTickerError: If the symbol format is invalid.
            PriceTickerNotFoundError: If the ticker is not found on Yahoo Finance.
            PriceTimeoutError: If the request times out.
            PriceClientError: For other fetch errors.

        Example:
            >>> client = PriceClient()
            >>> history = await client.get_historical_prices("AAPLX", period="1mo")
            >>> for price in history:
            ...     print(f"{price.date}: ${price.close:.2f}")
        """
        ticker_symbol = self._map_ticker(symbol)

        try:
            # Use asyncio.to_thread to run synchronous yfinance in async context
            prices = await asyncio.wait_for(
                asyncio.to_thread(self._fetch_historical_prices_sync, ticker_symbol, period),
                timeout=self.timeout,
            )
            return prices

        except asyncio.TimeoutError:
            raise PriceTimeoutError(
                f"Request for '{symbol}' timed out after {self.timeout}s"
            ) from None
        except (PriceTickerNotFoundError, PriceInvalidTickerError):
            raise
        except PriceClientError:
            raise
        except Exception as e:
            raise PriceClientError(
                f"Unexpected error fetching historical prices for '{symbol}': {str(e)}"
            ) from e

    async def get_current_prices_batch(
        self, symbols: list[str]
    ) -> dict[str, float | PriceClientError]:
        """
        Fetch current prices for multiple assets concurrently.

        Args:
            symbols: List of asset symbols to fetch prices for.

        Returns:
            Dictionary mapping symbols to their current prices.
            Failed fetches are represented by their exception.

        Example:
            >>> client = PriceClient()
            >>> prices = await client.get_current_prices_batch(["NVDAX", "AAPLX", "TSLAX"])
            >>> for symbol, price in prices.items():
            ...     if isinstance(price, float):
            ...         print(f"{symbol}: ${price:.2f}")
            ...     else:
            ...         print(f"{symbol}: Error - {price}")
        """

        async def fetch_price(symbol: str) -> tuple[str, float | PriceClientError]:
            try:
                price = await self.get_current_price(symbol)
                return symbol, price
            except PriceClientError as e:
                return symbol, e

        results = await asyncio.gather(*[fetch_price(symbol) for symbol in symbols])
        return dict(results)

    async def get_historical_prices_batch(
        self, symbols: list[str], period: str = "1mo"
    ) -> dict[str, list[HistoricalPrice] | PriceClientError]:
        """
        Fetch historical prices for multiple assets concurrently.

        Args:
            symbols: List of asset symbols to fetch historical prices for.
            period: The time period for historical data. Defaults to "1mo".

        Returns:
            Dictionary mapping symbols to their historical prices.
            Failed fetches are represented by their exception.

        Example:
            >>> client = PriceClient()
            >>> histories = await client.get_historical_prices_batch(["NVDAX", "AAPLX"])
            >>> for symbol, history in histories.items():
            ...     if isinstance(history, list):
            ...         print(f"{symbol}: {len(history)} days of data")
        """

        async def fetch_history(symbol: str) -> tuple[str, list[HistoricalPrice] | PriceClientError]:
            try:
                prices = await self.get_historical_prices(symbol, period)
                return symbol, prices
            except PriceClientError as e:
                return symbol, e

        results = await asyncio.gather(*[fetch_history(symbol) for symbol in symbols])
        return dict(results)

    def _calculate_historical_volatility_sync(
        self, ticker_symbol: str, period: str = "3mo"
    ) -> float:
        """
        Calculate historical volatility from price returns.

        Uses standard deviation of daily returns annualized by sqrt(252).

        Args:
            ticker_symbol: The Yahoo Finance ticker symbol.
            period: The time period for historical data. Defaults to "3mo".

        Returns:
            Annualized volatility as a decimal (e.g., 0.25 for 25%).

        Raises:
            PriceClientError: If data fetch fails or insufficient data.
        """
        try:
            ticker = Ticker(ticker_symbol)
            hist = ticker.history(period=period)

            if len(hist) < 30:
                raise PriceClientError(
                    f"Insufficient data for volatility calculation: {len(hist)} days"
                )

            # Calculate daily returns
            returns = hist["Close"].pct_change().dropna()

            if len(returns) < 30:
                raise PriceClientError(
                    f"Insufficient return data for volatility calculation: {len(returns)} days"
                )

            # Calculate standard deviation of returns
            daily_volatility = returns.std()

            # Annualize (sqrt of 252 trading days)
            annualized_volatility = daily_volatility * (252 ** 0.5)

            return float(annualized_volatility)

        except Exception as e:
            if isinstance(e, PriceClientError):
                raise
            raise PriceClientError(
                f"Failed to calculate historical volatility: {str(e)}"
            ) from e

    async def get_historical_volatility(
        self, symbol: str, period: str = "3mo"
    ) -> float:
        """
        Calculate historical volatility for a given asset.

        Uses standard deviation of daily returns from historical prices,
        annualized by multiplying by sqrt(252).

        Args:
            symbol: The asset symbol (e.g., "NVDAX", "AAPLX").
            period: The time period for historical data. Defaults to "3mo".

        Returns:
            Annualized volatility as a decimal.

        Raises:
            PriceClientError: If calculation fails.

        Example:
            >>> client = PriceClient()
            >>> vol = await client.get_historical_volatility("NVDAX")
            >>> print(f"NVDA volatility: {vol:.2%}")
        """
        ticker_symbol = self._map_ticker(symbol)

        try:
            volatility = await asyncio.wait_for(
                asyncio.to_thread(self._calculate_historical_volatility_sync, ticker_symbol, period),
                timeout=self.timeout,
            )
            return volatility

        except asyncio.TimeoutError:
            raise PriceTimeoutError(
                f"Volatility calculation for '{symbol}' timed out after {self.timeout}s"
            ) from None
        except PriceClientError:
            raise
        except Exception as e:
            raise PriceClientError(
                f"Unexpected error calculating volatility for '{symbol}': {str(e)}"
            ) from e
