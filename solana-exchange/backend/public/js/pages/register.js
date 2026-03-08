// Register Page
const RegisterPage = {
    async render(container) {
        container.innerHTML = `
            <div class="container">
                <div class="card">
                    <h1 class="text-center">◎ Solana Exchange</h1>
                    
                    <div class="tab-nav" style="margin-top: 20px;">
                        <button class="tab-btn" id="login-tab">Login</button>
                        <button class="tab-btn active" id="register-tab">Register</button>
                    </div>
                    
                    <form id="register-form">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="email" required>
                        </div>
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" id="username" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="password" required>
                        </div>
                        <div class="form-group">
                            <label>Phone (optional)</label>
                            <input type="tel" id="phone">
                        </div>
                        <button type="submit" class="btn btn-primary">Register</button>
                    </form>
                </div>
            </div>
        `;

        // Tab switching
        document.getElementById('login-tab').addEventListener('click', () => {
            Router.goTo('login');
        });

        // Form submit
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const phone = document.getElementById('phone').value;

            try {
                Utils.showLoading();
                const data = await API.auth.register(email, username, password, phone);
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
window.Pages.register = RegisterPage;
