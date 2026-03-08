// Application Configuration
const AppConfig = {
    // API endpoints
    API: {
        auth: '/api/auth',
        user: '/api/user',
        withdraw: '/api/withdraw',
        transfer: '/api/transfer',
        transactions: '/api/transactions',
        health: '/api/health'
    },
    
    // Constants
    SOL_PRICE: 100,
    FEE_PERCENT: 0.001,
    MAX_FEE: 10,
    REFRESH_INTERVAL: 5000,
    
    // Asset configs
    ASSETS: {
        SOL: { 
            icon: '◎', 
            decimals: 4, 
            color: '#6b5b95',
            gradient: 'linear-gradient(135deg, #6b5b95, #4a3f6e)'
        },
        USDC: { 
            icon: '💵', 
            decimals: 2, 
            color: '#2775ca',
            gradient: 'linear-gradient(135deg, #2775ca, #1b5a9c)'
        }
    }
};

window.AppConfig = AppConfig;
