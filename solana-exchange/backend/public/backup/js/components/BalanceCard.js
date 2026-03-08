// Balance Card Component
export function BalanceCard({ asset, balance, usdValue, icon, onClick }) {
    return `
        <div class="balance-card ${asset.toLowerCase()}" onclick="${onClick}">
            <div class="balance-icon">${icon}</div>
            <div class="balance-info">
                <div class="balance-label">${asset} Balance</div>
                <div class="balance-amount" id="${asset.toLowerCase()}-balance">${balance.toFixed(4)}</div>
                <div class="balance-usd" id="${asset.toLowerCase()}-usd">$${usdValue.toFixed(2)}</div>
            </div>
        </div>
    `;
}
