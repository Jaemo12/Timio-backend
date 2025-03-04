// Configuration
const API_BASE_URL = 'https://timio-extension.onrender.com';
const API_ENDPOINTS = {
    GET_CONTENT: `${API_BASE_URL}/api/content`,
    GET_INSIGHTS: `${API_BASE_URL}/api/insights`,
    GET_TAGS: `${API_BASE_URL}/api/tags`
};

// Logging utility
const Logger = {
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = {
            timestamp,
            message,
            data: data ? (typeof data === 'string' ? data : { ...data, sensitive: undefined }) : null
        };
        console.log('TIMIO Extension:', logMessage);
    },
    
    error(message, error = null) {
        const timestamp = new Date().toISOString();
        const logMessage = {
            timestamp,
            message,
            error: error?.message || error,
            stack: error?.stack
        };
        console.error('TIMIO Extension ERROR:', logMessage);
    }
};

// Cache manager with logging
const CacheManager = {
    async set(key, data) {
        try {
            Logger.log(`Setting cache for key: ${key}`);
            await chrome.storage.local.set({
                [key]: {
                    data,
                    timestamp: Date.now()
                }
            });
            Logger.log(`Cache set successfully for key: ${key}`);
        } catch (error) {
            Logger.error(`Failed to set cache for key: ${key}`, error);
            throw error;
        }
    },

    async get(key) {
        try {
            Logger.log(`Getting cache for key: ${key}`);
            const result = await chrome.storage.local.get(key);
            Logger.log(`Cache retrieved for key: ${key}`);
            return result[key];
        } catch (error) {
            Logger.error(`Failed to get cache for key: ${key}`, error);
            throw error;
        }
    },

    async clear(keys) {
        try {
            Logger.log(`Clearing cache for keys:`, keys);
            await chrome.storage.local.remove(keys);
            Logger.log('Cache cleared successfully');
        } catch (error) {
            Logger.error('Failed to clear cache', error);
            throw error;
        }
    },

    isExpired(timestamp) {
        const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
        return Date.now() - timestamp > CACHE_DURATION;
    }
};

// API Service with improved request handling
const ApiService = {
    async fetchWithRetry(url, options, retries = 3) {
        Logger.log(`Making API request to: ${url}`, { 
            method: options.method,
            hasBody: !!options.body
        });
        
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                Logger.log(`Request attempt ${i + 1} of ${retries}`);
                
                // Ensure proper URL for GET requests with params
                const finalUrl = options.method === 'GET' && options.params 
                    ? `${url}?${new URLSearchParams(options.params)}`
                    : url;

                // Log request details
                Logger.log('Request details:', {
                    url: finalUrl,
                    method: options.method,
                    hasParams: !!options.params,
                    hasBody: !!options.body
                });

                const response = await fetch(finalUrl, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
                }

                const data = await response.json();
                Logger.log(`API request successful`, { 
                    status: response.status,
                    hasData: !!data 
                });
                return data;
            } catch (error) {
                lastError = error;
                Logger.error(`API request attempt ${i + 1} failed`, error);
                
                if (i === retries - 1) break;
                
                const delay = Math.pow(2, i) * 1000;
                Logger.log(`Retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }
};

// Content Service with improved data handling
const ContentService = {
    async getArticleContent(url, useCache = true) {
        Logger.log(`Getting article content for URL: ${url}`, { useCache });
        
        const cacheKey = `content_${url}`;
        if (useCache) {
            try {
                const cached = await CacheManager.get(cacheKey);
                if (cached && !CacheManager.isExpired(cached.timestamp)) {
                    Logger.log('Returning cached content');
                    return cached.data;
                }
            } catch (error) {
                Logger.error('Cache retrieval failed', error);
            }
        }

        try {
            Logger.log(`Fetching fresh content from API`);
            
            const data = await ApiService.fetchWithRetry(
                API_ENDPOINTS.GET_CONTENT,
                { 
                    method: 'GET',
                    params: { article_url: url }
                }
            );

            if (!data || !data.clean_text) {
                throw new Error('Invalid content response from API');
            }

            await CacheManager.set(cacheKey, data);
            return data;
        } catch (error) {
            Logger.error('Failed to get article content', error);
            throw error;
        }
    },

    async getInsights(content, url, useCache = true) {
        const cacheKey = `insights_${url}`;
        if (useCache) {
            try {
                const cached = await CacheManager.get(cacheKey);
                if (cached && !CacheManager.isExpired(cached.timestamp)) {
                    Logger.log('Returning cached insights');
                    return cached.data;
                }
            } catch (error) {
                Logger.error('Cache retrieval failed', error);
            }
        }

        try {
            Logger.log('Requesting insights analysis');
            
            if (!content || !content.clean_text) {
                throw new Error('Invalid content provided for insights');
            }

            const insights = await ApiService.fetchWithRetry(
                API_ENDPOINTS.GET_INSIGHTS,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        content: content.clean_text
                    })
                }
            );

            await CacheManager.set(cacheKey, insights);
            return insights;
        } catch (error) {
            Logger.error('Failed to get insights', error);
            throw error;
        }
    },

    async getTags(content, url, useCache = true) {
        const cacheKey = `tags_${url}`;
        if (useCache) {
            try {
                const cached = await CacheManager.get(cacheKey);
                if (cached && !CacheManager.isExpired(cached.timestamp)) {
                    Logger.log('Returning cached tags');
                    return cached.data;
                }
            } catch (error) {
                Logger.error('Cache retrieval failed', error);
            }
        }

        try {
            Logger.log('Requesting content tags');
            
            if (!content || !content.clean_text) {
                throw new Error('Invalid content provided for tags');
            }

            const tags = await ApiService.fetchWithRetry(
                API_ENDPOINTS.GET_TAGS,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        content: content.clean_text 
                    })
                }
            );

            await CacheManager.set(cacheKey, tags);
            return tags;
        } catch (error) {
            Logger.error('Failed to get tags', error);
            throw error;
        }
    }
};

// Port Manager with improved message handling
const PortManager = {
    ports: new Set(),

    addPort(port) {
        Logger.log(`New port connection: ${port.name}`);
        this.ports.add(port);
        port.onDisconnect.addListener(() => {
            Logger.log(`Port disconnected: ${port.name}`);
            this.ports.delete(port);
        });
    },

    isPortActive(port) {
        const active = this.ports.has(port);
        Logger.log(`Checking port status: ${port.name}`, { active });
        return active;
    },

    sendMessage(port, message) {
        if (this.isPortActive(port)) {
            port.postMessage(message);
            Logger.log('Message sent through port', { type: message.error ? 'error' : 'success' });
        }
    }
};

// Message handling
chrome.runtime.onConnect.addListener((port) => {
    Logger.log('New connection established');
    PortManager.addPort(port);

    port.onMessage.addListener(async (message) => {
        Logger.log('Received message', { action: message.action });
        
        const operationTimeout = setTimeout(() => {
            if (PortManager.isPortActive(port)) {
                Logger.error('Operation timed out');
                PortManager.sendMessage(port, {
                    error: 'Operation timed out. Please try again.'
                });
            }
        }, 30000);

        try {
            if (!PortManager.isPortActive(port)) {
                Logger.log('Port is no longer active, ignoring message');
                return;
            }

            switch (message.action) {
                case 'getInsights':
                    try {
                        Logger.log('Processing getInsights request');
                        const content = await ContentService.getArticleContent(message.url);
                        Logger.log('Content retrieved, fetching insights');
                        
                        const insights = await ContentService.getInsights(content, message.url);
                        PortManager.sendMessage(port, { insights });
                    } catch (error) {
                        Logger.error('Failed to get insights', error);
                        PortManager.sendMessage(port, {
                            error: 'Unable to analyze this article.'
                        });
                    }
                    break;

                case 'getPivotArticles':
                    try {
                        Logger.log('Processing getPivotArticles request');
                        const content = await ContentService.getArticleContent(message.url);
                        
                        Logger.log('Content retrieved, length:', {
                            textLength: content.clean_text?.length,
                            htmlLength: content.clean_html?.length
                        });
                        
                        const articles = await ContentService.getTags(content, message.url);
                        
                        Logger.log('Related articles retrieved', {
                            hasArticles: !!articles,
                            articleCount: Array.isArray(articles) ? articles.length : 'not an array'
                        });
                        
                        PortManager.sendMessage(port, { articles });
                    } catch (error) {
                        Logger.error('Failed to get related articles', error);
                        PortManager.sendMessage(port, {
                            error: 'Unable to find related articles.'
                        });
                    }
                    break;

                default:
                    Logger.error(`Unknown action: ${message.action}`);
                    PortManager.sendMessage(port, {
                        error: `Unknown action: ${message.action}`
                    });
            }
        } catch (error) {
            Logger.error('Unexpected error in message handler', error);
            PortManager.sendMessage(port, {
                error: 'An unexpected error occurred.'
            });
        } finally {
            clearTimeout(operationTimeout);
        }
    });
});

// Log when the background script loads
Logger.log('Background script initialized', {
    apiBaseUrl: API_BASE_URL,
    endpoints: API_ENDPOINTS
});