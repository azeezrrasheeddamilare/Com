import { formatAddress, formatDate, formatTime } from '../services/utils.js';

// Transaction List Component
export function TransactionList({ transactions }) {
    if (!transactions || transactions.length === 0) {
        return '<div class="empty-state">📭 No transactions yet</div>';
    }
    
    // Group by date
    const grouped = {};
    transactions.forEach(tx => {
        const date = formatDate(tx.created_at);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(tx);
    });
    
    let html = '';
    for (const [date, txs] of Object.entries(grouped)) {
        html += `<div class="transaction-date-header">${date}</div>`;
        
        txs.forEach(tx => {
            const time = formatTime(tx.created_at);
            const sign = tx.type.includes('deposit') ? '+' : '-';
            const color = tx.type.includes('deposit') ? '#10b981' : '#f59e0b';
            
            html += `
                <div class="transaction-card" style="border-left-color: ${color}">
                    <div class="transaction-icon">${tx.type.includes('deposit') ? '📥' : '📤'}</div>
                    <div class="transaction-details">
                        <div class="transaction-type">
                            ${tx.type.toUpperCase()} · ${tx.asset}
                        </div>
                        <div class="transaction-time">${time}</div>
                        ${tx.tx_signature ? `
                            <div class="transaction-tx">
                                ${formatAddress(tx.tx_signature)}
                            </div>
                        ` : ''}
                    </div>
                    <div class="transaction-amount" style="color: ${color}">
                        ${sign}${Math.abs(tx.amount)} ${tx.asset}
                        ${tx.fee > 0 ? `<div class="transaction-fee">fee: ${tx.fee}</div>` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    return html;
}
