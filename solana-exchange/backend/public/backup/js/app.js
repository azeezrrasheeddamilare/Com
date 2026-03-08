// Simple test app.js
console.log('✅ app.js loaded');

// Import test
import { showNotification } from './services/notifications.js';

// Simple render function
function renderTest() {
    document.getElementById('app').innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <h1 style="color: white;">Solana Exchange</h1>
            <p style="color: white;">Loading...</p>
        </div>
    `;
}

// Try to show notification
try {
    showNotification('success', 'App loaded!');
} catch (e) {
    console.error('Notification error:', e);
}

// Check auth status
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);

if (token) {
    // Try to verify token
    fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        console.log('Auth response:', data);
        if (data.user) {
            renderTest();
        }
    })
    .catch(err => {
        console.error('Auth error:', err);
        renderTest();
    });
} else {
    renderTest();
}

// Hide loading
document.getElementById('loading').style.display = 'none';
