/**
 * UI Manager for updating the dashboard display
 */

import { INDICATOR_DISPLAY_ORDER, BASE_PROBABILITIES } from './config.js';
import { sanitizeHTML, formatDate, logger } from './utils.js';

/**
 * UI Manager class
 */
export class UIManager {
    constructor() {
        this.elements = {};
        this.initializeElements();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            alertBanner: document.getElementById('alert-banner'),
            indicatorsGrid: document.getElementById('indicators-grid'),
            lastUpdate: document.getElementById('last-update'),
            corsNotice: document.getElementById('cors-notice'),
            backendStatus: document.getElementById('backend-status'),
            loadingIndicator: document.getElementById('loading-indicator'),

            // Probability displays
            recessionProb: document.getElementById('recession-prob'),
            depressionProb: document.getElementById('depression-prob'),
            reserveProb: document.getElementById('reserve-prob'),
            defaultProb: document.getElementById('default-prob'),
            devaluationProb: document.getElementById('devaluation-prob'),

            // Cards
            recessionCard: document.getElementById('recession-card'),
            depressionCard: document.getElementById('depression-card'),
            reserveCard: document.getElementById('reserve-card'),
            defaultCard: document.getElementById('default-card'),
            devaluationCard: document.getElementById('devaluation-card')
        };

        // Validate critical elements
        this.validateElements();
    }

    /**
     * Validate that critical elements exist
     */
    validateElements() {
        const criticalElements = [
            'alertBanner',
            'indicatorsGrid',
            'lastUpdate',
            'loadingIndicator'
        ];

        const missing = criticalElements.filter(key => !this.elements[key]);
        if (missing.length > 0) {
            logger.warn('Missing critical DOM elements:', missing);
        }
    }

    /**
     * Update all UI elements
     */
    updateAll(probabilities, factors, indicators, connectionStatus) {
        try {
            this.updateProbabilityDisplays(probabilities, factors);
            this.updateIndicatorsGrid(indicators);
            this.updateAlertBanner(probabilities);
            this.updateTimestamp();
            this.updateConnectionStatus(connectionStatus);
        } catch (error) {
            logger.error('Error updating UI:', error);
        }
    }

    /**
     * Update probability displays
     */
    updateProbabilityDisplays(probabilities, factors) {
        const events = ['recession', 'depression', 'reserve', 'default', 'devaluation'];

        events.forEach(event => {
            try {
                this.updateProbabilityDisplay(event, probabilities[event], factors[event]);
            } catch (error) {
                logger.error(`Error updating ${event} display:`, error);
            }
        });
    }

    /**
     * Update single probability display
     */
    updateProbabilityDisplay(event, probability, factors) {
        const element = this.elements[`${event}Prob`];
        const card = this.elements[`${event}Card`];

        if (!element || !card) {
            logger.warn(`Missing elements for ${event}`);
            return;
        }

        // Update percentage
        const percentage = (probability * 100).toFixed(1) + '%';
        element.textContent = percentage;

        // Update risk level class
        const riskLevel = this.getRiskLevel(event, probability);
        element.classList.remove('risk-low', 'risk-moderate', 'risk-high', 'risk-critical');
        element.classList.add(`risk-${riskLevel}`);

        // Update factors list
        this.updateFactorsList(card, factors);
    }

    /**
     * Get risk level based on probability
     */
    getRiskLevel(event, probability) {
        const thresholds = {
            recession: 0.60,
            depression: 0.20,
            reserve: 0.30,
            default: 0.10,
            devaluation: 0.50
        };

        const threshold = thresholds[event] || 0.5;

        if (probability >= threshold) {
            return 'critical';
        } else if (probability >= threshold * 0.7) {
            return 'high';
        } else if (probability >= threshold * 0.4) {
            return 'moderate';
        } else {
            return 'low';
        }
    }

    /**
     * Update factors list for a card
     */
    updateFactorsList(card, factors) {
        const factorsList = card.querySelector('.indicator-list');
        if (!factorsList) return;

        if (factors && factors.length > 0) {
            const factorsHTML = factors
                .map(f => {
                    const reason = sanitizeHTML(f.reason);
                    const factor = sanitizeHTML(f.factor.toString());
                    return `<div class="data-source">↗ ${reason} (×${factor})</div>`;
                })
                .join('');
            factorsList.innerHTML = factorsHTML;
        } else {
            factorsList.innerHTML = '<div class="data-source">No active triggers</div>';
        }
    }

    /**
     * Update indicators grid
     */
    updateIndicatorsGrid(indicators) {
        const grid = this.elements.indicatorsGrid;
        if (!grid) return;

        // Clear grid
        grid.innerHTML = '';

        INDICATOR_DISPLAY_ORDER.forEach(key => {
            if (indicators[key]) {
                try {
                    const indicatorElement = this.createIndicatorElement(indicators[key]);
                    grid.appendChild(indicatorElement);
                } catch (error) {
                    logger.error(`Error creating indicator element for ${key}:`, error);
                }
            }
        });
    }

    /**
     * Create indicator element
     */
    createIndicatorElement(indicator) {
        const div = document.createElement('div');
        div.className = 'indicator';

        const name = sanitizeHTML(indicator.name);
        const value = sanitizeHTML(indicator.value);
        const threshold = sanitizeHTML(indicator.threshold);
        const source = sanitizeHTML(indicator.source);
        const date = indicator.date ? sanitizeHTML(formatDate(indicator.date)) : '';
        const note = indicator.note ? `<br>${sanitizeHTML(indicator.note)}` : '';

        div.innerHTML = `
            <div class="indicator-name">${name}</div>
            <div class="indicator-value">${value}</div>
            <div class="indicator-threshold">Threshold: ${threshold}</div>
            <div class="data-source">
                Source: ${source}
                ${date ? ` (${date})` : ''}
                ${note}
            </div>
        `;

        return div;
    }

    /**
     * Update alert banner
     */
    updateAlertBanner(probabilities) {
        const banner = this.elements.alertBanner;
        if (!banner) return;

        const criticalEvents = this.getCriticalEvents(probabilities);

        if (criticalEvents.length > 0) {
            banner.style.display = 'block';
            banner.className = 'alert-banner alert-red';
            const eventNames = criticalEvents.map(sanitizeHTML).join(', ');
            banner.textContent = `⚠️ RED ALERT: Critical risk levels for ${eventNames}`;
        } else if (this.hasMultipleElevatedRisks(probabilities, 3)) {
            banner.style.display = 'block';
            banner.className = 'alert-banner alert-orange';
            banner.textContent = '⚠️ ORANGE ALERT: Multiple elevated risk indicators';
        } else if (this.hasMultipleElevatedRisks(probabilities, 2)) {
            banner.style.display = 'block';
            banner.className = 'alert-banner alert-yellow';
            banner.textContent = '⚠️ YELLOW ALERT: Some risk indicators elevated';
        } else {
            banner.style.display = 'none';
        }
    }

    /**
     * Get critical events
     */
    getCriticalEvents(probabilities) {
        const thresholds = {
            recession: 0.60,
            depression: 0.20,
            reserve: 0.30,
            default: 0.10,
            devaluation: 0.50
        };

        return Object.entries(probabilities)
            .filter(([event, prob]) => prob >= (thresholds[event] || 0.5))
            .map(([event]) => event);
    }

    /**
     * Check if multiple risks are elevated
     */
    hasMultipleElevatedRisks(probabilities, multiplier) {
        const maxCurrent = Math.max(...Object.values(probabilities));
        const maxBase = Math.max(...Object.values(BASE_PROBABILITIES));
        return maxCurrent > maxBase * multiplier;
    }

    /**
     * Update timestamp
     */
    updateTimestamp() {
        const element = this.elements.lastUpdate;
        if (element) {
            element.textContent = new Date().toLocaleString();
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
        const element = this.elements.corsNotice;
        if (!element) return;

        if (status.isFullyLive) {
            element.innerHTML = `✅ Connected to live FRED data via proxy server (${status.liveCount}/${status.totalCount} indicators)`;
            element.style.color = '#00ff88';
        } else if (status.isPartialLive) {
            element.innerHTML = `⚠️ Partial live data: ${status.liveCount} live, ${status.mockCount} mock indicators`;
            element.style.color = '#ffaa00';
        } else if (!status.useBackend) {
            element.innerHTML = `
                ⚠️ Using mock data. To enable live data:<br>
                1. Save the proxy server code and run: <code>npm install express cors axios && node fred-proxy-server.js</code><br>
                2. Refresh this page once the server is running on port 3001
            `;
            element.style.color = '#ff8844';
        } else {
            element.innerHTML = 'Loading data...';
        }
    }

    /**
     * Update backend status message
     */
    updateBackendStatus(isConnected) {
        const element = this.elements.backendStatus;
        if (!element) return;

        if (isConnected) {
            element.innerHTML = '<span style="color: #00ff88;">✅ Backend proxy server is connected and ready!</span>';
        } else {
            element.innerHTML = '<span style="color: #ff8844;">⚠️ Backend proxy not detected. Follow the steps above to enable live data.</span>';
        }
    }

    /**
     * Show/hide loading indicator
     */
    showLoading(show) {
        const element = this.elements.loadingIndicator;
        if (element) {
            element.style.display = show ? 'inline-block' : 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message, type = 'error') {
        const banner = this.elements.alertBanner;
        if (!banner) return;

        banner.style.display = 'block';
        banner.className = `alert-banner alert-${type === 'error' ? 'red' : 'orange'}`;
        banner.textContent = `⚠️ ${sanitizeHTML(message)}`;

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (banner.textContent === `⚠️ ${sanitizeHTML(message)}`) {
                banner.style.display = 'none';
            }
        }, 10000);
    }
}
