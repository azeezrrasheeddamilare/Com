// Auth API calls
export async function login(email, password) {
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function register(email, username, password, phone) {
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email, username, password, phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function verifyToken() {
    const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}
