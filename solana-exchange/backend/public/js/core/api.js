// API Service
const API = {
    // Get auth token
    getToken: () => localStorage.getItem('token'),

    // Set auth token
    setToken: (token) => localStorage.setItem('token', token),

    // Remove auth token
    removeToken: () => localStorage.removeItem('token'),

    // Make API request
    async request(endpoint, options = {}) {
        const token = this.getToken();
        
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
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
    auth: {
        login: (email, password) => API.request(AppConfig.API.auth, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', email, password })
        }),

        register: (email, username, password, phone) => API.request(AppConfig.API.auth, {
            method: 'POST',
            body: JSON.stringify({ action: 'register', email, username, password, phone })
        }),

        verify: () => API.request(AppConfig.API.auth + '/verify')
    },

    // User endpoints
    user: {
        get: (userId) => API.request(`${AppConfig.API.user}/${userId}`)
    },

    // Transaction endpoints
    transactions: {
        getAll: () => API.request(AppConfig.API.transactions)
    },

    // Withdrawal endpoints
    withdraw: {
        sol: (amount, toAddress) => API.request(AppConfig.API.withdraw + '/sol', {
            method: 'POST',
            body: JSON.stringify({ amount, toAddress })
        }),
        usdc: (amount, toAddress) => API.request(AppConfig.API.withdraw + '/usdc', {
            method: 'POST',
            body: JSON.stringify({ amount, toAddress })
        })
    },

    // Transfer endpoints
    transfer: {
        send: (toUsername, asset, amount, memo) => API.request(AppConfig.API.transfer, {
            method: 'POST',
            body: JSON.stringify({ toUsername, asset, amount, memo })
        }),
        history: () => API.request(AppConfig.API.transfer + '/history')
    }
};

window.API = API;
