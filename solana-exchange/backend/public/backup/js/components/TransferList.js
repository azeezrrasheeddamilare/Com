import { formatAddress, formatDate, formatTime } from '../services/utils.js';

// Transfer List Component
export function TransferList({ transfers, currentUserId }) {
    if (!transfers || transfers.length === 0) {
        return '<div class="empty-state">📭 No transfers yet</div>';
    }
    
    return transfers.map(t => {
        const isSender = t.sender_id === currentUserId;
        const sign = isSender ? '-' : '+';
        const color = isSender ? '#f59e0b' : '#10b981';
        const date = formatDate(t.created_at);
        const time = formatTime(t.created_at);
        
        return `
            <div class="transfer-item" style="border-left-color: ${color}">
                <div class="transfer-icon">${isSender ? '📤' : '📥'}</div>
                <div class="transfer-details">
                    <div>
                        ${isSender ? 'To' : 'From'}: @${isSender ? t.receiver_name : t.sender_name}
                    </div>
                    <div class="transfer-memo">${t.memo || 'No memo'}</div>
                    <div class="transfer-time">${date} ${time}</div>
                </div>
                <div class="transfer-amount" style="color: ${color}">
                    ${sign}${t.amount} ${t.asset}
                    ${t.fee > 0 ? `<div class="transfer-fee">fee: ${t.fee}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}
