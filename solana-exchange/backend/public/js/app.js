// Main Application
const App = {
    user: null,
    currentPage: 'dashboard',
    
    init: async function() {
        console.log('🚀 Starting Solana Exchange...');
        this.setupEventListeners();
        await this.checkAuth();
    },
    
    setupEventListeners: function() {
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('user-menu');
            const button = document.querySelector('.user-button');
            if (menu && button && !button.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
        
        // Mobile menu toggle
        window.toggleMobileMenu = () => {
            document.getElementById('mobile-menu').classList.toggle('active');
        };
    },
    
    checkAuth: async function() {
        const token = localStorage.getItem('token');
        this.showLoading();
        
        if (token) {
            try {
                const res = await fetch('/api/auth/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.user) {
                    this.user = data.user;
                    await this.loadDashboard();
                    this.hideLoading();
                    return;
                }
            } catch (err) {
                localStorage.removeItem('token');
            }
        }
        
        this.showAuth();
        this.hideLoading();
    },
    
    showLoading: function() {
        document.getElementById('loading').style.display = 'flex';
    },
    
    hideLoading: function() {
        document.getElementById('loading').style.display = 'none';
    },
    
    showNotification: function(type, message) {
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
    
    showAuth: function() {
        document.getElementById('app').innerHTML = `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-card">
                        <div class="auth-header">
                            <div class="auth-title">◎ Solana Exchange</div>
                            <div class="auth-subtitle">Secure. Fast. Reliable.</div>
                        </div>
                        
                        <div class="tabs" style="display: flex; gap: 10px; margin-bottom: 30px;">
                            <button class="tab-btn active" style="flex:1; padding: 12px;" onclick="App.showLoginForm()">Login</button>
                            <button class="tab-btn" style="flex:1; padding: 12px;" onclick="App.showRegisterForm()">Register</button>
                        </div>
                        
                        <div id="auth-form">
                            <div class="form-group">
                                <input type="email" id="email" placeholder="Email" value="alice@example.com">
                            </div>
                            <div class="form-group">
                                <input type="password" id="password" placeholder="Password" value="password">
                            </div>
                            <button class="btn btn-primary" onclick="App.login()">Login</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    showLoginForm: function() {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.remove('active');
        document.getElementById('auth-form').innerHTML = `
            <div class="form-group">
                <input type="email" id="email" placeholder="Email" value="alice@example.com">
            </div>
            <div class="form-group">
                <input type="password" id="password" placeholder="Password" value="password">
            </div>
            <button class="btn btn-primary" onclick="App.login()">Login</button>
        `;
    },
    
    showRegisterForm: function() {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.querySelectorAll('.tab-btn')[0].classList.remove('active');
        document.getElementById('auth-form').innerHTML = `
            <div class="form-group">
                <input type="email" id="reg-email" placeholder="Email">
            </div>
            <div class="form-group">
                <input type="text" id="reg-username" placeholder="Username">
            </div>
            <div class="form-group">
                <input type="password" id="reg-password" placeholder="Password">
            </div>
            <button class="btn btn-primary" onclick="App.register()">Register</button>
        `;
    },
    
    login: async function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        this.showLoading();
        
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', email, password })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('token', data.token);
                this.user = data.user;
                await this.loadDashboard();
            } else {
                this.showNotification('error', data.error);
            }
        } catch (err) {
            this.showNotification('error', 'Login failed');
        } finally {
            this.hideLoading();
        }
    },
    
    register: async function() {
        const email = document.getElementById('reg-email').value;
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        
        this.showLoading();
        
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', email, username, password })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('token', data.token);
                this.user = data.user;
                await this.loadDashboard();
            } else {
                this.showNotification('error', data.error);
            }
        } catch (err) {
            this.showNotification('error', 'Registration failed');
        } finally {
            this.hideLoading();
        }
    },
    
    loadDashboard: async function() {
        try {
            const res = await fetch(`/api/user/${this.user.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            this.user = { ...this.user, ...data };
        } catch (err) {}
        
        const isAdmin = this.user.username === 'alice' || this.user.is_admin;
        
        document.getElementById('app').innerHTML = `
            <div class="app">
                <!-- Header -->
                <header class="header">
                    <div class="header-content">
                        <a href="/" class="logo">
                            <span class="logo-icon">◎</span>
                            <span class="logo-text">SolanaX</span>
                        </a>
                        
                        <nav class="nav-desktop">
                            <a href="#" class="nav-link active" onclick="App.navigate('dashboard')">
                                <span>📊</span> Dashboard
                            </a>
                            <a href="#" class="nav-link" onclick="App.navigate('transfer')">
                                <span>↔️</span> Transfer
                            </a>
                            <a href="#" class="nav-link" onclick="App.navigate('withdraw')">
                                <span>📤</span> Withdraw
                            </a>
                            <a href="#" class="nav-link" onclick="App.navigate('history')">
                                <span>📜</span> History
                            </a>
                        </nav>
                        
                        <div class="user-menu" id="user-menu">
                            <div class="user-button" onclick="this.closest('.user-menu').classList.toggle('active')">
                                <div class="user-avatar">${this.user.username[0].toUpperCase()}</div>
                                <span class="user-name">${this.user.username}</span>
                                <span class="dropdown-icon">▼</span>
                            </div>
                            
                            <div class="dropdown-menu">
                                ${isAdmin ? `
                                    <div class="dropdown-item" onclick="App.goToAdmin()">
                                        <span>👑</span> Admin Panel
                                    </div>
                                ` : ''}
                                <div class="dropdown-item logout" onclick="App.logout()">
                                    <span>🚪</span> Logout
                                </div>
                            </div>
                        </div>
                        
                        <button class="mobile-menu-btn" onclick="toggleMobileMenu()">☰</button>
                    </div>
                    
                    <div class="mobile-menu" id="mobile-menu">
                        <a href="#" class="mobile-nav-link" onclick="App.navigate('dashboard'); toggleMobileMenu()">
                            <span>📊</span> Dashboard
                        </a>
                        <a href="#" class="mobile-nav-link" onclick="App.navigate('transfer'); toggleMobileMenu()">
                            <span>↔️</span> Transfer
                        </a>
                        <a href="#" class="mobile-nav-link" onclick="App.navigate('withdraw'); toggleMobileMenu()">
                            <span>📤</span> Withdraw
                        </a>
                        <a href="#" class="mobile-nav-link" onclick="App.navigate('history'); toggleMobileMenu()">
                            <span>📜</span> History
                        </a>
                        ${isAdmin ? `
                            <a href="#" class="mobile-nav-link" onclick="App.goToAdmin(); toggleMobileMenu()">
                                <span>👑</span> Admin Panel
                            </a>
                        ` : ''}
                        <a href="#" class="mobile-nav-link" onclick="App.logout()">
                            <span>🚪</span> Logout
                        </a>
                    </div>
                </header>
                
                <!-- Main Content -->
                <main class="main-content">
                    <div class="container">
                        <div id="page-content"></div>
                    </div>
                </main>
                
                <!-- Footer -->
                <footer class="footer">
                    <div class="footer-content">
                        <div class="footer-section">
                            <h3>About</h3>
                            <p>SolanaX is a secure and reliable cryptocurrency exchange built on Solana blockchain.</p>
                        </div>
                        <div class="footer-section">
                            <h3>Quick Links</h3>
                            <a href="#" onclick="App.navigate('dashboard')">Dashboard</a>
                            <a href="#" onclick="App.navigate('transfer')">Transfer</a>
                            <a href="#" onclick="App.navigate('withdraw')">Withdraw</a>
                            <a href="#" onclick="App.navigate('history')">History</a>
                        </div>
                        <div class="footer-section">
                            <h3>Support</h3>
                            <a href="#">Help Center</a>
                            <a href="#">Contact Us</a>
                            <a href="#">Terms of Service</a>
                        </div>
                    </div>
                    <div class="footer-bottom">
                        © 2026 SolanaX. All rights reserved.
                    </div>
                </footer>
            </div>
        `;
        
        await this.navigate('dashboard');
    },
    
    navigate: async function(page) {
        this.currentPage = page;
        
        // Update active nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelectorAll('.nav-link')[['dashboard','transfer','withdraw','history'].indexOf(page)].classList.add('active');
        
        const content = document.getElementById('page-content');
        
        switch(page) {
            case 'dashboard':
                await this.showDashboard(content);
                break;
            case 'transfer':
                await this.showTransfer(content);
                break;
            case 'withdraw':
                await this.showWithdraw(content);
                break;
            case 'history':
                await this.showHistory(content);
                break;
        }
    },
    
    showDashboard: async function(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <p class="page-description">Welcome back, ${this.user.username}!</p>
            </div>
            
            <div class="balance-grid">
                <div class="balance-card sol" onclick="App.navigate('withdraw')">
                    <div class="balance-icon">◎</div>
                    <div class="balance-label">SOL Balance</div>
                    <div class="balance-amount" id="sol-balance">${(this.user.sol_balance || 0).toFixed(4)}</div>
                    <div class="balance-usd" id="sol-usd">$${((this.user.sol_balance || 0) * 100).toFixed(2)}</div>
                </div>
                
                <div class="balance-card usdc" onclick="App.navigate('withdraw')">
                    <div class="balance-icon">💵</div>
                    <div class="balance-label">USDC Balance</div>
                    <div class="balance-amount" id="usdc-balance">${(this.user.usdc_balance || 0).toFixed(2)}</div>
                    <div class="balance-usd" id="usdc-usd">$${(this.user.usdc_balance || 0).toFixed(2)}</div>
                </div>
            </div>
            
            <div class="address-card">
                <div class="address-label">Your Deposit Address</div>
                <div class="address-container">
                    <code class="address-code">${this.user.deposit_address || 'Loading...'}</code>
                    <button class="copy-btn" onclick="App.copyAddress('${this.user.deposit_address}')">Copy</button>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <div class="stat-label">Portfolio Value</div>
                        <div class="stat-value" id="portfolio-value">
                            $${(((this.user.sol_balance || 0) * 100) + (this.user.usdc_balance || 0)).toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.startBalanceRefresh();
    },
    
    showTransfer: async function(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Transfer</h1>
                <p class="page-description">Send funds to another user</p>
            </div>
            
            <div class="card">
                <form id="transfer-form" onsubmit="App.handleTransfer(event)">
                    <div class="form-group">
                        <label>Recipient Username</label>
                        <input type="text" id="transfer-username" placeholder="@username" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Amount</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="number" id="transfer-amount" step="0.001" min="0.001" placeholder="0.00" style="flex:2;" required>
                            <select id="transfer-asset" style="flex:1;">
                                <option value="SOL">SOL</option>
                                <option value="USDC">USDC</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Memo (optional)</label>
                        <input type="text" id="transfer-memo" placeholder="What's this for?">
                    </div>
                    
                    <div class="info-box">
                        <div class="info-row">
                            <span>Fee (0.1%):</span>
                            <span id="transfer-fee">0</span>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Send Transfer</button>
                </form>
            </div>
        `;
        
        document.getElementById('transfer-amount').addEventListener('input', () => {
            const amount = parseFloat(document.getElementById('transfer-amount').value) || 0;
            document.getElementById('transfer-fee').textContent = (amount * 0.001).toFixed(4);
        });
    },
    
    showWithdraw: async function(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Withdraw</h1>
                <p class="page-description">Withdraw funds to external wallet</p>
            </div>
            
            <div class="card">
                <div class="asset-selector">
                    <button class="asset-btn active" onclick="App.selectAsset('SOL')">◎ SOL</button>
                    <button class="asset-btn" onclick="App.selectAsset('USDC')">💵 USDC</button>
                </div>
                
                <form id="withdraw-form" onsubmit="App.handleWithdraw(event)">
                    <div class="form-group">
                        <label>Amount (<span id="withdraw-asset">SOL</span>)</label>
                        <input type="number" id="withdraw-amount" step="0.001" min="0.001" placeholder="0.00" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Destination Address</label>
                        <input type="text" id="withdraw-address" placeholder="Enter Solana address" required>
                    </div>
                    
                    <div class="info-box">
                        <div class="info-row">
                            <span>Available:</span>
                            <span id="withdraw-available">${(this.user.sol_balance || 0).toFixed(4)} SOL</span>
                        </div>
                        <div class="info-row">
                            <span>Fee (0.1%):</span>
                            <span id="withdraw-fee">0</span>
                        </div>
                        <div class="info-row total">
                            <span>You receive:</span>
                            <span id="withdraw-receive">0</span>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Withdraw</button>
                </form>
            </div>
        `;
        
        document.getElementById('withdraw-amount').addEventListener('input', () => {
            const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;
            const fee = amount * 0.001;
            document.getElementById('withdraw-fee').textContent = fee.toFixed(4);
            document.getElementById('withdraw-receive').textContent = (amount - fee).toFixed(4);
        });
    },
    
    showHistory: async function(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">History</h1>
                <p class="page-description">Your transaction history</p>
            </div>
            
            <div class="card">
                <div id="transaction-list" class="transaction-list">
                    <div class="text-center" style="padding: 40px;">
                        <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto 20px;"></div>
                        <p>Loading transactions...</p>
                    </div>
                </div>
            </div>
        `;
        
        this.loadTransactions();
    },
    
    selectAsset: function(asset) {
        document.querySelectorAll('.asset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.asset-btn[onclick*="${asset}"]`).classList.add('active');
        document.getElementById('withdraw-asset').textContent = asset;
        
        const balance = asset === 'SOL' ? this.user.sol_balance : this.user.usdc_balance;
        document.getElementById('withdraw-available').textContent = `${(balance || 0).toFixed(4)} ${asset}`;
    },
    
    handleWithdraw: async function(e) {
        e.preventDefault();
        
        const asset = document.getElementById('withdraw-asset').textContent;
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const address = document.getElementById('withdraw-address').value;
        
        if (!amount || amount <= 0) {
            this.showNotification('error', 'Invalid amount');
            return;
        }
        
        if (!address) {
            this.showNotification('error', 'Address required');
            return;
        }
        
        this.showLoading();
        
        try {
            const endpoint = asset === 'SOL' ? '/api/withdraw/sol' : '/api/withdraw/usdc';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ amount, toAddress: address })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                this.showNotification('success', `Withdrawal request created`);
                setTimeout(() => this.navigate('history'), 2000);
            } else {
                this.showNotification('error', data.error);
            }
        } catch (err) {
            this.showNotification('error', 'Withdrawal failed');
        } finally {
            this.hideLoading();
        }
    },
    
    handleTransfer: async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('transfer-username').value;
        const amount = parseFloat(document.getElementById('transfer-amount').value);
        const asset = document.getElementById('transfer-asset').value;
        const memo = document.getElementById('transfer-memo').value;
        
        if (!username || !amount || amount <= 0) {
            this.showNotification('error', 'Invalid input');
            return;
        }
        
        this.showLoading();
        
        try {
            const res = await fetch('/api/transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ toUsername: username, asset, amount, memo })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                this.showNotification('success', `Sent ${amount} ${asset} to ${username}`);
                setTimeout(() => this.navigate('history'), 2000);
            } else {
                this.showNotification('error', data.error);
            }
        } catch (err) {
            this.showNotification('error', 'Transfer failed');
        } finally {
            this.hideLoading();
        }
    },
    
    loadTransactions: async function() {
        try {
            const res = await fetch('/api/transactions', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const transactions = await res.json();
            
            const container = document.getElementById('transaction-list');
            
            if (transactions.length === 0) {
                container.innerHTML = '<div class="text-center" style="padding: 40px;">No transactions yet</div>';
                return;
            }
            
            container.innerHTML = transactions.map(tx => {
                const date = new Date(tx.created_at).toLocaleDateString();
                const amount = tx.amount;
                const type = tx.type.includes('deposit') ? 'positive' : 'negative';
                const icon = tx.type.includes('deposit') ? '📥' : '📤';
                
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon">${icon}</div>
                        <div class="transaction-details">
                            <div class="transaction-type">${tx.type.toUpperCase()} · ${tx.asset}</div>
                            <div class="transaction-time">${date}</div>
                        </div>
                        <div class="transaction-amount ${type}">
                            ${type === 'positive' ? '+' : '-'}${amount} ${tx.asset}
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (err) {
            console.error('Failed to load transactions:', err);
        }
    },
    
    startBalanceRefresh: function() {
        setInterval(async () => {
            try {
                const res = await fetch(`/api/user/${this.user.id}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                
                document.getElementById('sol-balance').textContent = data.sol_balance.toFixed(4);
                document.getElementById('usdc-balance').textContent = data.usdc_balance.toFixed(2);
                document.getElementById('sol-usd').textContent = `$${(data.sol_balance * 100).toFixed(2)}`;
                document.getElementById('usdc-usd').textContent = `$${data.usdc_balance.toFixed(2)}`;
                
                const portfolio = (data.sol_balance * 100) + data.usdc_balance;
                document.getElementById('portfolio-value').textContent = `$${portfolio.toFixed(2)}`;
            } catch (err) {}
        }, 10000);
    },
    
    copyAddress: async function(address) {
        await navigator.clipboard.writeText(address);
        this.showNotification('success', 'Address copied!');
    },
    
    goToAdmin: function() {
        window.location.href = '/admin-ultimate.html';
    },
    
    logout: function() {
        localStorage.removeItem('token');
        window.location.reload();
    }
};

// Initialize app
window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
