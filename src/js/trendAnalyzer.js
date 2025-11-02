/**
 * Trend Analysis Module for Enhanced Bayesian Forecasting
 *
 * Analyzes historical data trends to adjust probability calculations:
 * - Direction: Is the indicator improving or worsening?
 * - Velocity: How fast is it changing?
 * - Acceleration: Is the rate of change increasing?
 */

import { CONFIG } from './config.js';
import { validateNumber, logger } from './utils.js';

/**
 * Trend Analyzer class
 */
export class TrendAnalyzer {
    constructor() {
        this.historicalData = {};
    }

    /**
     * Fetch historical data for a series
     */
    async fetchHistoricalData(seriesId, months = 12) {
        try {
            if (!CONFIG.BACKEND_URL) {
                logger.warn('No backend URL configured for historical data');
                return null;
            }

            const response = await fetch(`${CONFIG.BACKEND_URL}/api/fred/${seriesId}/history?months=${months}`, {
                timeout: CONFIG.FETCH_TIMEOUT_MS
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.observations || !Array.isArray(data.observations)) {
                throw new Error('Invalid historical data format');
            }

            // Store historical data
            this.historicalData[seriesId] = data.observations.map(obs => ({
                date: obs.date,
                value: parseFloat(obs.value)
            })).filter(obs => !isNaN(obs.value));

            logger.info(`Loaded ${this.historicalData[seriesId].length} historical points for ${seriesId}`);
            return this.historicalData[seriesId];

        } catch (error) {
            logger.warn(`Failed to fetch historical data for ${seriesId}:`, error.message);
            return null;
        }
    }

    /**
     * Calculate trend direction (-1: worsening, 0: stable, 1: improving)
     */
    calculateTrendDirection(seriesId, isInverted = false) {
        const data = this.historicalData[seriesId];

        if (!data || data.length < 3) {
            return 0; // Not enough data
        }

        try {
            // Use linear regression to determine trend
            const n = data.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

            for (let i = 0; i < n; i++) {
                const x = i; // Time index
                const y = data[n - 1 - i].value; // Reverse order (oldest to newest)

                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumX2 += x * x;
            }

            // Calculate slope (trend)
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

            // Normalize slope by average value to get percentage change
            const avgValue = sumY / n;
            const normalizedSlope = (slope / avgValue) * 100;

            // Determine direction
            // For inverted indicators (e.g., unemployment), higher is worse
            let direction;
            if (Math.abs(normalizedSlope) < 0.5) {
                direction = 0; // Stable
            } else if (normalizedSlope > 0) {
                direction = isInverted ? -1 : 1; // Rising
            } else {
                direction = isInverted ? 1 : -1; // Falling
            }

            logger.info(`Trend for ${seriesId}: slope=${normalizedSlope.toFixed(2)}%, direction=${direction}`);
            return direction;

        } catch (error) {
            logger.warn(`Error calculating trend for ${seriesId}:`, error);
            return 0;
        }
    }

    /**
     * Calculate velocity (rate of change)
     * Returns percentage change per month
     */
    calculateVelocity(seriesId) {
        const data = this.historicalData[seriesId];

        if (!data || data.length < 2) {
            return 0;
        }

        try {
            const latest = data[0].value;
            const oldest = data[data.length - 1].value;
            const months = data.length - 1;

            // Calculate average monthly change
            const totalChange = ((latest - oldest) / oldest) * 100;
            const velocity = totalChange / months;

            logger.info(`Velocity for ${seriesId}: ${velocity.toFixed(2)}%/month`);
            return velocity;

        } catch (error) {
            logger.warn(`Error calculating velocity for ${seriesId}:`, error);
            return 0;
        }
    }

    /**
     * Calculate acceleration (change in rate of change)
     */
    calculateAcceleration(seriesId) {
        const data = this.historicalData[seriesId];

        if (!data || data.length < 6) {
            return 0; // Need at least 6 points for meaningful acceleration
        }

        try {
            // Split into two halves
            const midpoint = Math.floor(data.length / 2);
            const recentData = data.slice(0, midpoint);
            const olderData = data.slice(midpoint);

            // Calculate velocity for each half
            const recentVelocity = this._calculateSubsetVelocity(recentData);
            const olderVelocity = this._calculateSubsetVelocity(olderData);

            // Acceleration is the difference
            const acceleration = recentVelocity - olderVelocity;

            logger.info(`Acceleration for ${seriesId}: ${acceleration.toFixed(3)}`);
            return acceleration;

        } catch (error) {
            logger.warn(`Error calculating acceleration for ${seriesId}:`, error);
            return 0;
        }
    }

    /**
     * Helper: Calculate velocity for a subset of data
     */
    _calculateSubsetVelocity(data) {
        if (data.length < 2) return 0;

        const latest = data[0].value;
        const oldest = data[data.length - 1].value;
        const months = data.length - 1;

        return ((latest - oldest) / oldest * 100) / months;
    }

    /**
     * Get trend multiplier for probability adjustment
     * Returns multiplier between 0.7 (improving) and 1.3 (worsening)
     */
    getTrendMultiplier(seriesId, isInverted = false) {
        const direction = this.calculateTrendDirection(seriesId, isInverted);
        const velocity = Math.abs(this.calculateVelocity(seriesId));

        // Base multipliers
        const directionMultipliers = {
            '-1': 1.3,  // Worsening: increase probability
            '0': 1.0,   // Stable: no change
            '1': 0.7    // Improving: decrease probability
        };

        let multiplier = directionMultipliers[direction.toString()];

        // Adjust based on velocity (faster changes = stronger effect)
        if (velocity > 2.0) {
            // High velocity: amplify the effect
            if (direction === -1) {
                multiplier = Math.min(multiplier * 1.2, 1.5); // Cap at 1.5x
            } else if (direction === 1) {
                multiplier = Math.max(multiplier * 0.8, 0.5); // Floor at 0.5x
            }
        }

        return multiplier;
    }

    /**
     * Analyze all indicators for trend
     */
    async analyzeAllTrends(indicators) {
        const trendMultipliers = {};

        // Define which indicators are inverted (higher = worse)
        const invertedIndicators = new Set([
            'UNRATE',        // Unemployment
            'BAA10Y',        // Credit spreads
            'VIXCLS',        // Volatility
            'GFDGDPA188S',   // Debt/GDP
            'DeficitGDP',    // Deficit/GDP
            'A091RC1Q027SBEA' // Interest payments/GDP
        ]);

        // Fetch historical data for all indicators
        const seriesIds = Object.keys(indicators).filter(id => id !== 'DXY'); // DXY is calculated

        const fetchPromises = seriesIds.map(id => this.fetchHistoricalData(id, 12));
        await Promise.allSettled(fetchPromises);

        // Calculate trend multipliers
        for (const seriesId of seriesIds) {
            if (this.historicalData[seriesId]) {
                const isInverted = invertedIndicators.has(seriesId);
                trendMultipliers[seriesId] = this.getTrendMultiplier(seriesId, isInverted);
            }
        }

        return trendMultipliers;
    }

    /**
     * Get comprehensive trend analysis for an indicator
     */
    getTrendAnalysis(seriesId, isInverted = false) {
        if (!this.historicalData[seriesId]) {
            return null;
        }

        const direction = this.calculateTrendDirection(seriesId, isInverted);
        const velocity = this.calculateVelocity(seriesId);
        const acceleration = this.calculateAcceleration(seriesId);
        const multiplier = this.getTrendMultiplier(seriesId, isInverted);

        const directionLabel = {
            '-1': '↓ Worsening',
            '0': '→ Stable',
            '1': '↑ Improving'
        };

        return {
            direction,
            directionLabel: directionLabel[direction.toString()],
            velocity: parseFloat(velocity.toFixed(2)),
            acceleration: parseFloat(acceleration.toFixed(3)),
            multiplier: parseFloat(multiplier.toFixed(2)),
            dataPoints: this.historicalData[seriesId].length
        };
    }

    /**
     * Clear cached historical data
     */
    clearCache() {
        this.historicalData = {};
        logger.info('Trend analyzer cache cleared');
    }
}

/**
 * Configuration for trend-based adjustments
 */
export const TREND_CONFIG = {
    // Minimum data points required for trend analysis
    MIN_DATA_POINTS: 3,

    // Number of months to analyze
    ANALYSIS_WINDOW_MONTHS: 12,

    // Velocity thresholds (% per month)
    HIGH_VELOCITY_THRESHOLD: 2.0,

    // Trend multiplier ranges
    MULTIPLIER_MAX: 1.5,  // Maximum increase in probability
    MULTIPLIER_MIN: 0.5   // Maximum decrease in probability
};
