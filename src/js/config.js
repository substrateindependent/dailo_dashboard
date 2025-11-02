/**
 * Configuration constants for the Ray Dalio Economic Risk Dashboard
 */

export const CONFIG = {
    // API Configuration
    FRED_API_KEY: 'a1a8ea0bfdd8114159d3b42992c83c67',
    BACKEND_URL: 'http://localhost:3001',

    // Timing Configuration
    REFRESH_INTERVAL_MS: 30 * 60 * 1000, // 30 minutes
    MOCK_DATA_DELAY_MS: 50,

    // Request Configuration
    FETCH_TIMEOUT_MS: 10000, // 10 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
};

export const BASE_PROBABILITIES = {
    recession: 0.15,
    depression: 0.03,
    reserve: 0.05,
    default: 0.01,
    devaluation: 0.20
};

export const RISK_THRESHOLDS = {
    recession: {
        critical: 0.60,
        high: 0.42,      // 0.60 * 0.7
        moderate: 0.24   // 0.60 * 0.4
    },
    depression: {
        critical: 0.20,
        high: 0.14,      // 0.20 * 0.7
        moderate: 0.08   // 0.20 * 0.4
    },
    reserve: {
        critical: 0.30,
        high: 0.21,      // 0.30 * 0.7
        moderate: 0.12   // 0.30 * 0.4
    },
    default: {
        critical: 0.10,
        high: 0.07,      // 0.10 * 0.7
        moderate: 0.04   // 0.10 * 0.4
    },
    devaluation: {
        critical: 0.50,
        high: 0.35,      // 0.50 * 0.7
        moderate: 0.20   // 0.50 * 0.4
    }
};

export const MOCK_DATA = {
    'DGS10': {
        value: 4.75,
        name: '10-Year Treasury Yield',
        threshold: '> 5%',
        transform: (v) => v.toFixed(2) + '%'
    },
    'DFF': {
        value: 4.33,
        name: 'Fed Funds Rate',
        threshold: '< 0.5%',
        transform: (v) => v.toFixed(2) + '%'
    },
    'GFDGDPA188S': {
        value: 123.0,
        name: 'Federal Debt/GDP',
        threshold: '> 125%',
        transform: (v) => v.toFixed(1) + '%'
    },
    'BAA10Y': {
        value: 2.15,
        name: 'Credit Spreads (IG)',
        threshold: '> 4%',
        transform: (v) => (v * 100).toFixed(0) + ' bps'
    },
    'UNRATE': {
        value: 4.2,
        name: 'Unemployment Rate',
        threshold: '> 7%',
        transform: (v) => v.toFixed(1) + '%'
    },
    'T10Y2Y': {
        value: 0.20,
        name: 'Yield Curve (10Y-2Y)',
        threshold: '< 0%',
        transform: (v) => v.toFixed(2) + '%'
    },
    'VIXCLS': {
        value: 15.2,
        name: 'VIX Volatility Index',
        threshold: '> 30',
        transform: (v) => v.toFixed(1)
    },
    'DEXUSEU': {
        value: 1.03,
        name: 'EUR/USD Exchange Rate',
        threshold: '< 1.20',
        transform: (v) => v.toFixed(3)
    },
    'GOLDAMGBD228NLBM': {
        value: 2650,
        name: 'Gold Price (USD/oz)',
        threshold: '50% rise = warning',
        transform: (v) => '$' + v.toFixed(2)
    },
    'M2SL': {
        value: 21400,
        name: 'M2 Money Supply (Bil)',
        threshold: 'High growth = warning',
        transform: (v) => '$' + (v/1000).toFixed(1) + 'T'
    },
    'BOGMBASE': {
        value: 5800,
        name: 'Monetary Base (Bil)',
        threshold: 'Rapid expansion',
        transform: (v) => '$' + (v/1000).toFixed(1) + 'T'
    },
    'A091RC1Q027SBEA': {
        value: 3.8,
        name: 'Interest Payments/GDP',
        threshold: '> 4%',
        transform: (v) => v.toFixed(1) + '%'
    }
};

export const INDICATOR_DISPLAY_ORDER = [
    'DGS10', 'DFF', 'T10Y2Y', 'GFDGDPA188S',
    'DeficitGDP', 'A091RC1Q027SBEA', 'BAA10Y', 'VIXCLS',
    'DXY', 'GOLDAMGBD228NLBM', 'UNRATE', 'M2SL', 'BOGMBASE'
];

// Economic indicator thresholds for probability calculations
export const ECONOMIC_THRESHOLDS = {
    recession: {
        deficitGDP: { value: 5, factor: 1.8, reason: 'Deficit > 5% GDP' },
        creditSpreads: { value: 4, factor: 2.0, reason: 'Credit spreads > 400bps' },
        yieldCurve: { value: 0, factor: 1.7, reason: 'Yield curve inverted' }
    },
    depression: {
        fedFunds: { value: 0.5, factor: 3.0, reason: 'Fed Funds < 0.5%' },
        debtGDP: { value: 150, factor: 2.0, reason: 'Debt/GDP > 150%' },
        mbToM2: { value: 0.3, factor: 1.5, reason: 'Extreme QE conditions' }
    },
    reserve: {
        dxy: { value: 90, factor: 1.5, reason: 'Dollar weakness' }
    },
    default: {
        deficitGDP: { value: 7, factor: 3.0, reason: 'Deficit > 7% GDP' },
        interestPayments: { value: 4, factor: 2.5, reason: 'Interest payments > 4% GDP' },
        rateSpread: { value: 2, factor: 1.5, reason: 'Rising long-term rates' }
    },
    devaluation: {
        dxy: { value: 100, factor: 1.5, reason: 'DXY < 100' },
        deficitGDP: { value: 7, factor: 1.8, reason: 'High deficit monetization risk' }
    }
};

// Correlation discount factors
export const CORRELATION_DISCOUNT = {
    2: 0.7,  // Two correlated factors
    3: 0.5   // Three or more correlated factors
};
