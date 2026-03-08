// Withdrawal API calls
export async function withdrawSOL(amount, toAddress) {
    const res = await fetch('/api/withdraw/sol', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount, toAddress })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function withdrawUSDC(amount, toAddress) {
    const res = await fetch('/api/withdraw/usdc', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount, toAddress })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}
