# Setup Guide: Real Data Integration

This guide will help you set up the dashboard with real-time data from FRED API and Treasury data.

## Quick Start

### Option 1: Run with Mock Data (No Setup Required)

Simply open `index.html` in a web browser. The dashboard will use mock data.

### Option 2: Run with Real-Time Data

Follow these steps to connect to real FRED API data:

## Step 1: Get a FRED API Key

1. Visit [FRED API Registration](https://fred.stlouisfed.org/docs/api/api_key.html)
2. Click "Request API Key"
3. Sign up for a free account (if you don't have one)
4. Once logged in, go to "My Account" → "API Keys"
5. Copy your API key

**Note:** FRED API keys are free and allow 120 requests per minute.

## Step 2: Configure the API Key

You have two options to set your API key:

### Option A: Using Environment Variable (Recommended)

1. Create a `.env` file in the project root (it's already gitignored):
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your key:
   ```
   FRED_API_KEY=your_actual_api_key_here
   PORT=3001
   ```

### Option B: Edit the Server File

Edit `fred-proxy-server.js` line 17:
```javascript
FRED_API_KEY: process.env.FRED_API_KEY || 'your_actual_api_key_here',
```

## Step 3: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server framework
- `cors` - Enable cross-origin requests
- `axios` - HTTP client for API calls
- `http-server` - Development server for the frontend

## Step 4: Start the Backend Proxy Server

In one terminal, start the backend:

```bash
npm run proxy
```

Or directly:
```bash
node fred-proxy-server.js
```

You should see:
```
============================================================
🚀 FRED API Proxy Server
============================================================
Port:          3001
Cache TTL:     30 minutes
Timeout:       10 seconds
Max Retries:   3
============================================================
✓ Ready to accept connections
```

## Step 5: Start the Frontend

In another terminal, start the frontend server:

```bash
npm run serve
```

Then open your browser to:
```
http://localhost:8000
```

## Step 6: Verify Connection

Once the dashboard loads:

1. Look for the connection status indicator at the bottom
2. You should see: **"🟢 Connected to FRED API - Live Data (13/13)"**
3. Check the browser console for logs showing real data fetches

If you see "🟠 Using Mock Data", check that:
- The backend server is running on port 3001
- Your FRED API key is valid
- Check browser console and server logs for errors

## Understanding the Data Flow

```
┌─────────────────────────────────────────────┐
│  Browser (Dashboard)                        │
│  http://localhost:8000                      │
└─────────────┬───────────────────────────────┘
              │
              │ Checks: http://localhost:3001/health
              │
┌─────────────▼───────────────────────────────┐
│  Backend Proxy Server                       │
│  http://localhost:3001                      │
│  - Caches data (30 min)                     │
│  - Handles rate limiting                    │
│  - Retries on failure                       │
└─────────────┬───────────────────────────────┘
              │
              ├─────────────────┬─────────────────┐
              │                 │                 │
┌─────────────▼────┐  ┌────────▼─────┐  ┌───────▼─────┐
│   FRED API       │  │ Treasury API │  │   Cache     │
│   - 12 series    │  │ - Deficit    │  │   (30 min)  │
│   - Latest data  │  │ - GDP data   │  │             │
└──────────────────┘  └──────────────┘  └─────────────┘
```

## Features of the Backend Server

### 1. **Data Caching**
- Caches all API responses for 30 minutes
- Reduces API calls and improves performance
- Check cache status: `http://localhost:3001/api/cache/stats`

### 2. **Automatic Retries**
- Retries failed requests up to 3 times
- Exponential backoff: 1s, 2s, 4s
- Handles transient network errors gracefully

### 3. **Batch Fetching**
- Fetches multiple indicators in parallel
- Optimized for dashboard's initial load
- Reduces total request time

### 4. **Treasury Integration**
- Real Budget Deficit/GDP data
- Automatically fetches and calculates ratio
- Falls back to estimate if API unavailable

### 5. **Historical Data for Trends**
- Fetches up to 12 months of history per indicator
- Powers the trend analysis feature
- Calculates velocity and acceleration

## API Endpoints Reference

### Health Check
```bash
curl http://localhost:3001/health
```

### Get Single Indicator
```bash
curl http://localhost:3001/api/fred/DGS10
```

### Batch Fetch Multiple Indicators
```bash
curl -X POST http://localhost:3001/api/fred/batch \
  -H "Content-Type: application/json" \
  -d '{"series": ["DGS10", "DFF", "UNRATE"]}'
```

### Get Historical Data
```bash
curl http://localhost:3001/api/fred/DGS10/history?months=12
```

### Get Deficit/GDP Ratio
```bash
curl http://localhost:3001/api/treasury/deficit
```

### Cache Management
```bash
# Get cache stats
curl http://localhost:3001/api/cache/stats

# Clear cache
curl -X POST http://localhost:3001/api/cache/clear
```

## Enhanced Bayesian Forecasting

The dashboard now includes **trend-based probability adjustments**:

### How It Works

1. **Trend Analysis**
   - Calculates direction: improving (↑), stable (→), or worsening (↓)
   - Uses linear regression on 12 months of data
   - Accounts for whether indicators are inverted (e.g., unemployment)

2. **Velocity Calculation**
   - Measures rate of change (% per month)
   - Fast changes amplify the trend effect
   - Threshold: >2% per month is considered high velocity

3. **Trend Multipliers**
   - **Improving trend**: 0.7x (reduces probability)
   - **Stable trend**: 1.0x (no change)
   - **Worsening trend**: 1.3x (increases probability)
   - **High velocity worsening**: up to 1.5x
   - **High velocity improving**: down to 0.5x

4. **Applied to Risk Calculations**
   - Each triggered threshold gets a base factor
   - Trend multiplier adjusts the factor
   - Example: Credit spreads >400bps normally = 2.0x
     - If worsening fast → 2.0 × 1.5 = 3.0x
     - If improving → 2.0 × 0.7 = 1.4x

### Example Calculation

**Recession Risk with Trend Analysis:**

```
Base Probability: 15%

Triggered Factors:
  1. Deficit > 5% GDP
     - Base factor: 1.8x
     - Trend: Worsening (↓)
     - Trend multiplier: 1.3x
     - Adjusted factor: 1.8 × 1.3 = 2.34x

  2. Credit spreads > 400bps
     - Base factor: 2.0x
     - Trend: Stable (→)
     - Trend multiplier: 1.0x
     - Adjusted factor: 2.0 × 1.0 = 2.0x

Combined Factor: 2.34 × 2.0 = 4.68
Correlation Discount (2 factors): × 0.7 = 3.276

Final Probability: 15% × 3.276 = 49.1%
```

Without trend analysis, it would be:
```
(1.8 × 2.0) × 0.7 = 2.52
15% × 2.52 = 37.8%
```

The worsening deficit trend increased the probability by ~11%.

## Troubleshooting

### Dashboard shows "Using Mock Data"

**Check:**
1. Is the backend server running? Check `http://localhost:3001/health`
2. Is your FRED API key valid? Check the `.env` file
3. Check browser console for errors
4. Check server logs for API errors

### Server returns 403 errors

**Solution:** Your FRED API key is invalid or expired
- Get a new key from [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html)
- Update your `.env` file
- Restart the server

### Rate Limit Exceeded

**Solution:** FRED allows 120 requests/minute
- The cache reduces API calls significantly
- Wait 1 minute and try again
- The dashboard auto-retries with exponential backoff

### Treasury Deficit Data Unavailable

**Expected behavior:** Treasury API can be unreliable
- The server automatically falls back to an estimate (7.2%)
- The dashboard displays a note about using estimated data
- This doesn't affect other indicators

### Trend Analysis Not Working

**Check:**
1. Backend server must be running
2. Historical data endpoint must be accessible
3. Need at least 3 months of data for trends
4. Check browser console for warnings

**Fallback:** Trend analysis failure doesn't break the dashboard
- It falls back to base calculations
- You'll see a warning in the console
- All other features continue to work

## Performance Optimization

### Frontend Caching
- No frontend cache (always fetches from backend)
- Backend cache handles all caching (30 min TTL)
- Auto-refresh every 30 minutes

### Backend Caching
- 30-minute cache per indicator
- Shared across all dashboard instances
- Clear cache to force fresh data

### API Rate Limits
- FRED: 120 requests/minute
- Treasury: No documented limit
- Batch endpoint minimizes requests

## Security Considerations

1. **API Key Security**
   - Never commit `.env` to git (already in .gitignore)
   - Use environment variables in production
   - Consider using a secrets manager

2. **CORS Configuration**
   - Currently allows all origins (development mode)
   - For production, restrict to your domain:
     ```javascript
     app.use(cors({
       origin: 'https://yourdomain.com'
     }));
     ```

3. **Input Validation**
   - All numeric values are validated
   - HTML outputs are sanitized
   - Series IDs are validated against known list

## Deployment Options

### Option 1: Deploy Backend on Heroku

1. Create `Procfile`:
   ```
   web: node fred-proxy-server.js
   ```

2. Set environment variables:
   ```bash
   heroku config:set FRED_API_KEY=your_key_here
   ```

3. Update `config.js` with your Heroku URL

### Option 2: Deploy Backend on Vercel

Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "fred-proxy-server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "fred-proxy-server.js"
    }
  ],
  "env": {
    "FRED_API_KEY": "@fred-api-key"
  }
}
```

### Option 3: Deploy Both on Netlify

- Frontend: Deploy via GitHub (already configured)
- Backend: Use Netlify Functions (requires refactoring to serverless)

### Option 4: Traditional VPS

Deploy both frontend and backend on a single server:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone your-repo
cd dailo_dashboard
npm install

# Use PM2 for process management
npm install -g pm2
pm2 start fred-proxy-server.js
pm2 startup
pm2 save

# Serve frontend with nginx
sudo apt-get install nginx
# Configure nginx to serve the static files
```

## Cost Analysis

### Free Tier
- FRED API: Free (120 req/min)
- Treasury API: Free (no documented limits)
- Frontend hosting: Free (GitHub Pages)
- Backend hosting:
  - Heroku: Free tier (limited hours)
  - Vercel: Free tier (generous limits)
  - Netlify Functions: Free tier (125k requests/month)

### Estimated Costs (Paid Hosting)
- Small VPS (DigitalOcean): $5/month
- Heroku Hobby: $7/month
- Backend serverless: $0-5/month (depends on traffic)

**Total: $0-7/month for production deployment**

## Monitoring

### Health Monitoring

Create a simple uptime monitor:

```javascript
// monitor.js
const axios = require('axios');

async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3001/health');
    console.log('✓ Server healthy:', response.data);
  } catch (error) {
    console.error('✗ Server unhealthy:', error.message);
    // Send alert (email, Slack, etc.)
  }
}

setInterval(checkHealth, 60000); // Every minute
```

### Logging

The server logs all operations to console. For production:

1. Use a logging library (Winston, Bunyan)
2. Ship logs to a service (Papertrail, Loggly)
3. Set up alerts for errors

### Cache Monitoring

```bash
# Check cache effectiveness
curl http://localhost:3001/api/cache/stats

# Expected output:
{
  "total": 15,
  "fresh": 13,
  "stale": 2
}
```

## Advanced Configuration

### Adjust Cache Duration

Edit `fred-proxy-server.js` line 15:
```javascript
CACHE_DURATION_MS: 30 * 60 * 1000, // 30 minutes
```

Change to 1 hour:
```javascript
CACHE_DURATION_MS: 60 * 60 * 1000, // 60 minutes
```

### Adjust Retry Behavior

Edit `fred-proxy-server.js` line 18:
```javascript
MAX_RETRIES: 3,
```

### Disable Trend Analysis

In browser console:
```javascript
dashboardApp.probabilityCalculator.setTrendAnalysis(false);
dashboardApp.refreshData();
```

Or edit `src/js/probabilityCalculator.js` line 30:
```javascript
this.useTrendAnalysis = false; // Disable by default
```

## Support and Resources

- **FRED API Docs:** https://fred.stlouisfed.org/docs/api/
- **Treasury API Docs:** https://fiscaldata.treasury.gov/api-documentation/
- **Project Issues:** (your GitHub issues page)

## Next Steps

1. ✅ Get your FRED API key
2. ✅ Configure and start the backend
3. ✅ Verify data is loading
4. 🔄 Customize thresholds in `src/js/config.js`
5. 🔄 Adjust probability base rates
6. 🔄 Deploy to production

Happy forecasting! 📊
