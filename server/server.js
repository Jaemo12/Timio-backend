const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging middleware
const logRequest = (req, res, next) => {
    console.log('\n=== Incoming Request ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Query Parameters:', req.query);
    console.log('Body:', req.body);
    console.log('Headers:', {
        ...req.headers,
        authorization: req.headers.authorization ? '[REDACTED]' : undefined
    });
    next();
};

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(logRequest);

// Cloud Run request handler with enhanced logging
async function makeCloudRunRequest(endpoint, method, params = {}) {
    console.log('\n=== Making Cloud Run Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Method:', method);
    console.log('Parameters:', params);
    
    try {
        const config = {
            method: method,
            url: endpoint,
            headers: {
                'Authorization': process.env.CLOUD_RUN_API_KEY,
                'Content-Type': 'application/json'
            },
            params: method === 'GET' ? params : {},
            data: method === 'POST' ? params : undefined
        };

        console.log('Request Configuration:', {
            method: config.method,
            url: config.url,
            params: config.params,
            data: config.data,
            hasApiKey: !!config.headers.Authorization
        });

        console.log('Full URL with params:', 
            axios.getUri({
                url: endpoint,
                params: config.params
            })
        );

        const response = await axios(config);
        
        console.log('Cloud Run Response:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data
        });
        
        return response.data;
    } catch (error) {
        console.error('\n=== Cloud Run Request Error ===');
        console.error('Error Details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data,
            requestConfig: {
                url: error.config?.url,
                method: error.config?.method,
                params: error.config?.params,
                data: error.config?.data
            }
        });
        throw error;
    }
}

// Article content endpoint with enhanced error handling
app.get('/api/content', async (req, res) => {
    console.log('\n=== Content Endpoint Called ===');
    try {
        const { article_url } = req.query;
        console.log('Received article_url:', article_url);
        
        if (!article_url) {
            console.error('Missing article_url parameter');
            return res.status(400).json({ 
                error: 'Article URL is required',
                received: req.query
            });
        }

        console.log('Making request to Cloud Run content service');
        const result = await makeCloudRunRequest(
            process.env.CLOUD_RUN_CONTENT_URL,
            'GET',
            { article_url }
        );

        console.log('Successfully retrieved content:', {
            resultKeys: Object.keys(result),
            contentLength: result.text?.length
        });

        res.json(result);
    } catch (error) {
        console.error('\n=== Content Endpoint Error ===');
        console.error('Error Details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to fetch article content',
            details: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Insights endpoint with enhanced error handling
app.post('/api/insights', async (req, res) => {
    console.log('\n=== Insights Endpoint Called ===');
    try {
        const { content } = req.body;
        console.log('Received content length:', content?.length);
        
        if (!content) {
            console.error('Missing content in request body');
            return res.status(400).json({ 
                error: 'Content is required',
                received: {
                    bodyKeys: Object.keys(req.body),
                    contentPresent: !!content
                }
            });
        }

        console.log('Making request to Cloud Run insights service');
        const result = await makeCloudRunRequest(
            process.env.CLOUD_RUN_INSIGHTS_URL,
            'POST',
            { content }
        );

        console.log('Successfully generated insights');
        res.json(result);
    } catch (error) {
        console.error('\n=== Insights Endpoint Error ===');
        console.error('Error Details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to generate insights',
            details: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Tags endpoint with enhanced error handling
app.post('/api/tags', async (req, res) => {
    console.log('\n=== Tags Endpoint Called ===');
    try {
        const { content } = req.body;
        console.log('Received content length:', content?.length);
        
        if (!content) {
            console.error('Missing content in request body');
            return res.status(400).json({ 
                error: 'Content is required',
                received: {
                    bodyKeys: Object.keys(req.body),
                    contentPresent: !!content
                }
            });
        }

        console.log('Making request to Cloud Run tags service');
        const result = await makeCloudRunRequest(
            process.env.CLOUD_RUN_TAGS_URL,
            'POST',
            { content }
        );

        console.log('Successfully generated tags');
        res.json(result);
    } catch (error) {
        console.error('\n=== Tags Endpoint Error ===');
        console.error('Error Details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to fetch tags',
            details: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    console.log('\n=== Health Check Called ===');
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: {
            hasContentUrl: !!process.env.CLOUD_RUN_CONTENT_URL,
            hasInsightsUrl: !!process.env.CLOUD_RUN_INSIGHTS_URL,
            hasTagsUrl: !!process.env.CLOUD_RUN_TAGS_URL,
            hasApiKey: !!process.env.CLOUD_RUN_API_KEY
        },
        endpoints: {
            content: process.env.CLOUD_RUN_CONTENT_URL,
            insights: process.env.CLOUD_RUN_INSIGHTS_URL,
            tags: process.env.CLOUD_RUN_TAGS_URL
        }
    };
    
    console.log('Health Check Response:', health);
    res.json(health);
});

app.listen(PORT, () => {
    console.log(`\n=== Server Started ===`);
    console.log(`Server running on port ${PORT}`);
    console.log('Environment Check:', {
        hasContentUrl: !!process.env.CLOUD_RUN_CONTENT_URL,
        hasInsightsUrl: !!process.env.CLOUD_RUN_INSIGHTS_URL,
        hasTagsUrl: !!process.env.CLOUD_RUN_TAGS_URL,
        hasApiKey: !!process.env.CLOUD_RUN_API_KEY
    });
});