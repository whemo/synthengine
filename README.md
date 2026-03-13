# SynthEngine

Portfolio optimizer for the Synth hackathon. Takes a capital amount or existing positions, fetches Synth API AI price percentiles (P5-P95), and runs Risk Parity allocation where each asset contributes equally to total portfolio risk. The weights are forward-looking by design: instead of historical vol, the optimizer uses what the model expects going forward.

Output is a full analysis dashboard: optimal allocation with exact share counts, BUY/SELL/HOLD signals, drift monitoring against target weights, 7-day Monte Carlo with VaR/CVaR, Synth AI vol vs historical vol comparison, 24H forecast, and a 9-month backtest against SPY.

---

## Input modes

**Synthetic Creation** - put in a capital amount, pick assets, set risk tolerance. Get optimal allocation from scratch with exact share counts.

**Active Portfolio** - put in your current positions (shares per asset + cash on hand). Get drift analysis showing how far you've deviated from optimal, and BUY/SELL/HOLD signals to fix it.

---

## Output screens

### 1. Portfolio Analysis
The main dashboard. Top bar shows four metrics: Net Liquidity, Annualized Volatility, Tail Risk (Max Drawdown), Risk Profile.

Below that, two panels:

**Liquidity Distribution** - donut chart with current vs target weights per asset. Sector tags at the bottom (Technology, Broad Market, Consumer). Investable capital total.

**Execution Signals** - concrete actions per asset. New portfolio gets ALLOCATE, existing gets BUY/SELL/HOLD. Each signal shows current weight, target weight, share count, and one-line reasoning.

### 2. Drift Monitor
Progress bars showing how far each position sits from its target weight. Status tags: Optimal, Drift, Action. Thresholds: 2% is fine, 5% worth watching, 10% triggers rebalance. Throws a "Rebalancing Required" banner at the top when something needs attention.

### 3. Monte Carlo Simulation
100 scenarios over a 7-day horizon using Geometric Brownian Motion. Fan chart with P5-P95 confidence band. Below the chart: Probability of Profit, VaR 95%, CVaR 95% cards, and a return distribution histogram.

### 4. Signal Variance
Side-by-side comparison of Synth AI forecast vol vs 3-month realized historical vol for each asset. Shows a compression or expansion percentage — "69% compression" on NVDAX means Synth is predicting significantly lower volatility than recent history suggests.

### 5. 24H Synth Forecast
Next 24 hours. Shows expected portfolio value range (worst/current/best), Probability of Gain, Std Dev, Min Return. Gets labeled "Unfavorable" when probability of gain drops below threshold.

### 6. Historical Performance
1-year backtest chart using Yahoo Finance historical prices. Shows portfolio growth over time with the entry price and current price per asset, plus percentage return on each.

### 7. Retrospective Alpha
Same backtest but benchmarked against SPY. Strategy line vs benchmark line on one chart. Demo run: **$277,973 vs $233,090** on a $190k portfolio over 9 months.

---

## Risk metrics

| Metric | What it is | Demo value |
|--------|-----------|------------|
| Annualized Volatility | Synth AI-predicted vol, annualized | 3.4% |
| Sharpe Ratio | Return per unit of risk | -0.66 |
| 95% VaR | Max daily loss 95% of the time | -0.30% |
| Max Drawdown | Worst peak-to-trough in simulation | -2.6% |
| CVaR 95% | Average loss in the worst 5% of scenarios | -0.37% |
| Prob. of Profit (7-day) | Monte Carlo runs ending positive | 44% |
| Prob. of Gain (24H) | 24H forecast runs ending positive | 39.5% |

Risk Multiplier constraints:

| Parameter | Low | Medium | High |
|-----------|-----|--------|------|
| Min weight per asset | 10% | 5% | 5% |
| Max weight per asset | 30% | 40% | 50% |
| Max portfolio volatility | 15% | 25% | 40% |

---

## Math

```python
# Volatility from Synth percentiles (optimizer.py)
volatility = (p90 - p10) / current_price / 2.56
annualized_vol = volatility * sqrt(252)

# Risk Parity weights with risk tolerance factor (optimizer.py)
# Factors: low=1.5, medium=1.0, high=0.7
inverse_vol = 1.0 / volatility
adjusted_inverse_vol = inverse_vol ** risk_tolerance_factor
weight[i] = adjusted_inverse_vol[i] / sum(all_adjusted_inverse_vols)

# Risk contribution (risk_engine.py)
risk_contribution[i] = weight[i] * volatility[i] / portfolio_volatility

# Monte Carlo GBM (risk_engine.py)
daily_vol = annualized_vol / sqrt(252)
portfolio_value[t+1] = portfolio_value[t] * (1 + daily_drift + daily_vol * z)
# z ~ N(0,1), 100 simulations x 7 days

# Alpha vs SPY (main.py)
alpha = portfolio_1y_return - sp500_1y_return
```

---

## Stack

```
Backend:   Python 3.11+, FastAPI 0.109+, Pydantic 2.5+, aiohttp, yfinance, NumPy
Frontend:  React 18, TypeScript, Vite 5+, TailwindCSS 3.4+, Recharts, Axios
Data:      Synth API (P5-P95 price percentiles), Yahoo Finance (historical prices)
```

---

## Assets

| Symbol | Underlying | Sector | Yahoo Ticker |
|--------|-----------|--------|-------------|
| NVDAX | NVIDIA | Technology | NVDA |
| AAPLX | Apple | Technology | AAPL |
| GOOGLX | Alphabet | Technology | GOOGL |
| TSLAX | Tesla | Consumer | TSLA |
| SPYX | S&P 500 ETF | Broad Market | SPY |

---

## Setup

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install && npm run dev
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

Add `SYNTH_API_KEY` to `backend/.env`. If the API is unreachable the engine falls back to Yahoo Finance historical vol automatically.

---

## Environment

```env
SYNTH_API_KEY=your_api_key_here
CORS_ORIGINS=["http://localhost:3000"]
DEBUG=true
HOST=0.0.0.0
PORT=8000
API_TIMEOUT=30
DEFAULT_SIMULATIONS=100
DEFAULT_DAYS=7
```

---

## API

| Endpoint | Method | |
|----------|--------|-|
| `/api/v1/health` | GET | Health check |
| `/api/v1/assets` | GET | Available assets |
| `/api/v1/price/{symbol}` | GET | Current price |
| `/api/v1/volatility/{symbol}` | GET | Synth AI volatility |
| `/api/v1/portfolio/analyze` | POST | Full analysis |
| `/api/v1/portfolio/optimize` | POST | Weights only |
| `/api/v1/debug/calculations` | GET | Trace calculations |

**New portfolio**
```json
POST /api/v1/portfolio/analyze
{
  "mode": "new",
  "capital": 100000,
  "assets": ["NVDAX", "AAPLX", "GOOGLX", "TSLAX", "SPYX"],
  "risk_tolerance": "medium"
}
```

**Existing portfolio**
```json
POST /api/v1/portfolio/analyze
{
  "mode": "existing",
  "positions": {"NVDAX": 200, "AAPLX": 50, "GOOGLX": 25},
  "cash": 10000,
  "assets": ["NVDAX", "AAPLX", "GOOGLX"],
  "risk_tolerance": "medium"
}
```

---

## Structure

```
synthengine/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI endpoints
│   │   ├── models/schemas.py          # Pydantic models
│   │   └── services/
│   │       ├── synth_client.py        # Synth API, percentile fetching
│   │       ├── price_client.py        # Yahoo Finance, ticker mapping
│   │       ├── optimizer.py           # Risk Parity algorithm
│   │       └── risk_engine.py         # Monte Carlo, VaR, CVaR, Sharpe
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/
        │   ├── PortfolioInput.tsx
        │   ├── AllocationChart.tsx
        │   ├── RiskContributionTable.tsx
        │   ├── MonteCarloChart.tsx
        │   ├── RiskMetricsCard.tsx
        │   ├── RecommendationsPanel.tsx
        │   ├── VolatilityComparisonChart.tsx
        │   ├── SynthForecast24h.tsx
        │   ├── BenchmarkCard.tsx
        │   ├── HistoricalPerformanceChart.tsx
        │   ├── SectorExposureChart.tsx
        │   ├── DriftMonitor.tsx
        │   └── TopMetricsBar.tsx
        ├── contexts/CurrencyContext.tsx
        ├── hooks/usePortfolio.ts
        ├── services/api.ts
        └── App.tsx
```

---

## Troubleshooting

**Backend won't start** - check Python version (needs 3.11+), try `pip install -r requirements.txt --force-reinstall`.

**"Synth API key not configured"** - check `SYNTH_API_KEY` in `backend/.env`, make sure the file is inside the `backend/` folder, restart uvicorn after editing.

**Frontend can't reach backend** - backend needs to be on port 8000, check `CORS_ORIGINS` in `.env` and the proxy setting in `vite.config.ts`.

**Monte Carlo shows 0 scenarios** - check `DEFAULT_SIMULATIONS=100` in `.env`, make sure volatilities are coming back > 0 from the API.

---

MIT
