// Withdraw Page
const WithdrawPage = {
    user: null,
    asset: 'SOL',

    async render(container, user, asset = 'SOL') {
        this.user = user;
        this.asset = asset;

        container.innerHTML = `
            <div class="card page">
                ${Components.header(this.user, 'withdraw')}
                
                <h2 class="page-title">Withdraw Funds</h2>
                
                ${Components.assetSelector(this.asset)}
                
                <form id="withdraw-form">
                    <div class="form-group">
                        <label>Amount (${this.asset})</label>
                        <input type="number" id="amount" step="0.001" min="0.001" placeholder="0.00" required oninput="Pages.withdraw.updateFee()">
                    </div>
                    
                    <div class="form-group">
                        <label>Destination Address</label>
                        <input type="text" id="address" placeholder="Enter Solana address" required>
                    </div>
                    
                    <div id="withdraw-info-container">
                        ${Components.withdrawInfo(
                            this.asset, 
                            this.asset === 'SOL' ? this.user.solBalance : this.user.usdcBalance,
                            0
                        )}
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Withdraw</button>
                </form>
            </div>
        `;

        // Add form handler
        document.getElementById('withdraw-form').addEventListener('submit', this.handleSubmit.bind(this));
    },

    selectAsset(asset) {
        this.asset = asset;
        const container = document.getElementById('app');
        this.render(container, this.user, asset);
    },

    updateFee() {
        const amount = parseFloat(document.getElementById('amount').value) || 0;
        const available = this.asset === 'SOL' ? this.user.solBalance : this.user.usdcBalance;
        
        document.getElementById('withdraw-info-container').innerHTML = 
            Components.withdrawInfo(this.asset, available, amount);
    },

    async handleSubmit(e) {
        e.preventDefault();
        
        const amount = parseFloat(document.getElementById('amount').value);
        const address = document.getElementById('address').value;

        // Validate
        if (amount > (this.asset === 'SOL' ? this.user.solBalance : this.user.usdcBalance)) {
            Utils.showNotification('error', 'Insufficient balance');
            return;
        }

        try {
            Utils.showLoading();
            
            const withdrawFn = this.asset === 'SOL' ? API.withdraw.sol : API.withdraw.usdc;
            await withdrawFn(amount, address);
            
            Utils.showNotification('success', 'Withdrawal request created!');
            
            // Refresh user data
            const freshUser = await API.user.get(this.user.id);
            this.user = { ...this.user, ...freshUser };
            
            // Go back to dashboard
            Router.goTo('dashboard', { user: this.user });
            
        } catch (error) {
            Utils.handleError(error);
        } finally {
            Utils.hideLoading();
        }
    }
};

window.Pages = window.Pages || {};
window.Pages.withdraw = WithdrawPage;
