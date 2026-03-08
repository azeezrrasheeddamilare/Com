function showLogin() {
    document.querySelectorAll('.toggle button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.toggle button')[0].classList.add('active');
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}
function showRegister() {
    document.querySelectorAll('.toggle button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.toggle button')[1].classList.add('active');
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    window.showLoading();
    try {
        const data = await API.login(email, password);
        localStorage.setItem('token', data.token);
        window.currentUser = data.user;
        window.renderDashboard();
    } catch (err) { alert(err.message); }
    finally { window.hideLoading(); }
}
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const phone = document.getElementById('register-phone').value;
    window.showLoading();
    try {
        const data = await API.register(email, username, password, phone);
        localStorage.setItem('token', data.token);
        window.currentUser = data.user;
        window.renderDashboard();
    } catch (err) { alert(err.message); }
    finally { window.hideLoading(); }
}
window.showLogin = showLogin;
window.showRegister = showRegister;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
