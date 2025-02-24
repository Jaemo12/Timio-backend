// Add this at the start of your content.js, before the IIFE
console.log('Content script loaded');

(() => {
    let port = null;

    function createPort() {
        console.log('Starting port creation process');

        try {
            if (port) {
                console.log('Existing port found, attempting cleanup');
                try {
                    port.disconnect();
                    console.log('Existing port disconnected successfully');
                } catch (e) {
                    console.warn('Port cleanup error:', e);
                }
            }

            console.log('Creating new port connection');
            const newPort = chrome.runtime.connect({ name: 'timio-extension' });
            console.log('New port created successfully:', newPort);

            newPort.onDisconnect.addListener(() => {
                const error = chrome.runtime.lastError;
                console.log('Port disconnected. Error:', error);

                if (error && error.message === 'Extension context invalidated.') {
                    console.log('Extension context invalidated, showing reload message');
                    handleExtensionReload();
                } else {
                    console.log('Attempting to reconnect port in 1 second');
                    setTimeout(() => {
                        port = createPort();
                    }, 1000);
                }
            });

            newPort.onMessage.addListener((msg) => {
                console.log('Port received message:', msg);
            });

            return newPort;
        } catch (error) {
            console.error('Port creation failed:', {
                error,
                stack: error.stack,
                lastError: chrome.runtime.lastError
            });

            if (error.message.includes('Extension context invalidated')) {
                console.log('Extension context invalidated during port creation');
                handleExtensionReload();
            }
            return null;
        }
    }

    function handleExtensionReload() {
        const modal = document.getElementById('timio-modal');
        if (!modal) return;

        const spinner = modal.querySelector('.timio-spinner');
        const content = modal.querySelector('.timio-insights-content');
        const pivotContent = modal.querySelector('.timio-pivot-content');

        if (spinner) spinner.style.display = 'none';

        const errorContainer = content || pivotContent;
        if (errorContainer) {
            errorContainer.style.display = 'block';
            errorContainer.innerHTML = `
                <div class="timio-error-message">
                    <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p class="timio-error-title">Extension Updated</p>
                    <p class="timio-error-text">Please refresh the page to continue using the extension.</p>
                    <button class="timio-refresh-button" onclick="window.location.reload()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.99 6.57 2.57L21 8"></path>
                            <path d="M21 3v5h-5"></path>
                        </svg>
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }

    function formatInsights(insights) {
        if (!insights) return '<p>No insights available</p>';

        let insightContent = insights;
        if (typeof insights === 'object' && insights.article_insight) {
            insightContent = insights.article_insight;
        }

        insightContent = insightContent
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\/g, '');

        const sections = insightContent
            .split('\n\n')
            .filter(section => section.trim());

        return `
            <div style="padding: 16px;">
                ${sections.map(section => {
                    const [title, ...points] = section.split('\n');

                    return `
                        <div class="timio-insight-section">
                            <h3 class="timio-insight-title">${title.replace(/\*\*/g, '')}</h3>
                            <ul class="timio-insight-list">
                                ${points.map(point => `
                                    <li class="timio-insight-item">
                                        ${point.replace(/^[•\-]\s*/, '').trim()}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="text-align: center;">
                <button class="timio-copy-button">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Analysis
                </button>
            </div>
        `;
    }

    function formatPivotArticles(articles) {
        console.log('Received articles:', articles); // Log the received articles for debugging

        if (!articles || articles.length === 0) {
            return `
                <div class="timio-error-message">
                    <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <p class="timio-error-title">No Results Found</p>
                    <p class="timio-error-text">Unable to find related articles. Please try a different article.</p>
                </div>
            `;
        }

        // Helper functions for fallback values
        const formatDate = (dateString) => {
            if (!dateString) return 'Recent';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Recent';
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (e) {
                console.warn('Error formatting date:', e);
                return 'Recent';
            }
        };

        const getDomain = (url) => {
            try {
                return new URL(url).hostname.replace('www.', '');
            } catch (e) {
                console.warn('Error parsing URL:', e);
                return 'Unknown source';
            }
        };

        const truncateText = (text, maxLength = 150) => {
            if (!text) return 'No description available';
            text = text.replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ''); // Remove HTML tags
            return text.length > maxLength ? 
                text.substring(0, maxLength).trim() + '...' : 
                text;
        };

        // Generate HTML for each article
        const articlesHTML = articles.map((article, index) => {
            console.log(`Processing article ${index + 1}:`, article); // Log each article for debugging

            if (!article.url) {
                console.warn('Article missing URL:', article);
                return ''; // Skip articles without a URL
            }

            const domain = article.source?.domain || getDomain(article.url);
            const description = article.description || article.summary || 'No description available';
            const date = formatDate(article.pubDate);
            const imageUrl = article.imageUrl || ''; // Fallback to empty string if no image URL
            const title = article.title || 'Untitled';
            const authorsByline = article.authorsByline ? article.authorsByline.split(',')[0] : '';

            return `
                <a href="${article.url}" 
                   class="timio-pivot-article" 
                   target="_blank" 
                   rel="noopener noreferrer">
                    ${imageUrl ? `
                        <div class="timio-pivot-image">
                            <div class="timio-image-placeholder"></div>
                            <img src="${imageUrl}" 
                                 alt="${title}"
                                 onload="this.previousElementSibling.style.display='none'"
                                 onerror="this.previousElementSibling.style.display='block';this.style.display='none'"
                                 loading="lazy">
                        </div>
                    ` : `
                        <div class="timio-pivot-image">
                            <div class="timio-image-placeholder"></div>
                        </div>
                    `}
                    
                    <div class="timio-pivot-text">
                        <h3 class="timio-pivot-title">${title}</h3>
                        <p class="timio-pivot-description">${truncateText(description)}</p>
                        
                        <div class="timio-pivot-meta">
                            <span class="timio-pivot-source">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 2H3v16h5v4l4-4h5l4-4V2z"></path>
                                </svg>
                                ${domain}
                            </span>
                            <span class="timio-pivot-date">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 6v6l4 2"></path>
                                </svg>
                                ${date}
                            </span>
                            ${authorsByline ? `
                                <span class="timio-pivot-author">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    ${authorsByline}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </a>
            `;
        }).join('');

        return `
            <div class="timio-pivot-container">
                ${articlesHTML}
            </div>
        `;
    }

    function addCopyButtonListener() {
        const copyButton = document.querySelector('.timio-copy-button');
        if (!copyButton) return;

        copyButton.addEventListener('click', async () => {
            const insightsContent = document.querySelector('.timio-insights-content');
            const textToCopy = insightsContent.textContent.trim();

            try {
                await navigator.clipboard.writeText(textToCopy);
                copyButton.classList.add('copied');
                copyButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                `;

                setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Analysis
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text:', err);
            }
        });
    }

    function handleButtonClick(action, title, animationType) {
        return async () => {
            console.log(`Button clicked - Action: ${action}, Title: ${title}, Animation: ${animationType}`);

            try {
                // Ensure port connection
                if (!port) {
                    console.log('No port found, creating new port...');
                    port = createPort();
                    if (!port) {
                        console.error('Failed to create port');
                        handleExtensionReload();
                        return;
                    }
                }

                const modal = document.getElementById('timio-modal');
                if (!modal) {
                    console.error('Modal element not found');
                    return;
                }

                const spinner = modal.querySelector('.timio-spinner');
                const content = modal.querySelector('.timio-insights-content');
                const pivotContent = modal.querySelector('.timio-pivot-content');

                // Update modal title and show it
                modal.querySelector('.timio-modal-title').textContent = title;
                modal.classList.add('active');

                // Create unique container for animation
                const containerId = `lottie-container-${Date.now()}`;

                // Setup spinner container with loading text
                spinner.innerHTML = `
                    <div id="${containerId}" class="timio-lottie-container"></div>
                    <p style="margin-top: 16px; color: #9ca3af; text-align: center;">
                        ${animationType === 'torch' ? 'Analyzing article...' : 'Finding related articles...'}
                    </p>
                `;

                // Show spinner, hide content
                spinner.style.display = 'flex';
                content.style.display = 'none';
                pivotContent.style.display = 'none';

                // Ensure the container exists before trying to set up animation
                const animationContainer = document.getElementById(containerId);
                if (!animationContainer) {
                    console.error('Animation container not found');
                    return;
                }

                // Load animation directly using Lottie
                try {
                    const animationPath = chrome.runtime.getURL(`${animationType}.json`);
                    lottie.loadAnimation({
                        container: animationContainer,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: animationPath,
                        onComplete: () => {
                            console.log(`${animationType} animation loaded successfully`);
                        },
                        onError: (error) => {
                            console.error(`${animationType} animation error:`, error);
                            animationContainer.innerHTML = `
                                <div class="timio-spinner-fallback"></div>
                            `;
                        }
                    });
                } catch (error) {
                    console.error('Animation setup failed:', error);
                    animationContainer.innerHTML = `
                        <div class="timio-spinner-fallback"></div>
                    `;
                }

                // Send message through port
                port.postMessage({
                    action,
                    url: window.location.href
                });

            } catch (error) {
                console.error('Button click handler failed:', {
                    error,
                    stack: error.stack,
                    action,
                    title,
                    animationType
                });
                handleExtensionReload();
            }
        };
    }

    function injectFloatingMenu() {
        if (document.getElementById('timio-floating-menu')) {
            return;
        }

        const style = document.createElement('style');
     style.textContent = `
         #timio-floating-menu {
             position: fixed;
             bottom: 24px;
             right: 24px;
             z-index: 2147483647;
             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         }
 
         .timio-menu-container {
             position: relative;
         }
        .timio-lottie-container {
    width: 300px;
    height: 300px;
    margin: 0 auto 16px auto;
    display: flex;
    align-items: center;
    justify-content: center;
}
         .timio-menu-items {
             position: absolute;
             bottom: 80px;
             right: 8px;
             display: flex;
             flex-direction: column;
             gap: 16px;
             opacity: 0;
             visibility: hidden;
             transform: translateY(20px);
             transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
         }
 
         .timio-menu-items.active {
             opacity: 1;
             visibility: visible;
             transform: translateY(0);
         }
 
         .timio-menu-button {
             width: 48px;
             height: 48px;
             border-radius: 50%;
             background: #3b82f6;
             border: none;
             cursor: pointer;
             display: flex;
             align-items: center;
             justify-content: center;
             box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
             transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
             padding: 0;
             position: relative;
         }
 
         .timio-menu-button svg {
             width: 24px;
             height: 24px;
             transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
         }
 
         .timio-menu-button .plus-icon {
             opacity: 1;
             transition: opacity 0.3s ease;
         }
 
         .timio-menu-button .arrow-icon {
             opacity: 0;
             position: absolute;
             transition: opacity 0.3s ease;
         }
 
         .timio-menu-button.active .plus-icon {
             opacity: 0;
         }
 
         .timio-menu-button.active .arrow-icon {
             opacity: 1;
         }
 
         .timio-menu-button:hover {
             transform: scale(1.05);
             background: #2563eb;
             box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
         }
 
         .timio-action-button {
            width: 48px;
            height: 48px;
            padding: 0;          /* Explicitly remove padding */
            margin: 0;          /* Explicitly remove margin */
            border: none;
            cursor: pointer;
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: none;
            display: flex;       /* Changed to flex */
            align-items: center; /* Center vertically */
            justify-content: center; /* Center horizontally */
            outline: none;
        }
         
        .timio-loading-spinner {
            display: inline-block;
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #3b82f6;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
 
         .button-image {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;       /* Added flex display */
            align-items: center;
            justify-content: center;
        }

        .timio-action-button img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
            padding: 0;
            margin: 0;
        }
 
         .timio-action-button:hover {
             transform: scale(1.1);
         }
 
         .timio-action-button:hover .button-image {
             box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
         }
 
         .timio-tooltip {
             position: absolute;
             right: 64px;
             top: 50%;
             transform: translateY(-50%);
             background: #1f2937;
             color: white;
             padding: 8px 12px;
             border-radius: 6px;
             font-size: 13px;
             font-weight: 500;
             white-space: nowrap;
             opacity: 0;
             visibility: hidden;
             transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
             pointer-events: none;
             box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
         }
 
         .timio-tooltip::after {
             content: '';
             position: absolute;
             right: -6px;
             top: 50%;
             transform: translateY(-50%);
             border-width: 6px;
             border-style: solid;
             border-color: transparent transparent transparent #1f2937;
         }
 
         .timio-action-button:hover .timio-tooltip {
             opacity: 1;
             visibility: visible;
             right: 60px;
         }
 
         .timio-modal {
             display: none;
             position: fixed;
             top: 0;
             right: 0;
             height: 100vh;
             width: 400px;
             background: #1a1a1a;
             box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
             z-index: 2147483646;
             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
             transform: translateX(100%);
             transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
             border-left: 1px solid rgba(255, 255, 255, 0.1);
         }
 
         .timio-modal.active {
             display: block;
             transform: translateX(0);
         }
 
         .timio-modal-content {
             background: #1a1a1a;
             height: 100%;
             width: 100%;
             display: flex;
             flex-direction: column;
         }
 
         .timio-modal-header {
             padding: 20px;
             background: #1a1a1a;
             border-bottom: 1px solid rgba(255, 255, 255, 0.1);
             position: relative;
         }
 
         .timio-modal-title {
             font-size: 18px;
             font-weight: 600;
             color: white;
             margin: 0;
             display: flex;
             align-items: center;
             gap: 12px;
         }
 
         .timio-modal-close {
             position: absolute;
             top: 50%;
             right: 20px;
             transform: translateY(-50%);
             background: transparent;
             border: none;
             color: #9ca3af;
             cursor: pointer;
             padding: 8px;
             font-size: 24px;
             border-radius: 6px;
             transition: all 0.2s ease;
         }
 
         .timio-modal-close:hover {
             color: white;
             background: rgba(255, 255, 255, 0.1);
         }
 
         .timio-modal-body {
             flex: 1;
             overflow-y: auto;
             padding: 20px;
             background: #1a1a1a;
             color: white;
         }
 
         .timio-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 40px 20px;
    width: 100%;
    background: #1a1a1a;
}


         .timio-error-message {
             text-align: center;
             padding: 24px;
             color: #ef4444;
         }
 
         .timio-error-icon {
             width: 48px;
             height: 48px;
             stroke: currentColor;
             margin-bottom: 16px;
         }
 
         .timio-error-title {
             font-size: 18px;
             font-weight: 600;
             margin: 0 0 8px 0;
         }
 
         .timio-error-text {
             font-size: 14px;
             color: #9ca3af;
             margin: 0 0 20px 0;
         }
 
         .timio-refresh-button {
             background: #3b82f6;
             color: white;
             border: none;
             padding: 10px 20px;
             border-radius: 8px;
             font-size: 14px;
             font-weight: 500;
             cursor: pointer;
             display: inline-flex;
             align-items: center;
             gap: 8px;
             transition: all 0.2s ease;
         }
 
         .timio-refresh-button:hover {
             background: #2563eb;
             transform: translateY(-1px);
         }
 
         .timio-refresh-button svg {
             width: 16px;
             height: 16px;
             stroke: currentColor;
         }
 
         /* Insights styles */
         .timio-insight-section {
             background: #2d2d2d;
             border-radius: 12px;
             padding: 20px;
             margin-bottom: 20px;
             border: 1px solid rgba(255, 255, 255, 0.1);
             transition: transform 0.2s ease;
         }
 
         .timio-insight-section:hover {
             transform: translateY(-2px);
             border-color: rgba(59, 130, 246, 0.5);
         }
 
         .timio-insight-title {
             color: #3b82f6;
             font-size: 16px;
             font-weight: 600;
             margin: 0 0 16px 0;
             letter-spacing: -0.01em;
         }
 
         .timio-insight-list {
             list-style: none;
             margin: 0;
             padding: 0;
             display: flex;
             flex-direction: column;
             gap: 12px;
         }
 
         .timio-insight-item {
             color: #e5e5e5;
             font-size: 14px;
             line-height: 1.6;
             padding-left: 20px;
             position: relative;
         }
 
         .timio-insight-item:before {
             content: "";
             position: absolute;
             left: 0;
             top: 8px;
             width: 6px;
             height: 6px;
             background: #3b82f6;
             border-radius: 50%;
         }
 
         /* Pivot styles */
         .timio-pivot-container {
             padding: 16px;
             display: flex;
             flex-direction: column;
             gap: 16px;
         }
 
         .timio-pivot-article {
             background: #2d2d2d;
             border-radius: 12px;
             padding: 20px;
             cursor: pointer;
             transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
             border: 1px solid rgba(255, 255, 255, 0.1);
             text-decoration: none;
             display: block;
         }
 
         .timio-pivot-article:hover {
             transform: translateX(4px);
             background: #363636;
             border-color: rgba(59, 130, 246, 0.5);
         }
 
         .timio-pivot-image {
             width: 100%;
             height: 200px;
             border-radius: 8px;
             overflow: hidden;
             margin-bottom: 16px;
             background: #1a1a1a;
             position: relative;
         }
 
         .timio-pivot-image img {
             width: 100%;
             height: 100%;
             object-fit: cover;
             transition: transform 0.3s ease;
         }
 
         .timio-pivot-article:hover .timio-pivot-image img {
             transform: scale(1.05);
         }
 
         .timio-pivot-title {
             color: #3b82f6;
             font-size: 16px;
             font-weight: 600;
             margin: 0 0 12px 0;
             line-height: 1.4;
             letter-spacing: -0.01em;
         }
 
         .timio-pivot-description {
             color: #e5e5e5;
             font-size: 14px;
             line-height: 1.6;
             margin: 0 0 16px 0;
         }
 
         .timio-pivot-meta {
             display: flex;
             align-items: center;
             gap: 16px;
             color: #9ca3af;
             font-size: 13px;
         }
 
         .timio-pivot-source,
         .timio-pivot-date,
         .timio-pivot-author {
             display: flex;
             align-items: center;
             gap: 6px;
         }
 
         .timio-pivot-meta svg {
             width: 14px;
             height: 14px;
             stroke-width: 2;
         }
 
         .timio-image-placeholder {
             width: 100%;
             height: 100%;
             background: linear-gradient(135deg, #2d2d2d 25%, #363636 50%, #2d2d2d 75%);
             background-size: 200% 200%;
             animation: shimmer 2s infinite;
             position: absolute;
             top: 0;
             left: 0;
         }
 
 
         @keyframes shimmer {
             0% {
                 background-position: 200% 200%;
             }
             100% {
                 background-position: -200% -200%;
             }
         }

     

@keyframes spinner-rotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.timio-spinner-fallback {
    width: 48px;
    height: 48px;
    border: 3px solid #3b82f6;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spinner-rotate 1s linear infinite;
    margin: 0 auto;
}
        .timio-copy-button {
            background: #2d2d2d;
            color: #e5e5e5;
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 8px;
            padding: 12px 24px;
            width: auto;
            max-width: 180px;
            margin: 24px auto 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .timio-copy-button:hover {
            background: #363636;
            border-color: #3b82f6;
            transform: translateY(-1px);
        }

        .timio-copy-button.copied {
            background: #065f46;
            border-color: #059669;
            color: white;
        }

        .timio-copy-button svg {
            width: 16px;
            height: 16px;
            stroke-width: 2;
        }

        /* Scrollbar styles */
        .timio-modal-body::-webkit-scrollbar {
            width: 8px;
            background-color: #1a1a1a;
        }

        .timio-modal-body::-webkit-scrollbar-thumb {
            background-color: #4b5563;
            border-radius: 4px;
        }

        .timio-modal-body::-webkit-scrollbar-thumb:hover {
            background-color: #6b7280;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .timio-modal {
                width: 100%;
                max-width: 100%;
            }

            .timio-pivot-meta {
                flex-wrap: wrap;
            }
        }
        .timio-progress {
            width: 100%;
            height: 4px;
            background: #2d2d2d;
            border-radius: 2px;
            margin: 8px 0;
            overflow: hidden;
        }

        .timio-progress-bar {
            height: 100%;
            background: #3b82f6;
            width: 0%;
            transition: width 0.3s ease;
        }

        .timio-status-text {
            color: #9ca3af;
            font-size: 13px;
            text-align: center;
            margin: 8px 0;
        }
    `;
    document.head.appendChild(style);

    const menuContainer = document.createElement('div');
    menuContainer.id = 'timio-floating-menu';
    menuContainer.innerHTML = `
        <div class="timio-menu-container">
            <div class="timio-menu-items">
                <button class="timio-action-button" id="timio-insights">
                    <div class="button-image">
                        <img src="${chrome.runtime.getURL('Torch_Icon.png')}" alt="Torch">
                    </div>
                    <span class="timio-tooltip">Torch</span>
                </button>
                <button class="timio-action-button" id="timio-pivot">
                    <div class="button-image">
                        <img src="${chrome.runtime.getURL('Pivot_Icon.png')}" alt="Pivot">
                    </div>
                    <span class="timio-tooltip">Pivot</span>
                </button>
            </div>
            <button class="timio-menu-button" id="timio-toggle">
                <svg class="menu-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                    <g class="plus-icon">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </g>
                    <g class="arrow-icon">
                        <path d="M6 9l6 6 6-6"></path>
                    </g>
                </svg>
            </button>
        </div>
    `;

    const modal = document.createElement('div');
    modal.id = 'timio-modal';
    modal.className = 'timio-modal';
    modal.innerHTML = `
        <div class="timio-modal-content">
            <div class="timio-modal-header">
                <h2 class="timio-modal-title">Torch's Insights</h2>
                <button class="timio-modal-close">×</button>
            </div>
            <div class="timio-modal-body">
                <div class="timio-spinner">
                    <div id="animation-container" class="timio-lottie-container"></div>
                    <p style="margin-top: 16px; color: #9ca3af;">Analyzing article...</p>
                </div>
                <div class="timio-insights-content" style="display: none;"></div>
                <div class="timio-pivot-content" style="display: none;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(menuContainer);
    document.body.appendChild(modal);

    port = createPort();

    const toggle = document.getElementById('timio-toggle');
    const menuItems = document.querySelector('.timio-menu-items');
    const insightsButton = document.getElementById('timio-insights');
    const pivotButton = document.getElementById('timio-pivot');
    let isOpen = false;

    toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        toggle.classList.toggle('active');
        menuItems.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target) && isOpen) {
            isOpen = false;
            toggle.classList.remove('active');
            menuItems.classList.remove('active');
        }
    });

    insightsButton.addEventListener('click', 
        handleButtonClick('getInsights', 'Torch\'s Insights', 'torch')
    );
    pivotButton.addEventListener('click', 
        handleButtonClick('getPivotArticles', 'Alternate Views', 'pivot')
    );

    const closeButton = modal.querySelector('.timio-modal-close');
    closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
        window.cleanupAnimations();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    if (port) {
        port.onMessage.addListener((response) => {
            console.log('Received response:', response);
            if (!modal) return;

            const spinner = modal.querySelector('.timio-spinner');
            const content = modal.querySelector('.timio-insights-content');
            const pivotContent = modal.querySelector('.timio-pivot-content');

            // Use the new cleanup function from lottie-manager.js
            window.cleanupAnimations();

            spinner.style.display = 'none';

            if (response.insights) {
                pivotContent.style.display = 'none';
                content.style.display = 'block';
                content.innerHTML = formatInsights(response.insights);
                setTimeout(() => {
                    addCopyButtonListener();
                }, 100);
            }
            else if (response.articles) {
                // Extract the nested articles array
                const articlesArray = response.articles.articles;
                console.log('Extracted articles array:', articlesArray); // Log the extracted array

                if (!articlesArray || articlesArray.length === 0) {
                    pivotContent.innerHTML = `
                        <div class="timio-error-message">
                            <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <p class="timio-error-title">No Results Found</p>
                            <p class="timio-error-text">Unable to find related articles. Please try a different article.</p>
                        </div>
                    `;
                } else {
                    content.style.display = 'none';
                    pivotContent.style.display = 'block';
                    pivotContent.innerHTML = formatPivotArticles(articlesArray); // Pass the extracted array
                }
            }
            else if (response.error) {
                const errorContainer = pivotContent.style.display === 'block' ? pivotContent : content;
                const otherContainer = errorContainer === content ? pivotContent : content;

                otherContainer.style.display = 'none';
                errorContainer.style.display = 'block';
                errorContainer.innerHTML = `
                    <div class="timio-error-message">
                        <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p class="timio-error-title">Error</p>
                        <p class="timio-error-text">${response.error}</p>
                        <button class="timio-refresh-button" onclick="window.location.reload()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.99 6.57 2.57L21 8"></path>
                                <path d="M21 3v5h-5"></path>
                            </svg>
                            Refresh Page
                        </button>
                    </div>
                `;
            }
        });
    }
}

if (document.readyState === 'complete') {
    injectFloatingMenu();
} else {
    window.addEventListener('load', injectFloatingMenu);
}
})();