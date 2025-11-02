# Ray Dalio Economic Risk Monitoring Dashboard

[![Deploy to GitHub Pages](https://github.com/substrateindependent/dailo_dashboard/actions/workflows/deploy.yml/badge.svg)](https://github.com/substrateindependent/dailo_dashboard/actions/workflows/deploy.yml)

A real-time economic risk monitoring dashboard inspired by Ray Dalio's principles for tracking major economic indicators and calculating Bayesian probabilities for significant economic events.

## 🌐 Live Demo

**View the deployed dashboard:** [https://substrateindependent.github.io/dailo_dashboard/](https://substrateindependent.github.io/dailo_dashboard/)

> Note: The live demo uses mock economic data by default. For real-time FRED API data, see the [Live Data Setup](#live-data-setup) section below.

## Features

- 📊 **Real-time Economic Data**: Fetches live data from the Federal Reserve Economic Data (FRED) API
- 🧠 **Enhanced Bayesian Forecasting**: Calculates conditional probabilities with trend analysis
- 📈 **Trend Analysis**: Analyzes 12-month historical data to adjust probabilities based on improving/worsening trends
- 💾 **Smart Caching**: 30-minute data cache reduces API calls and improves performance
- 🔄 **Automatic Updates**: Refreshes data every 30 minutes
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- ⚡ **Graceful Degradation**: Falls back to mock data if API is unavailable
- 🛡️ **Error Handling**: Comprehensive error handling and validation throughout
- 🏦 **Treasury Integration**: Real Budget Deficit/GDP data from US Treasury API

## Monitored Economic Risks

1. **Massive Recession** (Base: 15%)
2. **Economic Depression** (Base: 3%)
3. **USD Reserve Status Loss** (Base: 5%)
4. **US Debt Default** (Base: 1%)
5. **USD Devaluation** (Base: 20%)

## Key Economic Indicators

- 10-Year Treasury Yield
- Fed Funds Rate
- Yield Curve (10Y-2Y)
- Federal Debt/GDP
- Budget Deficit/GDP
- Credit Spreads
- VIX Volatility Index
- Dollar Index (DXY)
- Gold Price
- Unemployment Rate
- Money Supply (M2)
- Monetary Base
- Interest Payments/GDP

## Project Structure

```
dailo_dashboard/
├── index.html                 # Main HTML file
├── src/
│   ├── css/
│   │   └── styles.css        # All stylesheets
│   └── js/
│       ├── app.js            # Main application entry point
│       ├── config.js         # Configuration constants
│       ├── dataService.js    # Data fetching and API interactions
│       ├── probabilityCalculator.js  # Bayesian probability calculations
│       ├── uiManager.js      # UI updates and DOM manipulation
│       └── utils.js          # Utility functions and error handling
├── html                       # Original monolithic file (deprecated)
└── README.md
```

## Refactoring Changes

This codebase was refactored from a single monolithic HTML file into a modular, maintainable structure:

### Key Improvements

1. **Fixed File Corruption**: Removed duplicate code blocks that existed in the original file
2. **Modular Architecture**: Separated concerns into distinct modules
3. **Error Handling**: Added comprehensive error handling and validation throughout
4. **Configuration Management**: Centralized all configuration constants
5. **Input Validation**: All numeric inputs are validated
6. **XSS Prevention**: Sanitized all HTML outputs
7. **Retry Logic**: Added fetch retry with exponential backoff
8. **Throttling**: Prevented rapid refresh button clicks
9. **Global Error Handler**: Catches unhandled errors and promise rejections
10. **Logging**: Structured logging for debugging

### Module Breakdown

- **config.js**: All configuration constants, thresholds, and mock data
- **utils.js**: Error classes, fetch utilities, validation, sanitization, throttle/debounce
- **dataService.js**: Handles all API interactions and data fetching
- **probabilityCalculator.js**: Bayesian probability calculations with validation
- **uiManager.js**: All DOM manipulation and UI updates
- **app.js**: Main application logic and initialization

## Usage

### Quick Start (Mock Data)

Simply open `index.html` in a modern web browser. The dashboard will load with mock economic data.

### Live Data Setup

The dashboard now includes a complete backend proxy server with caching, trend analysis, and Treasury API integration.

#### Quick Setup

1. **Get a FRED API Key** (free): https://fred.stlouisfed.org/docs/api/api_key.html

2. **Configure your API key**:
   ```bash
   cp .env.example .env
   # Edit .env and add your FRED_API_KEY
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the backend**:
   ```bash
   npm run proxy
   ```

5. **Start the frontend** (in another terminal):
   ```bash
   npm run serve
   ```

6. **Open your browser**: http://localhost:8000

For detailed setup instructions, deployment options, and troubleshooting, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

### Backend Server Features

The included `fred-proxy-server.js` provides:

- ✅ **FRED API Integration**: Fetches all 12 economic indicators
- ✅ **Treasury API Integration**: Real Budget Deficit/GDP data
- ✅ **30-Minute Caching**: Reduces API calls and improves performance
- ✅ **Automatic Retries**: Exponential backoff for failed requests
- ✅ **Batch Fetching**: Parallel requests for faster loading
- ✅ **Historical Data**: Fetches 12 months for trend analysis
- ✅ **Rate Limiting Protection**: Respects FRED API limits

<details>
<summary><b>Old Manual Setup (Legacy)</b></summary>

To create a basic proxy server manually:

1. Create a file `fred-proxy-server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const FRED_API_KEY = 'your_fred_api_key_here';

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/fred/:seriesId', async (req, res) => {
    try {
        const { seriesId } = req.params;
        const response = await axios.get(
            `https://api.stlouisfed.org/fred/series/observations`,
            {
                params: {
                    series_id: seriesId,
                    api_key: FRED_API_KEY,
                    file_type: 'json',
                    sort_order: 'desc',
                    limit: 1
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/fred/batch', async (req, res) => {
    try {
        const { series } = req.body;
        const results = {};

        await Promise.all(
            series.map(async (seriesId) => {
                try {
                    const response = await axios.get(
                        `https://api.stlouisfed.org/fred/series/observations`,
                        {
                            params: {
                                series_id: seriesId,
                                api_key: FRED_API_KEY,
                                file_type: 'json',
                                sort_order: 'desc',
                                limit: 1
                            }
                        }
                    );
                    results[seriesId] = response.data;
                } catch (error) {
                    results[seriesId] = { error: error.message };
                }
            })
        );

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 FRED Proxy Server Running on port ${PORT}`);
});
```

2. Install dependencies:
```bash
npm install express cors axios
```

3. Run the proxy server:
```bash
node fred-proxy-server.js
```

4. Refresh the dashboard - it will automatically connect to live data

</details>

## Enhanced Bayesian Forecasting

The dashboard uses a sophisticated Bayesian probability model enhanced with trend analysis:

### Base Calculation

```
New Probability = Base Probability × Combined Factor × Correlation Discount
```

Where:
- **Base Probability**: Starting risk level (e.g., recession: 15%)
- **Combined Factor**: Product of all triggered threshold factors
- **Correlation Discount**: 0.7 for 2 factors, 0.5 for 3+ factors

### Trend Enhancement (NEW!)

Each factor is now adjusted based on historical trends:

- **Improving Trend (↑)**: Factor × 0.7 (reduces probability)
- **Stable Trend (→)**: Factor × 1.0 (no change)
- **Worsening Trend (↓)**: Factor × 1.3 (increases probability)
- **High Velocity**: Amplifies effect (0.5x to 1.5x range)

**Example:** Credit spreads >400bps normally = 2.0x
- If worsening rapidly → 2.0 × 1.5 = 3.0x
- If improving → 2.0 × 0.7 = 1.4x

This makes the forecast more accurate by considering whether indicators are getting better or worse.

### Trend Analysis Details

- **Data Source**: 12 months of historical data per indicator
- **Direction**: Linear regression determines trend slope
- **Velocity**: Rate of change per month
- **Acceleration**: Change in velocity (for future enhancements)
- **Inverted Indicators**: Automatically handles indicators where higher = worse (unemployment, credit spreads, etc.)

## Configuration

All configuration is centralized in `src/js/config.js`:

- `REFRESH_INTERVAL_MS`: Auto-refresh interval (default: 30 minutes)
- `FETCH_TIMEOUT_MS`: API request timeout (default: 10 seconds)
- `MAX_RETRIES`: Number of retry attempts (default: 3)
- `BASE_PROBABILITIES`: Base probability rates for each risk
- `RISK_THRESHOLDS`: Alert thresholds for each risk level
- `ECONOMIC_THRESHOLDS`: Economic indicator thresholds for probability calculations

Backend configuration in `fred-proxy-server.js`:
- `CACHE_DURATION_MS`: Cache TTL (default: 30 minutes)
- `REQUEST_TIMEOUT_MS`: API request timeout (default: 10 seconds)
- `MAX_RETRIES`: Retry attempts (default: 3)
- `PORT`: Server port (default: 3001)

## Browser Compatibility

Requires a modern browser with support for:
- ES6 Modules
- Fetch API
- CSS Grid and Flexbox
- Async/Await

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

### Running Locally

1. Clone the repository
2. Open `index.html` in a browser (or use a local server)
3. For live data, follow the "Live Data Setup" instructions above

### Serving with a Local Server

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx http-server -p 8000

# Then visit http://localhost:8000
```

## Error Handling

The application includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Validation Errors**: Input validation for all numeric data
- **API Errors**: Graceful fallback to mock data
- **Global Error Handler**: Catches unhandled errors and displays user-friendly messages

## Security

- All HTML outputs are sanitized to prevent XSS attacks
- Input validation on all numeric data
- API requests include timeout protection
- No direct execution of user-provided code

## Performance

- Parallel data fetching where possible
- Throttled refresh button to prevent abuse
- Efficient DOM updates (only changed elements)
- Automatic cleanup of intervals on page unload

## Accessibility

- ARIA labels for screen readers
- Keyboard navigation support
- Focus indicators for interactive elements
- Semantic HTML structure
- High contrast color scheme

## License

This is an open-source educational project. Feel free to use and modify as needed.

## Credits

Inspired by Ray Dalio's economic principles and "Principles for Navigating Big Debt Crises".

Data provided by the Federal Reserve Economic Data (FRED) API.

## Changelog

### Version 2.1.0 (Current)
- ✨ **NEW:** Complete backend proxy server with FRED & Treasury APIs
- ✨ **NEW:** 30-minute data caching for performance
- ✨ **NEW:** Trend analysis with 12-month historical data
- ✨ **NEW:** Enhanced Bayesian forecasting with trend-based adjustments
- ✨ **NEW:** Velocity and acceleration calculations
- ✨ **NEW:** Comprehensive setup and deployment guide
- 🐛 Fixed API key configuration
- 📚 Enhanced documentation with troubleshooting

### Version 2.0.0
- Complete refactoring into modular architecture
- Fixed file corruption issues
- Added comprehensive error handling
- Added input validation throughout
- Centralized configuration
- Improved security (XSS prevention, input sanitization)
- Added retry logic and timeout handling
- Added throttling for user actions
- Improved logging and debugging
- Enhanced documentation

### Version 1.0.0 (Deprecated)
- Initial monolithic single-file implementation
- Basic functionality with embedded CSS/JS
