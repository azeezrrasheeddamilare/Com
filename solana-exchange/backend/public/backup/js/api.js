// API Service - All calls use relative paths
const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        
        // Add cache busting for GET requests to ensure fresh data
        let url = endpoint;
        if (options.method === undefined || options.method === 'GET') {
            const separator = endpoint.includes('?') ? '&' : '?';
            url = `${endpoint}${separator}_t=${Date.now()}`;
        }
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    },
    
    // Auth endpoints
    login: (email, password) => API.request('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password })
    }),
    
    register: (email, username, password, phone) => API.request('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', email, username, password, phone })
    }),
    
    verifyToken: () => API.request('/api/auth/verify'),
    
    // User endpoints - with cache busting
    getUser: (userId) => API.request(`/api/user/${userId}`),
    
    // Transaction endpoints
    getTransactions: () => API.request('/api/transactions'),
    
    // Withdrawal endpoints
    withdrawSOL: (amount, toAddress) => API.request('/api/withdraw/sol', {
        method: 'POST',
        body: JSON.stringify({ amount, toAddress })
    }),
    
    withdrawUSDC: (amount, toAddress) => API.request('/api/withdraw/usdc', {
        method: 'POST',
        body: JSON.stringify({ amount, toAddress })
    })
};

// Make API globally available
window.API = API;
