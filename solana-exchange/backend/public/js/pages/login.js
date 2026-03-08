// Login Page
const LoginPage = {
    async render(container) {
        container.innerHTML = `
            <div class="container">
                <div class="card">
                    <h1 class="text-center">◎ Solana Exchange</h1>
                    
                    <div class="tab-nav" style="margin-top: 20px;">
                        <button class="tab-btn active" id="login-tab">Login</button>
                        <button class="tab-btn" id="register-tab">Register</button>
                    </div>
                    
                    <form id="login-form">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="email" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="password" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Login</button>
                    </form>
                </div>
            </div>
        `;

        // Tab switching
        document.getElementById('register-tab').addEventListener('click', () => {
            Router.goTo('register');
        });

        // Form submit
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                Utils.showLoading();
                const data = await API.auth.login(email, password);
                API.setToken(data.token);
                await Router.goTo('dashboard', { user: data.user });
            } catch (error) {
                Utils.handleError(error);
            } finally {
                Utils.hideLoading();
            }
        });
    }
};

window.Pages = window.Pages || {};
window.Pages.login = LoginPage;
