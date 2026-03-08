// Utility functions
export function formatAddress(address) {
    if (!address) return '';
    if (address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

export function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
}

export function calculateFee(amount) {
    const fee = amount * 0.001;
    return Math.min(fee, 10); // Max fee 10
}
