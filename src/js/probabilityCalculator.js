/**
 * Bayesian probability calculator for economic risks
 * Enhanced with trend analysis for more accurate forecasting
 */

import {
    BASE_PROBABILITIES,
    RISK_THRESHOLDS,
    ECONOMIC_THRESHOLDS,
    CORRELATION_DISCOUNT
} from './config.js';
import { validateNumber, clamp, logger } from './utils.js';
import { TrendAnalyzer } from './trendAnalyzer.js';

/**
 * Probability calculator class
 */
export class ProbabilityCalculator {
    constructor() {
        this.currentProbabilities = { ...BASE_PROBABILITIES };
        this.updateFactors = {
            recession: [],
            depression: [],
            reserve: [],
            default: [],
            devaluation: []
        };
        this.trendAnalyzer = new TrendAnalyzer();
        this.trendMultipliers = {};
        this.useTrendAnalysis = true; // Can be toggled
    }

    /**
     * Update probabilities based on current indicators
     */
    async updateProbabilities(indicators) {
        try {
            // Reset factors
            this.resetFactors();

            // Fetch and analyze trends if enabled
            if (this.useTrendAnalysis) {
                try {
                    logger.info('Analyzing trends for enhanced forecasting...');
                    this.trendMultipliers = await this.trendAnalyzer.analyzeAllTrends(indicators);
                    logger.info(`Trend multipliers calculated for ${Object.keys(this.trendMultipliers).length} indicators`);
                } catch (error) {
                    logger.warn('Trend analysis failed, using base calculations:', error.message);
                    this.trendMultipliers = {};
                }
            }

            // Calculate factors for each risk type
            this.calculateRecessionFactors(indicators);
            this.calculateDepressionFactors(indicators);
            this.calculateReserveFactors(indicators);
            this.calculateDefaultFactors(indicators);
            this.calculateDevaluationFactors(indicators);

            // Calculate new probabilities
            this.calculateAllProbabilities();

            logger.info('Probabilities updated successfully');
            return this.currentProbabilities;
        } catch (error) {
            logger.error('Error updating probabilities:', error);
            // Return base probabilities on error
            this.currentProbabilities = { ...BASE_PROBABILITIES };
            return this.currentProbabilities;
        }
    }

    /**
     * Reset all factors
     */
    resetFactors() {
        this.updateFactors = {
            recession: [],
            depression: [],
            reserve: [],
            default: [],
            devaluation: []
        };
    }

    /**
     * Calculate recession factors
     */
    calculateRecessionFactors(indicators) {
        const thresholds = ECONOMIC_THRESHOLDS.recession;

        // Deficit > 5% GDP
        if (indicators.DeficitGDP && this.checkThreshold(indicators.DeficitGDP.raw, thresholds.deficitGDP.value, '>')) {
            const baseFactor = thresholds.deficitGDP.factor;
            const trendFactor = this.applyTrendAdjustment(baseFactor, 'DeficitGDP');
            this.updateFactors.recession.push({
                factor: trendFactor,
                baseFactor,
                reason: thresholds.deficitGDP.reason,
                trendAdjusted: trendFactor !== baseFactor
            });
        }

        // Credit spreads > 400bps
        if (indicators.BAA10Y && this.checkThreshold(indicators.BAA10Y.raw, thresholds.creditSpreads.value, '>')) {
            const baseFactor = thresholds.creditSpreads.factor;
            const trendFactor = this.applyTrendAdjustment(baseFactor, 'BAA10Y');
            this.updateFactors.recession.push({
                factor: trendFactor,
                baseFactor,
                reason: thresholds.creditSpreads.reason,
                trendAdjusted: trendFactor !== baseFactor
            });
        }

        // Inverted yield curve
        if (indicators.T10Y2Y && this.checkThreshold(indicators.T10Y2Y.raw, thresholds.yieldCurve.value, '<')) {
            const baseFactor = thresholds.yieldCurve.factor;
            const trendFactor = this.applyTrendAdjustment(baseFactor, 'T10Y2Y');
            this.updateFactors.recession.push({
                factor: trendFactor,
                baseFactor,
                reason: thresholds.yieldCurve.reason,
                trendAdjusted: trendFactor !== baseFactor
            });
        }
    }

    /**
     * Calculate depression factors
     */
    calculateDepressionFactors(indicators) {
        const thresholds = ECONOMIC_THRESHOLDS.depression;

        // Fed Funds < 0.5%
        if (indicators.DFF && this.checkThreshold(indicators.DFF.raw, thresholds.fedFunds.value, '<')) {
            this.updateFactors.depression.push({
                factor: thresholds.fedFunds.factor,
                reason: thresholds.fedFunds.reason
            });
        }

        // Debt/GDP > 150%
        if (indicators.GFDGDPA188S && this.checkThreshold(indicators.GFDGDPA188S.raw, thresholds.debtGDP.value, '>')) {
            this.updateFactors.depression.push({
                factor: thresholds.debtGDP.factor,
                reason: thresholds.debtGDP.reason
            });
        }

        // Extreme QE conditions (Monetary Base to M2 ratio)
        if (indicators.BOGMBASE && indicators.M2SL) {
            try {
                const mbToM2 = validateNumber(indicators.BOGMBASE.raw) / validateNumber(indicators.M2SL.raw);
                if (this.checkThreshold(mbToM2, thresholds.mbToM2.value, '>')) {
                    this.updateFactors.depression.push({
                        factor: thresholds.mbToM2.factor,
                        reason: thresholds.mbToM2.reason
                    });
                }
            } catch (error) {
                logger.warn('Error calculating MB to M2 ratio:', error);
            }
        }
    }

    /**
     * Calculate reserve status factors
     */
    calculateReserveFactors(indicators) {
        const thresholds = ECONOMIC_THRESHOLDS.reserve;

        // DXY < 90
        if (indicators.DXY && this.checkThreshold(indicators.DXY.raw, thresholds.dxy.value, '<')) {
            this.updateFactors.reserve.push({
                factor: thresholds.dxy.factor,
                reason: thresholds.dxy.reason
            });
        }
    }

    /**
     * Calculate default factors
     */
    calculateDefaultFactors(indicators) {
        const thresholds = ECONOMIC_THRESHOLDS.default;

        // Deficit > 7% GDP
        if (indicators.DeficitGDP && this.checkThreshold(indicators.DeficitGDP.raw, thresholds.deficitGDP.value, '>')) {
            this.updateFactors.default.push({
                factor: thresholds.deficitGDP.factor,
                reason: thresholds.deficitGDP.reason
            });
        }

        // Interest payments > 4% GDP
        if (indicators.A091RC1Q027SBEA && this.checkThreshold(indicators.A091RC1Q027SBEA.raw, thresholds.interestPayments.value, '>')) {
            this.updateFactors.default.push({
                factor: thresholds.interestPayments.factor,
                reason: thresholds.interestPayments.reason
            });
        }

        // Rising long-term rates
        if (indicators.DGS10 && indicators.DFF) {
            try {
                const spread = validateNumber(indicators.DGS10.raw) - validateNumber(indicators.DFF.raw);
                if (this.checkThreshold(spread, thresholds.rateSpread.value, '>')) {
                    this.updateFactors.default.push({
                        factor: thresholds.rateSpread.factor,
                        reason: thresholds.rateSpread.reason
                    });
                }
            } catch (error) {
                logger.warn('Error calculating rate spread:', error);
            }
        }
    }

    /**
     * Calculate devaluation factors
     */
    calculateDevaluationFactors(indicators) {
        const thresholds = ECONOMIC_THRESHOLDS.devaluation;

        // DXY < 100
        if (indicators.DXY && this.checkThreshold(indicators.DXY.raw, thresholds.dxy.value, '<')) {
            this.updateFactors.devaluation.push({
                factor: thresholds.dxy.factor,
                reason: thresholds.dxy.reason
            });
        }

        // Deficit > 7% GDP
        if (indicators.DeficitGDP && this.checkThreshold(indicators.DeficitGDP.raw, thresholds.deficitGDP.value, '>')) {
            this.updateFactors.devaluation.push({
                factor: thresholds.deficitGDP.factor,
                reason: thresholds.deficitGDP.reason
            });
        }
    }

    /**
     * Check if value meets threshold condition
     */
    checkThreshold(value, threshold, operator) {
        try {
            const numValue = validateNumber(value);
            const numThreshold = validateNumber(threshold);

            switch (operator) {
                case '>':
                    return numValue > numThreshold;
                case '<':
                    return numValue < numThreshold;
                case '>=':
                    return numValue >= numThreshold;
                case '<=':
                    return numValue <= numThreshold;
                case '==':
                    return numValue === numThreshold;
                default:
                    logger.warn(`Unknown operator: ${operator}`);
                    return false;
            }
        } catch (error) {
            logger.warn('Error checking threshold:', error);
            return false;
        }
    }

    /**
     * Apply trend adjustment to a factor
     */
    applyTrendAdjustment(baseFactor, seriesId) {
        if (!this.useTrendAnalysis || !this.trendMultipliers[seriesId]) {
            return baseFactor;
        }

        const trendMultiplier = this.trendMultipliers[seriesId];
        const adjustedFactor = baseFactor * trendMultiplier;

        logger.info(`Trend adjustment for ${seriesId}: ${baseFactor.toFixed(2)} × ${trendMultiplier.toFixed(2)} = ${adjustedFactor.toFixed(2)}`);

        return adjustedFactor;
    }

    /**
     * Calculate all probabilities
     */
    calculateAllProbabilities() {
        for (const event in this.currentProbabilities) {
            const baseProbability = BASE_PROBABILITIES[event];
            const factors = this.updateFactors[event];

            if (factors.length > 0) {
                let combinedFactor = factors.reduce((acc, f) => acc * f.factor, 1);

                // Apply correlation discount
                if (factors.length === 2 && CORRELATION_DISCOUNT[2]) {
                    combinedFactor *= CORRELATION_DISCOUNT[2];
                } else if (factors.length >= 3 && CORRELATION_DISCOUNT[3]) {
                    combinedFactor *= CORRELATION_DISCOUNT[3];
                }

                // Calculate new probability and clamp between 0 and 1
                this.currentProbabilities[event] = clamp(
                    baseProbability * combinedFactor,
                    0,
                    1.0
                );

                // Log if trend adjustments were applied
                const trendAdjusted = factors.some(f => f.trendAdjusted);
                if (trendAdjusted) {
                    logger.info(`${event} probability includes trend adjustments`);
                }
            } else {
                this.currentProbabilities[event] = baseProbability;
            }
        }
    }

    /**
     * Get current probabilities
     */
    getProbabilities() {
        return { ...this.currentProbabilities };
    }

    /**
     * Get update factors for a specific event
     */
    getFactors(event) {
        return this.updateFactors[event] || [];
    }

    /**
     * Get all update factors
     */
    getAllFactors() {
        return { ...this.updateFactors };
    }

    /**
     * Get risk level for an event
     */
    getRiskLevel(event) {
        const probability = this.currentProbabilities[event];
        const thresholds = RISK_THRESHOLDS[event];

        if (!thresholds) {
            return 'unknown';
        }

        if (probability >= thresholds.critical) {
            return 'critical';
        } else if (probability >= thresholds.high) {
            return 'high';
        } else if (probability >= thresholds.moderate) {
            return 'moderate';
        } else {
            return 'low';
        }
    }

    /**
     * Get all risk levels
     */
    getAllRiskLevels() {
        const levels = {};
        for (const event in this.currentProbabilities) {
            levels[event] = this.getRiskLevel(event);
        }
        return levels;
    }

    /**
     * Get critical events
     */
    getCriticalEvents() {
        return Object.entries(this.currentProbabilities)
            .filter(([event, prob]) => {
                const thresholds = RISK_THRESHOLDS[event];
                return thresholds && prob >= thresholds.critical;
            })
            .map(([event]) => event);
    }

    /**
     * Toggle trend analysis on/off
     */
    setTrendAnalysis(enabled) {
        this.useTrendAnalysis = enabled;
        logger.info(`Trend analysis ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get trend analysis for an indicator
     */
    getTrendAnalysis(seriesId, isInverted = false) {
        return this.trendAnalyzer.getTrendAnalysis(seriesId, isInverted);
    }

    /**
     * Get all trend multipliers
     */
    getTrendMultipliers() {
        return { ...this.trendMultipliers };
    }
}
