/**
 * Main application entry point for Ray Dalio Economic Risk Dashboard
 */

import { CONFIG } from './config.js';
import { DataService } from './dataService.js';
import { ProbabilityCalculator } from './probabilityCalculator.js';
import { UIManager } from './uiManager.js';
import { setupGlobalErrorHandler, logger, throttle } from './utils.js';

/**
 * Dashboard Application class
 */
class DashboardApp {
    constructor() {
        this.dataService = new DataService();
        this.probabilityCalculator = new ProbabilityCalculator();
        this.uiManager = new UIManager();
        this.refreshInterval = null;
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            logger.info('Initializing Dalio Dashboard...');

            // Setup global error handling
            setupGlobalErrorHandler();

            // Check backend connection
            const isConnected = await this.dataService.checkBackendConnection();
            this.uiManager.updateBackendStatus(isConnected);

            // Initial data fetch and update
            await this.refreshData();

            // Setup auto-refresh
            this.setupAutoRefresh();

            // Setup manual refresh button
            this.setupRefreshButton();

            logger.info('Dashboard initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize dashboard:', error);
            this.uiManager.showError('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    /**
     * Refresh all data and update UI
     */
    async refreshData() {
        try {
            this.uiManager.showLoading(true);
            logger.info('Refreshing data...');

            // Fetch all indicators
            const indicators = await this.dataService.fetchAllData();

            // Update probabilities
            const probabilities = this.probabilityCalculator.updateProbabilities(indicators);

            // Get update factors
            const factors = this.probabilityCalculator.getAllFactors();

            // Get connection status
            const connectionStatus = this.dataService.getConnectionStatus();

            // Update UI
            this.uiManager.updateAll(probabilities, factors, indicators, connectionStatus);

            logger.info('Data refresh completed successfully');
        } catch (error) {
            logger.error('Error refreshing data:', error);
            this.uiManager.showError('Error refreshing data. Using cached or mock data.');
        } finally {
            this.uiManager.showLoading(false);
        }
    }

    /**
     * Setup auto-refresh interval
     */
    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            logger.info('Auto-refresh triggered');
            await this.refreshData();
        }, CONFIG.REFRESH_INTERVAL_MS);

        logger.info(`Auto-refresh setup: every ${CONFIG.REFRESH_INTERVAL_MS / 1000 / 60} minutes`);
    }

    /**
     * Setup manual refresh button with throttling
     */
    setupRefreshButton() {
        const refreshButton = document.querySelector('.refresh-button');
        if (!refreshButton) {
            logger.warn('Refresh button not found');
            return;
        }

        // Throttle to prevent rapid clicking
        const throttledRefresh = throttle(async () => {
            logger.info('Manual refresh triggered');
            await this.dataService.checkBackendConnection();
            await this.refreshData();
        }, 2000); // 2 second throttle

        // Remove any existing onclick handler
        refreshButton.removeAttribute('onclick');

        // Add event listener
        refreshButton.addEventListener('click', (e) => {
            e.preventDefault();
            throttledRefresh();
        });

        logger.info('Refresh button setup complete');
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        logger.info('Dashboard destroyed');
    }
}

/**
 * Initialize app when DOM is ready
 */
let app = null;

function initApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            app = new DashboardApp();
            app.init();
        });
    } else {
        app = new DashboardApp();
        app.init();
    }
}

// Start the app
initApp();

// Expose for debugging
if (typeof window !== 'undefined') {
    window.dashboardApp = app;
}

// Export for testing
export { DashboardApp };
