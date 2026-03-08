// Auth Service
const Auth = {
    // Check if user is logged in
    isAuthenticated() {
        return !!API.getToken();
    },

    // Get current user from token
    async getCurrentUser() {
        try {
            const data = await API.auth.verify();
            return data.user;
        } catch (error) {
            console.error('Auth error:', error);
            this.logout();
            return null;
        }
    },

    // Logout
    logout() {
        console.log('Logging out...');
        API.removeToken();
        // Clear any intervals
        if (Pages.dashboard && Pages.dashboard.cleanup) {
            Pages.dashboard.cleanup();
        }
        Router.goTo('login');
    },

    // Initialize auth state
    async init() {
        console.log('Auth init...');
        if (!this.isAuthenticated()) {
            console.log('Not authenticated, going to login');
            Router.goTo('login');
            return;
        }

        try {
            const user = await this.getCurrentUser();
            if (user) {
                console.log('User authenticated:', user.username);
                Router.goTo('dashboard', { user });
            } else {
                console.log('No user, going to login');
                Router.goTo('login');
            }
        } catch (error) {
            console.error('Auth init error:', error);
            Router.goTo('login');
        }
    }
};

window.Auth = Auth;
