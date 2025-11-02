/**
 * Utility functions for error handling, validation, and common operations
 */

import { CONFIG } from './config.js';

/**
 * Custom error classes for better error handling
 */
export class NetworkError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'NetworkError';
        this.status = status;
    }
}

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class APIError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
    }
}

/**
 * Enhanced fetch with timeout and retry logic
 */
export async function fetchWithTimeout(url, options = {}, timeout = CONFIG.FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);

        if (!response.ok) {
            throw new NetworkError(
                `HTTP Error: ${response.status} ${response.statusText}`,
                response.status
            );
        }

        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new NetworkError('Request timeout', 408);
        }
        throw error;
    }
}

/**
 * Retry fetch operation with exponential backoff
 */
export async function fetchWithRetry(url, options = {}, maxRetries = CONFIG.MAX_RETRIES) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fetchWithTimeout(url, options);
        } catch (error) {
            lastError = error;
            console.warn(`Fetch attempt ${attempt + 1} failed:`, error.message);

            if (attempt < maxRetries - 1) {
                const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
                console.log(`Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw new NetworkError(
        `Failed after ${maxRetries} attempts: ${lastError.message}`,
        lastError.status
    );
}

/**
 * Validate numeric value
 */
export function validateNumber(value, fieldName = 'Value') {
    const num = parseFloat(value);
    if (isNaN(num) || !isFinite(num)) {
        throw new ValidationError(`${fieldName} must be a valid number. Received: ${value}`);
    }
    return num;
}

/**
 * Validate indicator data structure
 */
export function validateIndicatorData(data, seriesId) {
    if (!data) {
        throw new ValidationError(`No data received for ${seriesId}`);
    }

    if (!data.observations || !Array.isArray(data.observations)) {
        throw new ValidationError(`Invalid data structure for ${seriesId}: missing observations array`);
    }

    if (data.observations.length === 0) {
        throw new ValidationError(`No observations available for ${seriesId}`);
    }

    const observation = data.observations[0];
    if (!observation.value || !observation.date) {
        throw new ValidationError(`Invalid observation format for ${seriesId}`);
    }

    return true;
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Safely set inner HTML
 */
export function safeSetInnerHTML(element, html) {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Clear the element
    element.innerHTML = '';

    // Append sanitized content
    while (temp.firstChild) {
        element.appendChild(temp.firstChild);
    }
}

/**
 * Throttle function execution
 */
export function throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;

    return function (...args) {
        const currentTime = Date.now();

        if (currentTime - lastExecTime < delay) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                lastExecTime = currentTime;
                func.apply(this, args);
            }, delay - (currentTime - lastExecTime));
        } else {
            lastExecTime = currentTime;
            func.apply(this, args);
        }
    };
}

/**
 * Debounce function execution
 */
export function debounce(func, delay) {
    let timeoutId;

    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Sleep utility
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

/**
 * Safe console logger with levels
 */
export const logger = {
    info: (message, ...args) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (CONFIG.DEBUG) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }
};

/**
 * Global error handler
 */
export function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
        logger.error('Global error caught:', event.error);
        showUserError('An unexpected error occurred. Please refresh the page.');
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection:', event.reason);
        showUserError('An error occurred while fetching data. Using fallback data.');
    });
}

/**
 * Show user-friendly error message
 */
export function showUserError(message, type = 'error') {
    const alertBanner = document.getElementById('alert-banner');
    if (alertBanner) {
        alertBanner.style.display = 'block';
        alertBanner.className = `alert-banner alert-${type === 'error' ? 'red' : 'orange'}`;
        alertBanner.textContent = `⚠️ ${message}`;

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (alertBanner.textContent === `⚠️ ${message}`) {
                alertBanner.style.display = 'none';
            }
        }, 10000);
    }
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current, previous) {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
