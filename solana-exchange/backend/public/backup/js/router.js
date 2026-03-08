import { renderDashboard } from './pages/Dashboard.js';
import { renderTransfer } from './pages/Transfer.js';
import { renderWithdraw } from './pages/Withdraw.js';
import { renderHistory } from './pages/History.js';

export class Router {
    constructor(container, user) {
        this.container = container;
        this.user = user;
        this.currentTab = 'dashboard';
    }
    
    async navigate(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tab-button[data-tab="${tab}"]`).classList.add('active');
        
        // Render page
        switch(tab) {
            case 'dashboard':
                await renderDashboard(this.container, this.user, this.navigate.bind(this));
                break;
            case 'transfer':
                await renderTransfer(this.container, this.user);
                break;
            case 'withdraw':
                renderWithdraw(this.container, this.user);
                break;
            case 'history':
                await renderHistory(this.container);
                break;
        }
    }
}
