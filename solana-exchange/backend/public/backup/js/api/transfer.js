// Transfer API calls
export async function sendTransfer(toUsername, asset, amount, memo) {
    const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ toUsername, asset, amount, memo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function getTransfers() {
    const res = await fetch('/api/transfer/history', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}
