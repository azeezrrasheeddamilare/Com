// Simple Router
const Router = {
    currentPage: null,
    container: document.getElementById('app'),

    // Navigate to page
    async goTo(page, data = {}) {
        console.log('Navigating to:', page, data);
        Utils.showLoading();
        
        try {
            // Hide all pages
            if (this.currentPage) {
                // Cleanup current page if needed
                if (this.currentPage === 'dashboard' && Pages.dashboard.cleanup) {
                    Pages.dashboard.cleanup();
                }
            }

            // Load new page
            switch(page) {
                case 'login':
                    await Pages.login.render(this.container);
                    break;
                case 'register':
                    await Pages.register.render(this.container);
                    break;
                case 'dashboard':
                    await Pages.dashboard.render(this.container, data.user);
                    break;
                case 'withdraw':
                    await Pages.withdraw.render(this.container, data.user, data.asset);
                    break;
                case 'transfer':
                    await Pages.transfer.render(this.container, data.user);
                    break;
                case 'history':
                    await Pages.history.render(this.container, data.user);
                    break;
                default:
                    await Pages.login.render(this.container);
            }

            this.currentPage = page;
            
            // Update URL hash (optional)
            window.location.hash = page;
            
        } catch (error) {
            console.error('Navigation error:', error);
            Utils.handleError(error);
        } finally {
            Utils.hideLoading();
        }
    },

    // Initialize
    init() {
        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            if (event.state) {
                this.goTo(event.state.page, event.state.data);
            }
        });

        // Check initial hash
        const hash = window.location.hash.slice(1);
        if (hash && Auth.isAuthenticated()) {
            // Get user and navigate to hash page
            Auth.getCurrentUser().then(user => {
                if (user) {
                    this.goTo(hash, { user });
                }
            });
        }
    },

    // Push state
    push(page, data = {}) {
        history.pushState({ page, data }, '', `#${page}`);
    }
};

window.Router = Router;

// Check if user is admin and redirect to admin if needed
const originalInit = Router.init;
Router.init = function() {
    originalInit.call(this);
    
    // Check for admin hash
    if (window.location.hash === '#admin') {
        Auth.getCurrentUser().then(user => {
            if (user) {
                // Check if user is admin
                fetch('/api/admin/stats', {
                    headers: { 'Authorization': `Bearer ${API.getToken()}` }
                })
                .then(res => {
                    if (res.ok) {
                        Router.goTo('admin', { user });
                    }
                })
                .catch(() => {});
            }
        });
    }
};
