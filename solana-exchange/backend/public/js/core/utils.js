// Utility Functions
const Utils = {
    // Format address
    formatAddress: (address) => {
        if (!address) return '';
        if (address.length < 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    },

    // Format date
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    },

    // Format time
    formatTime: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString();
    },

    // Format datetime
    formatDateTime: (dateString) => {
        const date = new Date(dateString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    },

    // Calculate fee
    calculateFee: (amount) => {
        const fee = amount * AppConfig.FEE_PERCENT;
        return Math.min(fee, AppConfig.MAX_FEE);
    },

    // Format amount with decimals (safe version)
    formatAmount: (amount, asset) => {
        // Ensure amount is a number
        const num = parseFloat(amount) || 0;
        const decimals = AppConfig.ASSETS[asset]?.decimals || 4;
        return num.toFixed(decimals);
    },

    // Safe number formatting
    safeToFixed: (value, decimals = 2) => {
        const num = parseFloat(value) || 0;
        return num.toFixed(decimals);
    },

    // Show loading
    showLoading: () => {
        document.getElementById('loading').style.display = 'flex';
    },

    // Hide loading
    hideLoading: () => {
        document.getElementById('loading').style.display = 'none';
    },

    // Show notification
    showNotification: (type, message) => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${type === 'success' ? '✅' : '❌'}</span>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 5000);
    },

    // Handle error
    handleError: (error) => {
        console.error('Error:', error);
        Utils.showNotification('error', error.message || 'An error occurred');
    }
};

window.Utils = Utils;
