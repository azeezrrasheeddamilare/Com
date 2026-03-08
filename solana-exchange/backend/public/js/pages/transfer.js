// Transfer Page
const TransferPage = {
    user: null,

    async render(container, user) {
        this.user = user;

        container.innerHTML = `
            <div class="card page">
                ${Components.header(this.user, 'transfer')}
                
                <h2 class="page-title">Send to User</h2>
                
                <form id="transfer-form">
                    <div class="form-group">
                        <label>Recipient Username</label>
                        <input type="text" id="username" placeholder="@username" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Amount</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="number" id="amount" step="0.001" min="0.001" placeholder="0.00" style="flex: 2;" required>
                            <select id="asset" style="flex: 1; padding: 14px; border: 2px solid var(--border); border-radius: 12px;">
                                <option value="SOL">SOL</option>
                                <option value="USDC">USDC</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Memo (optional)</label>
                        <input type="text" id="memo" placeholder="What's this for?">
                    </div>
                    
                    <div class="withdraw-info">
                        <div class="info-row">
                            <span>Fee (0.1%):</span>
                            <span id="fee">0.0000</span>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Send</button>
                </form>
                
                <h3 style="margin: 30px 0 15px;">Recent Transfers</h3>
                <div id="transfer-list" class="transfer-list">
                    <div class="loading-spinner-small"></div>
                </div>
            </div>
        `;

        // Load transfer history
        this.loadTransferHistory();

        // Add fee calculator
        document.getElementById('amount').addEventListener('input', () => {
            const amount = parseFloat(document.getElementById('amount').value) || 0;
            const fee = Utils.calculateFee(amount);
            document.getElementById('fee').textContent = `${fee.toFixed(4)} ${document.getElementById('asset').value}`;
        });

        // Add form handler
        document.getElementById('transfer-form').addEventListener('submit', this.handleSubmit.bind(this));
    },

    async loadTransferHistory() {
        try {
            const transfers = await API.transfer.history();
            const container = document.getElementById('transfer-list');
            
            if (transfers.length === 0) {
                container.innerHTML = '<div class="empty-state">No transfers yet</div>';
                return;
            }

            container.innerHTML = transfers.map(t => {
                const isSender = t.sender_id === this.user.id;
                const sign = isSender ? '-' : '+';
                const color = isSender ? '#f59e0b' : '#10b981';
                
                return `
                    <div class="transfer-item" style="border-left-color: ${color}">
                        <div class="transfer-icon">${isSender ? '📤' : '📥'}</div>
                        <div class="transfer-details">
                            <div style="font-weight: 600;">
                                ${isSender ? 'To' : 'From'}: @${isSender ? t.receiver_name : t.sender_name}
                            </div>
                            <div class="transfer-memo">${t.memo || 'No memo'}</div>
                            <div class="transfer-time">${Utils.formatDateTime(t.created_at)}</div>
                        </div>
                        <div class="transfer-amount" style="color: ${color}">
                            ${sign}${t.amount} ${t.asset}
                            ${t.fee > 0 ? `<div class="transfer-fee">fee: ${t.fee}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Failed to load transfers:', error);
        }
    },

    async handleSubmit(e) {
        e.preventDefault();
        
        const toUsername = document.getElementById('username').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const asset = document.getElementById('asset').value;
        const memo = document.getElementById('memo').value;

        // Validate balance
        if (amount > (asset === 'SOL' ? this.user.solBalance : this.user.usdcBalance)) {
            Utils.showNotification('error', 'Insufficient balance');
            return;
        }

        try {
            Utils.showLoading();
            
            await API.transfer.send(toUsername, asset, amount, memo);
            
            Utils.showNotification('success', 'Transfer sent successfully!');
            
            // Reset form
            document.getElementById('username').value = '';
            document.getElementById('amount').value = '';
            document.getElementById('memo').value = '';
            
            // Refresh user data
            const freshUser = await API.user.get(this.user.id);
            this.user = { ...this.user, ...freshUser };
            
            // Refresh transfer history
            await this.loadTransferHistory();
            
        } catch (error) {
            Utils.handleError(error);
        } finally {
            Utils.hideLoading();
        }
    }
};

window.Pages = window.Pages || {};
window.Pages.transfer = TransferPage;
