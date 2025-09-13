// Configuration file for Shared Notes Web Frontend

const CONFIG = {
    // API Configuration
    API_BASE_URL: window.location.hostname === 'd3e671tppt51wm.cloudfront.net' 
        ? 'https://d2w8ulo83u5tax.cloudfront.net/api/v1'
        : 'http://localhost:8000/api/v1',
    
    // Application Settings
    APP_NAME: 'Shared Notes',
    APP_VERSION: '1.0.0',
    
    // UI Settings
    AUTO_HIDE_ALERTS_AFTER: 5000, // milliseconds
    NOTES_PER_PAGE: 100,
    
    // Token Settings
    TOKEN_STORAGE_KEY: 'accessToken',
    REFRESH_TOKEN_STORAGE_KEY: 'refreshToken',
    
    // Default Values
    DEFAULT_SHARE_PERMISSION: 'read',
    DEFAULT_NOTE_VISIBILITY: false
};

// Make config available globally
window.CONFIG = CONFIG;
