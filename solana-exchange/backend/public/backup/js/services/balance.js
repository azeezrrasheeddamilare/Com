import { getUser } from '../api/user.js';

let balanceInterval = null;

export async function updateBalance(userId) {
    try {
        const user = await getUser(userId);
        return {
            sol: user.sol_balance || 0,
            usdc: user.usdc_balance || 0
        };
    } catch (err) {
        console.error('Balance update failed:', err);
        return null;
    }
}

export function startBalanceAutoRefresh(userId, callback) {
    if (balanceInterval) clearInterval(balanceInterval);
    balanceInterval = setInterval(async () => {
        const balances = await updateBalance(userId);
        if (balances) callback(balances);
    }, 5000);
}

export function stopBalanceAutoRefresh() {
    if (balanceInterval) {
        clearInterval(balanceInterval);
        balanceInterval = null;
    }
}
