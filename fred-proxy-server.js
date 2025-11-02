/**
 * FRED API Proxy Server with Data Caching and Treasury Integration
 *
 * This server provides:
 * - FRED API data fetching with caching
 * - Treasury API integration for deficit data
 * - Rate limiting protection
 * - Error handling and retry logic
 * - Data validation
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const CONFIG = {
    FRED_API_KEY: process.env.FRED_API_KEY || 'f31a77511e44f9da37c9ec6632333504',
    FRED_BASE_URL: 'https://api.stlouisfed.org/fred/series/observations',
    TREASURY_BASE_URL: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
    CACHE_DURATION_MS: 30 * 60 * 1000, // 30 minutes
    REQUEST_TIMEOUT_MS: 10000, // 10 seconds
    MAX_RETRIES: 3,
    PORT: process.env.PORT || 3001
};

// In-memory cache
const cache = {
    data: {},

    set(key, value) {
        this.data[key] = {
            value,
            timestamp: Date.now()
        };
    },

    get(key) {
        const cached = this.data[key];
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > CONFIG.CACHE_DURATION_MS) {
            delete this.data[key];
            return null;
        }

        return cached.value;
    },

    clear() {
        this.data = {};
    },

    getStats() {
        const keys = Object.keys(this.data);
        const now = Date.now();
        const fresh = keys.filter(k => now - this.data[k].timestamp < CONFIG.CACHE_DURATION_MS);
        return {
            total: keys.length,
            fresh: fresh.length,
            stale: keys.length - fresh.length
        };
    }
};

// Utility: Fetch with retry logic
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios({
                url,
                timeout: CONFIG.REQUEST_TIMEOUT_MS,
                ...options
            });
            return response;
        } catch (error) {
            const isLastAttempt = attempt === retries;

            if (isLastAttempt) {
                throw error;
            }

            // Exponential backoff
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`Retry attempt ${attempt}/${retries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Utility: Validate FRED response
function validateFREDResponse(data, seriesId) {
    if (!data || !data.observations || !Array.isArray(data.observations)) {
        throw new Error(`Invalid FRED response format for ${seriesId}`);
    }

    if (data.observations.length === 0) {
        throw new Error(`No observations found for ${seriesId}`);
    }

    const latest = data.observations[0];
    if (!latest.value || !latest.date) {
        throw new Error(`Missing value or date in FRED response for ${seriesId}`);
    }

    // Check if value is a number
    const numValue = parseFloat(latest.value);
    if (isNaN(numValue)) {
        throw new Error(`Invalid numeric value for ${seriesId}: ${latest.value}`);
    }

    return true;
}

// ========================================
// ENDPOINTS
// ========================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    const cacheStats = cache.getStats();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        cache: cacheStats,
        uptime: process.uptime()
    });
});

/**
 * Get single FRED series
 */
app.get('/api/fred/:seriesId', async (req, res) => {
    const { seriesId } = req.params;
    const cacheKey = `fred:${seriesId}`;

    try {
        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`✓ Cache hit: ${seriesId}`);
            return res.json({
                ...cached,
                cached: true
            });
        }

        console.log(`⟳ Fetching from FRED: ${seriesId}`);

        // Fetch from FRED API
        const response = await fetchWithRetry(CONFIG.FRED_BASE_URL, {
            params: {
                series_id: seriesId,
                api_key: CONFIG.FRED_API_KEY,
                file_type: 'json',
                sort_order: 'desc',
                limit: 1
            }
        });

        // Validate response
        validateFREDResponse(response.data, seriesId);

        // Cache and return
        cache.set(cacheKey, response.data);
        res.json({
            ...response.data,
            cached: false
        });

    } catch (error) {
        console.error(`✗ Error fetching ${seriesId}:`, error.message);
        res.status(500).json({
            error: error.message,
            seriesId,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Batch fetch multiple FRED series
 */
app.post('/api/fred/batch', async (req, res) => {
    const { series } = req.body;

    if (!series || !Array.isArray(series)) {
        return res.status(400).json({
            error: 'Invalid request: series array required'
        });
    }

    console.log(`⟳ Batch request for ${series.length} series`);

    const results = {};
    let cacheHits = 0;
    let cacheMisses = 0;

    try {
        // Process all series in parallel
        await Promise.all(
            series.map(async (seriesId) => {
                const cacheKey = `fred:${seriesId}`;

                try {
                    // Check cache first
                    const cached = cache.get(cacheKey);
                    if (cached) {
                        results[seriesId] = { ...cached, cached: true };
                        cacheHits++;
                        console.log(`  ✓ Cache hit: ${seriesId}`);
                        return;
                    }

                    cacheMisses++;
                    console.log(`  ⟳ Fetching: ${seriesId}`);

                    // Fetch from FRED
                    const response = await fetchWithRetry(CONFIG.FRED_BASE_URL, {
                        params: {
                            series_id: seriesId,
                            api_key: CONFIG.FRED_API_KEY,
                            file_type: 'json',
                            sort_order: 'desc',
                            limit: 1
                        }
                    });

                    // Validate
                    validateFREDResponse(response.data, seriesId);

                    // Cache and store
                    cache.set(cacheKey, response.data);
                    results[seriesId] = { ...response.data, cached: false };

                } catch (error) {
                    console.error(`  ✗ Error fetching ${seriesId}:`, error.message);
                    results[seriesId] = {
                        error: error.message,
                        timestamp: new Date().toISOString()
                    };
                }
            })
        );

        console.log(`✓ Batch complete: ${cacheHits} cached, ${cacheMisses} fetched`);

        res.json({
            ...results,
            _metadata: {
                total: series.length,
                successful: Object.values(results).filter(r => !r.error).length,
                failed: Object.values(results).filter(r => r.error).length,
                cacheHits,
                cacheMisses
            }
        });

    } catch (error) {
        console.error('✗ Batch request error:', error.message);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get Budget Deficit to GDP ratio from Treasury API
 */
app.get('/api/treasury/deficit', async (req, res) => {
    const cacheKey = 'treasury:deficit_gdp';

    try {
        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log('✓ Cache hit: deficit/GDP');
            return res.json({
                ...cached,
                cached: true
            });
        }

        console.log('⟳ Fetching Treasury deficit data...');

        // Fetch recent monthly deficit data
        // Using Monthly Treasury Statement (MTS)
        const deficitResponse = await fetchWithRetry(
            `${CONFIG.TREASURY_BASE_URL}/v1/accounting/mts/mts_table_5`,
            {
                params: {
                    filter: 'line_code_nbr:eq:5694', // Total Deficit
                    sort: '-record_date',
                    page: { number: 1, size: 12 } // Last 12 months
                }
            }
        );

        // Fetch GDP data from FRED
        const gdpResponse = await fetchWithRetry(CONFIG.FRED_BASE_URL, {
            params: {
                series_id: 'GDP',
                api_key: CONFIG.FRED_API_KEY,
                file_type: 'json',
                sort_order: 'desc',
                limit: 1
            }
        });

        // Process deficit data
        if (!deficitResponse.data || !deficitResponse.data.data || deficitResponse.data.data.length === 0) {
            throw new Error('No deficit data available from Treasury');
        }

        // Sum up last 12 months of deficit (fiscal year)
        const deficitData = deficitResponse.data.data;
        let annualDeficit = 0;

        for (let i = 0; i < Math.min(12, deficitData.length); i++) {
            const monthlyDeficit = parseFloat(deficitData[i].current_fytd_net_outly_amt || 0);
            annualDeficit = monthlyDeficit; // The FYTD (Fiscal Year to Date) already contains cumulative
            if (i === 0) break; // We only need the most recent FYTD value
        }

        // Process GDP data
        validateFREDResponse(gdpResponse.data, 'GDP');
        const gdp = parseFloat(gdpResponse.data.observations[0].value);

        // Calculate ratio (convert deficit from millions to match GDP billions)
        const deficitGDPRatio = Math.abs((annualDeficit / 1000) / gdp * 100);

        const result = {
            deficit_gdp_ratio: parseFloat(deficitGDPRatio.toFixed(2)),
            annual_deficit_billions: parseFloat((annualDeficit / 1000).toFixed(2)),
            gdp_billions: gdp,
            source: 'US Treasury MTS & FRED GDP',
            date: deficitData[0].record_date,
            gdp_date: gdpResponse.data.observations[0].date
        };

        // Cache and return
        cache.set(cacheKey, result);
        console.log(`✓ Deficit/GDP ratio: ${result.deficit_gdp_ratio}%`);

        res.json({
            ...result,
            cached: false
        });

    } catch (error) {
        console.error('✗ Error fetching deficit data:', error.message);

        // Return estimate as fallback
        res.json({
            deficit_gdp_ratio: 7.2,
            source: 'Estimate (Treasury API unavailable)',
            note: error.message,
            timestamp: new Date().toISOString(),
            cached: false
        });
    }
});

/**
 * Get historical data for trend analysis
 */
app.get('/api/fred/:seriesId/history', async (req, res) => {
    const { seriesId } = req.params;
    const { months = 12 } = req.query;
    const cacheKey = `fred:${seriesId}:history:${months}`;

    try {
        // Check cache
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`✓ Cache hit: ${seriesId} history`);
            return res.json({
                ...cached,
                cached: true
            });
        }

        console.log(`⟳ Fetching history from FRED: ${seriesId} (${months} months)`);

        // Fetch historical data
        const response = await fetchWithRetry(CONFIG.FRED_BASE_URL, {
            params: {
                series_id: seriesId,
                api_key: CONFIG.FRED_API_KEY,
                file_type: 'json',
                sort_order: 'desc',
                limit: parseInt(months)
            }
        });

        if (!response.data || !response.data.observations) {
            throw new Error(`Invalid FRED response for ${seriesId}`);
        }

        const result = {
            seriesId,
            observations: response.data.observations,
            count: response.data.observations.length
        };

        // Cache and return
        cache.set(cacheKey, result);
        res.json({
            ...result,
            cached: false
        });

    } catch (error) {
        console.error(`✗ Error fetching history for ${seriesId}:`, error.message);
        res.status(500).json({
            error: error.message,
            seriesId,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Clear cache (admin endpoint)
 */
app.post('/api/cache/clear', (req, res) => {
    cache.clear();
    console.log('🗑️  Cache cleared');
    res.json({
        status: 'ok',
        message: 'Cache cleared successfully'
    });
});

/**
 * Get cache statistics
 */
app.get('/api/cache/stats', (req, res) => {
    res.json(cache.getStats());
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// ========================================
// START SERVER
// ========================================

const server = app.listen(CONFIG.PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 FRED API Proxy Server');
    console.log('='.repeat(60));
    console.log(`Port:          ${CONFIG.PORT}`);
    console.log(`Cache TTL:     ${CONFIG.CACHE_DURATION_MS / 1000 / 60} minutes`);
    console.log(`Timeout:       ${CONFIG.REQUEST_TIMEOUT_MS / 1000} seconds`);
    console.log(`Max Retries:   ${CONFIG.MAX_RETRIES}`);
    console.log('='.repeat(60));
    console.log('\nEndpoints:');
    console.log(`  GET  /health`);
    console.log(`  GET  /api/fred/:seriesId`);
    console.log(`  POST /api/fred/batch`);
    console.log(`  GET  /api/treasury/deficit`);
    console.log(`  GET  /api/fred/:seriesId/history`);
    console.log(`  GET  /api/cache/stats`);
    console.log(`  POST /api/cache/clear`);
    console.log('\n✓ Ready to accept connections\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
    });
});

module.exports = app;
