/**
 * Data service for fetching economic indicators
 */

import { CONFIG, MOCK_DATA } from './config.js';
import {
    fetchWithRetry,
    validateNumber,
    validateIndicatorData,
    logger,
    sleep,
    NetworkError,
    ValidationError
} from './utils.js';

/**
 * Data service class
 */
export class DataService {
    constructor() {
        this.useBackend = false;
        this.indicators = {};
    }

    /**
     * Check if backend proxy server is available
     */
    async checkBackendConnection() {
        try {
            const response = await fetchWithRetry(`${CONFIG.BACKEND_URL}/health`, {}, 1);
            const data = await response.json();

            if (data.status === 'ok') {
                this.useBackend = true;
                logger.info('Connected to FRED proxy server');
                return true;
            }
            return false;
        } catch (error) {
            this.useBackend = false;
            logger.warn('Backend not available, using mock data:', error.message);
            return false;
        }
    }

    /**
     * Fetch all economic indicators
     */
    async fetchAllData() {
        this.indicators = {};

        try {
            if (this.useBackend) {
                await this.fetchAllDataFromBackend();
            } else {
                await this.fetchAllMockData();
            }

            // Calculate derived indicators
            this.calculateDXY();
            await this.calculateDeficitGDP();

            return this.indicators;
        } catch (error) {
            logger.error('Error fetching all data:', error);
            // Fallback to mock data if everything fails
            if (Object.keys(this.indicators).length === 0) {
                await this.fetchAllMockData();
                this.calculateDXY();
                await this.calculateDeficitGDP();
            }
            throw error;
        }
    }

    /**
     * Batch fetch from backend
     */
    async fetchAllDataFromBackend() {
        try {
            const seriesToFetch = Object.keys(MOCK_DATA);

            const response = await fetchWithRetry(`${CONFIG.BACKEND_URL}/api/fred/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ series: seriesToFetch })
            });

            const results = await response.json();

            // Validate response
            if (!results || typeof results !== 'object') {
                throw new ValidationError('Invalid batch response format');
            }

            // Process each result
            const processPromises = Object.entries(results).map(([seriesId, data]) =>
                this.processIndicatorData(seriesId, data)
            );

            await Promise.all(processPromises);

            logger.info(`Fetched ${Object.keys(this.indicators).length} indicators from backend`);
        } catch (error) {
            logger.error('Batch fetch failed:', error);

            // Try individual fetches as fallback
            await this.fetchIndividualIndicators();
        }
    }

    /**
     * Fetch individual indicators from backend
     */
    async fetchIndividualIndicators() {
        const fetchPromises = Object.entries(MOCK_DATA).map(([seriesId, config]) =>
            this.fetchIndicatorFromBackend(seriesId, config)
        );

        const results = await Promise.allSettled(fetchPromises);

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        logger.info(`Individual fetch: ${successCount} succeeded, ${failCount} failed`);
    }

    /**
     * Fetch single indicator from backend
     */
    async fetchIndicatorFromBackend(seriesId, config) {
        try {
            const response = await fetchWithRetry(`${CONFIG.BACKEND_URL}/api/fred/${seriesId}`);
            const data = await response.json();

            await this.processIndicatorData(seriesId, data);
        } catch (error) {
            logger.warn(`Failed to fetch ${config.name} from backend:`, error.message);
            // Fallback to mock data for this indicator
            await this.fetchMockIndicator(seriesId, config);
        }
    }

    /**
     * Process indicator data from API response
     */
    async processIndicatorData(seriesId, data) {
        const config = MOCK_DATA[seriesId];
        if (!config) {
            logger.warn(`No config found for series ${seriesId}`);
            return;
        }

        try {
            // Validate data structure
            if (data.error) {
                throw new ValidationError(data.error);
            }

            validateIndicatorData(data, seriesId);

            const rawValue = validateNumber(data.observations[0].value, config.name);

            this.indicators[seriesId] = {
                value: config.transform(rawValue),
                raw: rawValue,
                threshold: config.threshold,
                name: config.name,
                source: 'FRED API',
                date: data.observations[0].date
            };

            logger.info(`Live data: ${config.name}: ${config.transform(rawValue)}`);
        } catch (error) {
            if (error instanceof ValidationError) {
                logger.warn(`Validation error for ${config.name}:`, error.message);
                await this.fetchMockIndicator(seriesId, config);
            } else {
                throw error;
            }
        }
    }

    /**
     * Fetch all mock data
     */
    async fetchAllMockData() {
        const fetchPromises = Object.entries(MOCK_DATA).map(([seriesId, config]) =>
            this.fetchMockIndicator(seriesId, config)
        );

        await Promise.all(fetchPromises);
        logger.info(`Loaded ${Object.keys(this.indicators).length} mock indicators`);
    }

    /**
     * Fetch single mock indicator
     */
    async fetchMockIndicator(seriesId, config) {
        try {
            // Simulate API delay
            await sleep(CONFIG.MOCK_DATA_DELAY_MS);

            const value = validateNumber(config.value, config.name);

            this.indicators[seriesId] = {
                value: config.transform(value),
                raw: value,
                threshold: config.threshold,
                name: config.name,
                source: 'Mock Data',
                date: new Date().toISOString().split('T')[0]
            };

            logger.info(`Mock data: ${config.name}: ${config.transform(value)}`);
        } catch (error) {
            logger.error(`Error with ${config.name}:`, error);
        }
    }

    /**
     * Calculate Dollar Index (DXY) from EUR/USD
     */
    calculateDXY() {
        try {
            if (!this.indicators['DEXUSEU']) {
                logger.warn('Cannot calculate DXY: EUR/USD data not available');
                return;
            }

            const eurUsd = validateNumber(this.indicators['DEXUSEU'].raw, 'EUR/USD');
            const dxyApprox = 120 - (eurUsd * 20);

            this.indicators['DXY'] = {
                value: dxyApprox.toFixed(1),
                raw: dxyApprox,
                threshold: '< 80',
                name: 'Dollar Index (DXY proxy)',
                source: 'Calculated',
                date: this.indicators['DEXUSEU'].date
            };

            logger.info(`Calculated DXY: ${dxyApprox.toFixed(1)}`);
        } catch (error) {
            logger.error('Error calculating DXY:', error);
        }
    }

    /**
     * Calculate deficit to GDP ratio
     */
    async calculateDeficitGDP() {
        if (this.useBackend) {
            try {
                const response = await fetchWithRetry(`${CONFIG.BACKEND_URL}/api/treasury/deficit`);
                const data = await response.json();

                if (!data || typeof data.deficit_gdp_ratio !== 'number') {
                    throw new ValidationError('Invalid deficit data format');
                }

                const ratio = validateNumber(data.deficit_gdp_ratio, 'Deficit/GDP ratio');

                this.indicators['DeficitGDP'] = {
                    value: ratio.toFixed(1) + '%',
                    raw: ratio,
                    threshold: '> 3%',
                    name: 'Budget Deficit/GDP',
                    source: data.source || 'Treasury API',
                    date: data.date
                };

                logger.info(`Live deficit/GDP: ${ratio}%`);
                return;
            } catch (error) {
                logger.warn('Failed to fetch deficit data from backend:', error.message);
            }
        }

        // Fallback to estimate
        const deficitGDP = 7.2;

        this.indicators['DeficitGDP'] = {
            value: deficitGDP.toFixed(1) + '%',
            raw: deficitGDP,
            threshold: '> 3%',
            name: 'Budget Deficit/GDP',
            source: 'Estimate',
            note: 'Current fiscal year estimate'
        };

        logger.info(`Using estimated deficit/GDP: ${deficitGDP}%`);
    }

    /**
     * Get all indicators
     */
    getIndicators() {
        return this.indicators;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        const liveCount = Object.values(this.indicators).filter(
            ind => ind.source === 'FRED API'
        ).length;
        const mockCount = Object.values(this.indicators).filter(
            ind => ind.source === 'Mock Data'
        ).length;
        const totalCount = Object.keys(this.indicators).length;

        return {
            useBackend: this.useBackend,
            liveCount,
            mockCount,
            totalCount,
            isFullyLive: this.useBackend && liveCount === totalCount,
            isPartialLive: this.useBackend && liveCount > 0 && liveCount < totalCount
        };
    }
}
